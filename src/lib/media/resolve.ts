import "server-only";
import fs from "node:fs";
import path from "node:path";
import { imagePaths, media, videoPaths, type MediaEntry, type MediaKey } from "@/content/media";
import type { ResolvedImage, ResolvedMedia, ResolvedVideo } from "./types";

function exists(publicPath: string): boolean {
  return fs.existsSync(path.join(process.cwd(), "public", publicPath));
}

function resolveVideo(key: MediaKey, entry: MediaEntry): ResolvedVideo {
  const paths = videoPaths(entry.file);
  return {
    kind: "video",
    key,
    label: entry.label,
    raw: entry.raw,
    aspect: entry.aspect,
    available: exists(paths.mp4),
    seamless: entry.seamless ?? false,
    ...paths,
  };
}

function resolveImage(key: MediaKey, entry: MediaEntry): ResolvedImage {
  const paths = imagePaths(entry.file);
  return {
    kind: "image",
    key,
    label: entry.label,
    raw: entry.raw,
    aspect: entry.aspect,
    available: exists(paths.jpg),
    ...paths,
  };
}

/** Server-only: checks which manifest files exist so components can fall back to placeholders. */
export function resolveMedia(): ResolvedMedia {
  return {
    hero: resolveVideo("hero", media.hero),
    roofing: resolveVideo("roofing", media.roofing),
    siding: resolveVideo("siding", media.siding),
    windows: resolveVideo("windows", media.windows),
    gutters: resolveVideo("gutters", media.gutters),
    proofMorph: resolveVideo("proofMorph", media.proofMorph),
    proofBefore: resolveImage("proofBefore", media.proofBefore),
    proofAfter: resolveImage("proofAfter", media.proofAfter),
  };
}
