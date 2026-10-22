import {chromium} from 'playwright-core';
import express from 'express';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {attachMultiplayer} from '../hero-multiplayer.js';

const size = process.argv.includes('--four') ? 4 : 2;
const app = express();
app.use(express.static(resolve('original-ludo')));
const server = createServer(app);
let forcedDice;
const game = attachMultiplayer(server, null, {turnMs:60000, randomDice:() => forcedDice ?? 6});
let browser;
const errors = [];
const until = async (fn, label, timeout = 20000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await fn()) return;
    await new Promise(resolve => setTimeout(resolve,100));
  }
  throw Error('Timed out: '+label);
};
const board = page => page.evaluate(() => {
  const c = window.ig?.game?.getEntityByName('GameController');
  return c && {turn:c.currentPlayer.serverId, ended:c.gameEnd, pieces:c.getCurrentState(),
    id:ig.game.gameClient.playerId, state:window.LudoRooms.state,
    moving:c.horses.some(h => h.isMoving || h.isJumping)};
});
async function clickEntity(page, name, playerCount) {
  const point = await page.evaluate(({name,playerCount}) => {
    let entity;
    if (name === 'dice') entity = ig.game.getEntityByName('GameController').dice;
    else if (name === 'horse') entity = ig.game.getEntityByName('GameController').currentPlayer.horses.find(h => h.movable);
    else entity = ig.game.getEntitiesByType(window[name]).find(e => playerCount === undefined || e.numOfPlayers === playerCount);
    if (!entity) throw Error('Missing entity '+name);
    const rect = document.querySelector('canvas').getBoundingClientRect();
    return {x:rect.x+(entity.pos.x-ig.game.screen.x+entity.size.x/2)/ig.system.width*rect.width,
      y:rect.y+(entity.pos.y-ig.game.screen.y+entity.size.y/2)/ig.system.height*rect.height};
  }, {name,playerCount});
  await page.mouse.click(point.x,point.y);
}
try {
  await mkdir('test-results',{recursive:true});
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({headless:true, ...(process.env.BROWSER_PATH ? {executablePath:process.env.BROWSER_PATH} : {channel:'chrome'})});
  const context = await browser.newContext({viewport:{width:480,height:900}});
  const pages = await Promise.all(Array.from({length:size}, () => context.newPage()));
  for (const [i,p] of pages.entries()) p.on('pageerror', e => { errors.push({player:i,error:e.message}); console.log('PAGE ERROR',i,e.stack); });
  for (const p of pages) {
    await p.goto(origin);
  await p.waitForFunction(() => window.ig?.game?.getEntityByName('HomeController') && ig.game.network_client?.socket?.disconnected === false, null, {timeout:60000});
    // Exercise the King presentation through the same controls players use.
    await p.evaluate(() => { ig.game.showTutorial = false; ig.game.save('tutorial',false); });
    await p.waitForTimeout(600);
    if(p===pages[0])await p.screenshot({path:`test-results/hero-${size}-king-menu.png`});
    await p.locator('#king-online').click();
    await p.locator('[data-size="'+size+'"]').click();
    await p.locator('#room-dialog').waitFor();
  }
  await pages[0].locator('#room-size').selectOption(String(size));
  await pages[0].locator('#create-room').click();
  await until(() => game.rooms.size === 1,'room created');
  const room = [...game.rooms.values()][0];
  for (const p of pages.slice(1)) {
    await p.locator('#room-code').fill(room.code); await p.locator('#join-room').click();
  }
  await pages[0].getByRole('button',{name:'Start game',exact:true}).click();
  await until(async () => (await Promise.all(pages.map(board))).every(Boolean),'boards loaded');
  await pages[0].screenshot({path:`test-results/hero-${size}-king-start.png`});
  await pages[0].waitForTimeout(1400);
  const ids = await Promise.all(pages.map(p => p.evaluate(() => ig.game.gameClient.playerId)));
  assert.equal(new Set(ids).size,size);
  for(const p of pages)await p.evaluate(()=>{
    const ctx=Howler.ctx,analyser=ctx.createAnalyser();analyser.fftSize=512;Howler.masterGain.connect(analyser);
    const samples=new Float32Array(analyser.fftSize);
    window.heroAudioProbe={peak:0,sounds:[],analyser};
    const player=ig.soundHandler.sfxPlayer,play=player.play;
    player.play=function(sound){window.heroAudioProbe.sounds.push({sound,turn:LudoRooms.state.turn,me:ig.game.gameClient.playerId});return play.call(this,sound);};
    setInterval(()=>{analyser.getFloatTimeDomainData(samples);window.heroAudioProbe.peak=Math.max(window.heroAudioProbe.peak,...samples.map(Math.abs));},10);
    ig.soundHandler.bgmPlayer.mute();
  });
  const checkBoards = async () => {
    const expected = Object.fromEntries(room.players.flatMap(p => p.pieces.map((n,h) => [p.id+'H'+h,n])));
    await until(async () => (await Promise.all(pages.map(board))).every(s => s && !s.moving && JSON.stringify(Object.entries(s.pieces).sort()) === JSON.stringify(Object.entries(expected).sort())), 'matching rendered pieces');
  };
  for (let seat = 0; seat < size; seat++) {
    const p = pages[ids.indexOf(room.players[room.turn].id)];
    for (const value of [6,1]) {
      forcedDice = value;
      const revision = room.revision;
      await p.waitForFunction(() => ig.game.getEntityByName('GameController')?.dice.clickReady);
      await p.evaluate(()=>{window.heroAudioProbe.peak=0;ig.soundHandler.focusBlurMute=true;Howler.mute(true);});
      await clickEntity(p,'dice');
      await until(() => room.revision > revision,'server dice');
      await until(() => room.players[seat].pieces[0] === (value === 6 ? 1 : 2), 'native automatic token move');
      await checkBoards();
      const audio=await p.evaluate(()=>({peak:heroAudioProbe.peak,sounds:heroAudioProbe.sounds,muted:Howler._muted,preference:ig.soundHandler.sfxPlayer.stayMuteFlag,source:ig.soundHandler.sfxPlayer.soundList.dice._src}));
      assert.ok(audio.source.endsWith('/diceRoll.mp3')||audio.source==='king/diceRoll.mp3',JSON.stringify(audio));
      assert.ok(audio.peak>.0001,'Audible King effects during the owning player turn: '+JSON.stringify(audio));
      assert.equal(audio.muted,false);assert.equal(audio.preference,false);
      if (value === 1) await until(() => room.turn === (seat+1)%size,'next seat');
    }
  }
  console.log(`PASS: ${size} original clients created/joined a private room, rolled dice and rendered matching moves for every seat.`);
  console.log('PASS: actual audio waveform output on every owner turn despite a stale focus mute; King dice clip loaded.');
  const id = ids[0];
  await pages[0].reload();
  await until(async () => (await board(pages[0]))?.id === id,'automatic reload rejoin');
  await checkBoards();
  console.log('PASS: reload restored the same identity and board without entering a code.');
  for (const ws of game.wss.clients) ws.terminate();
  await until(async () => (await Promise.all(pages.map(p => p.evaluate(() => ig.game.network_client.socket.disconnected)))).every(v => !v), 'automatic socket reconnect');
  await until(async () => (await Promise.all(pages.map(board))).every(s => s?.state.players.every(p => p.online)), 'all seats reconnected');
  await checkBoards();
  console.log('PASS: all clients automatically reconnected after their sockets were interrupted.');
  // Terminal-state fixture, not a claim to have played a full random match.
  room.players[0].pieces = [56,57,57,57]; room.turn = 0; room.phase = 'roll'; room.sixes = 0; room.dice = null; room.revision++;
  for (const p of pages) await p.evaluate(() => ig.game.network_client.sendMessage({type:21}));
  await checkBoards(); forcedDice = 1;
  await pages[0].waitForFunction(() => ig.game.getEntityByName('GameController').dice.clickReady);
  await clickEntity(pages[0],'dice');
  await until(() => room.status === 'finished','authoritative home finish');
  for (const p of pages) await p.getByRole('dialog').waitFor();
  assert.equal(room.winner,id);
  assert.ok((await Promise.all(pages.map(p => p.locator('.room-content').innerText()))).every(text => text.includes('Player 1 — Winner')));
  await mkdir('test-results',{recursive:true});
  await pages[0].screenshot({path:`test-results/hero-${size}-results.png`});
  await pages[0].getByRole('button',{name:'Play again',exact:true}).click();
  await until(async () => room.match === 2 && (await Promise.all(pages.map(board))).every(s => s && !s.ended && s.state.match === 2), 'rematch boards');
  await checkBoards();
  await pages[0].screenshot({path:`test-results/hero-${size}-rematch.png`});
  assert.deepEqual(errors,[]);
  console.log('PASS: all clients displayed the same winner and started a clean host-controlled rematch; no page errors.');
} finally {
  await browser?.close();
  for (const ws of game.wss.clients) ws.terminate();
  await new Promise(resolve => game.wss.close(resolve));
  await new Promise(resolve => server.close(resolve));
}
