// Builds the round logo mark, favicons and the WhatsApp/Facebook share image from existing assets.
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const logo = 'assets-src/arasu-main.png';
const { width, height } = await sharp(logo).metadata();

// The portrait medallion is the left square of the logo.
const mark = sharp(logo).extract({ left: 0, top: 0, width: height, height });
const markBuf = await mark.png().toBuffer();
const circle = (s) => Buffer.from(`<svg width="${s}" height="${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}"/></svg>`);
const round = async (s) => sharp(markBuf).resize(s, s).composite([{ input: circle(s), blend: 'dest-in' }]).png().toBuffer();

await sharp(await round(176)).webp({ quality: 88 }).toFile('public/images/logo-mark.webp');
await sharp(await round(192)).toFile('public/icon-192.png');
await sharp(await round(512)).toFile('public/icon-512.png');
await sharp(markBuf).resize(180, 180).flatten({ background: '#b4121b' }).toFile('public/apple-touch-icon.png');

// favicon.ico holding a single 32px PNG
const png32 = await round(32);
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header.writeUInt8(32, 6); header.writeUInt8(32, 7); header.writeUInt8(0, 8); header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
header.writeUInt32LE(png32.length, 14); header.writeUInt32LE(22, 18);
await writeFile('public/favicon.ico', Buffer.concat([header, png32]));

// 1200x630 share card: wedding photo, maroon gradient, logo
const W = 1200, H = 630;
const overlay = Buffer.from(`<svg width="${W}" height="${H}">
  <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#3a0709" stop-opacity="0.95"/><stop offset="0.6" stop-color="#3a0709" stop-opacity="0.55"/><stop offset="1" stop-color="#3a0709" stop-opacity="0"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <text x="70" y="330" font-family="Georgia, serif" font-size="64" fill="#fbf7ef">Feel the grandeur</text>
  <text x="70" y="405" font-family="Georgia, serif" font-style="italic" font-size="64" fill="#dcbc6e">in every bite</text>
  <text x="72" y="470" font-family="Arial, sans-serif" font-size="24" letter-spacing="4" fill="#ead9bd">PREMIUM CATERING &amp; EVENTS · SINCE 1952</text>
</svg>`);
const logoW = 420;
const logoBuf = await sharp(logo).resize(logoW).png().toBuffer();
await sharp('assets-src/L-2.jpg')
  .resize(W, H, { fit: 'cover', position: 'attention' })
  .composite([{ input: overlay }, { input: logoBuf, left: 70, top: 120 }])
  .jpeg({ quality: 82 })
  .toFile('public/images/og-cover.jpg');

console.log(`logo ${width}x${height}; icons and og-cover written`);
