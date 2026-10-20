// Minimal branded loading screen; the original loader controls completion.
window.LudoLoadingScreen = {
  wallpaper: Object.assign(new Image(), { src: 'board-pattern.png' }),
  draw(loader) {
    const ctx = ig.system.context;
    const width = ig.system.width;
    const height = ig.system.height;
    ctx.save();
    ctx.fillStyle = '#0b0b13';
    ctx.fillRect(0, 0, width, height);
    const wallpaper = this.wallpaper;
    if (wallpaper.complete && wallpaper.naturalWidth) {
      const scale = Math.max(width / wallpaper.naturalWidth, height / wallpaper.naturalHeight);
      const w = wallpaper.naturalWidth * scale;
      const h = wallpaper.naturalHeight * scale;
      ctx.drawImage(wallpaper, (width - w) / 2, (height - h) / 2, w, h);
      ctx.fillStyle = '#04244866';
      ctx.fillRect(0, 0, width, height);
    }
    const size = Math.min(width, height) * .16;
    const centerY = height / 2 - size * .15;
    if (loader.loadingLogo.loaded) {
      // The supplied artwork has transparent margins. Fit the visible logo.
      ctx.drawImage(loader.loadingLogo.data, 292, 302, 698, 676,
        (width - size) / 2, centerY - size / 2, size, size * 676 / 698);
    }
    ctx.fillStyle = '#dddde3';
    ctx.font = `${Math.max(14, Math.min(width, height) * .032)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Loading...', width / 2, centerY + size / 2 + 16);
    ctx.restore();
  }
};
