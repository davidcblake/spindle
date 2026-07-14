/**
 * Generates Spindle's PNG app icons without native image deps.
 * Design: deep-blue gradient rounded square, white 8-point Liahona spindle
 * star, amber center — matches the in-app sign-in mark.
 * Run: node scripts/make-icons.mjs
 */
import { deflateSync } from "zlib";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ---------- minimal PNG encoder ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- drawing ---------- */
function starVertices(cx, cy, outer, inner, points = 8) {
  const verts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    verts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return verts;
}

function inPolygon(x, y, verts) {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const [xi, yi] = verts[i];
    const [xj, yj] = verts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function render(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const c = size / 2;
  // Maskable icons need the full canvas painted; regular icons get a rounded square.
  const cornerR = maskable ? 0 : size * 0.22;
  const star = starVertices(c, c, size * (maskable ? 0.3 : 0.36), size * (maskable ? 0.11 : 0.13));
  const dotR = size * 0.055;
  const SS = 3; // supersampling for smooth edges

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;

          // rounded-square alpha
          let inShape = true;
          if (!maskable) {
            const dx = Math.max(cornerR - px, px - (size - cornerR), 0);
            const dy = Math.max(cornerR - py, py - (size - cornerR), 0);
            inShape = dx * dx + dy * dy <= cornerR * cornerR;
          }
          if (!inShape) continue;

          // background: diagonal gradient #1d2f8f → #2b4bd7
          const t = (px + py) / (2 * size);
          let r = Math.round(0x1d + (0x2b - 0x1d) * t);
          let g = Math.round(0x2f + (0x4b - 0x2f) * t);
          let b = Math.round(0x8f + (0xd7 - 0x8f) * t);

          const dcx = px - c;
          const dcy = py - c;
          if (dcx * dcx + dcy * dcy <= dotR * dotR) {
            r = 0xe0; g = 0xa4; b = 0x28; // amber center
          } else if (inPolygon(px, py, star)) {
            r = 0xff; g = 0xff; b = 0xff; // white spindle star
          }

          rSum += r; gSum += g; bSum += b; aSum += 255;
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      const alpha = aSum / n;
      // premultiplied-looking edges: scale color by coverage
      const cov = alpha / 255 || 1;
      rgba[i] = Math.round(rSum / n / cov || 0);
      rgba[i + 1] = Math.round(gSum / n / cov || 0);
      rgba[i + 2] = Math.round(bSum / n / cov || 0);
      rgba[i + 3] = Math.round(alpha);
    }
  }
  return encodePNG(size, rgba);
}

mkdirSync(join(root, "public/icons"), { recursive: true });
writeFileSync(join(root, "public/icons/icon-192.png"), render(192));
writeFileSync(join(root, "public/icons/icon-512.png"), render(512));
writeFileSync(join(root, "public/icons/apple-touch-icon.png"), render(180, { maskable: true }));
writeFileSync(join(root, "public/icons/maskable-512.png"), render(512, { maskable: true }));
console.log("icons written to public/icons/");
