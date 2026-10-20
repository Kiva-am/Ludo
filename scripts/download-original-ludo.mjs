import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve('original-ludo');
const origin='https://html5.gamedistribution.com/rvvASMiM/951d399995cc4ea5a528c9b7e873066b/';
await mkdir(root,{recursive:true});
for(const file of ['index.html','game.js'])await copyFile(resolve('.reference/ludo-hero',file),resolve(root,file));
const script=await readFile(resolve(root,'game.js'),'utf8');
const assets=new Set(['game.css','media/graphics/promo/icons/64x64.png','branding/splash1.png','branding/logo.png']);
for(const m of script.matchAll(/["']((?:media|branding|lib|css|js)\/[^"'\\\s]+)["']/g)){
 const p=m[1];if(p.includes('..'))continue;
 if(p.startsWith('media/audio/')&&!/\.[a-z0-9]+$/i.test(p)){assets.add(p+'.ogg');assets.add(p+'.mp3');}
 else assets.add(p);
}
const results=[];
async function get(path){try{const r=await fetch(new URL(path,origin),{signal:AbortSignal.timeout(25000)});if(!r.ok){results.push({path,status:r.status});return;}const b=Buffer.from(await r.arrayBuffer());const destination=resolve(root,path);if(!destination.startsWith(root+'\\')&&!destination.startsWith(root+'/'))throw Error('Path outside output');await mkdir(dirname(destination),{recursive:true});await writeFile(destination,b);results.push({path,status:r.status,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')});if(path.endsWith('.css'))for(const m of b.toString('utf8').matchAll(/url\(["']?([^\s)'"?]+)["']?\)/g)){if(!/^(?:data:|https?:|\/\/)/.test(m[1]))assets.add(new URL(m[1],new URL(path,origin)).pathname.slice(new URL(origin).pathname.length));}}catch(e){results.push({path,error:e.message});}}
const visited=new Set();while(true){const batch=[...assets].filter(x=>!visited.has(x));if(!batch.length)break;let cursor=0;await Promise.all(Array.from({length:6},async()=>{while(cursor<batch.length){const p=batch[cursor++];visited.add(p);await get(p);}}));}
await writeFile(resolve(root,'download-manifest.json'),JSON.stringify({origin,downloadedAt:new Date().toISOString(),results},null,2));
console.log(JSON.stringify({downloaded:results.filter(x=>x.status===200).length,missing:results.filter(x=>x.status!==200).map(x=>({path:x.path,status:x.status,error:x.error}))},null,2));
await import('./customize-original-ludo.mjs');
