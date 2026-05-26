import { createServerFn } from "@tanstack/react-start";
import { VFX_PRESETS } from "./vfx-presets";

// AI editing assistant — takes a free-form user prompt + the selected clip's
// current state, and returns a JSON edit instruction picking a VFX preset
// and (optionally) overriding adjustments / suggesting a sound effect.

export type AiEditResult = {
  presetId: string | null;
  adjustments?: Partial<{
    brightness: number; contrast: number; saturation: number; blur: number;
    hueRotate: number; sepia: number; grayscale: number;
  }>;
  bgRemove?: boolean;
  bgColor?: string | null;
  faceFilter?: string | null;
  soundQuery?: string | null;
  message: string;
};

export const runAiEdit = createServerFn({ method: "POST" })
  .inputValidator((data: { prompt: string; clipName?: string; hasFace?: boolean }) => data)
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const presetList = VFX_PRESETS.map((p) => `- ${p.id} (${p.category}): ${p.name} — ${p.description}`).join("\n");

    const system = `You are an AI video-editing assistant for CreatorCut. Given a user prompt describing a cinematic look or effect, choose ONE preset from the catalog and optionally fine-tune.

Available VFX presets:
${presetList}

Rules:
- Always pick the single best preset id from the list, or null if nothing fits.
- You may override numeric adjustments (brightness/contrast/saturation/blur 0-200, hueRotate -180..360, sepia/grayscale 0..1) to better match the prompt.
- If the prompt implies a sound (rain, thunder, explosion, magic, etc.), set soundQuery to a short search term.
- Keep "message" to one friendly sentence describing what you applied.`;

    const body = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Clip: "${data.clipName ?? "selected clip"}"\nPrompt: ${data.prompt}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "apply_edit",
          description: "Apply a cinematic edit to the selected clip",
          parameters: {
            type: "object",
            properties: {
              presetId: { type: "string", description: "VFX preset id from the catalog, or empty for none" },
              adjustments: {
                type: "object",
                properties: {
                  brightness: { type: "number" }, contrast: { type: "number" },
                  saturation: { type: "number" }, blur: { type: "number" },
                  hueRotate: { type: "number" }, sepia: { type: "number" }, grayscale: { type: "number" },
                },
                additionalProperties: false,
              },
              bgRemove: { type: "boolean" },
              bgColor: { type: "string", description: "Hex color for background, or empty" },
              faceFilter: { type: "string", description: "Face filter id (e.g. lens-glasses), or empty" },
              soundQuery: { type: "string", description: "Short sound-effect search term, or empty" },
              message: { type: "string" },
            },
            required: ["presetId", "message"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "apply_edit" } },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 429) throw new Error("Rate limit reached — try again in a moment.");
    if (res.status === 402) throw new Error("Out of AI credits — add funds in Settings > Workspace > Usage.");
    if (!res.ok) throw new Error(`AI gateway error (${res.status})`);
    const json = await res.json();
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) throw new Error("AI did not return an edit");
    const parsed = JSON.parse(call.function.arguments);

    const result: AiEditResult = {
      presetId: parsed.presetId && VFX_PRESETS.some((p) => p.id === parsed.presetId) ? parsed.presetId : null,
      adjustments: parsed.adjustments && Object.keys(parsed.adjustments).length ? parsed.adjustments : undefined,
      bgRemove: typeof parsed.bgRemove === "boolean" ? parsed.bgRemove : undefined,
      bgColor: parsed.bgColor || null,
      faceFilter: parsed.faceFilter || null,
      soundQuery: parsed.soundQuery || null,
      message: parsed.message || "Applied edit.",
    };
    return result;
  });
