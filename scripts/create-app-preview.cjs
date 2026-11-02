// Edits real native screen recordings; captions occupy a separate top band.
const fs=require('fs');const path=require('path');const {spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..');const media=process.env.SIFT_MEDIA_TOOLS||'/tmp/sift-media-tools';const ffmpeg=require(require.resolve('ffmpeg-static',{paths:[media]}));
const sharp=require(require.resolve('sharp',{paths:[path.join(root,'website'),media]}));const fontkit=require(require.resolve('fontkit',{paths:[media]}));
const source=path.join(root,'launch-assets/previews/source/native-session.mov');
const markers=JSON.parse(fs.readFileSync(path.join(root,'launch-assets/previews/source/scene-markers.json')));
const labels={overview:'Your kitchen, at a glance',recipes:'Pro · Recipe costing',suppliers:'Compare every supplier',invoices:'Keep invoices organized',alerts:'Pro · Price alerts'};
const font=fontkit.openSync(path.join(root,'node_modules/@expo-google-fonts/manrope/700Bold/Manrope_700Bold.ttf'));
function centeredText(str,y,size,color){const run=font.layout(str),scale=size/font.unitsPerEm;let x=(886-run.positions.reduce((a,p)=>a+p.xAdvance,0)*scale)/2;return run.glyphs.map((g,i)=>{const p=run.positions[i];const out=`<path fill="${color}" d="${g.path.toSVG()}" transform="translate(${x+p.xOffset*scale},${y-p.yOffset*scale}) scale(${scale},${-scale})"/>`;x+=p.xAdvance*scale;return out;}).join('');}
async function main(){
 const dir=path.join(root,'launch-assets/previews/source/captions');fs.mkdirSync(dir,{recursive:true});
 const captions=[];for(const m of markers){const p=path.join(dir,m.scene+'.png');const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="886" height="128"><rect width="886" height="128" fill="#F5F5F0"/>${centeredText(labels[m.scene],55,39,'#123D30')}${centeredText('Fictional sample restaurant',98,20,'#5D6D64')}</svg>`;await sharp(Buffer.from(svg)).png().toFile(p);captions.push(p);}
 const args=['-y','-hide_banner'];for(const m of markers)args.push('-i',source);args.push('-f','lavfi','-i','anullsrc=channel_layout=stereo:sample_rate=48000');for(const p of captions)args.push('-i',p);
 const filters=markers.map((m,i)=>`[${i}:v]fps=30,trim=start=${m.start}:duration=4.4,setpts=PTS-STARTPTS,scale=-2:1792,pad=886:1920:(ow-iw)/2:128:color=0xF5F5F0,setsar=1[base${i}];[base${i}][${markers.length+1+i}:v]overlay=0:0,trim=duration=4.4,setpts=PTS-STARTPTS[v${i}]`);
 filters.push(markers.map((_,i)=>`[v${i}]`).join('')+`concat=n=${markers.length}:v=1:a=0[out]`);
 args.push('-filter_complex',filters.join(';'),'-map','[out]','-map',`${markers.length}:a`,'-t','22','-c:v','libx264','-profile:v','high','-level:v','4.0','-pix_fmt','yuv420p','-b:v','10M','-maxrate','12M','-bufsize','20M','-preset','medium','-c:a','aac','-b:a','256k','-ar','48000','-ac','2','-movflags','+faststart',path.join(root,'launch-assets/previews/sift-app-preview-886x1920.mp4'));
 const r=spawnSync(ffmpeg,args,{stdio:'inherit'});if(r.status)process.exit(r.status);
}
main().catch(e=>{console.error(e.message);process.exit(1)});
