#!/usr/bin/env node
/* global Buffer */
// Website launch film (prelaunch edition): 1920x1080, ~40 s, built from REAL native captures and,
// optionally, segments of a native screen recording shown inside a phone mockup on the brand background.
// Website only — never upload this to App Store Connect (wrong size, >30 s, device frame).
//
//   node scripts/create-website-film.cjs --captures <dir> [--recording <mov> --markers <json>]
//        [--out <dir>] [--scenes alerts,review,home,recipes,item-history,library]
//        [--cta "Coming to iPhone"] [--music generate|none|<wav>]
//
// Captures: same names as create-store-screenshots-v2.cjs. A scene whose key appears in the markers
// file (v2 "segments" format, see create-app-preview-v2.cjs) plays that recording segment in the phone
// instead of the still. Outputs in --out (default launch-assets/website/<today>/video):
//   Sift-launch-film-1920x1080.mp4, launch-film-poster.jpg, launch-film.en.vtt, closing-card.png, film.json
const fs = require('fs');
const path = require('path');
const L = require('./lib/launch-media.cjs');
const { C, text, pill, svgDoc, SCENES } = L;

const W = 1920, H = 1080, FPS = 30, XF = 0.5;
const SCREEN_H = 900, SCREEN_W = 2 * Math.round((SCREEN_H * 1320) / 2868 / 2); // 414
const BEZEL = 14, BODY_W = SCREEN_W + 2 * BEZEL, BODY_H = SCREEN_H + 2 * BEZEL;
const PHONE_CX = 1390, BODY_X = Math.round(PHONE_CX - BODY_W / 2), BODY_Y = Math.round((H - BODY_H) / 2);
const SCREEN_X = BODY_X + BEZEL, SCREEN_Y = BODY_Y + BEZEL, SCREEN_R = 60;
const HOOK = 5, SCENE = 5, CLOSE = 7.5; // 2-bar multiples of the 96 bpm music bed (bar = 2.5 s)
const DEFAULT_SCENES = ['alerts', 'review', 'home', 'recipes', 'item-history', 'library'];
const BACKFILL = ['suppliers', 'intelligence', 'personal'];

const bgDefs = `<radialGradient id="g" cx="50%" cy="42%" r="75%"><stop offset="0" stop-color="#1A4E3D"/><stop offset="1" stop-color="#0D2D23"/></radialGradient>` +
  `<filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="28"/></filter>`;
const bgBody = () => `<rect width="${W}" height="${H}" fill="url(#g)"/><circle cx="${PHONE_CX}" cy="560" r="470" fill="#1B503E" opacity=".55"/>` +
  `<circle cx="${PHONE_CX}" cy="560" r="600" fill="none" stroke="#35624C" stroke-width="2" opacity=".6"/>`;
const phoneBody = () => `<rect x="${BODY_X}" y="${BODY_Y + 30}" width="${BODY_W}" height="${BODY_H}" rx="${SCREEN_R + BEZEL}" fill="#04130E" opacity=".55" filter="url(#sh)"/>` +
  `<rect x="${BODY_X}" y="${BODY_Y}" width="${BODY_W}" height="${BODY_H}" rx="${SCREEN_R + BEZEL}" fill="#101815" stroke="#46524C" stroke-width="2"/>`;

function sceneText(key) {
  const s = SCENES[key];
  const x = 160;
  let b = '', ex = x;
  if (s.pro) { const p = pill(s.pro, x, 352, { height: 44, size: 20, padX: 18, tracking: 2 }); b += p.svg; ex += p.width + 16; }
  b += text(s.eyebrow, ex, 382, 22, C.heroMuted, 700, { tracking: 3 });
  const hs = L.fitSize(s.lines, 80, 800, 1000);
  b += text(s.lines[0], x - 4, 492, hs, C.cream, 800) + text(s.lines[1], x - 4, 590, hs, C.lime, 800);
  b += text(s.sub, x, 668, L.fitSize([s.sub], 32, 500, 1000), C.heroMuted, 500);
  return svgDoc(W, H, b);
}
const hookText = () => svgDoc(W, H, text('Food costs rarely jump.', W / 2, 500, 96, C.cream, 800, { anchor: 'middle' }) +
  text('They creep.', W / 2, 625, 96, C.lime, 800, { anchor: 'middle' }) +
  text('SIFT · FOR RESTAURANT KITCHENS', W / 2, 735, 24, C.heroMuted, 700, { anchor: 'middle', tracking: 4 }));

