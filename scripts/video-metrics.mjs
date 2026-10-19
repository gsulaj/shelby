// Measurement helpers for the hero upscale shootout and the before/after check (docs/HERO_RESUME.md, sharpness pass).
// Everything is ffmpeg (ffmpeg-static) for decoding plus plain JS maths, so it runs without python or OpenCV.
//
// Conventions: frames are decoded to 8-bit YUV 4:4:4 in limited range after scaling the picture onto a common grid
// (`place` = the size the whole picture is scaled to and its offset in grid coordinates), so every candidate's crops cover
// the same scene content whatever its native size. Sharpness and temporal checks use the luma plane.
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import sharp from "sharp";

const require = createRequire(import.meta.url);
export const FF = process.env.FFMPEG || require("ffmpeg-static");

/** Size, fps, codec, pixel format, colour tags and decoded frame count of a video's first video stream. */
export function probe(path) {
  const r = spawnSync(FF, ["-hide_banner", "-i", path, "-map", "0:v:0", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 26 });
  const err = r.stderr;
  const line = err.split("\n").find((l) => /Stream #0:\d.*Video:/.test(l)) ?? "";
  const dims = line.match(/, (\d{2,5})x(\d{2,5})[ ,]/);
  const fps = line.match(/([\d.]+) fps/);
  const codec = line.match(/Video: (\w+)/);
  const pix = line.match(/Video: [^,]*?, (\w+)(?:\(([^)]*)\))?/);
  const frames = [...err.matchAll(/frame=\s*(\d+)/g)].pop();
  return {
    w: dims ? +dims[1] : NaN,
    h: dims ? +dims[2] : NaN,
    fps: fps ? +fps[1] : NaN,
    codec: codec?.[1],
    pixFmt: pix?.[1],
    tags: pix?.[2] ?? "",
    frames: frames ? +frames[1] : NaN,
  };
}

/** ffmpeg select expression for a sorted list of frame numbers (consecutive runs become between()). */
function selectExpr(sorted) {
  const parts = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(i === j ? `eq(n,${sorted[i]})` : `between(n,${sorted[i]},${sorted[j]})`);
    i = j + 1;
  }
  return parts.join("+");
}

/**
 * Decode `frames` of `path`, scale each picture to place.w×place.h and call onFrame(frameNumber, {y, u, v, w, h}) in order.
 * `pre` is an optional filter run before scaling (e.g. a crop that removes padding).
 */
