#!/usr/bin/env node
/* global Buffer */
// App Store screenshots v2: branded frames around REAL native captures.
//
//   node scripts/create-store-screenshots-v2.cjs --captures <dir> [--out <dir>] [--order a,b,c] [--allow-missing]
//
// <dir> holds raw 1320x2868 simulator PNGs named by scene (aliases in scripts/lib/launch-media.cjs):
//   alerts.png review.png home.png recipes.png item-history.png library.png suppliers.png personal.png
//   intelligence.png, item-history.png and personal.png (or personal-home.png) are optional
// Output (default launch-assets/screenshots/app-store-v2/):
//   6.9/NN-<scene>.png  1320x2868 RGB, no alpha  (APP_IPHONE_67 / Dynamic Island large)
//   6.9/NN-<scene>.svg  editable source (text as Manrope vector paths, capture embedded)
//   6.3/NN-<scene>.png  1206x2622 RGB, no alpha  (Dynamic Island medium)
//   contact-sheet.png, manifest.json (captions, hashes, source captures)
// The capture is never repainted: only its outer corners are clipped.
const fs = require('fs');
const path = require('path');
const L = require('./lib/launch-media.cjs');
const { C, text, fitSize, pill, svgDoc, SCENES } = L;

const DEFAULT_ORDER = ['alerts', 'review', 'home', 'intelligence', 'recipes', 'item-history', 'library', 'suppliers', 'personal'];
const REQUIRED = ['alerts', 'review', 'home', 'recipes', 'library', 'suppliers'];
const SLUG = { alerts: 'price-alerts', review: 'scan-review', home: 'spending', intelligence: 'purchasing-intelligence', recipes: 'recipe-costing', 'item-history': 'item-history', library: 'invoice-library', suppliers: 'suppliers', personal: 'personal' };
const W = 1320, H = 2868;
const SIZES = { '6.9': [1320, 2868], '6.3': [1206, 2622] };

