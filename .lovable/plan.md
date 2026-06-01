# CreatorCut Stabilization & Feature Plan

Doing all of this in one turn would produce broken code. Below is a realistic 4-phase plan. I'll execute Phase 1 immediately after you approve; Phases 2–4 each need their own turn so I can test as I go.

---

## Phase 1 — Stability (this turn)

Goal: app loads, auth works, sound library works, no "missing SUPABASE_*" error.

1. **Remove Google login entirely**
   - Delete OAuth button from `src/routes/login.tsx`.
   - Delete `src/routes/auth.callback.tsx` and its routeTree entry.
   - Keep only email + password sign-up / sign-in forms.
2. **Fix "Missing SUPABASE_URL/PUBLISHABLE_KEY" on live site**
   - Make `src/integrations/supabase/client.ts` resilient: fall back to hardcoded publishable URL/key (already public — `nwjpaiboqflpsfcuxvuo` / anon key) when `import.meta.env.VITE_*` are empty at build time. This stops the white-screen on createcut.lovable.app permanently.
3. **Fix sound library "Failed to fetch"**
   - SoundHelix URLs are blocked by CORS for `fetch()` + `decodeAudioData`. Switch the sound library to use the `<audio>` element directly (which has no CORS issue) for playback, and skip waveform extraction for remote-only sounds. Add a clear error toast on fetch failures.

## Phase 2 — Audio + Video playback (next turn)

1. On file add, show a dialog: **"Add as Video"** vs **"Add as Audio Only"**.
2. "Audio Only" extracts the audio track via MediaElementSource and places it on a dedicated audio track (no video render).
3. Multi-track sync: single `requestAnimationFrame` clock drives all `<video>` and `<audio>` elements; each clip seeks/plays/pauses based on the shared playhead.
4. "Mute original video audio" toggle per video clip.
5. Fix the no-sound-when-adding-second-video bug (caused by the second video being treated as a visual layer with muted audio).

## Phase 3 — Editing polish (next turn)

1. Reliable trim handles on each clip (drag left/right edges).
2. Split-at-playhead (`S` key) producing two independent clips.
3. Snap-to-playhead and snap-to-other-clips.
4. Undo/redo for trim and split.

## Phase 4 — Brush blur + better VFX (next turn)

1. **Brush blur**: overlay `<canvas>` over the preview; user paints a mask with mouse/touch; blur is composited only inside masked pixels using `ctx.filter = 'blur(Npx)'` + `globalCompositeOperation`. Mask is keyframable per clip.
2. **VFX library upgrade**: real particle systems (fire/smoke/sparks) via canvas, plus pre-rendered overlay assets (explosions, lens flares, neon glow) layered on the preview canvas. This is what "Marvel-level" realistically means in a browser editor — true CGI rendering isn't feasible client-side.
3. **AI Director improvements**: expand `runAiEdit` server fn to also return overlay layers (e.g., `{ overlay: "fire-loop", position, scale }`) so prompts like "add explosion behind dancer" compose particle overlays, color grade, and a sound effect together.

---

## Technical notes

- **Supabase env fix** is a code-side hardening of `client.ts`. The values it falls back to are the *publishable* anon key + URL, which are safe in client code (per the auto-generated client comments).
- **Sound library fix**: SoundHelix doesn't send `Access-Control-Allow-Origin`, so `fetch()` fails in browsers — that's the "Failed to fetch". `<audio src>` doesn't require CORS unless you read its buffer. We keep waveforms only for user-uploaded files, which already work.
- **Brush blur** must use a separate canvas layer composited each frame, not CSS `filter: blur()`, because CSS blur applies to the whole element.
- I will NOT touch `src/integrations/supabase/client.ts` directly (it's auto-generated). Instead I'll add a thin `client-safe.ts` wrapper that the rest of the app imports — only if Phase 1 still shows the error after a republish.

Reply **"go"** to start Phase 1, or tell me to reorder phases.