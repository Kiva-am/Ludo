import {chromium} from 'playwright-core';
import express from 'express';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {attachMultiplayer} from '../hero-multiplayer.js';

const app=express();app.use(express.static(resolve('original-ludo')));
const server=createServer(app),game=attachMultiplayer(server);
let browser;const errors=[];
try{
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{channel:'chrome'})});
  await mkdir('test-results',{recursive:true});
  for(const size of [2,4]){
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.url().includes('/king/')&&r.status()>=400)errors.push(r.status()+' '+r.url());});
    await page.goto(origin);await page.locator('#king-computer').waitFor();
    await page.getByRole('button',{name:'Mute sound',exact:true}).click();
    assert.equal(await page.evaluate(()=>ig.soundHandler.sfxPlayer.stayMuteFlag),true);
    assert.equal(await page.evaluate(()=>ig.soundHandler.bgmPlayer.stayMuteFlag),false);
    await page.getByRole('button',{name:'Mute music',exact:true}).click();
    await page.reload();await page.locator('#king-computer').waitFor();
    await page.getByRole('button',{name:'Unmute sound',exact:true}).waitFor();
    await page.getByRole('button',{name:'Unmute music',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>ig.soundHandler.sfxPlayer.getVolume()),0);
    await page.getByRole('button',{name:'Unmute sound',exact:true}).click();
    assert.equal(await page.evaluate(()=>ig.soundHandler.bgmPlayer.getVolume()),0);
    assert.equal(await page.evaluate(()=>Howler._muted),false);
    await page.getByRole('button',{name:'Unmute music',exact:true}).click();
    assert.equal(await page.evaluate(()=>ig.soundHandler.bgmPlayer.bgmPlaying),true);
    // A mobile-sized menu must fit without scrolling past either mode card.
    const fits=await page.locator('#king-menu').evaluate(el=>el.scrollHeight<=el.clientHeight+1);
    assert.equal(fits,true);
    await page.screenshot({path:`test-results/hero-${size}-mobile-menu.png`});
    await page.locator('#king-computer').click();await page.locator(`[data-size="${size}"]`).click();
    await page.locator('#king-start').waitFor();
    assert.equal(await page.locator('#king-start img').getAttribute('src'),'king/game_img_start.png');
    // Capture an animation frame without waiting for the banner to finish and
    // remove itself (locator screenshots wait for stable geometry).
    await page.locator('#king-start').evaluate(el=>{el.style.animation='none';el.style.opacity='1';el.style.transform='none';});
    await page.screenshot({path:`test-results/hero-${size}-start-banner.png`});
    await page.waitForFunction(size=>{
      const c=ig.game.getEntityByName('GameController');
      return ig.game.botMode&&c?.players.length===size&&c.dice.clickReady;
    },size);
    await page.waitForTimeout(1500);
    assert.equal(await page.locator('#nameBox').isVisible(),false);
    assert.equal(await page.locator('#king-menu').count(),0);
    await page.screenshot({path:`test-results/hero-${size}-solo-board.png`});
    // Exercise the original solo dice and verify it reaches the movement stage.
    await page.evaluate(()=>{const d=ig.game.getEntityByName('GameController').dice;d.getRandomValue=()=>6;d.rolling();});
    await page.waitForFunction(()=>ig.game.getEntityByName('GameController').horses.some(h=>h.usedSteps>0));
    await context.close();
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: mobile menu fits, sound/music mute independently, King banner renders, and 2-/4-player solo mode rolls and moves without page or King asset errors.');
}finally{
  await browser?.close();for(const ws of game.wss.clients)ws.terminate();
  await new Promise(r=>game.wss.close(r));await new Promise(r=>server.close(r));
}