function frameSvg(key, index, total, captureBuf) {
  const s = SCENES[key];
  let b = `<rect width="${W}" height="${H}" fill="${s.bg}"/><circle cx="1240" cy="2780" r="480" fill="${C.lime}" opacity=".30"/>`;
  // Header row: wordmark + set counter (right-aligned, derived from the set size).
  b += text('Sift', 92, 120, 56, C.green, 800);
  b += text(`${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, 1228, 116, 28, C.muted, 500, { anchor: 'end', tracking: 1 });
  // Eyebrow: optional plan pill + feature label, >= 30 px so it survives product-page thumbnails.
  let x = 94;
  if (s.pro) {
    const p = pill(s.pro, x, 176, { height: 52, size: 25, tracking: 2.5 });
    b += p.svg; x += p.width + 18;
  }
  b += text(s.eyebrow, x, 213, 30, C.green, 700, { tracking: 3 });
  const hs = fitSize(s.lines, 90, 800, 1140);
  b += text(s.lines[0], 90, 340, hs, C.ink, 800) + text(s.lines[1], 90, 450, hs, C.ink, 800);
  b += text(s.sub, 94, 530, fitSize([s.sub], 34, 500, 1140), C.muted, 500);
  // Device-coloured frame + clipped capture (same geometry as v1 for set consistency).
  const defs = `<clipPath id="screen"><rect x="160" y="610" width="1000" height="2173" rx="86"/></clipPath>`;
  b += `<rect x="145" y="595" width="1030" height="2228" rx="100" fill="${C.green}"/>`;
  b += `<image clip-path="url(#screen)" href="${L.dataUri(captureBuf)}" x="160" y="610" width="1000" height="2173" preserveAspectRatio="xMidYMid meet"/>`;
  return svgDoc(W, H, b, defs);
}

async function main() {
  const args = L.parseArgs();
  if (!args.captures) throw new Error('Usage: --captures <dir> [--out <dir>] [--order a,b,...] [--allow-missing]');
  const capDir = path.resolve(args.captures);
  const out = path.resolve(args.out || path.join(L.root, 'launch-assets/screenshots/app-store-v2'));
  const order = (args.order ? String(args.order).split(',') : DEFAULT_ORDER).map((n) => {
    const k = L.canonicalScene(n.trim()); if (!k) throw new Error('Unknown scene: ' + n); return k;
  });
  const found = [], missing = [];
  for (const k of order) {
    const p = L.findCapture(capDir, SCENES[k].aliases);
    if (p) found.push([k, p]); else missing.push(k);
  }
  const missingRequired = missing.filter((k) => REQUIRED.includes(k));
  if (missingRequired.length && !args['allow-missing']) throw new Error('Missing required captures: ' + missingRequired.join(', '));
  if (missing.length) console.warn('Skipping scenes without a capture:', missing.join(', '));

  for (const d of Object.keys(SIZES)) fs.mkdirSync(path.join(out, d), { recursive: true });
  const manifest = { createdAt: new Date().toISOString(), captures: capDir, sizes: SIZES, screenshots: [] };
  const total = found.length;
  for (let i = 0; i < total; i++) {
    const [key, file] = found[i];
    const meta = await L.sharp(file).metadata();
    if (meta.width !== W || meta.height !== H) throw new Error(`${path.basename(file)} is ${meta.width}x${meta.height}; expected native ${W}x${H} (iPhone 16/17 Pro Max simulator)`);
    // Flatten any alpha in the raw (simctl PNGs are RGBA) before embedding.
    const capture = await L.sharp(file).flatten({ background: '#FFFFFF' }).removeAlpha().png().toBuffer();
    const name = `${String(i + 1).padStart(2, '0')}-${SLUG[key]}`;
    const source = frameSvg(key, i, total, capture);
    fs.writeFileSync(path.join(out, '6.9', name + '.svg'), source);
    const master = await L.sharp(Buffer.from(source), { density: 72 }).flatten({ background: C.cream }).removeAlpha().png().toBuffer();
    const entry = { scene: key, name, capture: path.basename(file), captureSha256: L.sha256(fs.readFileSync(file)), eyebrow: [SCENES[key].pro, SCENES[key].eyebrow].filter(Boolean).join(' · '), headline: SCENES[key].lines, sub: SCENES[key].sub, files: {} };
    for (const [d, [w, h]] of Object.entries(SIZES)) {
      const buf = w === W ? master : await L.sharp(master).resize(w, h, { fit: 'cover', kernel: 'lanczos3' }).removeAlpha().png().toBuffer();
      const outFile = path.join(out, d, name + '.png');
      fs.writeFileSync(outFile, buf);
      const m = await L.sharp(buf).metadata();
      if (m.width !== w || m.height !== h || m.hasAlpha || m.channels !== 3) throw new Error(`Bad export ${outFile}: ${m.width}x${m.height} ch${m.channels} alpha=${m.hasAlpha}`);
      entry.files[d] = { path: path.relative(out, outFile), width: w, height: h, sha256: L.sha256(buf) };
    }
    manifest.screenshots.push(entry);
    console.log(`${name}  <- ${path.basename(file)}`);
  }
  // Review-only contact sheet (not an upload asset).
  const tw = 330, th = 717, gap = 24, cols = Math.min(total, 4), rows = Math.ceil(total / cols);
  const tiles = await Promise.all(manifest.screenshots.map(async (e, i) => ({
    input: await L.sharp(path.join(out, e.files['6.9'].path)).resize(tw, th).png().toBuffer(),
    left: gap + (i % cols) * (tw + gap), top: gap + Math.floor(i / cols) * (th + gap),
  })));
  await L.sharp({ create: { width: gap + cols * (tw + gap), height: gap + rows * (th + gap), channels: 3, background: '#DDDDD5' } })
    .composite(tiles).png().toFile(path.join(out, 'contact-sheet.png'));
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Rendered ${total} screenshots x ${Object.keys(SIZES).length} sizes -> ${out}`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
