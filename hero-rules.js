// Ludo Hero uses 0 for the yard, 1 for the start, and 57 for home.
import {randomInt} from 'node:crypto';
const safe = new Set([1,9,14,22,27,35,40,48]);
export function legalMoves(player, dice) {
  return player.pieces.flatMap((step, id) => step === 0 ? (dice === 6 ? [id] : []) : step < 57 && step + dice <= 57 ? [id] : []);
}
export function roll(room, playerId, random = () => randomInt(1,7)) {
  if (room.status !== 'playing' || room.players[room.turn].id !== playerId) throw Error('Wait for your turn.');
  if (room.phase !== 'roll') throw Error('Finish your move first.');
  room.dice = random();
  room.sixes = room.dice === 6 ? room.sixes + 1 : room.sixes;
  room.phase = room.sixes === 3 || !legalMoves(room.players[room.turn], room.dice).length ? 'next' : 'move';
  return room.dice;
}
export function move(room, playerId, horseId) {
  if (room.status !== 'playing' || room.players[room.turn].id !== playerId || room.phase !== 'move') throw Error('Wait for your move.');
  const player = room.players[room.turn];
  if (!legalMoves(player, room.dice).includes(horseId)) throw Error('That piece cannot move.');
  const from = player.pieces[horseId];
  const to = from === 0 ? 1 : from + room.dice;
  player.pieces[horseId] = to;
  const square = (to + player.seat * (room.size === 2 ? 26 : 13)) % 52;
  const occupants = [];
  if (to <= 51) for (const other of room.players) for (let h = 0; h < 4; h++) {
    const step = other.pieces[h];
    if (other === player && h === horseId || step === 0 || step > 51) continue;
    if ((step + other.seat * (room.size === 2 ? 26 : 13)) % 52 === square) occupants.push({other,h});
  }
  const captured = occupants.length === 1 && occupants[0].other !== player && !safe.has(square);
  if (captured) occupants[0].other.pieces[occupants[0].h] = 0;
  room.phase = room.dice === 6 || captured || to === 57 ? 'roll' : 'next';
  if (player.pieces.every(step => step === 57)) {
    room.status = 'finished';
    room.winner = player.id;
  }
  return {from,to,captured};
}
export function next(room, playerId) {
  if (room.status !== 'playing' || room.players[room.turn].id !== playerId || room.phase !== 'next') throw Error('Turn cannot advance yet.');
  room.turn = (room.turn + 1) % room.players.length;
  room.phase = 'roll'; room.sixes = 0; room.dice = null;
}
