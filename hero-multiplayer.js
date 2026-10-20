import {WebSocketServer,WebSocket} from 'ws';
import {randomBytes} from 'node:crypto';
import {roll,move,next} from './hero-rules.js';

export function attachMultiplayer(server, collection = null) {
  const wss = new WebSocketServer({server,path:'/rooms',maxPayload:8192});
  const rooms = new Map();
  const sockets = new Map();
  const writes = new Map();
  const send = (socket, message) => { if(socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); };
  const publicRoom = room => ({code:room.code,size:room.size,status:room.status,host:room.players[0]?.id,players:room.players.map(({token,...p})=>({...p,online:sockets.has(p.id)}))});
  const broadcast = (room,message) => room.players.forEach(p=>send(sockets.get(p.id),message));
  const save = room => {
    if(!collection)return;
    const snapshot=structuredClone({...room,_id:room.code,expiresAt:new Date(Date.now()+86400000)});
    const write=(writes.get(room.code)||Promise.resolve()).then(()=>collection.replaceOne({_id:room.code},snapshot,{upsert:true})).catch(()=>console.error('Could not persist a room snapshot.'));
    writes.set(room.code,write);write.finally(()=>{if(writes.get(room.code)===write)writes.delete(room.code);});
  };
  const lobby = room => { broadcast(room,{kind:'lobby',room:publicRoom(room)});save(room); };
  const event = (room,event,data) => broadcast(room,{kind:'native',message:{type:52,data:{event,data}}});
  const snapshot = room => ({...publicRoom(room),turn:room.players[room.turn]?.id,phase:room.phase,dice:room.dice,sixes:room.sixes});
  wss.on('connection',(socket,request)=>{
    // Only same-origin browser clients; command sessions also require a random token.
    if(request.headers.origin && request.headers.origin !== 'http://'+request.headers.host && request.headers.origin !== 'https://'+request.headers.host){socket.close(1008);return;}
    let joined = null, identity = null, chain = Promise.resolve(), count = 0;
    const limit = setInterval(()=>count=0,1000); limit.unref();
    const leave = () => {
      const room = joined; if(!room)return;
      if(sockets.get(identity?.id)!==socket){joined=null;return;}
      if(sockets.get(identity?.id)===socket)sockets.delete(identity.id);
      joined = null;
      if(room.status === 'lobby') {room.players=room.players.filter(p=>p!==identity);room.players.forEach((p,i)=>p.seat=i);if(!room.players.length)rooms.delete(room.code);else lobby(room);}
      else {broadcast(room,{kind:'notice',text:'A player left. Rejoin with the same room code to continue.'});lobby(room);}
    };
    socket.on('close',()=>{clearInterval(limit);leave();});
    socket.on('message',bytes=>{chain=chain.then(async()=>{
      let msg;
      try {
        if(++count>60)throw Error('Too many requests.');
        msg=JSON.parse(bytes.toString());
        const reply = data => send(socket,{kind:'reply',requestId:msg.requestId,...data});
        if(msg.kind==='command') {
          const {action,token,size,code} = msg;
          if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw Error('Invalid session. Refresh the page.');
          if(action==='create'||action==='join') {
            if(joined)leave();
            let room;
            if(action==='create') {
              if(size!==2&&size!==4)throw Error('Choose 2 or 4 players.');
              let roomCode;do{roomCode=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(roomCode));
              room={code:roomCode,size,status:'lobby',players:[],turn:0,phase:'roll',sixes:0,dice:null};rooms.set(roomCode,room);
            } else {
              if(typeof code!=='string'||!/^[A-F0-9]{6}$/.test(code))throw Error('Enter a six-character room code.');
              room=rooms.get(code);if(!room)throw Error('Room not found. Ask the host for a new code.');
            }
            let player=room.players.find(p=>p.token===token);
            if(!player) {
              if(room.status!=='lobby')throw Error('This game has already started.');
              if(room.players.length>=room.size)throw Error('This room is full.');
              player={id:randomBytes(8).toString('hex'),token,seat:room.players.length,pieces:[0,0,0,0]};room.players.push(player);
            }
            const previous=sockets.get(player.id);if(previous&&previous!==socket)previous.close();
            joined=room;identity=player;sockets.set(player.id,socket);
            reply({room:publicRoom(room),playerId:player.id});lobby(room);
            if(room.status==='playing')send(socket,{kind:'start',snapshot:snapshot(room)});
          } else {
            if(!joined||identity?.token!==token)throw Error('Join a room first.');
            if(action==='leave'){leave();reply({ok:true});return;}
            if(action!=='start'||joined.players[0]!==identity)throw Error('Only the host can start.');
            if(joined.status!=='lobby'||joined.players.length!==joined.size||joined.players.some(p=>!sockets.has(p.id)))throw Error('Wait for all players to join.');
            joined.status='playing';broadcast(joined,{kind:'start',snapshot:snapshot(joined)});save(joined);reply({ok:true});
          }
          return;
        }
        if(!joined||joined.status!=='playing')return;
        if(msg.kind==='snapshot'){send(socket,{kind:'restore',snapshot:snapshot(joined)});return;}
        if(msg.kind!=='native'||msg.message?.type!==52)return;
        const {event:ev,data}=msg.message.data||{};
        const room=joined;
        // Remote renderers also send completion events. Only the turn owner may act.
        if(room.players[room.turn].id!==identity.id)return;
        if(ev===1) {
          const value=roll(room,identity.id);event(room,1);
          setTimeout(()=>{if(room.status==='playing')event(room,2,value);},650).unref();
        } else if(ev===4) {
          move(room,identity.id,data?.horseId);event(room,4,{horseId:data.horseId});
          if(room.status==='finished'){
            const rankings=[identity,...room.players.filter(p=>p!==identity)].map((p,i)=>({playerId:p.id,playerName:'Player '+(p.seat+1),rankNo:i+1}));
            setTimeout(()=>event(room,12,rankings),1800).unref();
          }
        } else if(ev===3) {next(room,identity.id);event(room,3,Math.max(0,Math.min(600,Number(data)||300)));}
        // CHECK_AUTO, visibility and client capture reports never mutate authority.
        save(room);
      }catch(error){send(socket,{kind:'reply',requestId:msg?.requestId,error:error.message});}
    }).catch(()=>socket.close());});
  });
  const cleanup=setInterval(()=>{for(const [code,room] of rooms)if(!room.players.some(p=>sockets.has(p.id)))rooms.delete(code);},86400000);cleanup.unref();
  return {wss,rooms};
}
