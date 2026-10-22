import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import WebSocket from 'ws';
import {attachMultiplayer} from './hero-multiplayer.js';
import {legalMoves} from './hero-rules.js';

async function fixture(t, options = {}, collection = null) {
  const server = createServer();
  const game = attachMultiplayer(server, collection, {diceMs:5, animationMs:25, turnMs:60000, ...options});
  const clients = [];
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => {
    for (const c of clients) c.ws.terminate();
    for (const ws of game.wss.clients) ws.terminate();
    await new Promise(resolve => game.wss.close(resolve));
    await new Promise(resolve => server.close(resolve));
    await game.flush();
  });
  async function connect(token = randomBytes(32).toString('hex')) {
    const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}/rooms`);
    const messages = [], waiters = [];
    let seq = 0, revision;
    ws.on('message', raw => {
      const msg = JSON.parse(raw);
      revision = msg.snapshot?.revision ?? msg.room?.revision ?? revision;
      const index = waiters.findIndex(w => w.filter(msg));
      if (index < 0) messages.push(msg); else waiters.splice(index,1)[0].done(msg);
    });
    await once(ws, 'open');
    const wait = filter => new Promise((resolve, reject) => {
      const index = messages.findIndex(filter);
      if (index >= 0) return resolve(messages.splice(index,1)[0]);
      const entry = {filter, done:msg => { clearTimeout(timer); resolve(msg); }};
      const timer = setTimeout(() => { waiters.splice(waiters.indexOf(entry),1); reject(Error('Response timed out: '+filter+'; recent messages '+JSON.stringify(messages.slice(-5).map(m=>({kind:m.kind,event:m.message?.data?.event,revision:m.snapshot?.revision,error:m.error}))))); }, 2500);
      waiters.push(entry);
    });
    const client = {ws, token, wait,
      send:msg => ws.send(JSON.stringify(msg)),
      native(event, data, version = revision) { this.send({kind:'native', revision:version, message:{type:52, data:{event,data}}}); },
      async command(action, extra = {}) {
        const requestId = ++seq;
        this.send({kind:'command', action, token, requestId, ...extra});
        const msg = await wait(m => m.kind === 'reply' && m.requestId === requestId);
        if (msg.error) throw Error(msg.error);
        return msg;
      },
      async snapshot() {
        this.send({kind:'snapshot'});
        return (await wait(m => m.kind === 'restore')).snapshot;
      },
      async close() { ws.close(); await once(ws, 'close'); },
    };
    clients.push(client); return client;
  }
  async function playing(size = 2) {
    const players = [];
    for (let i = 0; i < size; i++) players.push(await connect());
    const created = await players[0].command('create', {size});
    players[0].id = created.playerId;
    for (const c of players.slice(1)) c.id = (await c.command('join', {code:created.room.code})).playerId;
    await players[0].command('start');
    await Promise.all(players.map(c => c.wait(m => m.kind === 'start')));
    return {players, room:game.rooms.get(created.room.code)};
  }
  return {game, connect, playing};
}

test('room capacity, host ownership, token privacy and failed join preserve the current room', async t => {
  const f = await fixture(t);
  const a = await f.connect(), b = await f.connect(), c = await f.connect();
  const first = await a.command('create', {size:2});
  await b.command('join', {code:first.room.code});
  await assert.rejects(c.command('join', {code:first.room.code}), /full/);
  await assert.rejects(b.command('start'), /host/);
  await assert.rejects(a.command('join', {code:'FFFFFF'}), /not found/);
  assert.equal((await a.snapshot()).code, first.room.code);
  assert.ok(first.room.players.every(p => !Object.hasOwn(p,'token')));
});

test('duplicate and stale actions cannot mutate an authoritative turn', async t => {
  const f = await fixture(t, {randomDice:() => 6});
  const {players:[a,b], room} = await f.playing();
  const old = room.revision;
  b.native(1);
  assert.match((await b.wait(m => m.kind === 'reply' && m.error)).error, /turn/);
  a.native(1);
  await a.wait(m => m.kind === 'native' && m.message.data.event === 2);
  a.native(4, {horseId:0}, old);
  assert.match((await a.wait(m => m.kind === 'reply' && m.error)).error, /advanced/);
  await a.wait(m => m.kind === 'restore');
  assert.deepEqual(room.players[0].pieces, [0,0,0,0]);
  a.native(4, {horseId:0});
  await a.wait(m => m.kind === 'native' && m.message.data.event === 4);
  a.native(4, {horseId:0});
  assert.match((await a.wait(m => m.kind === 'reply' && m.error)).error, /move/);
  assert.deepEqual(room.players[0].pieces, [1,0,0,0]);
});

test('a missed browser animation acknowledgement cannot stall a no-move turn', async t => {
  const f = await fixture(t, {randomDice:() => 2});
  const {players:[a,b]} = await f.playing();
  a.native(1);
  const turn = await b.wait(m => m.kind === 'native' && m.message.data.event === 3);
  assert.equal(turn.snapshot.turn, b.id);
  assert.equal(turn.snapshot.phase, 'roll');
});

test('a server deadline rolls and moves without any browser action', async t => {
  const f = await fixture(t, {turnMs:30, randomDice:() => 6});
  const {players:[a], room} = await f.playing();
  const restored = await a.wait(m => m.kind === 'restore' && m.snapshot.players[0].pieces[0] === 1);
  assert.equal(restored.snapshot.phase, 'roll');
  assert.equal(room.players[0].pieces[0], 1);
});

test('reconnect preserves identity and board; replacement socket owns the seat', async t => {
  const f = await fixture(t, {randomDice:() => 6});
  const {players:[a], room} = await f.playing();
  a.native(1); await a.wait(m => m.kind === 'native' && m.message.data.event === 2);
  a.native(4,{horseId:0}); await a.wait(m => m.kind === 'native' && m.message.data.event === 4);
  const closing = once(a.ws, 'close');
  const replacement = await f.connect(a.token);
  const joined = await replacement.command('join', {code:room.code});
  assert.equal(joined.playerId, a.id);
  assert.deepEqual(joined.room.players[0].pieces, [1,0,0,0]);
  await closing;
  assert.equal((await replacement.snapshot()).players[0].online, true);
});

test('disconnect grace ends a two-player match and results survive rejoin and rematch', async t => {
  const f = await fixture(t, {reconnectMs:35});
  const {players:[a,b], room} = await f.playing();
  await b.close();
  const finished = await a.wait(m => m.kind === 'finished');
  assert.equal(finished.snapshot.winner, a.id);
  assert.equal(finished.snapshot.reason, 'forfeit');
  await assert.rejects(a.command('rematch'), /all players/);
  const back = await f.connect(b.token);
  await back.command('join', {code:room.code});
  const resumed = await back.wait(m => m.kind === 'start');
  assert.equal(resumed.snapshot.status, 'finished');
  await assert.rejects(back.command('rematch'), /host/);
  const revision = room.revision;
  await a.command('rematch');
  const restarted = await back.wait(m => m.kind === 'start');
  assert.equal(restarted.snapshot.match, 2);
  assert.ok(restarted.snapshot.revision > revision);
  assert.ok(restarted.snapshot.players.every(p => !p.forfeited && p.pieces.every(n => n === 0)));
});

test('four-player forfeits keep seats stable and skip the departed player', async t => {
  const f = await fixture(t, {randomDice:() => 1});
  const {players:[a,b,c], room} = await f.playing(4);
  await b.command('leave');
  assert.equal(room.players.length, 4);
  assert.equal(room.players[1].forfeited, true);
  // Consume the departure restore before issuing the next action.
  await a.wait(m => m.kind === 'restore' && m.snapshot.players[1].forfeited);
  a.native(1);
  const nextTurn = await c.wait(m => m.kind === 'native' && m.message.data.event === 3);
  assert.equal(nextTurn.snapshot.turn, c.id);
});

test('home finish reaches both clients with the same winner', async t => {
  const f = await fixture(t, {randomDice:() => 1});
  const {players:[a,b], room} = await f.playing();
  // Explicit server fixture exercises final-state processing without a random full game.
  room.players[0].pieces = [56,57,57,57];
  a.native(1); await a.wait(m => m.kind === 'native' && m.message.data.event === 2);
  a.native(4,{horseId:0});
  const results = await Promise.all([a,b].map(c => c.wait(m => m.kind === 'native' && m.message.data.event === 12)));
  assert.equal(results[0].snapshot.winner, a.id);
  assert.deepEqual(results[0].message, results[1].message);
  assert.equal(results[0].snapshot.reason, 'home');
});

test('abandoned rooms and their scheduled work are removed after the grace period', async t => {
  const f = await fixture(t, {reconnectMs:25});
  const {players, room} = await f.playing();
  await Promise.all(players.map(c => c.close()));
  await new Promise(resolve => setTimeout(resolve,80));
  assert.equal(f.game.rooms.has(room.code), false);
});

test('MongoDB writes are ordered and contain no runtime timer handles', async t => {
  const saved = [];
  const f = await fixture(t, {}, {async replaceOne(filter, snapshot) {
    saved.push(snapshot); assert.equal(filter._id, snapshot.code);
  }});
  await f.playing(); await f.game.flush();
  assert.ok(saved.length >= 3);
  assert.ok(saved.every(s => s.expiresAt instanceof Date && !Object.hasOwn(s,'timer')));
  assert.equal(saved.at(-1).status, 'playing');
});

for (const size of [2,4]) test(`a complete ${size}-player network game reaches a shared winner without seeding pieces`, async t => {
  let room;
  const f = await fixture(t, {animationMs:1000, maxRequests:10000, randomDice:() => {
    const piece = room.players[room.turn].pieces.filter(p => p > 0 && p < 57).sort((a,b) => b-a)[0];
    return piece && 57-piece < 6 ? 57-piece : room.sixes < 2 ? 6 : 1;
  }});
  const created = await f.playing(size);
  room = created.room;
  const clients = created.players;
  for (let actions = 0; actions < 3000 && room.status === 'playing'; actions++) {
    const client = clients.find(c => c.id === room.players[room.turn].id);
    await client.snapshot();
    const revision = room.revision + 1;
    if (room.phase === 'roll') {
      client.native(1);
      await client.wait(m => m.kind === 'native' && m.message.data.event === 2 && m.snapshot.revision === revision);
    } else if (room.phase === 'move') {
      const player = room.players[room.turn];
      const horseId = legalMoves(player, room.dice).sort((a,b) => player.pieces[b]-player.pieces[a])[0];
      client.native(4,{horseId});
      await client.wait(m => m.kind === 'native' && m.message.data.event === 4 && m.snapshot.revision === revision);
    } else {
      client.native(3,0);
      await client.wait(m => m.kind === 'native' && m.message.data.event === 3 && m.snapshot.revision === revision);
    }
  }
  assert.equal(room.status,'finished');
  const results = await Promise.all(clients.map(c => c.wait(m => m.kind === 'finished')));
  assert.ok(results.every(m => m.snapshot.winner === room.winner));
  assert.ok(room.players.find(p => p.id === room.winner).pieces.every(p => p === 57));
});

test('another player disconnecting during dice animation cannot suppress the result', async t => {
  const f = await fixture(t, {diceMs:40, randomDice:() => 6});
  const {players:[a,b], room} = await f.playing();
  a.native(1); await a.wait(m => m.kind === 'native' && m.message.data.event === 1);
  await b.close();
  const result = await a.wait(m => m.kind === 'native' && m.message.data.event === 2);
  assert.equal(result.message.data.data,6);
  assert.equal(room.phase,'move');
});
