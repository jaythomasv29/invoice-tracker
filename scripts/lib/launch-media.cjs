/* global __dirname */
// Shared helpers for the v2 launch-asset renderers (store screenshots, App Store
// preview, website film, website media export). Auxiliary tools live OUTSIDE the
// app dependency graph:
//   npm install --prefix /tmp/sift-media-tools --no-package-lock sharp fontkit ffmpeg-static ffprobe-static
// Override the location with SIFT_MEDIA_TOOLS, or the binaries with SIFT_FFMPEG / SIFT_FFPROBE.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const mediaDir = process.env.SIFT_MEDIA_TOOLS || '/tmp/sift-media-tools';
const resolvePaths = [mediaDir, path.join(root, 'website')];
const load = (name) => require(require.resolve(name, { paths: resolvePaths }));

let _sharp, _fontkit, _ffmpeg, _ffprobe;
const sharp = (...a) => (_sharp ||= load('sharp'))(...a);
const fontkit = () => (_fontkit ||= load('fontkit'));
function ffmpegPath() {
  if (_ffmpeg) return _ffmpeg;
  _ffmpeg = process.env.SIFT_FFMPEG || load('ffmpeg-static');
  return _ffmpeg;
}
function ffprobePath() {
  if (_ffprobe) return _ffprobe;
  _ffprobe = process.env.SIFT_FFPROBE || load('ffprobe-static').path;
  return _ffprobe;
}

// Brand palette (matches constants/Colors.ts and the v1 artwork).
const C = {
  ink: '#172C25', green: '#123D30', primary: '#17624B', cream: '#F5F5F0', sage: '#E7F1EB',
  lime: '#D5ECA0', muted: '#5D6D64', heroMuted: '#C4D7CD', warm: '#F7EEE3', white: '#FFFFFF',
};

const FONT_FILES = { 800: '800ExtraBold', 700: '700Bold', 500: '500Medium' };
const _fonts = {};
function font(weight) {
  if (!_fonts[weight]) {
    const d = FONT_FILES[weight];
    _fonts[weight] = fontkit().openSync(path.join(root, `node_modules/@expo-google-fonts/manrope/${d}/Manrope_${d}.ttf`));
  }
  return _fonts[weight];
}

/** Advance width in px of `str` at `size`, including optional per-glyph tracking. */
function textWidth(str, size, weight = 800, tracking = 0) {
  const f = font(weight);
  const run = f.layout(str);
  return (run.advanceWidth * size) / f.unitsPerEm + tracking * Math.max(0, run.glyphs.length - 1);
}

/** Manrope text as vector <path>s (no system fonts needed). anchor: start | middle | end. */
function text(str, x, y, size, color = C.ink, weight = 800, { anchor = 'start', tracking = 0, opacity } = {}) {
  const f = font(weight);
  const run = f.layout(str);
  const scale = size / f.unitsPerEm;
  const w = textWidth(str, size, weight, tracking);
  let pen = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  const op = opacity == null ? '' : ` opacity="${opacity}"`;
  return run.glyphs.map((g, i) => {
    const p = run.positions[i];
    const d = g.path.toSVG();
    const out = d ? `<path fill="${color}"${op} d="${d}" transform="translate(${(pen + p.xOffset * scale).toFixed(2)},${(y - p.yOffset * scale).toFixed(2)}) scale(${scale},${-scale})"/>` : '';
    pen += p.xAdvance * scale + tracking;
    return out;
  }).join('');
}

/** Largest size <= `size` (step 2) at which every line fits in `max` px. */
function fitSize(lines, size, weight, max, tracking = 0) {
  let s = size;
  while (s > 10 && lines.some((l) => textWidth(l, s, weight, tracking) > max)) s -= 2;
  return s;
}

/** A rounded pill with centred label; returns { svg, width }. */
function pill(label, x, yTop, { height = 50, size = 24, fg = C.green, bg = C.lime, padX = 22, tracking = 2, weight = 800 } = {}) {
  const w = Math.round(textWidth(label, size, weight, tracking) + padX * 2);
  const capMid = size * 0.36; // Manrope cap height ~0.72em
  const svgOut = `<rect x="${x}" y="${yTop}" width="${w}" height="${height}" rx="${height / 2}" fill="${bg}"/>` +
    text(label, x + padX, yTop + height / 2 + capMid, size, fg, weight, { tracking });
  return { svg: svgOut, width: w };
}

