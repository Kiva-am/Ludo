// Mobile browsers require a user gesture before game audio can play.
(function () {
  const maxSoundDelay = 500;

  function installSoundQueue(player) {
    if (!player || player.queueForMobileAudio) return;
    const play = player.play;
    player.pendingMobileSounds = [];
    player.queueForMobileAudio = true;
    const context = window.Howler?.ctx;
    context?.addEventListener('statechange', () => playQueuedSounds(player));
    player.play = function (sound) {
      if (document.hidden || this.stayMuteFlag) return;
      const context = window.Howler?.ctx;
      if (context && context.state !== 'running' && !this.stayMuteFlag) {
        this.pendingMobileSounds.push({ sound, time: Date.now() });
        if (this.pendingMobileSounds.length > 12) this.pendingMobileSounds.shift();
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
          resumes.push(context.resume());
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
    }
  });
})();