async function closingCard(cta, file) {
  const icon = await L.sharp(path.join(L.root, 'launch-assets/brand/sift-icon-1024.png')).resize(164, 164).png().toBuffer();
  const pw = Math.round(L.textWidth(cta, 31, 800) + 72);
  let b = `<rect width="${W}" height="${H}" fill="url(#g)"/>`;
  b += `<clipPath id="ic"><rect x="878" y="150" width="164" height="164" rx="36"/></clipPath><image clip-path="url(#ic)" href="${L.dataUri(icon)}" x="878" y="150" width="164" height="164"/>`;
  b += text('Sift', W / 2, 475, 120, C.cream, 800, { anchor: 'middle' });
  b += text('Your kitchen. In the clear.', W / 2, 575, 52, C.lime, 700, { anchor: 'middle' });
  b += `<rect x="${(W - pw) / 2}" y="640" width="${pw}" height="78" rx="39" fill="${C.cream}"/>` + text(cta, W / 2, 691, 31, C.green, 800, { anchor: 'middle' });
  b += text('siftcosts.com', W / 2, 800, 32, C.heroMuted, 700, { anchor: 'middle' });
  b += text('Actual app screens with fictional sample data. Price alerts and recipe costing are Business Pro features.', W / 2, 990, 22, C.heroMuted, 500, { anchor: 'middle' });
  await L.sharp(Buffer.from(svgDoc(W, H, b, bgDefs))).flatten().removeAlpha().png().toFile(file);
}

/** Render one scene clip: static plate (+ optional recording in the screen) + animated text layer. */
function renderClip({ plate, textLayer, video, seg, len, out, textAnim = true }) {
  const args = ['-loop', '1', '-framerate', String(FPS), '-t', len.toFixed(3), '-i', plate];
  if (textLayer) args.push('-loop', '1', '-framerate', String(FPS), '-t', len.toFixed(3), '-i', textLayer);
  const f = [];
  let cur = '0:v';
  if (video) {
    const vi = textLayer ? 3 : 2;
    args.push('-loop', '1', '-framerate', String(FPS), '-t', len.toFixed(3), '-i', video.mask, '-i', video.file);
    const end = (seg.start + len * seg.speed + 0.5).toFixed(3);
    f.push(`[${vi}:v]scale=${SCREEN_W}:${SCREEN_H}:flags=lanczos,setsar=1,format=rgba,trim=end=${end},fps=${FPS},trim=start=${seg.start},setpts=(PTS-STARTPTS)/${seg.speed},fps=${FPS},tpad=stop_mode=clone:stop_duration=3,trim=duration=${len.toFixed(3)},setpts=PTS-STARTPTS[rv]`);
    f.push(`[${vi - 1}:v]format=gray[m]`, `[rv][m]alphamerge[rvm]`, `[0:v]format=rgba[pl]`, `[pl][rvm]overlay=${SCREEN_X}:${SCREEN_Y}:shortest=1[pv]`);
    cur = 'pv';
  }
  if (textLayer) {
    const anim = textAnim ? `fade=t=in:st=0.2:d=0.6:alpha=1,` : '';
    f.push(`[1:v]format=rgba,${anim}setpts=PTS-STARTPTS[tx]`);
    f.push(`[${cur}][tx]overlay=x=0:y='if(lt(t,0.2),26,26*max(0,1-(t-0.2)/0.7)^3)':eval=frame[o]`);
    cur = 'o';
  }
  f.push(`[${cur}]format=yuv420p[v]`);
  args.push('-filter_complex', f.join(';'), '-map', '[v]', '-t', len.toFixed(3), '-r', String(FPS), '-c:v', 'libx264', '-preset', 'fast', '-crf', '12', '-pix_fmt', 'yuv420p', out);
  L.ffmpeg(args);
}

const vttTime = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return `${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`; };

