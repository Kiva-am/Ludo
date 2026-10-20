// Install before the page's load handler starts the original game.
window.addEventListener('load', function () {
  ig.DomHandler.inject({
    forcedDeviceDetection() {
      // Use one portrait experience on phones, tablets and computers.
      ig.ua.mobile = true;
    }
  });
  ig.SizeHandler.inject({
    disableStretchToFitOnMobileFlag: true,
    sizeCalcs() {
      this.parent();
      if (!ig.ua.mobile) return;
      const style = getComputedStyle(document.documentElement);
      const inset = side => parseFloat(style.getPropertyValue('--safe-' + side)) || 0;
      this.safeInsets = { top: inset('top'), right: inset('right'),
        bottom: inset('bottom'), left: inset('left') };
      const availableWidth = window.innerWidth - this.safeInsets.left - this.safeInsets.right;
      const availableHeight = window.innerHeight - this.safeInsets.top - this.safeInsets.bottom;
      const scale = Math.min(availableWidth / this.mobile.actualResolution.x,
        availableHeight / this.mobile.actualResolution.y);
      this.mobile.actualSize.x = this.mobile.actualResolution.x * scale;
      this.mobile.actualSize.y = this.mobile.actualResolution.y * scale;
      this.scaleRatioMultiplier.x = this.scaleRatioMultiplier.y = scale;
    },
    resizeLayers() {
      this.parent();
      if (!ig.ua.mobile) return;
      const {top, right, bottom, left} = this.safeInsets;
      const width = Math.floor(this.mobile.actualSize.x);
      const height = Math.floor(this.mobile.actualSize.y);
      const x = Math.floor(left + (window.innerWidth - left - right - width) / 2);
      const y = Math.floor(top + (window.innerHeight - top - bottom - height) / 2);
      for (const selector of this.coreDivsToResize) {
        const element = this.domHandler.getElementById(selector);
        if (element) this.domHandler.resizeOffset(element, width, height, x, y);
      }
    },
    // Keep the portrait board playable when a phone is turned sideways.
    reorient() {
      document.getElementById('game').style.display = 'block';
      document.getElementById('orientate').style.display = 'none';
      this.resize();
    }
  });

  const wallpaper = new ig.Image('board-pattern.png');
  const backgrounds = new Set([
    'media/graphics/sprites/ui/bg.png',
    'media/graphics/sprites/ui/mobile/bg.png'
  ]);
  ig.Image.inject({
    draw(x, y, ...args) {
      if (!backgrounds.has(this.path) || !wallpaper.loaded) {
        return this.parent(x, y, ...args);
      }
      const width = ig.system.width;
      const height = ig.system.height;
      const scale = Math.max(width / wallpaper.width, height / wallpaper.height);
      const sourceWidth = width / scale;
      const sourceHeight = height / scale;
      const screenX = ig.game?.screen?.x || 0;
      ig.system.context.drawImage(wallpaper.data,
        (wallpaper.width - sourceWidth) / 2, (wallpaper.height - sourceHeight) / 2,
        sourceWidth, sourceHeight,
        (x - screenX) * ig.system.scale, y * ig.system.scale,
        width * ig.system.scale, height * ig.system.scale);
    }
  });
  window.visualViewport?.addEventListener('resize', () => ig.sizeHandler?.resize());
});
