#!/usr/bin/env node
/* global Buffer */
// App Store app preview v2 — built ONLY from a real native screen recording (Guideline 2.3.7 / 2.3.4):
// no device frame, no synthesized UI, no magnified callouts. The recording is scaled into the
// lower area; captions live in their own top band and never paint over app pixels.
//
//   node scripts/create-app-preview-v2.cjs --recording <session.mov> --markers <markers.json>
//        [--out <file.mp4>] [--target 28] [--music generate|none|<file.wav>] [--keep-work]
//
// markers.json (v2):
//   { "segments": [ { "scene": "scan", "start": 1.2, "end": 6.0, "speed": 1, "caption": "optional override", "file": "optional clip path" }, ... ] }
//   "file" (relative to the markers file) overrides --recording for that segment, so beats can be separate clips.
//   start/end are seconds in the SOURCE recording; output duration = sum((end-start)/speed).
//   Consecutive segments with the same caption share one caption (no flicker).
// Legacy markers (array of {scene,start}, as in launch-assets/previews/source/scene-markers.json)
// are accepted: each scene gets target/N seconds from its start.
//
// Output: 886x1920, 30 fps CFR, H.264 High@4.0, yuv420p, BT.709-tagged, ~10 Mbps, AAC-LC stereo
// 256 kbps 48 kHz (music bed or silence), +faststart. Also writes <out>.poster.png and <out>.json.
const fs = require('fs');
const path = require('path');
const L = require('./lib/launch-media.cjs');
const { C, text, pill, svgDoc, SCENES } = L;

const OW = 886, OH = 1920, BAND = 150, FPS = 30, XF = 0.3; // XF = crossfade between segments
const VH = OH - BAND - 0;                                     // 1770
const VW = 2 * Math.round((VH * 1320) / 2868 / 2);             // 814, keeps native aspect
const VX = (OW - VW) / 2, VY = BAND, RADIUS = 56;
const CAPTIONS = {
  scan: 'Snap the invoice.', review: 'Check every line.', alerts: 'Catch quiet price hikes.',
  'item-history': 'See when a cost started creeping.', home: 'See where the money goes.',
  intelligence: 'Spot what is creeping up.', recipes: 'Know what every plate costs.',
  library: 'Every invoice, found fast.', suppliers: 'Every supplier, one view.', personal: 'Groceries at home, too.',
};
const proFor = (scene) => (scene === 'scan' ? null : (SCENES[L.canonicalScene(scene)] || {}).pro || null);

function captionSvg(caption, pro) {
  const size = L.fitSize([caption], 46, 800, OW - 80);
  let b = `<rect width="${OW}" height="${BAND}" fill="${C.cream}"/>`;
  if (pro) {
    b += text(caption, OW / 2, 70, size, C.green, 800, { anchor: 'middle' });
    const w = L.textWidth(pro, 19, 800, 2) + 32;
    b += pill(pro, Math.round((OW - w) / 2), 94, { height: 36, size: 19, padX: 16, tracking: 2 }).svg;
  } else {
    b += text(caption, OW / 2, 92, size, C.green, 800, { anchor: 'middle' });
  }
  return svgDoc(OW, BAND, b);
}

function loadSegments(markersFile, target) {
  const raw = JSON.parse(fs.readFileSync(markersFile, 'utf8'));
  let segs;
  if (Array.isArray(raw)) { // legacy {scene,start}
    const each = target / raw.length;
    segs = raw.map((m) => ({ scene: m.scene, start: m.start, end: m.start + each, speed: 1 }));
  } else segs = raw.segments;
  return segs.map((s, i) => {
    const scene = s.scene === 'scan' ? 'scan' : L.canonicalScene(s.scene);
    if (!scene) throw new Error(`Segment ${i}: unknown scene "${s.scene}"`);
    const speed = s.speed || 1;
    if (!(s.end > s.start)) throw new Error(`Segment ${i}: end must be > start`);
    const file = s.file ? path.resolve(path.dirname(markersFile), s.file) : null;
    return { file, scene, start: s.start, end: s.end, speed, dur: (s.end - s.start) / speed, caption: s.caption || CAPTIONS[scene], pro: s.pro === undefined ? proFor(scene) : s.pro };
  });
}