async function main() {
  const a = L.parseArgs();
  if (!a.captures) throw new Error('Usage: --captures <dir> [--recording <mov> --markers <json>] [--out <dir>] [--scenes ...] [--cta "Coming to iPhone"] [--music generate|none|file]');
  const today = new Date().toISOString().slice(0, 10);
  const out = path.resolve(a.out || path.join(L.root, `launch-assets/website/${today}/video`));
  const work = path.join(out, '.work');
  fs.mkdirSync(work, { recursive: true });
  const cta = a.cta || 'Coming to iPhone'; // matches website/src/components/LaunchFilm.tsx while prelaunch
  const capDir = path.resolve(a.captures);

  // Recording segments keyed by canonical scene (optional).
  const segs = {};
  if (a.markers) {
    const raw = JSON.parse(fs.readFileSync(a.markers, 'utf8'));
    for (const s of (Array.isArray(raw) ? raw : raw.segments)) {
      if (s.scene === 'scan') continue; // capture/inbox beat has no film scene (the film opens on the text hook)
      const k = L.canonicalScene(s.scene);
      const file = s.file ? path.resolve(path.dirname(a.markers), s.file) : a.recording ? path.resolve(a.recording) : null;
      if (k && file && !segs[k]) segs[k] = { start: s.start, speed: s.speed || 1, file };
    }
  }
  // Choose scenes: requested order, skipping missing captures, backfilling to keep the set size.
  const wanted = (a.scenes ? String(a.scenes).split(',') : DEFAULT_SCENES).map((n) => L.canonicalScene(n.trim()));
  const has = (k) => segs[k] || L.findCapture(capDir, SCENES[k].aliases);
  const chosen = wanted.filter((k) => k && has(k));
  if (!a.scenes) for (const k of BACKFILL) if (chosen.length < DEFAULT_SCENES.length && !chosen.includes(k) && has(k)) chosen.push(k);
  if (chosen.length < 3) throw new Error('Need at least 3 scenes with captures; found ' + chosen.join(','));

  const mask = path.join(work, 'screen-mask.png');
  await L.sharp(Buffer.from(svgDoc(SCREEN_W, SCREEN_H, `<rect width="${SCREEN_W}" height="${SCREEN_H}" fill="#000"/><rect width="${SCREEN_W}" height="${SCREEN_H}" rx="${SCREEN_R}" fill="#fff"/>`))).greyscale().png().toFile(mask);

  const timeline = [{ kind: 'hook', dur: HOOK }, ...chosen.map((k) => ({ kind: 'scene', key: k, dur: SCENE })), { kind: 'close', dur: CLOSE }];
  const clips = [];
  for (const [i, item] of timeline.entries()) {
    const len = item.dur + (i < timeline.length - 1 ? XF : 0);
    const clip = path.join(work, `clip-${i}.mp4`);
    if (item.kind === 'hook') {
      const plate = path.join(work, 'hook-bg.png'), tl = path.join(work, 'hook-text.png');
      await L.sharp(Buffer.from(svgDoc(W, H, `<rect width="${W}" height="${H}" fill="url(#g)"/>`, bgDefs))).flatten().png().toFile(plate);
      await L.sharp(Buffer.from(hookText())).png().toFile(tl);
      renderClip({ plate, textLayer: tl, len, out: clip });
    } else if (item.kind === 'close') {
      const card = path.join(out, 'closing-card.png');
      await closingCard(cta, card);
      renderClip({ plate: card, len, out: clip });
    } else {
      const k = item.key, plate = path.join(work, `plate-${k}.png`), tl = path.join(work, `text-${k}.png`);
      const capture = L.findCapture(capDir, SCENES[k].aliases);
      let body = bgBody() + phoneBody();
      const useVideo = !!segs[k];
      if (!useVideo) {
        const meta = await L.sharp(capture).metadata();
        if (meta.width !== 1320 || meta.height !== 2868) throw new Error(`${capture}: expected 1320x2868`);
        const scr = await L.sharp(capture).flatten({ background: '#FFFFFF' }).resize(SCREEN_W, SCREEN_H, { kernel: 'lanczos3' }).png().toBuffer();
        body += `<clipPath id="sc"><rect x="${SCREEN_X}" y="${SCREEN_Y}" width="${SCREEN_W}" height="${SCREEN_H}" rx="${SCREEN_R}"/></clipPath><image clip-path="url(#sc)" href="${L.dataUri(scr)}" x="${SCREEN_X}" y="${SCREEN_Y}" width="${SCREEN_W}" height="${SCREEN_H}"/>`;
      }
      await L.sharp(Buffer.from(svgDoc(W, H, body, bgDefs))).flatten().removeAlpha().png().toFile(plate);
      await L.sharp(Buffer.from(sceneText(k))).png().toFile(tl);
      renderClip({ plate, textLayer: tl, len, out: clip, video: useVideo ? { file: segs[k].file, mask } : null, seg: segs[k] });
      item.source = useVideo ? `${path.basename(segs[k].file)}@${segs[k].start}s` : path.basename(capture);
    }
    clips.push(clip);
    console.log(`clip ${i}: ${item.kind}${item.key ? ' ' + item.key : ''} (${item.dur}s)`);
  }

  const total = timeline.reduce((t, x) => t + x.dur, 0);
  const closeStart = total - CLOSE;
  let music = null;
  if (a.music && a.music !== 'generate' && a.music !== 'none') music = path.resolve(a.music);
  else if (a.music !== 'none') music = L.generateMusic({ dur: total, bar: 2.5, arpFrom: HOOK, drumsFrom: HOOK + 5, drumsTo: closeStart, outroAt: closeStart + 2.5, out: path.join(work, 'music.wav') });

  const film = path.join(out, 'Sift-launch-film-1920x1080.mp4');
  const args = [];
  clips.forEach((c) => args.push('-i', c));
  if (music) args.push('-i', music); else args.push('-f', 'lavfi', '-t', String(total), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');
  const f = [];
  let last = '0:v', off = 0;
  for (let i = 1; i < clips.length; i++) {
    off += timeline[i - 1].dur;
    f.push(`[${last}][${i}:v]xfade=transition=fade:duration=${XF}:offset=${off.toFixed(3)}[x${i}]`);
    last = `x${i}`;
  }
  f.push(`[${last}]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[v]`);
  args.push('-filter_complex', f.join(';'), '-map', '[v]', '-map', `${clips.length}:a`, '-t', String(total), '-r', String(FPS),
    '-c:v', 'libx264', '-profile:v', 'high', '-level:v', '4.0', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-af', 'apad', '-movflags', '+faststart', film);
  L.ffmpeg(args);

  // Poster: middle of the first product scene. Captions: one cue per timeline item.
  L.ffmpeg(['-ss', (HOOK + SCENE / 2).toFixed(2), '-i', film, '-frames:v', '1', '-q:v', '3', path.join(out, 'launch-film-poster.jpg')]);
  let t = 0;
  const cues = timeline.map((item, i) => {
    let body;
    if (item.kind === 'hook') body = `${music ? '[Instrumental music]\n' : ''}Food costs rarely jump. They creep.`;
    else if (item.kind === 'close') body = `Sift. Your kitchen. In the clear.\n${cta}. siftcosts.com.`;
    else { const s = SCENES[item.key]; body = `${s.pro ? L.titleCase(s.pro) + ' ' : ''}${L.titleCase(s.eyebrow).replace(/&/g, 'and')}: ${s.lines.join(' ')}\n${s.sub}`; }
    const cue = `${vttTime(t)} --> ${vttTime(t + item.dur)}\n${body}`;
    t += item.dur; return cue;
  });
  fs.writeFileSync(path.join(out, 'launch-film.en.vtt'), 'WEBVTT\n\n' + cues.join('\n\n') + '\n');

  const p = L.probe(film);
  const v = p.streams.find((s) => s.codec_type === 'video'), au = p.streams.find((s) => s.codec_type === 'audio');
  const report = {
    film: path.basename(film), sha256: L.sha256(fs.readFileSync(film)), durationSeconds: Number(p.format.duration), width: v.width, height: v.height,
    video: [v.codec_name, v.profile, v.level, v.pix_fmt, v.r_frame_rate], audio: [au.codec_name, au.channels, au.sample_rate, Number(au.bit_rate)],
    cta, music: music ? 'scripts/lib/music_bed.py (synthesized in-house, no third-party audio)' : 'silence', captures: capDir,
    timeline: timeline.map(({ kind, key, dur, source }) => ({ kind, key, dur, source })),
  };
  fs.writeFileSync(path.join(out, 'film.json'), JSON.stringify(report, null, 2) + '\n');
  if (!a['keep-work']) fs.rmSync(work, { recursive: true, force: true });
  console.log(JSON.stringify({ out, duration: report.durationSeconds, size: `${v.width}x${v.height}`, scenes: chosen }));
}
main().catch((e) => { console.error(e.message); process.exit(1); });
