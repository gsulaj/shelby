// Single source of truth for every media path. Swapping in real footage or photos later is a
// one-file change here (plus dropping files into /assets-raw and running `npm run media`).

export type MediaKey =
  | "hero"
  | "roofing"
  | "siding"
  | "windows"
  | "gutters"
  | "proofBefore"
  | "proofAfter"
  | "proofMorph";

export type MediaKind = "video" | "image";

export type MediaEntry = {
  kind: MediaKind;
  /** Output basename inside /public/media (written by scripts/process-media.sh). */
  file: string;
  /** Exact raw filename expected in /assets-raw. */
  raw: string;
  /** CSS aspect-ratio value. */
  aspect: string;
  label: string;
  /**
   * Loop through SmartVideo's double buffer (two stacked elements) instead of the native `loop`. Set for a clip whose
   * native wrap held a frame longer than 84 ms (two 24 fps frames) in `node scripts/svc-wrap-check.mjs`.
   */
  seamless?: boolean;
};

export const media: Record<MediaKey, MediaEntry> = {
  hero: { kind: "video", file: "hero", raw: "hero-flyover.mp4", aspect: "16 / 9", label: "Hero flyover" },
  // Services v2 (2160×2160): every clip held a frame above 84 ms at a native wrap in at least one engine (roofing 85.2,
  // siding 84.4 and gutters 101.3 ms in Chrome, windows 86 ms in WebKit), so all four loop through the double buffer
  // (docs/STATUS.md section 13).
  roofing: { kind: "video", file: "roofing", raw: "svc-roofing.mp4", aspect: "1 / 1", label: "Roofing", seamless: true },
  siding: { kind: "video", file: "siding", raw: "svc-siding.mp4", aspect: "1 / 1", label: "Siding", seamless: true },
  windows: { kind: "video", file: "windows", raw: "svc-windows.mp4", aspect: "1 / 1", label: "Windows", seamless: true },
  gutters: { kind: "video", file: "gutters", raw: "svc-gutters.mp4", aspect: "1 / 1", label: "Gutters", seamless: true },
  proofBefore: { kind: "image", file: "proof-before", raw: "proof-before.jpg", aspect: "16 / 9", label: "Before" },
  proofAfter: { kind: "image", file: "proof-after", raw: "proof-after.jpg", aspect: "16 / 9", label: "After" },
  // Proof v2 (2560×1440): the native wrap held a frame for 85–86 ms in real Safari and WebKit (Chromium 83.4 ms), so it
  // loops through the double buffer too (docs/STATUS.md section 14).
  proofMorph: {
    kind: "video",
    file: "proof-morph",
    raw: "proof-morph.mp4",
    aspect: "16 / 9",
    label: "From storm-damaged to The Shelby Standard",
    seamless: true,
  },
};

export type ProofMode = "video" | "slider";

/** "video" plays the proofMorph clip; "slider" shows the draggable before/after comparison. */
export const proofMode: ProofMode = "video";

/**
 * Seconds into proof-morph.mp4 where the storm-damaged roof has dissolved halfway into the new one (the midpoint of the
 * in-place dissolve, PROOF_BRIEF.md v2). The proof frame's label reads "Before" until then and "After" from then to the
 * loop. Set from scripts/proof-finish.sh's report whenever the morph is re-cut.
 */
export const proofMorphSwitchAt = 4.0;

export const MEDIA_DIR = "/media";

export function videoPaths(file: string) {
  return {
    webm: `${MEDIA_DIR}/${file}.webm`,
    mp4: `${MEDIA_DIR}/${file}.mp4`,
    poster: `${MEDIA_DIR}/${file}-poster.jpg`,
  };
}

export function imagePaths(file: string) {
  return {
    jpg: `${MEDIA_DIR}/${file}.jpg`,
    webp: `${MEDIA_DIR}/${file}.webp`,
  };
}
