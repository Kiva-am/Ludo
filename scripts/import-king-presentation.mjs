// Import only presentation assets from the captured King client. No game rules.
import {readFile,mkdir,copyFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const source=resolve('ludo-king/ludo-king/public/play/assets/main');
const config=JSON.parse(await readFile(source+'/config.606d4.json'));
const pack=JSON.parse(await readFile(source+'/import/0f/0fdff2675.0d0bf.json'));
function uuid(value){if(value.length!==22)return value;const h=value.slice(0,2)+Buffer.from(value.slice(2),'base64').toString('hex');return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');}
const out=resolve('original-ludo/king');await mkdir(out,{recursive:true});
const manifest={source:'Captured Ludo King client, assets/main/config.606d4.json',sounds:{},assets:[]};
for(let index=0;index<pack[5].length;index++){
 const entry=pack[5][index];const clip=entry?.[0]?.[0];
 if(!Array.isArray(clip)||!/^\.(mp3|wav)$/.test(clip[2]))continue;
 const id=config.packs['0fdff2675'][index];const uid=uuid(config.uuids[id]);
 const dir=source+'/native/'+uid.slice(0,2);const file=(await readdir(dir)).find(x=>x.startsWith(uid+'.')&&x.endsWith(clip[2]));
 if(!file)throw Error('Missing King clip '+clip[1]);
 const dest=clip[1]+clip[2];await copyFile(dir+'/'+file,out+'/'+dest);
 manifest.sounds[clip[1]]={file:dest,duration:clip[3]};
 manifest.assets.push({file:dest,source:'assets/main/native/'+uid.slice(0,2)+'/'+file,sha256:createHash('sha256').update(await readFile(out+'/'+dest)).digest('hex')});
}
await writeFile(out+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
// Export atlas coordinates for the small set of menu/start graphics we use.
const wanted=new Set(['game_img_start','mainmenu_img_selectbg','BgMenuButton','Game_Name','BG','play_online','mainmenu_img_bg','soundOn','soundOff']);
const frames={};
for(const entry of pack[5]){
 const frame=entry?.[0]?.[0];if(!wanted.has(frame?.name))continue;
 const uid=uuid(pack[1][entry.at(-1)[0]]);
 const dir=source+'/native/'+uid.slice(0,2);
 const file=(await readdir(dir)).find(x=>x.startsWith(uid+'.')&&/\.(png|jpg)$/.test(x));
 if(!file)throw Error('Missing King texture '+uid);
 const dest='atlas-'+uid+(file.endsWith('.jpg')?'.jpg':'.png');
 await copyFile(dir+'/'+file,out+'/'+dest);
 frames[frame.name]={...frame,texture:dest};
 if(!manifest.assets.some(a=>a.file===dest))manifest.assets.push({file:dest,source:'assets/main/native/'+uid.slice(0,2)+'/'+file,sha256:createHash('sha256').update(await readFile(out+'/'+dest)).digest('hex')});
}
await writeFile(out+'/frames.json',JSON.stringify(frames,null,2)+'\n');
await copyFile(resolve('ludo-king/ludo-king/public/play/assets/resources/native/f2/f25bf61d-32f3-45ad-8a8b-7237b1f66567.7cf5e/CARTERONE.ttf'),out+'/CARTERONE.ttf');
await writeFile(out+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log('Imported '+Object.keys(manifest.sounds).length+' King sound clips.');