const svgDoc = (w, h, body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`;
const dataUri = (buf, mime = 'image/png') => `data:${mime};base64,${buf.toString('base64')}`;
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const escapeXml = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

function run(bin, args, { quiet = true } = {}) {
  const r = spawnSync(bin, args, { stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit', maxBuffer: 1 << 28 });
  if (r.status !== 0) {
    const err = r.stderr ? r.stderr.toString().split('\n').slice(-25).join('\n') : '';
    throw new Error(`${path.basename(bin)} failed (${r.status}):\n${err}`);
  }
  return r.stdout ? r.stdout.toString() : '';
}
const ffmpeg = (args) => run(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
function probe(file) {
  return JSON.parse(run(ffprobePath(), ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]));
}

/** Minimal --key value / --flag parser. */
function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const [k, inline] = a.slice(2).split('=');
    if (inline !== undefined) out[k] = inline;
    else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) out[k] = argv[++i];
    else out[k] = true;
  }
  return out;
}

/** Find `<dir>/<name>.png` trying each alias; returns absolute path or null. */
function findCapture(dir, names, exts = ['.png']) {
  for (const n of names) for (const e of exts) {
    const p = path.join(dir, n + e);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Story metadata shared by every renderer. `pro` is the paid-plan label that must
 * accompany the feature (see shared/workspacePolicy.ts + constants/plans.ts):
 *  - recipe costing: Business-only paid feature (recipes.tsx: isPaid && !isPersonal)
 *  - price alerts / purchasing intelligence: paid (alerts.tsx / index.tsx gate on isPaid);
 *    in the Business workspace that plan is "Business Pro"
 *  - item history, invoices, suppliers, review, spending overview: free in Business
 */
const SCENES = {
  alerts: { aliases: ['alerts', 'price-alerts'], pro: 'BUSINESS PRO', eyebrow: 'PRICE ALERTS', lines: ['Catch price hikes', 'before they add up.'], sub: 'See which supplier items cost more, by delivery.', bg: C.warm, short: 'Catch quiet price hikes.' },
  review: { aliases: ['review', 'scan-review', 'scan'], pro: null, eyebrow: 'SCAN & REVIEW', lines: ['Snap the invoice.', 'Check every line.'], sub: 'Smart Sift reads it. You confirm before saving.', bg: C.sage, short: 'Snap it. Check every line.' },
  home: { aliases: ['home', 'overview'], pro: null, eyebrow: 'SPENDING OVERVIEW', lines: ['See where your', 'food money goes.'], sub: 'Spend by supplier, day, week and month.', bg: C.cream, short: 'See where the money goes.' },
  intelligence: { aliases: ['intelligence', 'home-intelligence'], pro: 'BUSINESS PRO', eyebrow: 'PURCHASING INTELLIGENCE', lines: ['Spot the items', 'creeping up.'], sub: 'Price insights drawn from your saved invoices.', bg: C.sage, short: 'Spot what is creeping up.' },
  recipes: { aliases: ['recipes', 'recipe-costing'], pro: 'BUSINESS PRO', eyebrow: 'RECIPE COSTING', lines: ['Know what every', 'plate really costs.'], sub: 'Ingredient costs from your own invoices.', bg: C.sage, short: 'Know every plate’s cost.' },
  'item-history': { aliases: ['item-history', 'product-history', 'carousel'], pro: null, eyebrow: 'PRODUCT HISTORY', lines: ['Every item’s price,', 'every delivery.'], sub: 'See exactly when a cost started creeping.', bg: C.cream, short: 'Every price, every delivery.' },
  library: { aliases: ['library', 'invoices'], pro: null, eyebrow: 'INVOICE LIBRARY', lines: ['Every invoice.', 'Found in seconds.'], sub: 'Search by supplier or invoice number.', bg: C.cream, short: 'Every invoice, found fast.' },
  suppliers: { aliases: ['suppliers', 'vendors'], pro: null, eyebrow: 'SUPPLIERS', lines: ['Every supplier.', 'One clear view.'], sub: 'Compare what you spend with each vendor.', bg: C.cream, short: 'Every supplier, one view.' },
  personal: { aliases: ['personal', 'personal-home'], pro: null, eyebrow: 'PERSONAL WORKSPACE', lines: ['Groceries at home?', 'Sift does that too.'], sub: 'Household receipts, kept separate. Same login.', bg: C.cream, short: 'Groceries at home, too.' },
};
const sceneLabel = (key) => (SCENES[key].pro ? `${SCENES[key].short} · ${titleCase(SCENES[key].pro)}` : SCENES[key].short);
function titleCase(s) { return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()); }

/** Accept a scene key or any alias; returns canonical key or null. */
function canonicalScene(name) {
  for (const [k, v] of Object.entries(SCENES)) if (k === name || v.aliases.includes(name)) return k;
  return null;
}

/**
 * Render the in-house synthesized music bed (scripts/lib/music_bed.py, no third-party audio).
 * Returns the WAV path, or null (caller falls back to silence) if Python/numpy is unavailable.
 */
function generateMusic({ dur, bar = 2.5, arpFrom = 0, drumsFrom = 2.5, drumsTo, outroAt, out }) {
  const py = process.env.SIFT_PYTHON || 'python3';
  const pyArgs = [path.join(__dirname, 'music_bed.py'), '--dur', String(dur), '--bar', String(bar),
    '--arp-from', String(arpFrom), '--drums-from', String(drumsFrom), '--drums-to', String(drumsTo),
    '--outro-at', String(outroAt), '--out', out];
  const opts = { env: { ...process.env, SIFT_FFMPEG: ffmpegPath() }, stdio: ['ignore', 'pipe', 'pipe'] };
  let r = spawnSync(py, pyArgs, opts);
  // An x64 (Rosetta) Node launches universal python3 as x86_64, which cannot load arm64 numpy wheels.
  if (r.status !== 0 && process.platform === 'darwin') r = spawnSync('arch', ['-arm64', py, ...pyArgs], opts);
  if (r.status !== 0 || !fs.existsSync(out)) {
    console.warn('Music bed unavailable, using silence:', (r.stderr || r.error || '').toString().trim().split('\n').pop());
    return null;
  }
  return out;
}

module.exports = {
  generateMusic,
  root, mediaDir, sharp, fontkit, ffmpegPath, ffprobePath, ffmpeg, probe, run, C, font, text, textWidth, fitSize,
  pill, svgDoc, dataUri, sha256, escapeXml, parseArgs, findCapture, SCENES, canonicalScene, sceneLabel, titleCase,
};
