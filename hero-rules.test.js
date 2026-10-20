import test from 'node:test';
import assert from 'node:assert/strict';
import {roll,move,next,legalMoves} from './hero-rules.js';
const room=()=>({size:2,status:'playing',players:[{id:'a',seat:0,pieces:[0,0,0,0]},{id:'b',seat:1,pieces:[0,0,0,0]}],turn:0,phase:'roll',sixes:0});
test('only the active player rolls and a six releases a cone',()=>{
 const r=room();assert.throws(()=>roll(r,'b'));roll(r,'a',()=>6);assert.throws(()=>roll(r,'a'));move(r,'a',0);assert.equal(r.players[0].pieces[0],1);assert.equal(r.phase,'roll');
});
test('no legal move advances and three sixes lose the turn',()=>{
 const r=room();roll(r,'a',()=>2);assert.equal(r.phase,'next');next(r,'a');assert.equal(r.turn,1);
 r.sixes=2;roll(r,'b',()=>6);assert.equal(r.phase,'next');assert.throws(()=>move(r,'b',0));next(r,'b');assert.equal(r.sixes,0);
});
test('single enemy capture grants another roll; a stack protects pieces',()=>{
 const r=room();r.players[0].pieces=[2,0,0,0];r.players[1].pieces=[29,0,0,0];roll(r,'a',()=>1);move(r,'a',0);assert.equal(r.players[1].pieces[0],0);assert.equal(r.phase,'roll');
 const s=room();s.players[0].pieces=[2,0,0,0];s.players[1].pieces=[29,29,0,0];roll(s,'a',()=>1);move(s,'a',0);assert.deepEqual(s.players[1].pieces,[29,29,0,0]);assert.equal(s.phase,'next');
});
test('home requires an exact roll and completed pieces cannot move',()=>{
 const r=room();r.players[0].pieces=[56,57,57,57];assert.deepEqual(legalMoves(r.players[0],2),[]);roll(r,'a',()=>1);move(r,'a',0);assert.equal(r.status,'finished');assert.equal(r.winner,'a');
});
