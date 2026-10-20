// Run against a running server: node scripts/check-multiplayer.mjs http://localhost:3000
// Creates a normal test room, which expires automatically after 24 hours.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
const origin=(process.argv[2]||'http://localhost:3000').replace(/^http/,'ws');
const peers=[];
async function peer(token=randomBytes(32).toString('hex')) {
 const ws=new WebSocket(origin+'/socket.io/?EIO=4&transport=websocket');
 let latest,id=0;const waiting=new Map();
 const ready=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Connection timeout')),10000);ws.addEventListener('error',reject);ws.addEventListener('message',({data})=>{const s=String(data);if(s.startsWith('0'))ws.send('40');else if(s.startsWith('40')){clearTimeout(timeout);resolve();}else if(s==='2')ws.send('3');else if(s.startsWith('42')){const [event,state]=JSON.parse(s.slice(2));if(event==='state')latest=state;}else if(s.startsWith('43')){const split=s.indexOf('['),key=Number(s.slice(2,split));const done=waiting.get(key);if(done){waiting.delete(key);done(JSON.parse(s.slice(split))[0]);}}});});
 await ready;
 const p={token,get state(){return latest;},ws,send(type,extra={}){return new Promise((resolve,reject)=>{const n=++id;const timeout=setTimeout(()=>{waiting.delete(n);reject(Error('Command timeout'));},12000);waiting.set(n,result=>{clearTimeout(timeout);resolve(result);});ws.send('42'+n+JSON.stringify(['command',{type,token,...extra}]));});}};peers.push(p);return p;
}
const pause=()=>new Promise(r=>setTimeout(r,180));
try {
 const a=await peer(),b=await peer();
 const made=await a.send('create',{name:'QA Host'});assert.ok(made.code);await pause();
 const joined=await b.send('join',{name:'QA Guest',code:made.code});assert.equal(joined.error,undefined);assert.equal(b.state.players.length,2);assert.equal(a.state.players.length,2);assert.equal(a.state.you,0);assert.equal(b.state.you,1);
 assert.ok(a.state.players.every(p=>p.id!==b.token));assert.ok(b.state.players.every(p=>p.id!==a.token));
 const c=await peer(),d=await peer();
 assert.equal((await c.send('join',{name:'QA Third',code:made.code})).error,undefined);
 assert.equal((await d.send('join',{name:'QA Fourth',code:made.code})).error,undefined);
 assert.deepEqual(a.state.players.map(p=>p.color),[3,0,2,1]);
 await pause();assert.ok((await b.send('start')).error);await pause();assert.equal((await a.send('start')).error,undefined);assert.equal(b.state.status,'playing');await pause();assert.ok((await b.send('roll')).error);await pause();assert.equal((await a.send('roll')).error,undefined);assert.equal(a.state.lastRoll,b.state.lastRoll);assert.ok(a.state.lastRoll>=1&&a.state.lastRoll<=6);
 const token=a.token;a.ws.close();const rejoined=await peer(token);assert.equal((await rejoined.send('join',{name:'QA Host',code:made.code})).error,undefined);assert.equal(rejoined.state.players.length,4);assert.equal(rejoined.state.you,0);assert.equal(rejoined.state.lastRoll,b.state.lastRoll);
 console.log('PASS: four-player blue/red/green/yellow seats, create/join, shared state, host authority, turn validation, server dice, token privacy and reconnect.');
}finally{peers.forEach(p=>p.ws.close());}
