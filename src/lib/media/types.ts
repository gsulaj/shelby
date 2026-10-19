import type { MediaKey } from "@/content/media";

type Base = {
  key: MediaKey;
  label: string;
  raw: string;
  aspect: string;
  /** True once the processed file exists in /public/media. */
  available: boolean;
};

export type ResolvedVideo = Base & {
  kind: "video";
  webm: string;
  mp4: string;
  poster: string;
  /** Loop through SmartVideo's double buffer (from the manifest entry). */
  seamless: boolean;
};
export type ResolvedImage = Base & { kind: "image"; jpg: string; webp: string };

export type ResolvedMedia = {
  hero: ResolvedVideo;
  roofing: ResolvedVideo;
  siding: ResolvedVideo;
  windows: ResolvedVideo;
  gutters: ResolvedVideo;
  proofMorph: ResolvedVideo;
  proofBefore: ResolvedImage;
  proofAfter: ResolvedImage;
};
