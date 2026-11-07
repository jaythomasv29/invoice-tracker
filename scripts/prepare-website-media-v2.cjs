#!/usr/bin/env node
/* global Buffer */
// Export fresh native captures + the website film into the marketing site with content-hashed names
// (old cached URLs can never show new bytes, and vice versa), then rewrite website/src/content/media.json.
//
//   node scripts/prepare-website-media-v2.cjs --captures <dir> --film-dir <dir> [--archive <dir>]
//        [--public-root website/public] [--media-json website/src/content/media.json] [--strict] [--dry-run]
//
// --film-dir is the output of create-website-film.cjs. --archive (e.g. launch-assets/website/<date>) gets a
// copy of the webp exports + manifest for provenance, like launch-assets/website/2026-11-04/.
// Keys the site reads today: home (Hero), intelligence, review, alerts, library, recipes, personal (page.tsx).
// A missing capture keeps the existing media.json entry (marked "stale") unless --strict.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const L = require('./lib/launch-media.cjs');

const SITE_KEYS = { home: 'home', intelligence: 'intelligence', review: 'review', alerts: 'alerts', library: 'library', recipes: 'recipes', personal: 'personal', suppliers: 'suppliers', itemHistory: 'item-history' };
const REQUIRED = ['home', 'intelligence', 'review', 'alerts', 'library', 'recipes', 'personal'];
const FILE_STEM = { personal: 'personal-home', itemHistory: 'item-history' };

async function main() {
  const a = L.parseArgs();
  if (!a.captures) throw new Error('Usage: --captures <dir> [--film-dir <dir>] [--archive <dir>] [--public-root dir] [--media-json file] [--strict] [--dry-run]');
  const capDir = path.resolve(a.captures);
  const publicRoot = path.resolve(a['public-root'] || path.join(L.root, 'website/public'));
  const mediaJson = path.resolve(a['media-json'] || path.join(L.root, 'website/src/content/media.json'));
  const archive = a.archive ? path.resolve(a.archive) : null;
  const dry = !!a['dry-run'];
  const previous = fs.existsSync(mediaJson) ? JSON.parse(fs.readFileSync(mediaJson, 'utf8')) : { screens: {} };
  let appCommit = a['app-commit'];
  if (!appCommit) try { appCommit = execSync('git rev-parse --short HEAD', { cwd: L.root }).toString().trim(); } catch { appCommit = 'unknown'; }

  const write = (file, buf) => { if (dry) return; fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, buf); };
  const manifest = {
    createdAt: new Date().toISOString(), appCommit,
    data: a.data || 'Fictional seeded development ledger; disposable development identity. No production restaurant data.',
    screens: {}, film: previous.film || {},
  };
  const stale = [];
  for (const [key, scene] of Object.entries(SITE_KEYS)) {
    const file = L.findCapture(capDir, L.SCENES[scene].aliases);
    if (!file) {
      if (REQUIRED.includes(key)) {
        if (a.strict) throw new Error(`Missing capture for required website screen "${key}"`);
        if (previous.screens && previous.screens[key]) { manifest.screens[key] = { ...previous.screens[key], stale: true }; stale.push(key); }
        else throw new Error(`Missing capture for "${key}" and no previous entry to keep`);
      }
      continue;
    }
    const raw = fs.readFileSync(file);
    const meta = await L.sharp(raw).metadata();
    if (meta.width !== 1320 || meta.height !== 2868) throw new Error(`Unexpected native geometry for ${key}: ${meta.width}x${meta.height}`);
    const image = await L.sharp(raw).webp({ quality: 95, effort: 6 }).toBuffer();
    const hash = L.sha256(image);
    const filename = `${FILE_STEM[key] || key}-${hash.slice(0, 10)}.webp`;
    write(path.join(publicRoot, 'screens', filename), image);
    if (archive) write(path.join(archive, filename), image);
    manifest.screens[key] = { src: '/screens/' + filename, width: 1320, height: 2868, sha256: hash, rawSha256: L.sha256(raw) };
    if (key === 'personal') manifest.screens[key].data = 'Actual native Personal UI; fictional isolated household fixture.';
  }

  if (a['film-dir']) {
    const fd = path.resolve(a['film-dir']);
    const need = ['Sift-launch-film-1920x1080.mp4', 'launch-film-poster.jpg', 'launch-film.en.vtt'];
    for (const n of need) if (!fs.existsSync(path.join(fd, n))) throw new Error('Film dir is missing ' + n);
    const video = fs.readFileSync(path.join(fd, need[0]));
    const copy = (buf, stem, ext) => { const fn = `${stem}-${L.sha256(buf).slice(0, 10)}.${ext}`; write(path.join(publicRoot, 'media', fn), buf); return '/media/' + fn; };
    const info = fs.existsSync(path.join(fd, 'film.json')) ? JSON.parse(fs.readFileSync(path.join(fd, 'film.json'), 'utf8')) : {};
    const p = L.probe(path.join(fd, need[0]));
    const v = p.streams.find((s) => s.codec_type === 'video');
    manifest.film = {
      src: copy(video, 'sift-launch-film', 'mp4'),
      poster: copy(fs.readFileSync(path.join(fd, need[1])), 'sift-launch-film-poster', 'jpg'),
      captions: copy(fs.readFileSync(path.join(fd, need[2])), 'sift-launch-film.en', 'vtt'),
      durationSeconds: Math.round(Number(p.format.duration)), width: v.width, height: v.height, sha256: L.sha256(video),
      edition: `Website prelaunch edition built from native ${appCommit} captures; closing card "${info.cta || 'Coming to iPhone'}". Music: ${info.music || 'unknown'}.`,
    };
    if (archive) for (const n of need) write(path.join(archive, 'video', n), fs.readFileSync(path.join(fd, n)));
  } else if (!manifest.film.src) throw new Error('No --film-dir and no previous film entry');

  const json = JSON.stringify(manifest, null, 2) + '\n';
  write(mediaJson, Buffer.from(json));
  if (archive) write(path.join(archive, 'manifest.json'), Buffer.from(json));
  console.log(JSON.stringify({ dryRun: dry, mediaJson, publicRoot, screens: Object.keys(manifest.screens), stale, film: manifest.film.src, durationSeconds: manifest.film.durationSeconds }, null, 1));
  if (manifest.film.durationSeconds && manifest.film.durationSeconds !== 45)
    console.warn(`NOTE: website/src/components/LaunchFilm.tsx says "A 45-second introduction" and describes the old film; update its copy to ${manifest.film.durationSeconds} s and the new scene list.`);
  if (stale.length) console.warn('Kept previous (stale) website screens for: ' + stale.join(', '));
}
main().catch((e) => { console.error(e.message); process.exit(1); });
