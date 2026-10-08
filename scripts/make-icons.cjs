const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPng(width, height, drawFn) {
  // RGBA buffer
  const buffer = Buffer.alloc(width * height * 4);
  drawFn(buffer, width, height);

  // Raw image data with filter byte (0) per row
  const rawData = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    rawData[y * (width * 4 + 1)] = 0; // Filter byte None
    buffer.copy(rawData, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function makeChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const chunkType = Buffer.from(type, 'ascii');
    const crcVal = crc32(Buffer.concat([chunkType, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeInt32BE(crcVal, 0);
    return Buffer.concat([length, chunkType, data, crcBuf]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace method

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32 table
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return crc ^ -1;
}

// Gym Buddy icon painter: Sleek dark charcoal background with modern athletic emerald barbell/bolt
function drawGymBuddyIcon(buffer, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const radius = w * 0.44;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Default dark charcoal #0D0E11
      let r = 13, g = 14, b = 17, a = 255;

      // Outer squircle or circle border
      const cornerR = w * 0.22;
      const inBoxX = Math.abs(dx) <= (w * 0.46 - cornerR);
      const inBoxY = Math.abs(dy) <= (h * 0.46 - cornerR);
      const cornerDist = Math.sqrt(
        Math.pow(Math.max(0, Math.abs(dx) - (w * 0.46 - cornerR)), 2) +
        Math.pow(Math.max(0, Math.abs(dy) - (h * 0.46 - cornerR)), 2)
      );

      const inCard = (inBoxX && Math.abs(dy) <= h * 0.46) ||
                     (inBoxY && Math.abs(dx) <= w * 0.46) ||
                     (cornerDist <= cornerR);

      if (!inCard) {
        buffer[idx + 0] = 0;
        buffer[idx + 1] = 0;
        buffer[idx + 2] = 0;
        buffer[idx + 3] = 0;
        continue;
      }

      // Card background: deep graphite #15171C
      r = 21; g = 23; b = 28;

      // Subtle border line
      if (cornerDist > cornerR - w * 0.015 || 
          Math.abs(Math.abs(dx) - w * 0.46) < w * 0.015 ||
          Math.abs(Math.abs(dy) - h * 0.46) < h * 0.015) {
        r = 38; g = 42; b = 52;
      }

      // Barbell shaft: horizontal bar
      const barHalfWidth = w * 0.26;
      const barHalfHeight = h * 0.035;
      const inBar = Math.abs(dx) <= barHalfWidth && Math.abs(dy) <= barHalfHeight;

      // Outer weight plates
      const plateWidth = w * 0.055;
      const plate1Height = h * 0.22;
      const plate2Height = h * 0.16;
      const plateOffset1 = w * 0.23;
      const plateOffset2 = w * 0.30;

      const inPlate1 = (Math.abs(Math.abs(dx) - plateOffset1) <= plateWidth / 2) && Math.abs(dy) <= plate1Height;
      const inPlate2 = (Math.abs(Math.abs(dx) - plateOffset2) <= plateWidth / 2) && Math.abs(dy) <= plate2Height;

      // Center knurling accent (electric emerald: #10B981)
      const inCenterKnurl = Math.abs(dx) <= w * 0.08 && Math.abs(dy) <= barHalfHeight;

      if (inPlate1 || inPlate2) {
        // Crisp white/light silver plates
        r = 243; g = 244; b = 246;
      } else if (inCenterKnurl) {
        // Emerald active grip #10B981
        r = 16; g = 185; b = 129;
      } else if (inBar) {
        // Subtle platinum bar
        r = 156; g = 163; b = 175;
      }

      buffer[idx + 0] = r;
      buffer[idx + 1] = g;
      buffer[idx + 2] = b;
      buffer[idx + 3] = a;
    }
  }
}

const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPng(512, 512, drawGymBuddyIcon));
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPng(192, 192, drawGymBuddyIcon));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180, 180, drawGymBuddyIcon));

// Also generate SVG favicon
const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="24" fill="#15171C" stroke="#282D37" stroke-width="3"/>
  <rect x="22" y="46" width="56" height="8" rx="4" fill="#9CA3AF"/>
  <rect x="42" y="46" width="16" height="8" rx="2" fill="#10B981"/>
  <rect x="24" y="26" width="8" height="48" rx="3" fill="#F3F4F6"/>
  <rect x="14" y="32" width="7" height="36" rx="2.5" fill="#E5E7EB"/>
  <rect x="68" y="26" width="8" height="48" rx="3" fill="#F3F4F6"/>
  <rect x="79" y="32" width="7" height="36" rx="2.5" fill="#E5E7EB"/>
</svg>`;
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgFavicon);
console.log('Successfully generated Gym Buddy PWA icons!');
