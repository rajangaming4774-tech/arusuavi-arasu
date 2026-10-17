// Joins the AI-generated hero story scenes (Google Flow, Veo 3.1) from assets-ai/video/ into ONE film,
// public/video/story-film.mp4, that the home hero scrubs with the scroll position.
// The scenes are Flow's free 1080p upscales (assets-ai/video/hd/). They are joined with short dissolves
// and lightly denoised (AI shimmer costs bits without adding detail). Two encodes come out of one pass:
// a desktop film at full 1920x1080 and a 1280x720 phone copy (story-film-m.mp4; on a portrait phone
// only the centre of the frame shows, so its height matters more than its width). Both have a keyframe every second and no B-frames, so seeking to any frame is fast.
// Flow only returned six clips; the feast clip cuts to a sangeet stage at ~2.96s, so it is split
// into chapter 6 (feast) and chapter 7 (sangeet).
// Each film also gets a REVERSED copy (story-film-rev.mp4 / story-film-m-rev.mp4): browsers cannot play
// video backwards, so when the visitor scrolls up the hero plays the reversed copy forward instead of
// seeking backwards frame by frame (which stutters and shows soft frames).
// Writes the chapter start times into data-chapters on the hero video in index.html.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const SRC = 'assets-ai/video/hd';
const OUT = 'public/video';
const FADE = 0.6;
// Chapter 6 (the feast): the dedicated gravy-pour clip once it has been rendered (prompt in
// assets-ai/video/PROMPT-story-6-pour.txt), otherwise the first 2.9 s of the original feast clip.
const POUR = 'story-6-pour.mp4';
const hasPour = existsSync(path.join(SRC, POUR));
const scenes = [
  { file: 'story-1-arrival.mp4', from: 0, to: 8, crop: 0.9 }, // Veo baked a dark round vignette into this one
  { file: 'story-2-welcome.mp4', from: 0, to: 8 },
  { file: 'story-3-haldi.mp4', from: 0, to: 8 },
  { file: 'story-4-mandapam.mp4', from: 0, to: 8 },
  { file: 'story-5-kitchen.mp4', from: 0, to: 8 },
  hasPour ? { file: POUR, from: 0, to: 8 } : { file: 'story-6-feast.mp4', from: 0, to: 2.92 },
  { file: 'story-6-feast.mp4', from: 3.0, to: 8 },
];
console.log(hasPour ? `chapter 6: ${POUR}` : `chapter 6: story-6-feast.mp4 (no ${POUR} yet, see PROMPT-story-6-pour.txt)`);

await mkdir(OUT, { recursive: true });
const mp4 = path.join(OUT, 'story-film.mp4');
const mp4m = path.join(OUT, 'story-film-m.mp4');

// One trimmed, normalised stream per scene, then a chain of dissolves
const inputs = scenes.flatMap((s) => ['-i', path.join(SRC, s.file)]);
const parts = scenes.map((s, i) =>
  `[${i}:v]trim=${s.from}:${s.to},setpts=PTS-STARTPTS,${s.crop ? `crop=iw*${s.crop}:ih*${s.crop},scale=1920:1080:flags=lanczos,` : ''}fps=24,format=yuv420p[s${i}]`);
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

parts.push('[joined]hqdn3d=1.5:1.5:6:6,split=2[hd][b]', '[b]scale=1280:-2:flags=lanczos[sd]');
const scrub = ['-g', '24', '-keyint_min', '24', '-bf', '0', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
execFileSync('ffmpeg', [
  '-y', '-loglevel', 'error', ...inputs, '-filter_complex', parts.join(';'),
  '-map', '[hd]', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-profile:v', 'high', ...scrub, mp4,
  '-map', '[sd]', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', ...scrub, mp4m,
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
const page = await readFile('index.html', 'utf8');
if (/data-chapters="[^"]*"/.test(page)) {
  await writeFile('index.html', page.replace(/data-chapters="[^"]*"/, chapterAttr));
  console.log(`index.html: ${chapterAttr}`);
} else {
  console.log(`paste into the hero video: ${chapterAttr}`);
}
