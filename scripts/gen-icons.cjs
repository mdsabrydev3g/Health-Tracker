// Generates solid-color PNG icons with a white cross motif (no dependencies).
const zlib = require("node:zlib");
const fs = require("node:fs");
const path = require("node:path");

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function makeIcon(size) {
  const R = 29; // brand-600-ish blue
  const G = 111;
  const B = 240;
  const cx = size / 2;
  const cy = size / 2;
  const heart = size * 0.16; // white square with rounded look → simple cross
  const armW = size * 0.07;
  const armL = size * 0.28;

  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter none
    for (let x = 0; x < size; x++) {
      const i = y * (size * 4 + 1) + 1 + x * 4;
      // circle background
      const inCircle = (x - cx) ** 2 + (y - cy) ** 2 <= (size / 2 - size * 0.02) ** 2;
      // white cross
      const inCross =
        Math.abs(x - cx) <= armL && Math.abs(y - cy) <= armW
          ? true
          : Math.abs(y - cy) <= armL && Math.abs(x - cx) <= armW
            ? true
            : false;
      if (inCross) {
        raw[i] = 255; raw[i + 1] = 255; raw[i + 2] = 255; raw[i + 3] = 255;
      } else if (inCircle) {
        raw[i] = R; raw[i + 1] = G; raw[i + 2] = B; raw[i + 3] = 255;
      } else {
        raw[i] = 244; raw[i + 1] = 246; raw[i + 2] = 251; raw[i + 3] = 255;
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const dir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(dir, { recursive: true });
for (const size of [192, 512]) {
  fs.writeFileSync(path.join(dir, `icon-${size}.png`), makeIcon(size));
  console.log(`icon-${size}.png written`);
}
