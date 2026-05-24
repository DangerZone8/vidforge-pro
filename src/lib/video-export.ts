// Browser-only FFmpeg.wasm export pipeline. Lazy-loaded; never import server-side.
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

export type ExportClip = {
  id: string;
  url: string;
  name: string;
  start: number; // timeline position (s)
  duration: number; // length on timeline (s)
  sourceOffset?: number; // in-clip start (s) — defaults to 0
};

export type ExportOverlay = {
  text: string;
  start: number;
  duration: number;
  color: string;
};

export type ExportAdjustments = {
  brightness: number; // 0-200 (100 = neutral)
  contrast: number;
  saturation: number;
  blur: number; // 0-10
};

export type ExportOptions = {
  width: number;
  height: number;
  fps: number;
  // CRF: lower = higher quality. 18 high / 23 medium / 28 low.
  crf: number;
  clips: ExportClip[];
  overlays: ExportOverlay[];
  adjustments: ExportAdjustments;
  onProgress?: (pct: number, stage: string) => void;
};

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ff = new FFmpeg();
    if (onLog) ff.on("log", ({ message }) => onLog(message));
    // Single-threaded core — no SharedArrayBuffer / COOP-COEP required.
    const base = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
    await ff.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegInstance = ff;
    return ff;
  })();

  return loadPromise;
}

function escapeDrawtext(s: string) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%");
}

function buildFilterGraph(opts: ExportOptions): string {
  const { clips, overlays, adjustments, width, height } = opts;

  // Per-clip normalization: scale/pad to canvas, trim to in-clip range, reset PTS.
  const segs: string[] = [];
  clips.forEach((c, i) => {
    const off = c.sourceOffset ?? 0;
    segs.push(
      `[${i}:v]trim=start=${off}:duration=${c.duration},setpts=PTS-STARTPTS,` +
        `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=${opts.fps}[v${i}]`,
    );
  });

  // Concat all clips into a single video stream.
  const concatInputs = clips.map((_, i) => `[v${i}]`).join("");
  const concat = `${concatInputs}concat=n=${clips.length}:v=1:a=0[cv]`;

  // Color adjustments via eq + saturation handled in eq + optional gblur.
  // ffmpeg eq: brightness in [-1,1], contrast in [0,2] (1 neutral), saturation in [0,3] (1 neutral).
  const brightness = (adjustments.brightness - 100) / 100; // -1..1
  const contrast = adjustments.contrast / 100; // 0..2
  const saturation = adjustments.saturation / 100; // 0..2
  const eq = `[cv]eq=brightness=${brightness.toFixed(3)}:contrast=${contrast.toFixed(3)}:saturation=${saturation.toFixed(3)}[ce]`;

  let chain = `${eq}`;
  let lastTag = "ce";

  if (adjustments.blur > 0) {
    chain += `;[${lastTag}]gblur=sigma=${adjustments.blur}[cb]`;
    lastTag = "cb";
  }

  // Burn text overlays. Use a generic sans-serif via fontconfig fallback.
  if (overlays.length > 0) {
    let prev = lastTag;
    overlays.forEach((o, i) => {
      const out = `t${i}`;
      const txt = escapeDrawtext(o.text);
      const color = o.color.replace("#", "0x");
      chain +=
        `;[${prev}]drawtext=text='${txt}':fontcolor=${color}:fontsize=${Math.round(height / 14)}` +
        `:x=(w-text_w)/2:y=h-th-${Math.round(height / 8)}:borderw=3:bordercolor=black@0.7` +
        `:enable='between(t,${o.start},${o.start + o.duration})'[${out}]`;
      prev = out;
    });
    lastTag = prev;
  }

  // Audio: concat audio from clips if any tracks present; else generate silence.
  const audioParts: string[] = [];
  const audioInputs: string[] = [];
  clips.forEach((c, i) => {
    const off = c.sourceOffset ?? 0;
    audioParts.push(
      `[${i}:a]atrim=start=${off}:duration=${c.duration},asetpts=PTS-STARTPTS,aresample=async=1[a${i}]`,
    );
    audioInputs.push(`[a${i}]`);
  });
  const audioConcat = `${audioInputs.join("")}concat=n=${clips.length}:v=0:a=1[ca]`;

  return [
    ...segs,
    concat,
    chain,
    ...audioParts,
    audioConcat,
    `[${lastTag}]null[outv]`,
  ].join(";");
}

export async function exportVideo(opts: ExportOptions): Promise<Blob> {
  if (opts.clips.length === 0) throw new Error("Timeline is empty — add at least one clip");

  const ff = await getFFmpeg();
  const progress = opts.onProgress ?? (() => {});

  progress(2, "Preparing");

  // Clean any leftover files from previous export.
  try {
    const list = await ff.listDir("/");
    for (const f of list) {
      if (!f.isDir && (f.name.startsWith("in") || f.name === "out.mp4")) {
        try { await ff.deleteFile(f.name); } catch {}
      }
    }
  } catch {}

  // Stage 1: download all clip sources into the virtual FS.
  for (let i = 0; i < opts.clips.length; i++) {
    const c = opts.clips[i];
    const ext = c.name.split(".").pop()?.toLowerCase() || "mp4";
    const fname = `in${i}.${ext}`;
    progress(2 + (i / opts.clips.length) * 28, `Loading clip ${i + 1}/${opts.clips.length}`);
    const data = await fetchFile(c.url);
    await ff.writeFile(fname, data);
    // Track filename so we can reference it in args.
    (opts.clips[i] as any).__file = fname;
  }

  const inputArgs: string[] = [];
  opts.clips.forEach((c) => {
    inputArgs.push("-i", (c as any).__file);
  });

  const filter = buildFilterGraph(opts);

  const args: string[] = [
    ...inputArgs,
    "-filter_complex", filter,
    "-map", "[outv]",
    "-map", "[ca]",
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-crf", String(opts.crf),
    "-pix_fmt", "yuv420p",
    "-r", String(opts.fps),
    "-c:a", "aac",
    "-b:a", "192k",
    "-movflags", "+faststart",
    "out.mp4",
  ];

  // Hook ffmpeg progress (0..1 of total stream duration).
  const totalDur = opts.clips.reduce((acc, c) => acc + c.duration, 0);
  const onProg = ({ progress: p, time }: { progress: number; time: number }) => {
    // ffmpeg's `progress` is sometimes >1 or NaN — fall back to time / totalDur.
    let frac = p;
    if (!isFinite(frac) || frac <= 0 || frac > 1) {
      frac = totalDur > 0 ? Math.min(1, time / 1_000_000 / totalDur) : 0;
    }
    progress(30 + frac * 65, "Encoding");
  };
  ff.on("progress", onProg);

  try {
    await ff.exec(args);
  } finally {
    ff.off("progress", onProg);
  }

  progress(97, "Finalizing");
  const data = await ff.readFile("out.mp4");
  const blob = new Blob([data as Uint8Array], { type: "video/mp4" });

  // Cleanup virtual FS.
  for (let i = 0; i < opts.clips.length; i++) {
    try { await ff.deleteFile((opts.clips[i] as any).__file); } catch {}
  }
  try { await ff.deleteFile("out.mp4"); } catch {}

  progress(100, "Done");
  return blob;
}
