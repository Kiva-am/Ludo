import WebSocket from 'ws';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {legalMoves} from '../hero-rules.js';

const base = process.argv[2] || 'http://localhost:3002';
async function connect(token = randomBytes(32).toString('hex')) {
  const ws = new WebSocket(base.replace(/^http/, 'ws') + '/rooms');
  const queue = [], waiters = [];
  let seq = 0, revision;
  ws.on('message', raw => {
    const msg = JSON.parse(raw);
    revision = msg.snapshot?.revision ?? msg.room?.revision ?? revision;
    const index = waiters.findIndex(w => w.filter(msg));
    if (index < 0) queue.push(msg);
    else waiters.splice(index, 1)[0].resolve(msg);
  });
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  const wait = filter => new Promise((resolve, reject) => {
    const index = queue.findIndex(filter);
    if (index >= 0) return resolve(queue.splice(index, 1)[0]);
    const entry = {filter, resolve: msg => { clearTimeout(timer); resolve(msg); }};
    const timer = setTimeout(() => { const i = waiters.indexOf(entry); if (i >= 0) waiters.splice(i, 1); reject(Error('Server response timed out')); }, 10000);
    waiters.push(entry);
  });
  return {ws, token, wait,
    native(event, data) { ws.send(JSON.stringify({kind:'native', revision, message:{type:52, data:{event,data}}})); },
    async command(action, extra = {}) {
      const requestId = ++seq;
      ws.send(JSON.stringify({kind:'command',action,token,requestId,...extra}));
      const reply = await wait(m => m.kind === 'reply' && m.requestId === requestId);
      if (reply.error) throw Error(reply.error);
      return reply;
    },
    async snapshot() {
      ws.send(JSON.stringify({kind:'snapshot'}));
      return (await wait(m => m.kind === 'restore')).snapshot;
    }
  };
}

const clients = [await connect(), await connect()];
let rolls = 0, moves = 0, turns = 0, rejoined = false, finished = false;
try {
  const created = await clients[0].command('create', {size:2});
  const code = created.room.code;
  clients[0].id = created.playerId;
  clients[1].id = (await clients[1].command('join', {code})).playerId;
  await clients[0].command('start');
  await Promise.all(clients.map(c => c.wait(m => m.kind === 'start')));
  const sameState = async () => {
    const states = await Promise.all(clients.map(c => c.snapshot()));
    assert.deepEqual(states[0], states[1], 'Both sessions must receive identical authoritative state');
    return states[0];
  };
  let state = await sameState();
  for (let action = 0; action < 6000; action++) {
    const active = clients.find(c => c.id === state.turn);
    if (state.phase === 'roll') {
      active.native(1);
      const dice = await Promise.all(clients.map(c => c.wait(m => m.kind === 'native' && m.message.data.event === 2)));
      assert.equal(dice[0].message.data.data, dice[1].message.data.data);
      assert.ok(dice[0].message.data.data >= 1 && dice[0].message.data.data <= 6);
      rolls++;
    } else if (state.phase === 'move') {
      const player = state.players.find(p => p.id === state.turn);
      const choices = legalMoves(player, state.dice);
      assert.ok(choices.length);
      const horseId = choices.sort((a,b) => player.pieces[b] - player.pieces[a])[0];
      const willFinish = player.pieces.every((step, i) => i === horseId ? step + state.dice === 57 : step === 57);
      active.native(4, {horseId});
      await Promise.all(clients.map(c => c.wait(m => m.kind === 'native' && m.message.data.event === 4)));
      moves++;
      if (willFinish) {
        const results = await Promise.all(clients.map(c => c.wait(m => m.kind === 'native' && m.message.data.event === 12)));
        assert.deepEqual(results[0].message.data.data, results[1].message.data.data);
        assert.equal(results[0].message.data.data[0].playerId, active.id);
        finished = true;
        break;
      }
    } else {
      assert.equal(state.phase, 'next');
      active.native(3, 0);
      await Promise.all(clients.map(c => c.wait(m => m.kind === 'native' && m.message.data.event === 3)));
      turns++;
    }
    state = await sameState();
    if (!rejoined && rolls >= 20) {
      const old = clients[1];
      await new Promise(resolve => { old.ws.once('close', resolve); old.ws.close(); });
      clients[1] = await connect(old.token);
      const reply = await clients[1].command('join', {code});
      clients[1].id = reply.playerId;
      assert.equal(reply.playerId, old.id);
      const restored = (await clients[1].wait(m => m.kind === 'start')).snapshot;
      assert.deepEqual(restored.players.map(p => p.pieces), state.players.map(p => p.pieces));
      assert.equal(restored.turn, state.turn);
      assert.equal(restored.phase, state.phase);
      state = await sameState();
      rejoined = true;
      console.log('PASS: disconnect/rejoin preserved identity, positions, dice phase and turn.');
    }
    if (state.phase === 'move' && rolls % 25 === 0) console.log(`Progress: ${rolls} rolls, ${moves} moves, ${turns} turn changes.`);
  }
  assert.ok(finished, 'A full game must reach its winner');
  assert.ok(rejoined);
  console.log(`PASS: complete live game ${code}; ${rolls} rolls, ${moves} moves, ${turns} turns; matching winner on both sessions.`);
} finally {
  for (const client of clients) client.ws.close();
}
