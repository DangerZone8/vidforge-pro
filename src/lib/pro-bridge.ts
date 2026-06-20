// Lightweight global bridge so pro panels (color grading, audio mixer,
// AI superpowers, motion & compositing) can read/write editor state
// without surgery on the 2000-line editor route.
//
// The editor publishes a snapshot + a few imperative setters on mount,
// and panels subscribe via useProBridge().

import { useSyncExternalStore } from "react";

export type ProClipPatch = Record<string, unknown>;

export type ProBridgeState = {
  selectedClipId: string | null;
  currentTime: number;
  totalDuration: number;
  clipIds: string[];
  audioClipIds: string[];
  // Extra CSS filter appended on top of base adjustments (color grade overlay).
  extraFilter: string;
  // Per-clip LUT data URL (PNG of a Hald CLUT) — applied via canvas overlay.
  lutByClip: Record<string, string | null>;
  // Mixer state (panels own these; engine reads master gain/analyser).
  master: { gain: number; muted: boolean };
  trackMix: Record<number, { gain: number; pan: number; muted: boolean; solo: boolean }>;
  // Compositing
  chromaKey: { enabled: boolean; color: string; threshold: number; smoothing: number } | null;
  // Markers/captions emitted by AI tools.
  captions: { id: string; start: number; end: number; text: string }[];
};

type Setters = {
  patchClip: (id: string, patch: ProClipPatch) => void;
  setSelected: (id: string | null) => void;
  seek: (t: number) => void;
  splitAt: (clipId: string, time: number) => void;
  addMarker: (time: number, label: string) => void;
  setExtraFilter: (css: string) => void;
  setLutForClip: (clipId: string, dataUrl: string | null) => void;
  setMaster: (m: Partial<ProBridgeState["master"]>) => void;
  setTrackMix: (track: number, m: Partial<ProBridgeState["trackMix"][number]>) => void;
  setChromaKey: (k: ProBridgeState["chromaKey"]) => void;
  setCaptions: (c: ProBridgeState["captions"]) => void;
};

const defaultState: ProBridgeState = {
  selectedClipId: null,
  currentTime: 0,
  totalDuration: 0,
  clipIds: [],
  audioClipIds: [],
  extraFilter: "",
  lutByClip: {},
  master: { gain: 1, muted: false },
  trackMix: {},
  chromaKey: null,
  captions: [],
};

let state: ProBridgeState = defaultState;
let setters: Setters = {
  patchClip: () => {},
  setSelected: () => {},
  seek: () => {},
  splitAt: () => {},
  addMarker: () => {},
  setExtraFilter: (css) => { state = { ...state, extraFilter: css }; emit(); },
  setLutForClip: (id, url) => { state = { ...state, lutByClip: { ...state.lutByClip, [id]: url } }; emit(); },
  setMaster: (m) => { state = { ...state, master: { ...state.master, ...m } }; emit(); },
  setTrackMix: (t, m) => { state = { ...state, trackMix: { ...state.trackMix, [t]: { ...{ gain: 1, pan: 0, muted: false, solo: false }, ...state.trackMix[t], ...m } } }; emit(); },
  setChromaKey: (k) => { state = { ...state, chromaKey: k }; emit(); },
  setCaptions: (c) => { state = { ...state, captions: c }; emit(); },
};

const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }

export const proBridge = {
  get state() { return state; },
  get setters() { return setters; },
  publishState(partial: Partial<ProBridgeState>) {
    state = { ...state, ...partial };
    emit();
  },
  publishSetters(s: Partial<Setters>) {
    setters = { ...setters, ...s };
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export function useProBridge() {
  return useSyncExternalStore(
    (cb) => proBridge.subscribe(cb),
    () => proBridge.state,
    () => proBridge.state,
  );
}