export function grabFrames(path, frames, place, onFrame, { pre = "", flags = "lanczos" } = {}) {
  const sorted = [...new Set(frames)].sort((a, b) => a - b);
  const { w, h } = place;
  const vf = [`select='${selectExpr(sorted)}'`, pre, `scale=${w}:${h}:flags=${flags}:out_range=tv`, "format=yuv444p"]
    .filter(Boolean)
    .join(",");
  const plane = w * h;
  const size = plane * 3;
  return new Promise((resolve, reject) => {
    const p = spawn(FF, ["-hide_banner", "-loglevel", "error", "-i", path, "-vf", vf, "-fps_mode", "passthrough", "-f", "rawvideo", "pipe:1"]);
    let buf = Buffer.allocUnsafe(size);
    let fill = 0;
    let k = 0;
    let stderr = "";
    p.stderr.on("data", (d) => (stderr += d));
    p.stdout.on("data", (chunk) => {
      let off = 0;
      while (off < chunk.length) {
        const n = Math.min(size - fill, chunk.length - off);
        chunk.copy(buf, fill, off, off + n);
        fill += n;
        off += n;
        if (fill === size) {
          onFrame(sorted[k++], { y: buf.subarray(0, plane), u: buf.subarray(plane, 2 * plane), v: buf.subarray(2 * plane), w, h });
          buf = Buffer.allocUnsafe(size);
          fill = 0;
        }
      }
    });
    p.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg failed on ${path}: ${stderr}`));
      if (k !== sorted.length) return reject(new Error(`${path}: got ${k} of ${sorted.length} frames`));
      resolve();
    });
  });
}

/** Copy a rectangle (grid coordinates, shifted by the video's offset dx/dy) out of one plane as Float32. */
export function cropPlane(plane, W, H, x, y, cw, ch, dx = 0, dy = 0) {
  const out = new Float32Array(cw * ch);
  for (let r = 0; r < ch; r++) {
    const sy = Math.min(H - 1, Math.max(0, y + r - dy));
    for (let c = 0; c < cw; c++) {
      const sx = Math.min(W - 1, Math.max(0, x + c - dx));
      out[r * cw + c] = plane[sy * W + sx];
    }
  }
  return out;
}

/** Variance of the 4-neighbour Laplacian over the interior: the standard focus/sharpness measure. */
export function laplacianVariance(img, w, h) {
  let s = 0;
  let s2 = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l = img[i - w] + img[i + w] + img[i - 1] + img[i + 1] - 4 * img[i];
      s += l;
      s2 += l * l;
      n++;
    }
  }
  const m = s / n;
  return s2 / n - m * m;
}

export function mean(a) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return s / a.length;
}

/** Separable Gaussian blur with clamped edges. */
export function blur(src, w, h, sigma) {
  const r = Math.ceil(sigma * 3);
  const k = new Float32Array(2 * r + 1);
  let ks = 0;
  for (let i = -r; i <= r; i++) ks += k[i + r] = Math.exp((-i * i) / (2 * sigma * sigma));
  for (let i = 0; i < k.length; i++) k[i] /= ks;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += k[i + r] * src[y * w + Math.min(w - 1, Math.max(0, x + i))];
      tmp[y * w + x] = s;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += k[i + r] * tmp[Math.min(h - 1, Math.max(0, y + i)) * w + x];
      out[y * w + x] = s;
    }
  }
  return out;
}

/** img − blur(img, sigma): the fine-detail band (texture, granules, mortar lines). */
export function highpass(img, w, h, sigma = 2) {
  const b = blur(img, w, h, sigma);
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = img[i] - b[i];
  return out;
}

function ssd(a, b, w, tx, ty, ts, dx, dy) {
  let s = 0;
  for (let y = 0; y < ts; y++) {
    const ra = (ty + y) * w + tx;
    const rb = (ty + y + dy) * w + tx + dx;
    for (let x = 0; x < ts; x++) {
      const d = a[ra + x] - b[rb + x];
      s += d * d;
    }
  }
  return s;
}

function downsample(img, w, h, f) {
  const dw = Math.floor(w / f);
  const dh = Math.floor(h / f);
  const out = new Float32Array(dw * dh);
  for (let y = 0; y < dh; y++)
    for (let x = 0; x < dw; x++) {
      let s = 0;
      for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) s += img[(y * f + j) * w + x * f + i];
      out[y * dw + x] = s / (f * f);
    }
  return { img: out, w: dw, h: dh };
}

/** Parabolic sub-pixel refinement of an integer SSD minimum. */
function subpixel(cm, c0, cp) {
  const den = cm - 2 * c0 + cp;
  return den > 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (cm - cp)) / den)) : 0;
}

/** Integer search of tile (tx,ty,ts) of `a` inside `b` around (cx,cy) ± r, then sub-pixel; returns {dx, dy, edge}. */
export function matchTile(a, b, w, h, tile, cx, cy, r) {
  const { x: tx, y: ty, s: ts } = tile;
  let best = Infinity;
  let bx = 0;
  let by = 0;
  const cost = new Map();
  for (let dy = cy - r; dy <= cy + r; dy++)
    for (let dx = cx - r; dx <= cx + r; dx++) {
      if (tx + dx < 0 || ty + dy < 0 || tx + dx + ts > w || ty + dy + ts > h) continue;
      const c = ssd(a, b, w, tx, ty, ts, dx, dy);
      cost.set(`${dx},${dy}`, c);
      if (c < best) [best, bx, by] = [c, dx, dy];
    }
  const at = (dx, dy) => cost.get(`${dx},${dy}`) ?? (tx + dx >= 0 && ty + dy >= 0 && tx + dx + ts <= w && ty + dy + ts <= h ? ssd(a, b, w, tx, ty, ts, dx, dy) : best);
  const fx = subpixel(at(bx - 1, by), best, at(bx + 1, by));
  const fy = subpixel(at(bx, by - 1), best, at(bx, by + 1));
  const edge = Math.abs(bx - cx) === r || Math.abs(by - cy) === r;
  return { dx: bx + fx, dy: by + fy, edge };
}

/**
 * Per-tile motion from frame a to frame b (both w×h luma). The whole tiled area is matched first at 1/4 resolution
 * (± range), which a periodic texture such as brick cannot alias, then each tile is refined at full resolution within
 * ± local px of that global shift (parallax and zoom), then to sub-pixel.
 */
export function estimateMotion(a, b, w, h, tiles, range, local = 10) {
  const A = downsample(a, w, h, 4);
  const B = downsample(b, w, h, 4);
  const x0 = Math.min(...tiles.map((t) => t.x));
  const y0 = Math.min(...tiles.map((t) => t.y));
  const x1 = Math.max(...tiles.map((t) => t.x + t.s));
  const y1 = Math.max(...tiles.map((t) => t.y + t.s));
  // the global block is square-sized for matchTile: use the tiled area's top-left square (the tiled area is square here)
  const s = Math.min(x1 - x0, y1 - y0);
  let g;
  if (range > 96) {
    // long ranges: search at 1/16 resolution first, then refine at 1/4 (keeps fast camera passes affordable)
    const A16 = downsample(A.img, A.w, A.h, 4);
    const B16 = downsample(B.img, B.w, B.h, 4);
    const c = matchTile(A16.img, B16.img, A16.w, A16.h, { x: Math.floor(x0 / 16), y: Math.floor(y0 / 16), s: Math.floor(s / 16) }, 0, 0, Math.ceil(range / 16));
    g = matchTile(A.img, B.img, A.w, A.h, { x: x0 / 4, y: y0 / 4, s: s / 4 }, Math.round(c.dx * 4), Math.round(c.dy * 4), 3);
    g.edge = c.edge;
  } else {
    g = matchTile(A.img, B.img, A.w, A.h, { x: x0 / 4, y: y0 / 4, s: s / 4 }, 0, 0, Math.ceil(range / 4));
  }
  const gx = Math.round(g.dx * 4);
  const gy = Math.round(g.dy * 4);
  return tiles.map((t) => ({ ...matchTile(a, b, w, h, t, gx, gy, local), global: [gx, gy], globalEdge: g.edge }));
}

/** Least-squares affine motion d(x, y) = [[a, b, c], [d, e, f]]·[x, y, 1] from per-tile displacements (tile centres). */
export function fitAffine(tiles, motion) {
  const solve = (key) => {
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const b = [0, 0, 0];
    tiles.forEach((t, k) => {
      const v = [t.x + t.s / 2, t.y + t.s / 2, 1];
      for (let i = 0; i < 3; i++) {
        b[i] += v[i] * motion[k][key];
        for (let j = 0; j < 3; j++) A[i][j] += v[i] * v[j];
      }
    });
    for (let i = 0; i < 3; i++) {
      let p = i;
      for (let k = i + 1; k < 3; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k;
      [A[i], A[p]] = [A[p], A[i]];
      [b[i], b[p]] = [b[p], b[i]];
      for (let k = i + 1; k < 3; k++) {
        const f = A[k][i] / A[i][i];
        for (let j = i; j < 3; j++) A[k][j] -= f * A[i][j];
        b[k] -= f * b[i];
      }
    }
    const x = [0, 0, 0];
    for (let i = 2; i >= 0; i--) {
      let s = b[i];
      for (let j = i + 1; j < 3; j++) s -= A[i][j] * x[j];
      x[i] = s / A[i][i];
    }
    return x;
  };
  return [solve("dx"), solve("dy")];
}

/** A rigidly moved copy of img: out(q) = img(q − d(q)) for the affine motion d, bicubic. */
export function warpAffine(img, w, h, aff) {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = x - (aff[0][0] * x + aff[0][1] * y + aff[0][2]);
      const sy = y - (aff[1][0] * x + aff[1][1] * y + aff[1][2]);
      const ix = Math.floor(sx);
      const iy = Math.floor(sy);
      const wx = cubicW(sx - ix);
      const wy = cubicW(sy - iy);
      let s = 0;
      for (let j = 0; j < 4; j++) {
        const yy = Math.min(h - 1, Math.max(0, iy - 1 + j));
        let r = 0;
        for (let i = 0; i < 4; i++) r += wx[i] * img[yy * w + Math.min(w - 1, Math.max(0, ix - 1 + i))];
        s += wy[j] * r;
      }
      out[y * w + x] = s;
    }
  return out;
}

/**
 * Detail coherence between frames a and b (luma ya/yb, fine-detail bands hpa/hpb): per tile the motion is refined ± 2 px
 * around the given estimate and b's band is sampled back onto a's tile; returns 2Σab / (Σa² + Σb²).
 */
export function detailCoherence(ya, yb, hpa, hpb, w, h, tiles, motion) {
  let ab = 0;
  let aa = 0;
  let bb = 0;
  tiles.forEach((tile, k) => {
    const m = matchTile(ya, yb, w, h, tile, Math.round(motion[k].dx), Math.round(motion[k].dy), 2);
    const a = tileOf(hpa, w, tile);
    const b = sampleShifted(hpb, w, h, tile, m.dx, m.dy);
    for (let i = 0; i < a.length; i++) {
      ab += a[i] * b[i];
      aa += a[i] * a[i];
      bb += b[i] * b[i];
    }
  });
  return (2 * ab) / (aa + bb);
}

/** Catmull-Rom weights for fractional offset f. */
function cubicW(f) {
  const f2 = f * f;
  const f3 = f2 * f;
  return [-0.5 * f3 + f2 - 0.5 * f, 1.5 * f3 - 2.5 * f2 + 1, -1.5 * f3 + 2 * f2 + 0.5 * f, 0.5 * f3 - 0.5 * f2];
}

/** Sample tile-sized block of `img` at (tx+dx, ty+dy) with bicubic interpolation. */
export function sampleShifted(img, w, h, tile, dx, dy) {
  const { x: tx, y: ty, s: ts } = tile;
  const ix = Math.floor(dx);
  const iy = Math.floor(dy);
  const wx = cubicW(dx - ix);
  const wy = cubicW(dy - iy);
  const out = new Float32Array(ts * ts);
  for (let y = 0; y < ts; y++)
    for (let x = 0; x < ts; x++) {
      let s = 0;
      for (let j = 0; j < 4; j++) {
        const sy = Math.min(h - 1, Math.max(0, ty + y + iy - 1 + j));
        let row = 0;
        for (let i = 0; i < 4; i++) row += wx[i] * img[sy * w + Math.min(w - 1, Math.max(0, tx + x + ix - 1 + i))];
        s += wy[j] * row;
      }
      out[y * ts + x] = s;
    }
  return out;
}

/** Copy a tile out of an image. */
export function tileOf(img, w, tile) {
  const { x: tx, y: ty, s: ts } = tile;
  const out = new Float32Array(ts * ts);
  for (let y = 0; y < ts; y++) for (let x = 0; x < ts; x++) out[y * ts + x] = img[(ty + y) * w + tx + x];
  return out;
}

/** Map YUV 4:4:4 limited-range BT.709 crops to an RGB24 buffer for display. */
export function yuvToRgb(y, u, v) {
  const out = Buffer.alloc(y.length * 3);
  for (let i = 0; i < y.length; i++) {
    const Y = 1.164 * (y[i] - 16);
    const U = u[i] - 128;
    const V = v[i] - 128;
    out[3 * i] = Math.max(0, Math.min(255, Math.round(Y + 1.793 * V)));
    out[3 * i + 1] = Math.max(0, Math.min(255, Math.round(Y - 0.213 * U - 0.533 * V)));
    out[3 * i + 2] = Math.max(0, Math.min(255, Math.round(Y + 2.112 * U)));
  }
  return out;
}

/** Per-frame SSIM (luma and all) of `cand` scaled to sw×sh against `src` (already sw×sh). */
export function ssimSeries(src, cand, sw, sh, { candPre = "" } = {}) {
  const lavfi = `[0:v]format=yuv420p[s];[1:v]${candPre ? candPre + "," : ""}scale=${sw}:${sh}:flags=area,format=yuv420p[c];[s][c]ssim=stats_file=-`;
  const r = spawnSync(FF, ["-hide_banner", "-loglevel", "error", "-i", src, "-i", cand, "-lavfi", lavfi, "-f", "null", "-"], {
    encoding: "utf8",
    maxBuffer: 1 << 26,
  });
  return r.stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => ({ y: +l.match(/Y:([\d.]+)/)[1], all: +l.match(/All:([\d.]+)/)[1] }));
}

/** Binary structural edge maps (Gaussian σ then Canny) of `frames`, after scaling to sw×sh with area averaging. */
export async function edgeMaps(path, frames, sw, sh, { sigma = 2, low = 0.04, high = 0.1, pre = "" } = {}) {
  const sorted = [...new Set(frames)].sort((a, b) => a - b);
  const vf = [`select='${selectExpr(sorted)}'`, pre, `scale=${sw}:${sh}:flags=area`, "format=gray", `gblur=sigma=${sigma}`, `edgedetect=low=${low}:high=${high}`]
    .filter(Boolean)
    .join(",");
  const r = spawnSync(FF, ["-hide_banner", "-loglevel", "error", "-i", path, "-vf", vf, "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1"], {
    maxBuffer: sw * sh * sorted.length + 1024,
  });
  if (r.status !== 0) throw new Error(`edge maps failed for ${path}: ${r.stderr}`);
  const out = new Map();
  sorted.forEach((f, i) => out.set(f, r.stdout.subarray(i * sw * sh, (i + 1) * sw * sh)));
  return out;
}

function dilate(map, w, h, r) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!map[y * w + x]) continue;
      for (let j = -r; j <= r; j++)
        for (let i = -r; i <= r; i++) {
          const yy = y + j;
          const xx = x + i;
          if (yy >= 0 && yy < h && xx >= 0 && xx < w) out[yy * w + xx] = 1;
        }
    }
  return out;
}

/** Edge agreement within `tol` px: precision (candidate edges near a source edge), recall, F1; optional roi {x,y,w,h}. */
export function edgeF1(srcMap, candMap, w, h, tol = 2, roi = { x: 0, y: 0, w, h }) {
  const ds = dilate(srcMap, w, h, tol);
  const dc = dilate(candMap, w, h, tol);
  let nc = 0;
  let ns = 0;
  let pc = 0;
  let ps = 0;
  for (let y = roi.y; y < roi.y + roi.h; y++)
    for (let x = roi.x; x < roi.x + roi.w; x++) {
      const i = y * w + x;
      if (candMap[i]) {
        nc++;
        if (ds[i]) pc++;
      }
      if (srcMap[i]) {
        ns++;
        if (dc[i]) ps++;
      }
    }
  const precision = nc ? pc / nc : 1;
  const recall = ns ? ps / ns : 1;
  return { precision, recall, f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0, srcEdges: ns, candEdges: nc };
}

/** Escape text for SVG. */
export function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** A text label as a PNG buffer (for sharp composites). */
export async function textPng(lines, w, h, { size = 22, color = "#ECEAE6", bg = "#0F1216", weight = 400, mono = false, align = "start" } = {}) {
  const family = mono ? "Menlo, monospace" : "Helvetica Neue, Helvetica, Arial, sans-serif";
  const x = align === "middle" ? w / 2 : 12;
  const rows = (Array.isArray(lines) ? lines : [lines])
    .map((l, i) => {
      const t = typeof l === "string" ? { text: l } : l;
      return `<text x="${x}" y="${(i + 1) * size * 1.3}" text-anchor="${align}" font-family="${family}" font-size="${t.size ?? size}" font-weight="${t.weight ?? weight}" fill="${t.color ?? color}">${esc(t.text)}</text>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${bg}"/>${rows}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** RGB24 crop buffer → PNG buffer. */
export function rgbPng(rgb, w, h) {
  return sharp(rgb, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}
