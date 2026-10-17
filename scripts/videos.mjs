// Downloads the old site's videos into assets-src/video/ and compresses them into public/video/
// (H.264, 1280px wide, no audio, faststart) with a WebP poster frame for each.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://arusuvaiarasu.in/vedios/';
const SRC = 'assets-src/video';
const OUT = 'public/video';

// old file name -> clean name used on the new site
const videos = {
  'header-final.mp4': 'home-header',
  'home-2.mp4': 'home-2',
  'Home-3.mp4': 'home-3',
  'About-header1.mp4': 'about-header',
  'about-second-vedio.mp4': 'about-2',
  'Service-banner.mp4': 'services-header',
  'Service-33ca84.mp4': 'services-2',
};
// Audio is dropped: every source video on the old site has a silent (-91 dB) audio track.

await mkdir(SRC, { recursive: true });
await mkdir(OUT, { recursive: true });

const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });

for (const [file, name] of Object.entries(videos)) {
  const src = path.join(SRC, file);
  if (!existsSync(src)) {
    const legacy = path.join('assets-src', file);
    if (existsSync(legacy)) {
      await copyFile(legacy, src);
    } else {
      console.log(`downloading ${file}`);
      const res = await fetch(BASE + file);
      if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
      await writeFile(src, Buffer.from(await res.arrayBuffer()));
    }
  }
  const mp4 = path.join(OUT, `${name}.mp4`);
  const poster = path.join(OUT, `${name}.webp`);
  // Long films (over a minute) get a lighter encode, plus a 20s loop for in-page bands
  const long = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src])) > 60;
  const encode = (out, extra = []) => ff([...extra, '-i', src, '-an', '-vf', `scale='min(${long ? 960 : 1280},iw)':-2`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', long ? '31' : '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
  if (!existsSync(mp4)) encode(mp4);
  const loop = path.join(OUT, `${name}-loop.mp4`);
  if (long && !existsSync(loop)) encode(loop, ['-t', '20']);
  if (!existsSync(poster)) {
    ff(['-ss', '1', '-i', mp4, '-frames:v', '1', '-vf', 'scale=1280:-2', '-c:v', 'libwebp', '-quality', '72', poster]);
  }
  const before = (await stat(src)).size / 1e6;
  const after = (await stat(mp4)).size / 1e6;
  console.log(`${name}: ${before.toFixed(1)} MB -> ${after.toFixed(1)} MB`);
}
