// Mobile browsers require a user gesture before game audio can play.
(function () {
  const maxSoundDelay = 500;
  const resuming = new WeakMap();

  function resumeContext(context) {
    if (!context || context.state === 'running' || context.state === 'closed') return Promise.resolve();
    if (resuming.has(context)) return resuming.get(context);
    try {
      const pending = Promise.resolve(context.resume()).catch(() => {}).finally(() => resuming.delete(context));
      resuming.set(context, pending);
      return pending;
    } catch { return Promise.resolve(); }
  }

  function syncVisibleAudio() {
    const handler = window.ig?.soundHandler;
    if (document.hidden || !handler) return;
    // Browser focus and visibility callbacks can arrive in either order. A
    // visible game must not retain Howler's temporary global focus mute.
    handler.focusBlurMute = false;
    window.Howler?.mute?.(false);
    for (const clip of Object.values(handler.sfxPlayer?.soundList || {})) clip.mute?.(!!handler.sfxPlayer.stayMuteFlag);
    handler.bgmPlayer?.sync?.();
  }

  function installSoundQueue(player) {
    if (!player || player.queueForMobileAudio) return;
    const play = player.play;
    player.pendingMobileSounds = [];
    player.queueForMobileAudio = true;
    for (const method of ['mute', 'unmute']) {
      const original = player[method];
      if (original) player[method] = function (...args) {
        const result = original.apply(this, args);
        syncVisibleAudio();
        return result;
      };
    }
    const context = window.Howler?.ctx;
    context?.addEventListener('statechange', () => playQueuedSounds(player));
    player.play = function (sound) {
      if (document.hidden || this.stayMuteFlag) return;
      syncVisibleAudio();
      const context = window.Howler?.ctx;
      if (context && context.state !== 'running' && !this.stayMuteFlag) {
        this.pendingMobileSounds.push({ sound, time: Date.now() });
        if (this.pendingMobileSounds.length > 12) this.pendingMobileSounds.shift();
        if (window.Howler?._audioUnlocked) resumeContext(context).then(() => playQueuedSounds(this));
        return;
      }
      return play.call(this, sound);
    };
  }

  function playQueuedSounds(player = window.ig?.soundHandler?.sfxPlayer) {
    if (!player?.pendingMobileSounds?.length || window.Howler?.ctx?.state !== 'running') return;
    const pending = player.pendingMobileSounds.splice(0);
    for (const { sound, time } of pending) {
      if (Date.now() - time <= maxSoundDelay) player.play(sound);
    }
  }

  // Register after the bundle's modules are ready, before the page starts the game.
  window.addEventListener('load', () => {
    ig.SoundHandler.inject({
      forceMuteAll() {
        // A DOM control or another window taking focus does not hide the game.
        if (!document.hidden) return;
        this.parent();
      },
      forceUnMuteAll() {
        this.parent();
        syncVisibleAudio();
      },
      init() {
        this.parent();
        // The global ig.soundHandler is assigned only after this constructor returns.
        installSoundQueue(this.sfxPlayer);
      }
    });
    installSoundQueue(ig.soundHandler?.sfxPlayer);
  });

  function unlockAudio(event) {
    if (!event.isTrusted || document.hidden) return;
    syncVisibleAudio();
    // Resume contexts directly. The bundled Howler code already installs its
    // own one-time touch unlock listeners; calling unlockWebAudio per tap would
    // keep adding another set while its asynchronous unlock is still pending.
    const contexts = new Set([
      window.Howler?.ctx,
      window.ig?.webaudio_ctx,
      window.ig?.soundHandler?.bgmPlayer?.webaudio?.context
    ]);
    const resumes = [];
    for (const context of contexts) {
      if (context && context.state !== 'running' && context.state !== 'closed') {
        try {
          resumes.push(resumeContext(context));
        } catch {
          // The browser may refuse to resume a context while backgrounded.
        }
      }
    }
    Promise.allSettled(resumes).then(playQueuedSounds);
  }
  for (const event of ['pointerdown', 'pointerup', 'touchend', 'keydown']) {
    document.addEventListener(event, unlockAudio, { capture: true, passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      window.ig?.soundHandler?.sfxPlayer?.pendingMobileSounds?.splice(0);
    } else {
      syncVisibleAudio();
      resumeContext(window.Howler?.ctx).then(() => playQueuedSounds());
    }
  });
  window.addEventListener('focus', syncVisibleAudio);
  window.addEventListener('pageshow', syncVisibleAudio);
})();
