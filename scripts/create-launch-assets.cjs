// Rebuild branded artwork from real native captures; see launch-assets/README.md.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const media = process.env.SIFT_MEDIA_TOOLS || '/tmp/sift-media-tools';
const sharp = require(require.resolve('sharp', { paths: [path.join(root, 'website'), media] }));
const fontkit = require(require.resolve('fontkit', { paths: [media] }));
const font = fontkit.openSync(path.join(root, 'node_modules/@expo-google-fonts/manrope/800ExtraBold/Manrope_800ExtraBold.ttf'));
const regular = fontkit.openSync(path.join(root, 'node_modules/@expo-google-fonts/manrope/500Medium/Manrope_500Medium.ttf'));
const base = path.join(root, 'launch-assets');
const C = {ink:'#172C25',green:'#123D30',cream:'#F5F5F0',sage:'#E7F1EB',lime:'#D5ECA0',muted:'#5D6D64'};
function text(t,x,y,size,color=C.ink,face=font) {
  const run=face.layout(t);const scale=size/face.unitsPerEm;let pen=x;
  return run.glyphs.map((g,i)=>{const p=run.positions[i];const svg=`<path fill="${color}" d="${g.path.toSVG()}" transform="translate(${pen+p.xOffset*scale},${y-p.yOffset*scale}) scale(${scale},${-scale})"/>`;pen+=p.xAdvance*scale;return svg;}).join('');
}
const svg=(w,h,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const imageData=f=>'data:image/png;base64,'+fs.readFileSync(path.join(base,f)).toString('base64');
async function exportSvg(name,source){fs.writeFileSync(path.join(base,name+'.svg'),source);await sharp(Buffer.from(source)).flatten({background:C.cream}).removeAlpha().png().toFile(path.join(base,name+'.png'));}
async function main(){
 const stories=[
  ['01-overview','Every invoice.','A clearer picture.','Spending across vendors, days and months.','OVERVIEW',C.cream],
  ['02-invoices','All your invoices.','One calm place.','Search by supplier or invoice number.','INVOICE LIBRARY',C.cream],
  ['03-review','AI reads.','You stay in control.','Review the details before you save.','SCAN & REVIEW',C.sage],
  ['04-recipes','Know the cost','behind every dish.','Ingredient costs grounded in your invoices.','PRO · RECIPE COSTING',C.sage],
  ['05-alerts','Spot the changes','that add up.','Follow supplier price increases with Pro.','PRO · PRICE ALERTS','#F7EEE3'],
  ['06-suppliers','Every supplier.','One clear view.','Compare purchasing across your vendors.','SUPPLIER INSIGHTS',C.cream],
 ];
 for(let i=0;i<stories.length;i++){
  const [name,line1,line2,sub,tag,bg]=stories[i];const raw='screenshots/raw/'+name+'.png';if(!fs.existsSync(path.join(base,raw)))continue;
  let b=`<rect width="1320" height="2868" fill="${bg}"/><circle cx="1240" cy="2780" r="480" fill="${C.lime}" opacity=".30"/>`;
  b+=text('Sift',92,120,56,C.green)+text(`${String(i+1).padStart(2,'0')} / 06`,1080,116,24,C.muted,regular);
  b+=text(tag,94,205,23,C.green,regular)+text(line1,90,330,90)+text(line2,90,440,90)+text(sub,94,518,32,C.muted,regular);
  b+=`<rect x="145" y="595" width="1030" height="2228" rx="100" fill="${C.green}"/><image href="${imageData(raw)}" x="160" y="610" width="1000" height="2173" preserveAspectRatio="xMidYMid meet"/>`;
  // Round only the outside corners of the real capture; no UI is repainted.
  b=b.replace(/<image href=/,'<defs><clipPath id="screen"><rect x="160" y="610" width="1000" height="2173" rx="86"/></clipPath></defs><image clip-path="url(#screen)" href=');
  await exportSvg('screenshots/app-store/'+name,svg(1320,2868,b));
 }
 const icon=fs.readFileSync(path.join(base,'brand/sift-icon.svg'),'utf8').replace(/^<svg[^>]*>|<\/svg>$/g,'');
 let h=`<rect width="3840" height="1646" fill="${C.green}"/><circle cx="3140" cy="870" r="910" fill="#1B503E"/><circle cx="3140" cy="870" r="650" fill="none" stroke="#35624C" stroke-width="2"/><circle cx="3140" cy="870" r="450" fill="none" stroke="#35624C" stroke-width="2"/>`;
 h+=text('Sift',480,410,95,'#D5ECA0')+text('Your kitchen.',475,690,184,'#F5F5EA')+text('In the clear.',475,910,184,'#F5F5EA')+text('INVOICES. COSTS. CLARITY.',485,1080,43,'#C4D7CD',regular);
 h+=`<g transform="translate(2400,290) rotate(-8,500,500)">${icon}</g>`;
 await exportSvg('creative/product-page-header-3840x1646',svg(3840,1646,h));
 if(fs.existsSync(path.join(base,'screenshots/raw/01-overview.png'))){
  let b=`<rect width="3840" height="2560" fill="${C.cream}"/><circle cx="3210" cy="1130" r="1500" fill="#E0EBD9"/>`;
  b+=text('Sift',260,500,120,C.green)+text('Restaurant costs,',250,880,160)+text('made clear.',250,1080,160)+text('Your invoices. Your suppliers.',260,1250,57,C.muted,regular)+text('A better view of your kitchen.',260,1330,57,C.muted,regular)+text('Invoice tracking + Pro recipe costing',260,1660,43,C.green,regular);
  b+=`<rect x="2235" y="298" width="945" height="2014" rx="105" fill="${C.green}"/><defs><clipPath id="searchscreen"><rect x="2250" y="318" width="915" height="1988" rx="90"/></clipPath></defs><image clip-path="url(#searchscreen)" href="${imageData('screenshots/raw/01-overview.png')}" x="2250" y="318" width="915" height="1988"/>`;
  await exportSvg('creative/search-results-3840x2560',svg(3840,2560,b));
 }
 const exports=stories.filter(([name])=>fs.existsSync(path.join(base,'screenshots/app-store',name+'.png'))).map(([name])=>name);
 const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sift launch assets</title><style>body{margin:0;background:${C.cream};color:${C.ink};font:16px/1.6 system-ui;padding:48px}h1{font-size:48px;letter-spacing:-2px;margin:0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px;margin:30px 0}img{max-width:100%;border-radius:16px}.wide{display:block;max-width:1100px;margin:24px 0}a{color:${C.green}}video{max-width:330px}</style><h1>Sift. Kitchen clarity.</h1><p>App Store artwork and actual iPhone captures. Fictional sample restaurant data. Pro features are labeled.</p><div class="grid">${exports.map(n=>`<a href="screenshots/app-store/${n}.png"><img alt="Sift ${n.slice(3)} screenshot" src="screenshots/app-store/${n}.png"></a>`).join('')}</div><h2>Creative placements</h2><img class="wide" alt="Product page header" src="creative/product-page-header-3840x1646.png"><img class="wide" alt="Search result creative" src="creative/search-results-3840x2560.png"><h2>App icon</h2><img width="180" alt="Sift receipt S icon" src="brand/sift-icon-1024.png"><h2>App preview</h2><video controls muted preload="metadata" src="previews/sift-app-preview-886x1920.mp4"></video><p>Sources and requirements: <a href="README.md">README</a>. Raw app captures are preserved in screenshots/raw.</p></html>`;
 fs.writeFileSync(path.join(base,'index.html'),html);console.log('Generated',exports.length,'store screenshots, header, search creative and local gallery.');
}
main().catch(e=>{console.error(e.message);process.exit(1)});
