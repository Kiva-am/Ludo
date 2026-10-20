(function(){
 let transport=null,room=null,playerId=null,pending=new Map(),request=0;
 let token=sessionStorage.getItem('hero-session');
 if(!token){token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');sessionStorage.setItem('hero-session',token);}
 const send=message=>transport?.readyState===WebSocket.OPEN&&transport.send(JSON.stringify(message));
 const command=(action,extra={})=>new Promise((resolve,reject)=>{
  if(transport?.readyState!==WebSocket.OPEN){reject(Error('Server disconnected. Refresh and try again.'));return;}
  const requestId=++request;
  const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('Server did not respond.'));},8000);
  pending.set(requestId,{resolve:result=>{clearTimeout(timer);resolve(result);},reject:error=>{clearTimeout(timer);reject(error);}});
  send({kind:'command',requestId,action,token,...extra});
 });
 function status(text){
  const el=document.getElementById('room-status');if(el){el.textContent=text;return;}
  let toast=document.getElementById('room-toast');
  if(!text){toast?.remove();return;}
  if(!toast){toast=document.createElement('div');toast.id='room-toast';toast.setAttribute('role','status');document.body.append(toast);}toast.textContent=text;
 }
 function close(){document.getElementById('room-dialog')?.remove();}
 function render(){
  const root=document.getElementById('room-dialog');if(!root)return;
  const content=root.querySelector('.room-content');content.replaceChildren();
  if(!room){
   content.innerHTML='<h2>Play with friends</h2><p>Create a private room or enter your friend’s code.</p><label>Players <select id="room-size"><option value="2">2 players</option><option value="4">4 players</option></select></label><button id="create-room">Create room</button><div class="room-divider">or join a room</div><label>Room code<input id="room-code" maxlength="6" placeholder="ABC123" autocomplete="off" /></label><button id="join-room">Join room</button>';
   content.querySelector('#create-room').onclick=()=>act('create',{size:Number(content.querySelector('#room-size').value)});
   content.querySelector('#room-size').value=String(ig.game.roomSize);
   content.querySelector('#join-room').onclick=()=>act('join',{code:content.querySelector('#room-code').value.trim().toUpperCase()});
   content.querySelector('#room-code').onkeydown=e=>{if(e.key==='Enter')content.querySelector('#join-room').click();};
  }else{
   const heading=document.createElement('h2');heading.textContent='Room '+room.code;content.append(heading);
   const help=document.createElement('p');help.textContent='Open this game in another browser and join with this code.';content.append(help);
   for(const p of room.players){const row=document.createElement('p');row.className='room-player';row.textContent='Player '+(p.seat+1)+(p.id===playerId?' (you)':'')+(p.online?' · connected':' · disconnected');content.append(row);}
   const button=document.createElement('button');button.textContent=room.host===playerId?'Start game':'Waiting for the host…';button.disabled=room.host!==playerId||room.players.length!==room.size||room.players.some(p=>!p.online);button.onclick=()=>act('start');content.append(button);
  }
 }
 async function act(action,extra){try{status('Please wait…');const result=await command(action,extra);if(result.room){room=result.room;playerId=result.playerId;ig.game.gameClient.playerId=playerId;ig.game.gameClient.roomId=room.code;render();}status('');}catch(e){status(e.message);}}
 function open(){
  close();const root=document.createElement('div');root.id='room-dialog';root.innerHTML='<section role="dialog" aria-modal="true" aria-label="Private room"><button class="room-close" aria-label="Close room">×</button><div class="room-content"></div><p id="room-status" role="status"></p></section>';
  document.body.append(root);root.querySelector('.room-close').onclick=async()=>{if(room){try{await command('leave');}catch{}room=null;}close();};render();
 }
 function begin(snapshot){
  room=snapshot;ig.game.botMode=false;ig.game.roomSize=room.size;
  const client=ig.game.gameClient;client.playerId=playerId;client.roomId=room.code;client.numOfPlayers=room.players.length;
  ig.global.gameState=room.players.map(p=>({playerId:p.id,name:'Player '+(p.seat+1),avatarId:0}));
  ig.global.firstPlayerId=snapshot.turn;ig.global.colorID=3;ig.global.gameStarted=true;ig.game.requestingState=false;
  close();window.LudoRooms.restoreSnapshot=snapshot;ig.game.getEntityByName('HomeController')?.startGame();
 }
 function restore(controller,snapshot){
  if(!controller||controller.gameEnd)return;
  for(const horse of controller.horses){const p=snapshot.players.find(p=>p.id===horse.parents.serverId);if(p)horse.updateState(p.pieces[horse.horseId]);}
  controller.players.forEach(p=>{p.stopCountdown();p.disableHorsesMoving();p.horsesComplete=p.horses.filter(h=>h.usedSteps===57).length;});
  controller.currentPlayer=controller.players.find(p=>p.serverId===snapshot.turn);controller.currentPlayerId=controller.players.indexOf(controller.currentPlayer);controller.currentPlayer.dice6=snapshot.sixes;
  controller.sortHorseZindex();controller.dice.setReady();
  if(snapshot.phase==='move')setTimeout(()=>controller.dice.setValue(snapshot.dice),500);
  if(snapshot.phase==='next'&&controller.currentPlayer.isMainPlayer)setTimeout(()=>ig.game.gameClient.emitEvent(network.Events.NEXT_TURN,300),500);
 }
 window.LudoRooms={open,restoreSnapshot:null,install(){
  if(this.installed)return;this.installed=true;
  ig.MjsNetworkClient.inject({
   connect(success,failure){
    if(transport&&transport.readyState<2)return;
    transport=new WebSocket((location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/rooms');this.socket={disconnected:true};
    transport.onopen=()=>{this.socket.disconnected=false;this.onServerConnect();ig.game.gameClient.userCountText='Private rooms';success?.();};
    transport.onclose=()=>{this.socket.disconnected=true;status('Connection lost. Refresh, then join using the same room code.');for(const item of pending.values())item.reject(Error('Connection lost.'));pending.clear();};
    transport.onerror=()=>failure?.();
    transport.onmessage=event=>{
     const message=JSON.parse(event.data);
     if(message.kind==='reply'){const item=pending.get(message.requestId);if(item){pending.delete(message.requestId);message.error?item.reject(Error(message.error)):item.resolve(message);}else if(message.error)status(message.error);}
     if(message.kind==='lobby'){room=message.room;render();if(room.players.every(p=>p.online))status('');}
     if(message.kind==='native')this.onServerMessage(message.message);
     if(message.kind==='notice')status(message.text);
     if(message.kind==='start')begin(message.snapshot);
     if(message.kind==='restore')restore(ig.game.getEntityByName('GameController'),message.snapshot);
    };
   },
   sendMessage(message){
    if(message.type===21){send({kind:'snapshot'});return;}
    if(message.type===22){command('leave').catch(()=>{});room=null;return;}
    send({kind:'native',message});
   },pingServer(){},getServerTime(){return Date.now();}
  });
  EntityHomeController.inject({requestGame(){open();}});
  EntityGameController.inject({
   init(x,y,settings){this.parent(x,y,settings);const snapshot=window.LudoRooms.restoreSnapshot;window.LudoRooms.restoreSnapshot=null;if(snapshot)setTimeout(()=>restore(this,snapshot),700);},
   playerActive(){},playerInactive(){}
  });
 }};
})();
