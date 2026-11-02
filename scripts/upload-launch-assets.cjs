// Requires an authenticated ASC client factory via SIFT_ASC_CLIENT.
// Uploads draft media only; never submits App Review or releases an app.
const fs=require('fs');const path=require('path');const crypto=require('crypto');
const root=path.resolve(__dirname,'..');const base=path.join(root,'launch-assets');
const localization='13fb9f2a-d0bc-42c9-94f8-64087c0a39b8';
const statusPath=path.join(base,'app-store-upload-status.json');
const status=fs.existsSync(statusPath)?JSON.parse(fs.readFileSync(statusPath)):{appId:'6797084602',localization:'en-US',screenshots:[],creative:[],previews:[]};
const save=()=>fs.writeFileSync(statusPath,JSON.stringify(status,null,2)+'\n');
let api;
async function upload(file,type,endpoint,relationships,extra={}){
 const bytes=fs.readFileSync(path.join(base,file));
 const created=await api(endpoint,'POST',{data:{type,attributes:{fileName:path.basename(file),fileSize:bytes.length,...extra},relationships}});
 const asset=created.data;
 for(const op of asset.attributes.uploadOperations??[]){
  const headers=Object.fromEntries((op.requestHeaders??[]).map(h=>[h.name,h.value]));
  const response=await fetch(op.url,{method:op.method,headers,body:bytes.subarray(op.offset,op.offset+op.length),signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw Error(`Asset byte upload failed: ${response.status} ${file}`);
 }
 const attrs={uploaded:true};if(type!=='appAssetLibraryImages')attrs.sourceFileChecksum=crypto.createHash('md5').update(bytes).digest('hex');
 const committed=await api(`${endpoint}/${asset.id}`,'PATCH',{data:{type,id:asset.id,attributes:attrs}});
 return {file,id:asset.id,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),state:committed.data.attributes.assetDeliveryState?.state??committed.data.attributes.state??'UPLOADED'};
}
const rel=(type,id)=>({data:{type,id}});
async function main(){
 if(!process.env.SIFT_ASC_CLIENT)throw Error('Set SIFT_ASC_CLIENT to an authenticated ASC client factory; do not put keys in this repository.');
 api=await require(path.resolve(process.env.SIFT_ASC_CLIENT))();
 const sets=await api(`/v1/appStoreVersionLocalizations/${localization}/appScreenshotSets`);
 let set=sets.data.find(x=>x.attributes.screenshotDisplayType==='APP_IPHONE_67');
 if(!set)set=(await api('/v1/appScreenshotSets','POST',{data:{type:'appScreenshotSets',attributes:{screenshotDisplayType:'APP_IPHONE_67'},relationships:{appStoreVersionLocalization:rel('appStoreVersionLocalizations',localization)}}})).data;
 status.screenshotSet=set.id;save();
 for(const file of fs.readdirSync(path.join(base,'screenshots/app-store')).filter(x=>x.endsWith('.png')).sort()){
  const f='screenshots/app-store/'+file;if(status.screenshots.some(x=>x.file===f))continue;
  const result=await upload(f,'appScreenshots','/v1/appScreenshots',{appScreenshotSet:rel('appScreenshotSets',set.id)});status.screenshots.push(result);save();console.log(JSON.stringify({kind:'screenshot',...result}));
 }
 const library=(await api('/v1/apps/6797084602/assetLibrary')).data.id;
 for(const [file,placementType] of [['creative/product-page-header-3840x1646.png','PRODUCT_PAGE_HEADER_ASSET'],['creative/search-results-3840x2560.png','APP_STORE_SEARCH_RESULTS_ASSET']]){
  let result=status.creative.find(x=>x.file===file);
  const expectedHash=crypto.createHash('sha256').update(fs.readFileSync(path.join(base,file))).digest('hex');
  if(result && result.sha256!==expectedHash){
    const referenceName=(placementType==='PRODUCT_PAGE_HEADER_ASSET'?'Sift — kitchen clarity header':'Sift — restaurant costs search')+' revision '+expectedHash.slice(0,8);
    let replacement=result.pendingRevision;
    if(!replacement){
      const existing=(await api(`/v1/appAssetLibraries/${library}/images?limit=200`)).data.find(x=>x.attributes.referenceName===referenceName);
      replacement=existing?{file,id:existing.id,sha256:expectedHash,state:existing.attributes.state}:await upload(file,'appAssetLibraryImages','/v1/appAssetLibraryImages',{assetLibrary:rel('appAssetLibraries',library)},{category:'CREATIVE_ASSETS',referenceName});
      result.pendingRevision=replacement;save();
    }
    const oldId=result.id,oldPlacement=result.placement;
    const place=id=>api('/v1/appAssetLibraryPlacements','POST',{data:{type:'appAssetLibraryPlacements',attributes:{placementType},relationships:{image:rel('appAssetLibraryImages',id),appStoreVersionLocalization:rel('appStoreVersionLocalizations',localization)}}});
    let placed;
    try { placed=await place(replacement.id); }
    catch(e){
      if(!oldPlacement || !e.message.includes('409'))throw e;
      await api(`/v1/appAssetLibraryPlacements/${oldPlacement}`,'DELETE');
      try {placed=await place(replacement.id);}
      catch(error){const restored=await place(oldId);result.placement=restored.data.id;save();throw error;}
    }
    if(oldPlacement){try{await api(`/v1/appAssetLibraryPlacements/${oldPlacement}`,'DELETE');}catch(e){if(!e.message.includes('404'))throw e;}}
    Object.assign(result,replacement,{placement:placed.data.id,previousAssetId:oldId,previousPlacement:oldPlacement});delete result.pendingRevision;delete result.orderingRequest;save();console.log(JSON.stringify({kind:'creative-revision',...result}));
  }
  if(!result){result=await upload(file,'appAssetLibraryImages','/v1/appAssetLibraryImages',{assetLibrary:rel('appAssetLibraries',library)},{category:'CREATIVE_ASSETS',referenceName:placementType==='PRODUCT_PAGE_HEADER_ASSET'?'Sift — kitchen clarity header':'Sift — restaurant costs search'});status.creative.push(result);save();console.log(JSON.stringify({kind:'creative',...result}));}
  if(!result.placement){const placed=await api('/v1/appAssetLibraryPlacements','POST',{data:{type:'appAssetLibraryPlacements',attributes:{placementType},relationships:{image:rel('appAssetLibraryImages',result.id),appStoreVersionLocalization:rel('appStoreVersionLocalizations',localization)}}});result.placement=placed.data.id;save();console.log(JSON.stringify({kind:'placement',type:placementType,id:result.placement}));}
 }
 // Apple orders each creative placement type independently.
 for(const result of status.creative){
  if(result.orderingRequest)continue;
  const ordered=await api('/v1/appAssetLibraryPlacementOrderingRequests','POST',{data:{type:'appAssetLibraryPlacementOrderingRequests',attributes:{placementGroup:'DEFAULT_PROFILE'},relationships:{orderedPlacements:{data:[{type:'appAssetLibraryPlacements',id:result.placement}]},appStoreVersionLocalization:rel('appStoreVersionLocalizations',localization)}}});
  result.orderingRequest=ordered.data.id;save();
 }
 const previewFile='previews/sift-app-preview-886x1920.mp4';
 if(fs.existsSync(path.join(base,previewFile))&&!status.previews.some(x=>x.file===previewFile)){
  const sets=await api(`/v1/appStoreVersionLocalizations/${localization}/appPreviewSets`);let set=sets.data.find(x=>x.attributes.previewType==='IPHONE_67');
  if(!set)set=(await api('/v1/appPreviewSets','POST',{data:{type:'appPreviewSets',attributes:{previewType:'IPHONE_67'},relationships:{appStoreVersionLocalization:rel('appStoreVersionLocalizations',localization)}}})).data;
  const result=await upload(previewFile,'appPreviews','/v1/appPreviews',{appPreviewSet:rel('appPreviewSets',set.id)},{mimeType:'video/mp4',previewFrameTimeCode:'00:00:02:00'});status.previews.push(result);save();console.log(JSON.stringify({kind:'preview',...result}));
 }
 console.log('Draft media upload requests completed. Verify Apple processing and browser placements.');
}
main().catch(e=>{console.error(e.message);process.exit(1)});