async function main() {
  const a = L.parseArgs();
  if (!a.markers) throw new Error('Usage: [--recording <file>] --markers <json> [--out file.mp4] [--target 28] [--music generate|none|file]');
  const target = Number(a.target || 28);
  const out = path.resolve(a.out || path.join(L.root, 'launch-assets/previews/v2/sift-app-preview-886x1920.mp4'));
  const work = out.replace(/\.mp4$/, '') + '.work';
  fs.mkdirSync(work, { recursive: true });
  const segs = loadSegments(a.markers, target);
  const total = +segs.reduce((t, s) => t + s.dur, 0).toFixed(3);
  if (total < 15 || total > 29.5) throw new Error(`Cut is ${total}s; App Store previews must be 15–30 s (keep <= 29.5 s margin). Adjust segment start/end.`);
  for (const s of segs) {
    s.file = s.file || (a.recording && path.resolve(a.recording));
    if (!s.file || !fs.existsSync(s.file)) throw new Error(`Segment ${s.scene}: no recording (pass --recording or a per-segment "file")`);
    const src = L.probe(s.file);
    const vs = src.streams.find((x) => x.codec_type === 'video');
    if (vs.width > vs.height) throw new Error(`${s.file} must be portrait`);
    if (Math.abs(vs.width / vs.height - 1320 / 2868) > 0.01) throw new Error(`${s.file} is ${vs.width}x${vs.height}; expected the 1320x2868 iPhone aspect`);
    if (s.start >= Number(src.format.duration)) throw new Error(`Segment ${s.scene} starts after ${path.basename(s.file)} ends`);
  }

  // Static layers: cream background, rounded-corner mask (clips only the outer corners), captions.
  const bg = path.join(work, 'bg.png'), mask = path.join(work, 'mask.png');
  await L.sharp({ create: { width: OW, height: OH, channels: 3, background: C.cream } }).png().toFile(bg);
  await L.sharp(Buffer.from(svgDoc(VW, VH, `<rect width="${VW}" height="${VH}" fill="#000"/><rect width="${VW}" height="${VH}" rx="${RADIUS}" fill="#fff"/>`))).greyscale().png().toFile(mask);
  // Group consecutive segments that share a caption.
  const groups = [];
  let t = 0;
  for (const s of segs) {
    const g = groups[groups.length - 1];
    if (g && g.caption === s.caption && g.pro === s.pro) g.end = t + s.dur;
    else groups.push({ caption: s.caption, pro: s.pro, start: t, end: t + s.dur });
    t += s.dur;
  }
  for (const [i, g] of groups.entries()) {
    g.file = path.join(work, `caption-${i}.png`);
    await L.sharp(Buffer.from(captionSvg(g.caption, g.pro))).png().toFile(g.file);
  }

  let music = null;
  if (a.music && a.music !== 'generate' && a.music !== 'none') music = path.resolve(a.music);
  else if (a.music !== 'none') music = L.generateMusic({ dur: total, bar: 2.5, arpFrom: 0, drumsFrom: 2.5, drumsTo: Math.max(5, total - 3.5), outroAt: Math.max(5, total - 2.5), out: path.join(work, 'music.wav') });

  // Inputs: 0 audio, 1 background, 2 mask, 3.. captions, then one decoder per segment (order-independent,
  // no split buffering when segments are out of source order).
  const args = [];
  if (music) args.push('-i', music); else args.push('-f', 'lavfi', '-t', String(total), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');
  args.push('-loop', '1', '-framerate', String(FPS), '-t', String(total), '-i', bg);
  args.push('-loop', '1', '-framerate', String(FPS), '-t', String(total), '-i', mask);
  const capBase = 3;
  for (const g of groups) args.push('-loop', '1', '-framerate', String(FPS), '-t', String(g.end - g.start + XF), '-i', g.file);
  const recBase = capBase + groups.length;
  for (const s of segs) args.push('-i', s.file);

  const f = [];
  segs.forEach((s, i) => {
    const len = s.dur + (i < segs.length - 1 ? XF : 0); // overlap so cut points stay at segment boundaries
    const end = (s.start + len * s.speed + 0.5).toFixed(3);
    // fps BEFORE the start trim: simulator recordings are VFR with long static gaps; fps re-emits the
    // last real frame so a trim inside a static interval still starts on the right picture.
    f.push(`[${recBase + i}:v]scale=${VW}:${VH}:flags=lanczos,setsar=1,format=rgba,trim=end=${end},fps=${FPS},trim=start=${s.start},setpts=(PTS-STARTPTS)/${s.speed},fps=${FPS},tpad=stop_mode=clone:stop_duration=2,trim=duration=${len.toFixed(3)},setpts=PTS-STARTPTS[c${i}]`);
  });
  let last = 'c0', off = 0;
  for (let i = 1; i < segs.length; i++) {
    off += segs[i - 1].dur;
    f.push(`[${last}][c${i}]xfade=transition=fade:duration=${XF}:offset=${off.toFixed(3)}[x${i}]`);
    last = `x${i}`;
  }
  f.push(`[2:v]format=gray[m]`, `[${last}][m]alphamerge[vm]`, `[1:v]format=rgba[bg]`, `[bg][vm]overlay=${VX}:${VY}:shortest=1[l0]`);
  groups.forEach((g, i) => {
    const len = g.end - g.start + (i < groups.length - 1 ? XF : 0);
    const fadeIn = i === 0 ? '' : `fade=t=in:st=0:d=${XF}:alpha=1,`;
    f.push(`[${capBase + i}:v]format=rgba,${fadeIn}trim=duration=${len.toFixed(3)},setpts=PTS-STARTPTS+${g.start.toFixed(3)}/TB[cap${i}]`);
    f.push(`[l${i}][cap${i}]overlay=0:0:eof_action=pass[l${i + 1}]`);
  });
  f.push(`[l${groups.length}]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[vout]`);
  args.push('-filter_complex', f.join(';'), '-map', '[vout]', '-map', '0:a', '-t', String(total), '-r', String(FPS),
    '-c:v', 'libx264', '-profile:v', 'high', '-level:v', '4.0', '-pix_fmt', 'yuv420p', '-preset', 'medium',
    '-b:v', '10M', '-maxrate', '12M', '-bufsize', '20M', '-x264-params', 'nal-hrd=vbr',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
    '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2', '-af', 'apad', '-movflags', '+faststart', out);
  console.log(`Rendering ${segs.length} segments / ${groups.length} captions, ${total}s, music=${music ? 'bed' : 'silence'} ...`);
  L.ffmpeg(args);

  // Poster suggestion: middle of the first alerts segment (set the ASC poster-frame time code to this).
  let pt = 0, posterAt = total / 2;
  for (const s of segs) { if (s.scene === 'alerts') { posterAt = pt + s.dur / 2; break; } pt += s.dur; }
  L.ffmpeg(['-ss', posterAt.toFixed(2), '-i', out, '-frames:v', '1', out.replace(/\.mp4$/, '.poster.png')]);
  const p = L.probe(out);
  const v = p.streams.find((s) => s.codec_type === 'video'), au = p.streams.find((s) => s.codec_type === 'audio');
  const report = {
    file: out, sha256: L.sha256(fs.readFileSync(out)), durationSeconds: Number(p.format.duration), posterFrameSeconds: +posterAt.toFixed(2),
    video: { codec: v.codec_name, profile: v.profile, level: v.level, width: v.width, height: v.height, pix_fmt: v.pix_fmt, fps: v.r_frame_rate, avg_fps: v.avg_frame_rate, bit_rate: Number(v.bit_rate), color: [v.color_primaries, v.color_transfer, v.color_space] },
    audio: { codec: au.codec_name, profile: au.profile, channels: au.channels, sample_rate: au.sample_rate, bit_rate: Number(au.bit_rate) },
    segments: segs, music: music ? 'scripts/lib/music_bed.py (synthesized in-house)' : 'silence',
  };
  const problems = [];
  if (v.width !== OW || v.height !== OH) problems.push('size');
  if (v.codec_name !== 'h264' || v.profile !== 'High' || v.level > 40) problems.push('codec/profile/level');
  if (v.pix_fmt !== 'yuv420p') problems.push('pix_fmt');
  if (v.r_frame_rate !== '30/1') problems.push('fps');
  if (au.codec_name !== 'aac' || au.channels !== 2) problems.push('audio');
  if (report.durationSeconds < 15 || report.durationSeconds > 30) problems.push('duration');
  report.ok = problems.length === 0; report.problems = problems;
  fs.writeFileSync(out.replace(/\.mp4$/, '.json'), JSON.stringify(report, null, 2) + '\n');
  if (!a['keep-work']) fs.rmSync(work, { recursive: true, force: true });
  console.log(JSON.stringify({ ok: report.ok, problems, duration: report.durationSeconds, posterFrameSeconds: report.posterFrameSeconds, out }));
  if (problems.length) process.exit(2);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
