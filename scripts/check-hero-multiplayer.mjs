import WebSocket from 'ws';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
const base=process.argv[2]||'http://localhost:3002';
async function player(){
 const ws=new WebSocket(base.replace(/^http/,'ws')+'/rooms');const messages=[],waiters=[];let seq=0,revision;
 ws.on('message',bytes=>{const msg=JSON.parse(bytes);revision=msg.snapshot?.revision??msg.room?.revision??revision;const i=waiters.findIndex(w=>w.filter(msg));if(i>=0)waiters.splice(i,1)[0].done(msg);else messages.push(msg);});
 await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
 const wait=filter=>new Promise((resolve,reject)=>{const i=messages.findIndex(filter);if(i>=0)return resolve(messages.splice(i,1)[0]);const entry={filter,done:msg=>{clearTimeout(timer);resolve(msg);}};const timer=setTimeout(()=>{waiters.splice(waiters.indexOf(entry),1);reject(Error('Timed out waiting for message'));},6000);waiters.push(entry);});
 const token=randomBytes(32).toString('hex');
 return {ws,wait,token,send:msg=>ws.send(JSON.stringify({revision,...msg})),async command(action,extra={}){const requestId=++seq;ws.send(JSON.stringify({kind:'command',action,token,requestId,...extra}));const result=await wait(m=>m.kind==='reply'&&m.requestId===requestId);if(result.error)throw Error(result.error);return result;}};
}
const a=await player(),b=await player(),c=await player();
try{
 const created=await a.command('create',{size:2}),code=created.room.code;
 await assert.rejects(()=>b.command('join',{code:'FFFFFF'}));
 const joined=await b.command('join',{code});assert.equal(joined.room.players.length,2);
 await assert.rejects(()=>c.command('join',{code}));await assert.rejects(()=>b.command('start'));
 await a.command('start');await a.wait(m=>m.kind==='start');await b.wait(m=>m.kind==='start');
 const native=(p,event,data)=>p.send({kind:'native',message:{type:52,data:{event,data}}});
 // An out-of-turn request cannot alter authority.
 native(b,1);b.send({kind:'snapshot'});const unchanged=await b.wait(m=>m.kind==='restore');assert.equal(unchanged.snapshot.phase,'roll');
 native(a,1);const ra=await a.wait(m=>m.kind==='native'&&m.message.data.event===2);const rb=await b.wait(m=>m.kind==='native'&&m.message.data.event===2);assert.equal(ra.message.data.data,rb.message.data.data);
 const value=ra.message.data.data;assert.ok(value>=1&&value<=6);
 if(value===6){native(a,4,{horseId:0});await b.wait(m=>m.kind==='native'&&m.message.data.event===4);}else{native(a,3,300);await b.wait(m=>m.kind==='native'&&m.message.data.event===3);}
 a.send({kind:'snapshot'});const state=await a.wait(m=>m.kind==='restore');assert.equal(state.snapshot.phase,'roll');
 console.log('PASS: private room, independent sessions, capacity, host permission, turn ownership, shared dice, synchronized move/turn. Room '+code);
}finally{a.ws.close();b.ws.close();c.ws.close();}
