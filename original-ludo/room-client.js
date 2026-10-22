(function(){
 let transport=null,room=null,playerId=null,pending=new Map(),request=0;
 let reconnectTimer=null,retry=0,stopped=false,activeMatch=null;
 const remember=()=>{if(room)sessionStorage.setItem('hero-room',room.code);else sessionStorage.removeItem('hero-room');};
 const accept=snapshot=>{if(snapshot){room=snapshot;remember();}};
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
   const heading=document.createElement('h2');heading.textContent=room.status==='finished'?'Game over':'Room '+room.code;content.append(heading);
   const help=document.createElement('p');help.textContent=room.status==='finished'?(room.reason==='forfeit'?'The other players left the game.':'The first player to bring all four cones home wins.'):'Open this game in another browser and join with this code.';content.append(help);
   if(room.status==='finished')for(const p of room.players){const result=document.createElement('p');result.textContent='Player '+(p.seat+1)+(p.id===room.winner?' — Winner':p.forfeited?' — Left the game':' — '+p.pieces.filter(n=>n===57).length+'/4 home');content.append(result);}
   for(const p of room.players){const row=document.createElement('p');row.className='room-player';row.textContent='Player '+(p.seat+1)+(p.id===playerId?' (you)':'')+(p.online?' · connected':' · disconnected');content.append(row);}
   const button=document.createElement('button');button.textContent=room.host===playerId?(room.status==='finished'?'Play again':'Start game'):'Waiting for the host…';button.disabled=room.host!==playerId||room.players.length!==room.size||room.players.some(p=>!p.online);button.onclick=()=>act(room.status==='finished'?'rematch':'start');content.append(button);
  }
 }
 async function act(action,extra){try{status('Please wait…');const result=await command(action,extra);if(result.room){accept(result.room);playerId=result.playerId;ig.game.gameClient.playerId=playerId;ig.game.gameClient.roomId=room.code;render();}status('');}catch(e){status(e.message);}}
 function open(){
  close();const root=document.createElement('div');root.id='room-dialog';root.innerHTML='<section role="dialog" aria-modal="true" aria-label="Private room"><button class="room-close" aria-label="Close room">×</button><div class="room-content"></div><p id="room-status" role="status"></p></section>';
  document.body.append(root);root.querySelector('.room-close').onclick=async()=>{if(room){try{await command('leave');}catch{}room=null;remember();activeMatch=null;ig.game.director.jumpTo(LevelHome);}close();};render();
 }
 function begin(snapshot){
  const match=snapshot.code+':'+snapshot.match;
  const controller=ig.game.getEntityByName('GameController');
  accept(snapshot);
  if(controller&&activeMatch===match){restore(controller,snapshot);return;}
  activeMatch=match;ig.game.botMode=false;ig.game.roomSize=room.size;
  const client=ig.game.gameClient;client.playerId=playerId;client.roomId=room.code;client.numOfPlayers=room.players.length;
  ig.global.gameState=room.players.map(p=>({playerId:p.id,name:'Player '+(p.seat+1),avatarId:0}));
  ig.global.firstPlayerId=snapshot.turn;ig.global.colorID=3;ig.global.gameStarted=true;ig.game.requestingState=false;
  close();window.LudoRooms.restoreSnapshot=snapshot;
  const home=ig.game.getEntityByName('HomeController');
  if(home)home.startGame();else ig.game.director.jumpTo(LevelGame);
 }
 function finished(controller,snapshot){
  if(controller)for(const horse of controller.horses){horse.stopTweens(false);horse.isMoving=horse.isJumping=false;const p=snapshot.players.find(p=>p.id===horse.parents.serverId);if(p)horse.updateState(p.pieces[horse.horseId]);}
  if(controller){controller.roomRestoreVersion=(controller.roomRestoreVersion||0)+1;controller.gameEnd=controller.completed=true;controller.dice.clickReady=false;controller.dice.stopRolling();controller.players.forEach(p=>{p.stopCountdown();p.disableHorsesMoving();});}
  accept(snapshot);open();
 }
 function restore(controller,snapshot){
  if(!controller)return;
  if(snapshot.status==='finished'){finished(controller,snapshot);return;}
  if(controller.gameEnd)return;
  controller.roomRestoreVersion=(controller.roomRestoreVersion||0)+1;
  const version=controller.roomRestoreVersion;
  controller.transferingTurn=false;controller.nextEvent='none';
  controller.dice.stopTweens(false);controller.dice.stopRolling();controller.dice.clickReady=false;
  for(const horse of controller.horses){horse.stopTweens(false);horse.isMoving=horse.isJumping=horse.drawSel=horse.movable=horse.isSelecting=false;const p=snapshot.players.find(p=>p.id===horse.parents.serverId);if(p)horse.updateState(p.pieces[horse.horseId]);}
  controller.players.forEach(p=>{p.stopCountdown();p.disableHorsesMoving();p.horsesComplete=p.horses.filter(h=>h.usedSteps===57).length;});
  controller.currentPlayer=controller.players.find(p=>p.serverId===snapshot.turn);if(!controller.currentPlayer)return;controller.currentPlayerId=controller.players.indexOf(controller.currentPlayer);controller.currentPlayer.dice6=snapshot.sixes-(snapshot.phase==='move'&&snapshot.dice===6?1:0);
  ig.game.requestingState=false;
  controller.roomRestoredDice=snapshot.phase==='move';
  controller.sortHorseZindex();controller.dice.setReady();
  if(snapshot.phase==='move')setTimeout(()=>{if(controller.roomRestoreVersion===version&&!ig.game.isHidden){controller.dice.clickReady=false;controller.dice.isReady=false;controller.dice.setValue(snapshot.dice);}},500);
  if(snapshot.phase==='next'&&controller.currentPlayer.isMainPlayer)setTimeout(()=>{if(controller.roomRestoreVersion===version&&!ig.game.isHidden)ig.game.gameClient.emitEvent(network.Events.NEXT_TURN,300);},500);
 }
 window.LudoRooms={open,get state(){return room;},restoreSnapshot:null,install(){
  if(this.installed)return;this.installed=true;
  // The preserved ad helper calls an omitted callback when no SDK is loaded.
  // This self-hosted build has no ad provider.
  ig.Gd?.inject({show(callback){if(typeof callback==='function')callback();}});
  ig.MjsNetworkClient.inject({
   connect(success,failure){
    if(transport&&transport.readyState<2)return;
    stopped=false;clearTimeout(reconnectTimer);
    const current=transport=new WebSocket((location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/rooms');this.socket={disconnected:true};
    transport.onopen=()=>{if(transport!==current)return;retry=0;this.socket.disconnected=false;this.onServerConnect();ig.game.gameClient.userCountText='Private rooms';success?.();const code=sessionStorage.getItem('hero-room');if(code)act('join',{code});};
    transport.onclose=event=>{if(transport!==current)return;this.socket.disconnected=true;for(const item of pending.values())item.reject(Error('Connection lost.'));pending.clear();if(event.code===4001){stopped=true;status('This player session is open in another tab.');return;}if(stopped){status('');return;}status('Connection lost. Reconnecting…');reconnectTimer=setTimeout(()=>this.connect(),Math.min(5000,500*2**retry++));};
    transport.onerror=()=>failure?.();
    transport.onmessage=event=>{
     const message=JSON.parse(event.data);
     if(message.snapshot)accept(message.snapshot);
     if(message.kind==='reply'){const item=pending.get(message.requestId);if(item){pending.delete(message.requestId);message.error?item.reject(Error(message.error)):item.resolve(message);}else if(message.error)status(message.error);}
     if(message.kind==='lobby'){accept(message.room);render();if(room.players.every(p=>p.online))status('');else if(room.status==='playing')status('A player disconnected. Their seat is held for 30 seconds.');}
     if(message.kind==='native'){
      const controller=ig.game.getEntityByName('GameController');
      const ev=message.message.data?.event;
      if(ev===12){finished(controller,message.snapshot||room);return;}
      if(ev===2&&controller?.currentPlayer&&message.snapshot)controller.currentPlayer.dice6=message.snapshot.sixes-(message.snapshot.dice===6?1:0);
      if(ev===2&&controller?.roomRestoredDice){controller.roomRestoredDice=false;return;}
      if(controller&&[1,3,4].includes(ev))controller.roomRestoredDice=false;
      this.onServerMessage(message.message);
     }
     if(message.kind==='notice')status(message.text);
     if(message.kind==='start')begin(message.snapshot);
     if(message.kind==='restore')restore(ig.game.getEntityByName('GameController'),message.snapshot);
     if(message.kind==='finished')finished(ig.game.getEntityByName('GameController'),message.snapshot);
    };
   },
   sendMessage(message){
    if(message.type===21){send({kind:'snapshot'});return;}
    if(message.type===22){command('leave').catch(()=>{});room=null;remember();activeMatch=null;return;}
    if(message.type===52&&[1,3,4].includes(message.data?.event)){
     if(!room||room.status!=='playing'||room.turn!==playerId)return;
     if(message.data.event===3&&room.phase!=='next')return;
    }
    send({kind:'native',message,revision:room?.revision});
   },disconnect(success){stopped=true;clearTimeout(reconnectTimer);transport?.close();success?.();},pingServer(){},getServerTime(){return Date.now();}
  });
  EntityHomeController.inject({requestGame(){open();}});
  EntityGameController.inject({
   init(x,y,settings){this.parent(x,y,settings);const snapshot=window.LudoRooms.restoreSnapshot;window.LudoRooms.restoreSnapshot=null;if(snapshot)setTimeout(()=>restore(this,snapshot),700);},
   playerActive(){if(!ig.game.botMode&&!this.gameEnd){ig.game.requestingState=true;send({kind:'snapshot'});}},
   playerInactive(){if(!ig.game.botMode){this.roomRestoreVersion=(this.roomRestoreVersion||0)+1;this.dice.clickReady=false;}},
   handleRanking(player){if(ig.game.botMode)return this.parent(player);},
   nextPlayer(delay){
    if(ig.game.botMode)return this.parent(delay);
    const version=this.roomRestoreVersion||0;
    this.currentPlayer.stopCountdown();this.currentPlayer.disableHorsesMoving();
    this.transferingTurn=true;this.dice.clickReady=false;this.dice.hand.fadeOut();this.currentPlayer.dice6=0;
    const target=this.players.find(p=>p.serverId===room?.turn)||this.players[(this.currentPlayerId+1)%this.players.length];
    setTimeout(()=>{if((this.roomRestoreVersion||0)!==version||ig.game.isHidden||ig.game.requestingState)return;this.currentPlayer=target;this.currentPlayerId=this.players.indexOf(target);this.transferingTurn=false;this.dice.setReady();},delay||0);
   }
  });
 }};
})();
