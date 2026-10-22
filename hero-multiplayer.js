import {WebSocketServer, WebSocket} from 'ws';
import {randomBytes} from 'node:crypto';
import {roll, move, next, legalMoves} from './hero-rules.js';

export function attachMultiplayer(server, collection = null, options = {}) {
  const turnMs = options.turnMs ?? (Number(process.env.HERO_TURN_SECONDS) || 15) * 1000;
  const reconnectMs = options.reconnectMs ?? 30000;
  const diceMs = options.diceMs ?? 650;
  const animationMs = options.animationMs ?? 2200;
  const randomDice = options.randomDice;
  const maxRequests = options.maxRequests ?? 60;
  const wss = new WebSocketServer({server, path:'/rooms', maxPayload:8192});
  const rooms = new Map(), sockets = new Map(), writes = new Map(), runtime = new Map();
  const send = (socket, message) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };
  const broadcast = (room, message) => room.players.forEach(p => send(sockets.get(p.id), message));
  const state = room => ({
    code:room.code, size:room.size, status:room.status, host:room.players[0]?.id,
    players:room.players.map(({token, ...p}) => ({...p, online:sockets.has(p.id)})),
    turn:room.players[room.turn]?.id, phase:room.phase, dice:room.dice, sixes:room.sixes,
    revision:room.revision, match:room.match, deadline:room.deadline || 0,
    turnSeconds:turnMs / 1000, winner:room.winner, reason:room.reason,
  });
  const save = room => {
    if (!collection) return;
    // Runtime timer handles never enter persisted snapshots.
    const snapshot = structuredClone({...room, _id:room.code, expiresAt:new Date(Date.now() + 86400000)});
    const write = (writes.get(room.code) || Promise.resolve())
      .then(() => collection.replaceOne({_id:room.code}, snapshot, {upsert:true}))
      .catch(() => console.error('Could not persist a room snapshot.'));
    writes.set(room.code, write);
    write.finally(() => { if (writes.get(room.code) === write) writes.delete(room.code); });
  };
  const publish = (room, kind = 'state') => { broadcast(room, {kind, snapshot:state(room), room:state(room)}); save(room); };
  const event = (room, ev, data) => broadcast(room, {
    kind:'native', snapshot:state(room), message:{type:52, data:{event:ev, data}},
  });
  const schedule = (room, key, fn, delay) => {
    const handles = runtime.get(room.code);
    clearTimeout(handles.get(key));
    const timer = setTimeout(() => {
      handles.delete(key);
      if (rooms.get(room.code) === room) fn();
    }, delay);
    timer.unref(); handles.set(key, timer);
  };
  const cancel = (room, key) => {
    const handles = runtime.get(room.code);
    clearTimeout(handles?.get(key)); handles?.delete(key);
  };
  const dispose = room => {
    for (const timer of runtime.get(room.code)?.values() || []) clearTimeout(timer);
    runtime.delete(room.code); rooms.delete(room.code);
  };
  const touch = room => { room.revision++; save(room); };
  const rankings = room => [...room.players].sort((a,b) =>
    Number(b.id === room.winner) - Number(a.id === room.winner) ||
    Number(a.forfeited) - Number(b.forfeited) ||
    b.pieces.reduce((s,p) => s+p,0) - a.pieces.reduce((s,p) => s+p,0)
  ).map((p,i) => ({playerId:p.id, playerName:'Player '+(p.seat+1), rankNo:i+1}));
  const finish = (room, winner, reason) => {
    room.status = 'finished'; room.winner = winner; room.reason = reason; room.deadline = 0;
    cancel(room, 'phase'); cancel(room, 'advance'); cancel(room, 'dice');
    touch(room);
    schedule(room, 'result', () => {
      event(room, 12, rankings(room)); publish(room, 'finished');
    }, reason === 'home' ? animationMs : 0);
  };
  const arm = room => {
    if (room.status !== 'playing') return;
    room.deadline = Date.now() + turnMs;
    schedule(room, 'phase', () => automatic(room), turnMs);
  };
  const advance = room => {
    if (room.status !== 'playing' || room.phase !== 'next') return;
    cancel(room, 'advance'); cancel(room, 'dice');
    next(room, room.players[room.turn].id); touch(room); arm(room);
    event(room, 3, 300); publish(room);
  };
  const afterMove = (room, automaticMove = false) => {
    cancel(room, 'phase');
    if (room.status === 'finished') { finish(room, room.winner, 'home'); return; }
    arm(room);
    // Advance even if the owning browser misses its animation acknowledgement.
    if (room.phase === 'next') schedule(room, 'advance', () => advance(room), animationMs);
    publish(room, automaticMove ? 'restore' : 'state');
  };
  const automatic = room => {
    if (room.status !== 'playing') return;
    const player = room.players[room.turn];
    if (room.phase === 'roll') {
      roll(room, player.id, randomDice); touch(room);
      publish(room, 'restore');
      schedule(room, 'phase', () => automatic(room), Math.max(diceMs, 500));
    } else if (room.phase === 'move') {
      const choices = legalMoves(player, room.dice);
      const horseId = choices.sort((a,b) => player.pieces[b] - player.pieces[a])[0];
      move(room, player.id, horseId); touch(room); afterMove(room, true);
    } else advance(room);
  };
  const forfeit = (room, player) => {
    if (room.status !== 'playing' || player.forfeited) return;
    player.forfeited = true; cancel(room, 'rejoin:'+player.id);
    const active = room.players.filter(p => !p.forfeited);
    if (active.length <= 1) { finish(room, active[0]?.id, 'forfeit'); return; }
    if (room.players[room.turn] === player) {
      cancel(room, 'dice'); cancel(room, 'advance'); room.phase = 'next';
      next(room, player.id); arm(room);
    }
    touch(room); publish(room, 'restore');
  };
  const start = room => {
    for (const key of [...runtime.get(room.code).keys()]) cancel(room, key);
    Object.assign(room, {status:'playing', turn:0, phase:'roll', sixes:0, dice:null,
      winner:null, reason:null, match:room.match+1});
    room.players.forEach(p => { p.pieces = [0,0,0,0]; p.forfeited = false; });
    touch(room); arm(room); publish(room, 'start');
  };

  wss.on('connection', (socket, request) => {
    if (request.headers.origin && !['http://','https://'].some(p => request.headers.origin === p+request.headers.host)) {
      socket.close(1008); return;
    }
    let joined = null, identity = null, count = 0;
    socket.alive = true;
    socket.on('pong', () => { socket.alive = true; });
    const limit = setInterval(() => { count = 0; }, 1000); limit.unref();
    const leave = (explicit = false) => {
      const room = joined, player = identity;
      joined = null; identity = null;
      if (!room || sockets.get(player.id) !== socket) return;
      sockets.delete(player.id);
      if (room.status === 'lobby') {
        room.players = room.players.filter(p => p !== player);
        room.players.forEach((p,i) => { p.seat = i; });
        if (!room.players.length) { dispose(room); return; }
      } else if (room.status === 'playing') {
        if (explicit) forfeit(room, player);
        else schedule(room, 'rejoin:'+player.id, () => forfeit(room, player), reconnectMs);
      }
      touch(room); publish(room, 'lobby');
      if (!room.players.some(p => sockets.has(p.id))) {
        schedule(room, 'abandoned', () => dispose(room), reconnectMs);
      }
    };
    socket.on('close', () => { clearInterval(limit); leave(); });
    socket.on('message', bytes => {
      let msg;
      try {
        if (++count > maxRequests) throw Error('Too many requests.');
        msg = JSON.parse(bytes.toString());
        if (!msg || typeof msg !== 'object' || Array.isArray(msg)) throw Error('Invalid request.');
        if (joined && sockets.get(identity.id) !== socket) throw Error('This session was replaced.');
        const reply = data => send(socket, {kind:'reply', requestId:msg.requestId, ...data});
        if (msg.kind === 'command') {
          const {action, token, size, code} = msg;
          if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw Error('Invalid session. Refresh the page.');
          if (action === 'create' || action === 'join') {
            let room;
            if (action === 'create') {
              if (size !== 2 && size !== 4) throw Error('Choose 2 or 4 players.');
              let roomCode;
              do { roomCode = randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(roomCode));
              room = {code:roomCode, size, status:'lobby', players:[], turn:0, phase:'roll', sixes:0, dice:null, revision:0, match:0};
            } else {
              if (typeof code !== 'string' || !/^[A-F0-9]{6}$/.test(code)) throw Error('Enter a six-character room code.');
              room = rooms.get(code);
              if (!room) throw Error('Room not found. Ask the host for a new code.');
            }
            let player = room.players.find(p => p.token === token);
            if (!player) {
              if (room.status !== 'lobby') throw Error('This game has already started.');
              if (room.players.length >= room.size) throw Error('This room is full.');
            }
            // Validate the destination before leaving an existing room.
            if (joined && joined !== room) leave(true);
            if (!rooms.has(room.code)) { rooms.set(room.code, room); runtime.set(room.code, new Map()); }
            if (!player) {
              player = {id:randomBytes(8).toString('hex'), token, seat:room.players.length, pieces:[0,0,0,0], forfeited:false};
              room.players.push(player);
            }
            const previous = sockets.get(player.id);
            joined = room; identity = player; sockets.set(player.id, socket);
            if (previous && previous !== socket) previous.close(4001, 'Session replaced');
            cancel(room, 'abandoned'); cancel(room, 'rejoin:'+player.id);
            reply({room:state(room), playerId:player.id}); publish(room, 'lobby');
            if (room.status !== 'lobby') send(socket, {kind:'start', snapshot:state(room)});
          } else {
            if (!joined || identity.token !== token) throw Error('Join a room first.');
            if (action === 'leave') { leave(true); reply({ok:true}); return; }
            if (!['start','rematch'].includes(action) || joined.players[0] !== identity) throw Error('Only the host can start.');
            if (joined.status !== (action === 'rematch' ? 'finished' : 'lobby')) throw Error('This game cannot start yet.');
            if (joined.players.length !== joined.size || joined.players.some(p => !sockets.has(p.id))) throw Error('Wait for all players to join.');
            start(joined); reply({ok:true});
          }
          return;
        }
        if (!joined) throw Error('Join a room first.');
        if (msg.kind === 'snapshot') { send(socket, {kind:'restore', snapshot:state(joined)}); return; }
        if (joined.status !== 'playing' || msg.kind !== 'native' || msg.message?.type !== 52) return;
        const {event:ev, data} = msg.message.data || {};
        if (![1,3,4].includes(ev)) return;
        if (joined.players[joined.turn] !== identity || identity.forfeited) throw Error('Wait for your turn.');
        if (msg.revision !== joined.revision) throw Error('The game has advanced. Restoring the current turn.');
        const room = joined;
        if (ev === 1) {
          const value = roll(room, identity.id, randomDice); touch(room); arm(room); event(room, 1);
          schedule(room, 'dice', () => {
            if (room.status === 'playing') event(room, 2, value);
          }, diceMs);
          if (room.phase === 'next') schedule(room, 'advance', () => advance(room), diceMs + animationMs);
        } else if (ev === 4) {
          move(room, identity.id, data?.horseId); cancel(room, 'dice'); touch(room); event(room, 4, {horseId:data.horseId}); afterMove(room);
        } else advance(room);
      } catch (error) {
        send(socket, {kind:'reply', requestId:msg?.requestId, error:error.message});
        if (joined && sockets.get(identity?.id) === socket) send(socket, {kind:'restore', snapshot:state(joined)});
      }
    });
  });
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!socket.alive) socket.terminate();
      else { socket.alive = false; socket.ping(); }
    }
  }, 15000);
  heartbeat.unref();
  wss.on('close', () => { clearInterval(heartbeat); for (const room of rooms.values()) dispose(room); });
  return {wss, rooms, async flush() { await Promise.all([...writes.values()]); }};
}
