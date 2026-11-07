// Renders launch-assets/brand/demo-invoice.svg (+ .png) — the "photo" shown on
// the review screen in captures, next to buildDemoReviewInvoice()'s extracted
// lines. Line content is date-independent (see lib/demoLedger.ts); only the
// printed date follows the capture date, so re-run before a capture session
// in a new week:
//
//   node --experimental-strip-types scripts/capture/render-demo-invoice.mjs [yyyy-mm-dd]
//
// PNG output needs `sharp`; point SHARP_DIR at a folder whose node_modules has
// it (e.g. a scratch `npm i sharp`) or the script writes the SVG only.
import { Buffer } from "node:buffer";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { buildDemoLedger, DEMO_RESTAURANT_NAME, DEMO_TAX_RATE } from "../../lib/demoLedger.ts";

const arg = process.argv[2];
const now = arg ? new Date(`${arg}T12:00:00`) : new Date();
const inv = buildDemoLedger(now).invoices.find((i) => i.vendor === "cascade" && i.k === 0);
const out = new URL("../../launch-assets/brand/", import.meta.url).pathname;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const money = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const code = (key) => String(1000000 + ([...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 8999999, 7))).slice(0, 7);
const [y, m, d] = inv.dateIso.split("-").map(Number);
const printed = new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

const W = 900, H = 1200, L = 50, R = 850;
const t = (x, yy, s, attrs = "") => `<text x="${x}" y="${yy}" ${attrs}>${esc(s)}</text>`;
const rows = inv.lines.map((l, i) => {
  const yy = 352 + i * 35;
  const qty = Number.isInteger(l.qty) ? String(l.qty) : l.qty.toFixed(1);
  return [
    i % 2 ? "" : `<rect x="${L}" y="${yy - 23}" width="${R - L}" height="35" fill="#F4F6F3"/>`,
    t(98, yy, qty, 'text-anchor="end"'),
    t(112, yy, l.unit),
    t(162, yy, code(l.key)),
    t(252, yy, l.raw),
    t(726, yy, money(l.unitPrice), 'text-anchor="end"'),
    t(R - 6, yy, money(l.ext), 'text-anchor="end"'),
  ].join("");
}).join("");
const tableEnd = 352 + inv.lines.length * 35 - 12;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#FFFFFF"/>
<g fill="#172C25" font-family="Helvetica, Arial, sans-serif">
${t(L, 78, inv.vendorName.toUpperCase(), 'font-size="34" font-weight="700" letter-spacing="1"')}
${t(L, 108, "Broadline foodservice distribution", 'font-size="16" fill="#55645D"')}
${t(L, 132, "SAMPLE INVOICE · FICTIONAL DATA", 'font-size="14" fill="#8A958F" letter-spacing="1.5"')}
${t(R, 78, "INVOICE", 'font-size="28" font-weight="700" text-anchor="end"')}
${t(R, 108, `No. ${inv.invoiceNumber}`, 'font-size="17" text-anchor="end"')}
${t(R, 132, printed, 'font-size="17" text-anchor="end"')}
<path d="M${L} 158H${R}" stroke="#172C25" stroke-width="2"/>
${t(L, 192, "BILL TO", 'font-size="13" fill="#8A958F" letter-spacing="1.5"')}
${t(L, 220, DEMO_RESTAURANT_NAME, 'font-size="21" font-weight="700"')}
${t(L, 244, "Receiving: back dock, 7–10 AM", 'font-size="15" fill="#55645D"')}
${t(560, 192, "TERMS", 'font-size="13" fill="#8A958F" letter-spacing="1.5"')}
${t(560, 220, "Net 14", 'font-size="18"')}
${t(700, 192, "ROUTE / STOP", 'font-size="13" fill="#8A958F" letter-spacing="1.5"')}
${t(700, 220, "R12 / 07", 'font-size="18"')}
</g>
<g fill="#172C25" font-family="Helvetica, Arial, sans-serif" font-size="12" font-weight="700" letter-spacing="1">
<path d="M${L} 286H${R}" stroke="#172C25" stroke-width="1.5"/>
${t(98, 306, "QTY", 'text-anchor="end"')}${t(112, 306, "UOM")}${t(162, 306, "ITEM #")}${t(252, 306, "DESCRIPTION")}${t(726, 306, "PRICE", 'text-anchor="end"')}${t(R - 6, 306, "EXTENSION", 'text-anchor="end"')}
<path d="M${L} 318H${R}" stroke="#172C25" stroke-width="1"/>
</g>
<g fill="#1F2A26" font-family="Courier New, Courier, monospace" font-size="15.5">${rows}</g>
<path d="M${L} ${tableEnd}H${R}" stroke="#172C25" stroke-width="1"/>
<g fill="#172C25" font-family="Helvetica, Arial, sans-serif" font-size="17">
${t(560, tableEnd + 36, `${inv.lines.length} lines · ${inv.lines.reduce((s, l) => s + (Number.isInteger(l.qty) ? l.qty : 1), 0)} pieces`, 'font-size="13" fill="#8A958F" text-anchor="end"')}
${t(600, tableEnd + 36, "Subtotal")}${t(R - 6, tableEnd + 36, `$${money(inv.subtotal)}`, 'text-anchor="end"')}
${t(600, tableEnd + 64, `Tax (${(DEMO_TAX_RATE * 100).toFixed(2)}% supplies)`)}${t(R - 6, tableEnd + 64, `$${money(inv.tax)}`, 'text-anchor="end"')}
<path d="M600 ${tableEnd + 80}H${R}" stroke="#172C25" stroke-width="1.5"/>
${t(600, tableEnd + 112, "TOTAL DUE", 'font-size="22" font-weight="700"')}${t(R - 6, tableEnd + 112, `$${money(inv.total)}`, 'font-size="22" font-weight="700" text-anchor="end"')}
${t(L, H - 34, "Created only for Sift product demonstrations. Fictional supplier, customer and amounts.", 'font-size="13" fill="#8A958F"')}
</g>
</svg>
`;

writeFileSync(join(out, "demo-invoice.svg"), svg);
console.log(`demo-invoice.svg: ${inv.invoiceNumber} · ${printed} · ${inv.lines.length} lines · $${money(inv.total)}`);
try {
  const require = createRequire(join(process.env.SHARP_DIR ?? process.cwd(), "noop.js"));
  const sharp = require("sharp");
  await sharp(Buffer.from(svg), { density: 144 }).png().toFile(join(out, "demo-invoice.png"));
  console.log("demo-invoice.png written");
} catch (e) {
  console.warn(`PNG skipped (${e.code ?? e.message}); set SHARP_DIR to a folder with sharp installed.`);
}
