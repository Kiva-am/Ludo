import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const adapter = readFileSync(new URL('./original-ludo/mobile-audio.js', import.meta.url), 'utf8');
const bundle = readFileSync(new URL('./original-ludo/game.js', import.meta.url), 'utf8');

function setup(state = 'running') {
  const events = new Map();
  const windowEvents = new Map();
  const played = [];
  let now = 0, onStateChange, injection, resumeCalls = 0, legacyUnlockCalls = 0, globalMuted = false;
  const context = {
    state,
    addEventListener(type, listener) {
      assert.equal(type, 'statechange');
      onStateChange = listener;
    },
    resume() {
      resumeCalls++;
      this.state = 'running';
      onStateChange?.();
      return Promise.resolve();
    }
  };
  const document = {hidden: false, addEventListener(type, listener) { events.set(type, listener); }};
  const ig = {SoundHandler: {inject(hooks) { injection = hooks; }}};
  const window = {
    ig, Howler: {ctx: context, mute(value){globalMuted=value;}},
    addEventListener(type, listener) { windowEvents.set(type, listener); }
  };
  const sandbox = vm.createContext({window, ig, document, Date: {now: () => now}});
  vm.runInContext(adapter, sandbox);
  windowEvents.get('load')();
  // Match the game's assignment order: init runs BEFORE ig.soundHandler is assigned.
  const handler = {
    parent() {
      this.sfxPlayer = {
        stayMuteFlag: false,
        play(sound) { if (context.state === 'running' && !this.stayMuteFlag && !globalMuted) played.push(sound); }
      };
    },
    unlockWebAudio() { legacyUnlockCalls++; }
  };
  injection.init.call(handler);
  ig.soundHandler = handler;
  return {
    player: handler.sfxPlayer, played, context, document, events, sandbox, window, handler, hooks:injection,
    advance(ms) { now += ms; },
    resume() { return context.resume(); },
    get resumeCalls() { return resumeCalls; },
    get legacyUnlockCalls() { return legacyUnlockCalls; }
  };
}

test('audio queue installs during construction before the global handler exists', () => {
  const {player} = setup();
  assert.equal(player.queueForMobileAudio, true);
});

test('visible owner and opponent turns recover a stale global focus mute without switching tabs', () => {
  const s=setup();
  for(const turn of ['mine','opponent','mine']){
    s.handler.focusBlurMute=true;s.window.Howler.mute(true);
    s.player.play('dice');
    assert.equal(s.handler.focusBlurMute,false,turn);
  }
  assert.deepEqual(s.played,['dice','dice','dice']);
});

test('focus mute only silences a hidden page', () => {
  const s=setup();let muted=0;
  const handler={parent(){muted++;}};
  s.hooks.forceMuteAll.call(handler);assert.equal(muted,0);
  s.document.hidden=true;s.hooks.forceMuteAll.call(handler);assert.equal(muted,1);
});

test('an already unlocked context resumes on the next game sound', async () => {
  const s=setup('interrupted');s.window.Howler._audioUnlocked=true;
  s.player.play('jump');await Promise.resolve();
  assert.deepEqual(s.played,['jump']);assert.equal(s.resumeCalls,1);
});

test('a visibility return repairs temporary mute but preserves an explicit sound mute', () => {
  const s=setup();s.handler.focusBlurMute=true;s.window.Howler.mute(true);
  s.events.get('visibilitychange')();s.player.play('dice');
  assert.deepEqual(s.played,['dice']);
  s.player.stayMuteFlag=true;s.events.get('visibilitychange')();s.player.play('jump');
  assert.deepEqual(s.played,['dice']);assert.equal(s.player.stayMuteFlag,true);
});

test('actual dice animation triggers one sound per roll, including server echoes', () => {
  const {sandbox, played} = setup();
  // Exercise the actual bundle method, without starting the browser renderer.
  const start = bundle.indexOf("'showRolling':function") + "'showRolling':".length;
  const end = bundle.indexOf(",'getRandomValue':", start);
  assert.ok(start > 0 && end > start);
  const showRolling = vm.runInContext('(' + bundle.slice(start, end) + ')', sandbox);
  const dice = {
    isRolling: false,
    parents: {currentPlayer: {stopCountdown() {}}},
    rollingTimer: {unpause() {}}
  };
  showRolling.call(dice);
  showRolling.call(dice);
  assert.deepEqual(played, ['dice']);
  dice.isRolling = false;
  showRolling.call(dice);
  assert.deepEqual(played, ['dice', 'dice']);
});

test('recent dice and movement sounds play once when the audio context resumes', async () => {
  const s = setup('suspended');
  s.player.play('dice');
  s.advance(200);
  s.player.play('jump');
  assert.deepEqual(s.played, []);
  await s.resume();
  s.events.get('pointerup')({isTrusted: true});
  assert.deepEqual(s.played, ['dice', 'jump']);
});

test('old effects do not burst out after a long audio interruption', async () => {
  const s = setup('suspended');
  s.player.play('dice');
  s.advance(1000);
  await s.resume();
  assert.deepEqual(s.played, []);
  assert.equal(s.player.pendingMobileSounds.length, 0);
});

test('mute and hiding the page prevent delayed sounds', async () => {
  const s = setup('suspended');
  s.player.play('dice');
  s.player.stayMuteFlag = true;
  await s.resume();
  s.player.play('jump');
  assert.deepEqual(s.played, []);
  s.player.stayMuteFlag = false;
  s.context.state = 'suspended';
  s.player.play('dice');
  s.document.hidden = true;
  s.events.get('visibilitychange')();
  s.player.play('jump');
  s.document.hidden = false;
  await s.resume();
  assert.deepEqual(s.played, []);
});

test('a trusted touch recovers an interrupted audio context', async () => {
  const s = setup('interrupted');
  s.player.play('dice');
  s.events.get('touchend')({isTrusted: false});
  assert.equal(s.context.state, 'interrupted');
  s.events.get('touchend')({isTrusted: true});
  await Promise.resolve();
  assert.deepEqual(s.played, ['dice']);
});

test('repeated taps resume audio once without reinstalling Howler unlock listeners', async () => {
  const s = setup('suspended');
  s.events.get('pointerdown')({isTrusted: true});
  s.events.get('pointerup')({isTrusted: true});
  s.events.get('touchend')({isTrusted: true});
  await Promise.resolve();
  assert.equal(s.resumeCalls, 1);
  assert.equal(s.legacyUnlockCalls, 0);
});
