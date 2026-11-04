const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const sharp=require(root+'/website/node_modules/sharp');
const source=path.join(root,'launch-assets/website/2026-11-04');
const publicRoot=path.join(root,'website/public');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 fs.mkdirSync(publicRoot+'/media',{recursive:true});
 const manifest={createdAt:new Date().toISOString(),appCommit:'cd9cd3e',data:'Fictional local demo ledger; disposable development identity. No production restaurant data.',screens:{},film:{}};
 for(const name of ['home','intelligence','review','alerts','library','recipes','suppliers']){
  const file=source+'/raw/'+name+'.png';const raw=fs.readFileSync(file);const meta=await sharp(raw).metadata();
  if(meta.width!==1320||meta.height!==2868)throw Error('Unexpected native geometry: '+name);
  const image=await sharp(raw).webp({quality:95,effort:6}).toBuffer();
  const filename=name+'-'+hash(image).slice(0,10)+'.webp';
  fs.writeFileSync(publicRoot+'/screens/'+filename,image);fs.writeFileSync(source+'/'+filename,image);
  manifest.screens[name]={src:'/screens/'+filename,width:meta.width,height:meta.height,sha256:hash(image),rawSha256:hash(raw)};
 }
 const original=fs.readFileSync(source+'/video/Sift-launch-film-1920x1080-original.mp4');
 const video=fs.readFileSync(source+'/video/Sift-launch-film-web-1920x1080.mp4');
 const poster=fs.readFileSync(source+'/video/launch-film-poster.jpg');
 const captions=fs.readFileSync(source+'/video/launch-film.en.vtt');
 const copy=(buffer,name,ext)=>{const filename=name+'-'+hash(buffer).slice(0,10)+'.'+ext;fs.writeFileSync(publicRoot+'/media/'+filename,buffer);return '/media/'+filename;};
 manifest.film={src:copy(video,'sift-launch-film','mp4'),poster:copy(poster,'sift-launch-film-poster','jpg'),captions:copy(captions,'sift-launch-film.en','vtt'),durationSeconds:45,width:1920,height:1080,sha256:hash(video),originalSha256:hash(original),edition:'Website prelaunch closing card replaces the original final 7.5 seconds. Original audio retained.'};
 fs.writeFileSync(source+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
 fs.writeFileSync(root+'/website/src/content/media.json',JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({screens:Object.keys(manifest.screens),film:manifest.film.src,sourceDirectory:source}));
})().catch(e=>{console.error(e.message);process.exit(1)});
