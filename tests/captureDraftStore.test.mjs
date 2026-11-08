import test from 'node:test';
import assert from 'node:assert/strict';
import {createCaptureDraftStore} from '../lib/captureDraftStore.ts';
function disk(){const files=new Map([['camera:1','photo1'],['camera:2','photo2']]);return {files,adapter:{read:async p=>files.get(p)??null,write:async(p,s)=>{files.set(p,s)},mkdir:async()=>{},copy:async(a,b)=>{if(!files.has(a))throw Error('missing source');files.set(b,files.get(a))},exists:async p=>files.has(p),remove:async p=>{for(const k of files.keys())if(k===p||k.startsWith(p))files.delete(k)}}};}
test('a fresh process recovers its photos and upload ID after the camera cache is lost',async()=>{
 const {files,adapter}=disk();const store=createCaptureDraftStore(adapter);const saved=await store.save('user1/business/',['camera:1','camera:2'],'invoice1');files.delete('camera:1');files.delete('camera:2');
 assert.deepEqual(await createCaptureDraftStore(adapter).load('user1/business/'),saved);
 assert.deepEqual(await store.load('user1/personal/'),{pages:[]});assert.deepEqual(await store.load('user2/business/'),{pages:[]});
});
test('a failed copy preserves the previous recoverable batch',async()=>{
 const {adapter}=disk();const store=createCaptureDraftStore(adapter);const before=await store.save('user1/business/',['camera:1']);await assert.rejects(store.save('user1/business/',['camera:2','missing']));assert.deepEqual(await store.load('user1/business/'),before);
});
test('removing a page persists across relaunch and cleanup only affects its owner',async()=>{
 const {adapter,files}=disk();const store=createCaptureDraftStore(adapter);const first=await store.save('user1/business/',['camera:1','camera:2']);await store.save('user2/business/',['camera:1']);await store.save('user1/business/',[first.pages[1]]);assert.equal(files.has(first.pages[0]),false);assert.equal((await store.load('user1/business/')).pages.length,1);await store.clear('user1/');assert.equal((await store.load('user1/business/')).pages.length,0);assert.equal((await store.load('user2/business/')).pages.length,1);
});
test('a missing persisted page cannot silently become a partial invoice',async()=>{
 const {adapter,files}=disk();const store=createCaptureDraftStore(adapter);const draft=await store.save('owner/workspace/',['camera:1','camera:2']);files.delete(draft.pages[0]);await assert.rejects(store.load('owner/workspace/'),/unavailable/);
});
test('temporary photos are released only after a durable manifest is committed',async()=>{
 const {adapter,files}=disk();const released=[];adapter.releaseSource=async p=>{assert.ok(files.has('owner/workspace/draft.json'));released.push(p);files.delete(p)};const store=createCaptureDraftStore(adapter);await assert.rejects(store.save('owner/workspace/',['camera:1','missing']));assert.deepEqual(released,[]);assert.ok(files.has('camera:1'));const draft=await store.save('owner/workspace/',['camera:1']);assert.deepEqual(released,['camera:1']);assert.equal(files.has('camera:1'),false);assert.equal((await store.load('owner/workspace/')).pages[0],draft.pages[0]);
});
