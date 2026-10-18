// Joins the AI-generated hero scenes (Google Flow, Veo 3.1) from assets-ai/video/ into ONE film,
// public/video/story-film.mp4, that the home hero plays on its own and scrubs with the scroll position.
// Since 2026-10-18 the film is the ultra-luxury catering story: welcome, chef's table, silver service,
// grand dinner (prompts in assets-ai/video/PROMPTS-luxury-catering.txt). The clips are 1280x720, so the
// desktop film stays at that native size and the phone copy is 960 px wide.
// Scenes are joined with short dissolves and lightly denoised (AI shimmer costs bits without adding detail).
// Both films have a keyframe every second and no B-frames, so seeking to any frame is fast.
// Each film also gets a REVERSED copy (story-film-rev.mp4 / story-film-m-rev.mp4): browsers cannot play
// video backwards, so when the visitor scrolls up the hero plays the reversed copy forward instead of
// seeking backwards frame by frame (which stutters and shows soft frames).
// Writes the chapter start times into data-chapters on the hero video in index.html.
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const SRC = 'assets-ai/video';
const OUT = 'public/video';
const FADE = 0.6;
const W = 1280, H = 720; // native size of the Flow clips
const scenes = [
  { file: 'lux-1-welcome.mp4', from: 0, to: 8 }, // Veo 3.1 Quality
  { file: 'lux-2-chef.mp4', from: 0, to: 8 }, // Veo 3.1 Quality
  { file: 'lux-3-silver.mp4', from: 0, to: 8 }, // Veo 3.1 Fast
  { file: 'lux-4-dinner.mp4', from: 0, to: 8 }, // Veo 3.1 Fast
];

await mkdir(OUT, { recursive: true });
const mp4 = path.join(OUT, 'story-film.mp4');
const mp4m = path.join(OUT, 'story-film-m.mp4');

// One trimmed, normalised stream per scene, then a chain of dissolves
const inputs = scenes.flatMap((s) => ['-i', path.join(SRC, s.file)]);
const parts = scenes.map((s, i) =>
  `[${i}:v]trim=${s.from}:${s.to},setpts=PTS-STARTPTS,${s.crop ? `crop=iw*${s.crop}:ih*${s.crop},scale=${W}:${H}:flags=lanczos,` : ''}fps=24,format=yuv420p[s${i}]`);
const chapters = [0];
let chain = '[s0]';
let offset = 0;
for (let i = 1; i < scenes.length; i++) {
  offset += scenes[i - 1].to - scenes[i - 1].from - FADE;
  const out = i === scenes.length - 1 ? '[joined]' : `[x${i}]`;
  parts.push(`${chain}[s${i}]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(3)}${out}`);
  chain = out;
  chapters.push(+(offset + FADE / 2).toFixed(2));
}

parts.push('[joined]hqdn3d=1.5:1.5:6:6,split=2[hd][b]', '[b]scale=960:-2:flags=lanczos[sd]');
const scrub = ['-g', '24', '-keyint_min', '24', '-bf', '0', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
execFileSync('ffmpeg', [
  '-y', '-loglevel', 'error', ...inputs, '-filter_complex', parts.join(';'),
  '-map', '[hd]', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-profile:v', 'high', ...scrub, mp4,
  '-map', '[sd]', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', ...scrub, mp4m,
], { stdio: 'inherit' });
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '0.4', '-i', mp4, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '86', path.join(OUT, 'story-film.webp')]);

// Reverse in 4 s chunks (reversing the whole film at once needs gigabytes of memory), then join the
// reversed chunks in reverse order.
async function reverseFilm(src, out, crf) {
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]));
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'rev-'));
  const chunks = [];
  for (let t = 0, i = 0; t < dur - 0.01; t += 4, i++) {
    const c = path.join(tmp, `c${String(i).padStart(3, '0')}.mp4`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(t), '-t', '4', '-i', src, '-vf', 'reverse', '-an',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), ...scrub, c]);
    chunks.push(c);
  }
  const list = path.join(tmp, 'list.txt');
  await writeFile(list, chunks.reverse().map((c) => `file '${c.split(path.sep).join('/')}'`).join('\n'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out]);
  await rm(tmp, { recursive: true, force: true });
}
await reverseFilm(mp4, path.join(OUT, 'story-film-rev.mp4'), 26);
await reverseFilm(mp4m, path.join(OUT, 'story-film-m-rev.mp4'), 27);

const duration = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString().trim();
console.log(`story-film.mp4: ${((await stat(mp4)).size / 1e6).toFixed(1)} MB, ${(+duration).toFixed(2)} s; phone copy ${((await stat(mp4m)).size / 1e6).toFixed(1)} MB`);
// Write the chapter start times straight into the hero video's data-chapters attribute
const chapterAttr = `data-chapters="${chapters.join(',')}"`;
let page = await readFile('index.html', 'utf8');
// The film keeps the same file names, so give its URLs a fresh ?v= tag; otherwise browsers that
// cached the previous film keep showing it.
const version = Date.now().toString(36);
page = page.replace(/(\/video\/story-film(?:-m)?(?:-rev)?\.(?:mp4|webp))(?:\?v=[\w-]+)?"/g, `$1?v=${version}"`);
console.log(`index.html: film URLs tagged ?v=${version}`);
if (/data-chapters="[^"]*"/.test(page)) {
  await writeFile('index.html', page.replace(/data-chapters="[^"]*"/, chapterAttr));
  console.log(`index.html: ${chapterAttr}`);
} else {
  await writeFile('index.html', page);
  console.log(`paste into the hero video: ${chapterAttr}`);
}
