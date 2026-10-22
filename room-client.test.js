import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function fixture(ids=['a','b']) {
  const timers=[], sent=[], hooks={};
  const players=ids.map(serverId=>({serverId,isMainPlayer:serverId==='a',horses:[],stopCountdown(){},disableHorsesMoving(){}}));
  const controller={players,horses:[],currentPlayer:players[0],currentPlayerId:0,sortHorseZindex(){}};
  let ready=0, values=[];
  controller.dice={hand:{fadeOut(){}},stopTweens(){},stopRolling(){},setReady(){ready++;},setValue(value){values.push(value);if(value===6)controller.currentPlayer.dice6++;}};
  class Socket {static OPEN=1;constructor(){this.readyState=1;Socket.instance=this;}send(raw){sent.push(JSON.parse(raw));}}
  const context={window:{},document:{getElementById(){return null;}},sessionStorage:{getItem(){return 'a'.repeat(64);},setItem(){},removeItem(){}},WebSocket:Socket,location:{protocol:'http:',host:'localhost:3002'},network:{Events:{NEXT_TURN:3}},setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){},
    ig:{Gd:{inject(value){hooks.ads=value;}},game:{getEntityByName(){return controller;},gameClient:{emitEvent(event){sent.push({event});}},isHidden:false,requestingState:false},MjsNetworkClient:{inject(value){hooks.client=value;}}},
    EntityHomeController:{inject(){}},EntityGameController:{inject(value){hooks.controller=value;}}};
  vm.runInNewContext(readFileSync('original-ludo/room-client.js','utf8'),context);
  context.window.LudoRooms.install();
  hooks.client.connect.call({onServerMessage(){sent.push({native:true});}});
  Object.assign(controller,hooks.controller);
  const snapshot=(extra={})=>({players:ids.map(id=>({id,pieces:[]})),turn:'b',sixes:0,phase:'roll',dice:null,...extra});
  return {controller,context,sent,timers,players,values,snapshot,hooks,ready:()=>ready,
    receive(message){Socket.instance.onmessage({data:JSON.stringify(message)});},
    flush(){while(timers.length)timers.shift()();}};
}

test('returning from a hidden browser requests server state and restores turn ownership',()=>{
  const f=fixture();
  f.context.ig.game.isHidden=true;f.controller.playerInactive();
  f.context.ig.game.isHidden=false;f.controller.playerActive();
  assert.equal(f.sent.at(-1).kind,'snapshot');
  assert.equal(f.context.ig.game.requestingState,true);
  f.receive({kind:'restore',snapshot:f.snapshot()});
  assert.equal(f.controller.currentPlayer.serverId,'b');
  assert.equal(f.controller.currentPlayerId,1);
  assert.equal(f.context.ig.game.requestingState,false);
  assert.equal(f.ready(),1);
});

test('a delayed old turn transition cannot overwrite a restored server turn',()=>{
  const f=fixture();f.controller.nextPlayer(450);
  f.controller.playerInactive();
  f.receive({kind:'restore',snapshot:f.snapshot({turn:'a'})});
  f.flush();assert.equal(f.controller.currentPlayer.serverId,'a');
});

test('resuming a pending six counts it once and ignores its late result echo',()=>{
  const f=fixture();f.receive({kind:'restore',snapshot:f.snapshot({turn:'a',phase:'move',dice:6,sixes:2})});
  f.receive({kind:'native',message:{data:{event:2,data:6}}});
  f.flush();assert.deepEqual(f.values,[6]);
  assert.equal(f.controller.currentPlayer.dice6,2);
  assert.equal(f.sent.some(m=>m.native),false);
});

test('restoring a no-move phase advances only from the owning browser',()=>{
  const f=fixture();f.receive({kind:'restore',snapshot:f.snapshot({phase:'next'})});f.flush();
  assert.equal(f.sent.length,0);
  f.receive({kind:'restore',snapshot:f.snapshot({turn:'a',phase:'next'})});f.flush();
  assert.equal(f.sent.at(-1).event,3);
});

test('a turn transition uses the server target and skips a forfeited seat',()=>{
  const f=fixture(['a','b','c','d']);
  f.receive({kind:'state',snapshot:f.snapshot({turn:'c'})});
  f.controller.nextPlayer(300);f.flush();
  assert.equal(f.controller.currentPlayer.serverId,'c');
});

test('the local ad helper accepts an omitted callback and invokes a provided one once',()=>{
  const f=fixture();let called=0;
  assert.doesNotThrow(()=>f.hooks.ads.show());
  f.hooks.ads.show(()=>called++);assert.equal(called,1);
});
