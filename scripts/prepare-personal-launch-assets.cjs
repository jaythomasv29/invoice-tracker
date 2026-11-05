// Actual native Personal capture; all example purchases belong to a disposable fixture.
const fs=require('fs');
const path=require('path');
const {text,svg,exportSvg,imageData,C}=require('./create-launch-assets.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const raw='personal/2026-11-04/raw/personal-home.png';
 let body=`<rect width="1320" height="2868" fill="${C.cream}"/><circle cx="1230" cy="2740" r="480" fill="${C.lime}" opacity=".3"/>`;
 body+=text('Sift',92,120,56,C.green)+text('PERSONAL · GROCERIES & HOUSEHOLD',94,205,23,C.green)+text('Everyday essentials.',90,330,86)+text('A clearer picture.',90,440,90)+text('Spending by store, week and month.',94,518,32,C.muted);
 body+=`<rect x="145" y="595" width="1030" height="2228" rx="100" fill="${C.green}"/><defs><clipPath id="personal"><rect x="160" y="610" width="1000" height="2173" rx="86"/></clipPath></defs><image clip-path="url(#personal)" href="${imageData(raw)}" x="160" y="610" width="1000" height="2173" preserveAspectRatio="xMidYMid meet"/>`;
 await exportSvg('screenshots/app-store/07-personal',svg(1320,2868,body));
 const icon=fs.readFileSync(path.join(root,'launch-assets/brand/sift-icon.svg'),'utf8').replace(/^<svg[^>]*>|<\/svg>$/g,'');
 let header=`<rect width="3840" height="1646" fill="${C.green}"/><circle cx="3140" cy="870" r="910" fill="#1B503E"/><circle cx="3140" cy="870" r="650" fill="none" stroke="#35624C" stroke-width="2"/>`;
 header+=text('Sift',480,410,95,C.lime)+text('Home or work.',475,690,184,C.cream)+text('In the clear.',475,910,184,C.cream)+text('EVERY PURCHASE. MORE PERSPECTIVE.',485,1080,43,'#C4D7CD');
 header+=`<g transform="translate(2400,290) rotate(-8,500,500)">${icon}</g>`;
 await exportSvg('creative/product-page-header-3840x1646',svg(3840,1646,header));
 let search=`<rect width="3840" height="2560" fill="${C.cream}"/><circle cx="3210" cy="1130" r="1500" fill="#E0EBD9"/>`;
 search+=text('Sift',260,500,120,C.green)+text('Every purchase.',250,880,160)+text('A little clearer.',250,1080,160)+text('Grocery receipts. Business invoices.',260,1250,48,C.muted)+text('Two workspaces. One Sift.',260,1330,48,C.muted)+text('Free to start. Optional Pro insights.',260,1660,40,C.green);
 for(const [id,file,x,y] of [['personal',raw,2140,500],['business','screenshots/raw/01-overview.png',2930,650]]){
  search+=`<rect x="${x-15}" y="${y-15}" width="720" height="1530" rx="80" fill="${C.green}"/><defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="690" height="1499" rx="70"/></clipPath></defs><image clip-path="url(#${id})" href="${imageData(file)}" x="${x}" y="${y}" width="690" height="1499" preserveAspectRatio="xMidYMid meet"/>`;
 }
 await exportSvg('creative/search-results-3840x2560',svg(3840,2560,search));
 let social=`<rect width="1200" height="630" fill="${C.green}"/>`;
 social+=text('Sift',80,130,58,C.lime)+text('Every purchase.',76,285,82,C.cream)+text('A little clearer.',76,390,82,C.cream)+text('PERSONAL + BUSINESS',82,525,27,'#C4D7CD');
 await exportSvg('personal/2026-11-04/social-card',svg(1200,630,social));
 fs.copyFileSync(path.join(root,'launch-assets/personal/2026-11-04/social-card.png'),path.join(root,'website/public/social-card.png'));
 console.log('Personal store screenshot, dual-workspace header/search creative, and social card prepared.');
})().catch(e=>{console.error(e.message);process.exit(1)});
