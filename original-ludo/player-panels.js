// Presentation only: retain the original board, turn logic, dice and pawn art.
(function () {
  function round(ctx, x, y, w, h, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
  }
  function layout(player) {
    const mobile = ig.game.isMobile;
    const right = player.posId >= 2;
    const w = mobile ? 210 : 156;
    const h = 86;
    const x = right
      ? player.avatarX + player.avatar.width - w + 10
      : player.avatarX - 10;
    const y = player.avatarY + (mobile ? 18 : 28);
    const trayX = right ? x + 3 : x + w - 81;
    const coneX = right ? x + w - 59 : x + 11;
    player.playerPanel = { x, y, w, h, trayX, coneX };
    player.avatarX = coneX;
    player.avatarY = y + 8;
    player.size.x = 48;
    player.size.y = 68;
    player.nameX = x + w / 2;
    player.nameY = y + h + 18;
    player.dicePos = { x: trayX + 8, y: y + 11 };
    // Draw the shared original dice above the panel background.
    player.dice.zIndex = 50;
  }
  function draw(player) {
    if (!player.playerPanel) return;
    const { x, y, w, h, trayX, coneX } = player.playerPanel;
    const ctx = ig.system.context;
    const active = player.parents.currentPlayer === player;
    ctx.save();
    ctx.shadowColor = active ? '#fff16b' : '#001f47';
    ctx.shadowBlur = active ? 12 : 4;
    const blue = ctx.createLinearGradient(x, y, x + w, y);
    blue.addColorStop(0, '#0753a7');
    blue.addColorStop(.5, '#6fb3cd');
    blue.addColorStop(1, '#07458f');
    ctx.fillStyle = blue;
    ctx.strokeStyle = active ? '#fff17b' : '#ecd63f';
    ctx.lineWidth = 3;
    round(ctx, x, y + 8, w, h - 16, 2);
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#89b6b4';
    round(ctx, trayX - 4, y - 3, 86, h + 6, 11);
    ctx.fill(); ctx.stroke();
    const pink = ctx.createLinearGradient(0, y, 0, y + h);
    pink.addColorStop(0, '#c88e97');
    pink.addColorStop(.55, '#e8b8bc');
    pink.addColorStop(1, '#fff2e7');
    ctx.fillStyle = pink;
    ctx.strokeStyle = '#fff4d3'; ctx.lineWidth = 2;
    round(ctx, trayX + 1, y + 2, 76, h - 4, 7);
    ctx.fill(); ctx.stroke();
    // Use the game's actual cone sprite, with its original player color.
    const pawn = player.horses?.[0]?.image;
    if (pawn?.loaded && pawn.data) {
      ctx.shadowColor = '#00172b88'; ctx.shadowBlur = 3;
      ctx.shadowOffsetY = 3;
      ctx.drawImage(pawn.data, coneX, y + 7, 46, 70);
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    }
    if (player.countdowning) {
      ctx.beginPath();
      ctx.arc(coneX + 23, y + 42, 29, player.rAngle, player.PI2);
      ctx.strokeStyle = '#fff09b'; ctx.lineWidth = 3; ctx.stroke();
    }
    if (player.autoMode) {
      ctx.fillStyle = '#072d61';
      round(ctx, coneX - 2, y + 59, 51, 16, 5); ctx.fill();
      ctx.fillStyle = '#fff2aa'; ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center'; ctx.fillText('AUTO', coneX + 23, y + 71);
    }
    ctx.restore();
    if (active && player.isMainPlayer && !player.parents.gameEnd && !player.parents.transferingTurn) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.font = 'bold 21px Arial';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#073366';
      ctx.fillStyle = '#fff17b';
      ctx.strokeText('Your turn', x + w / 2, y - 14);
      ctx.fillText('Your turn', x + w / 2, y - 14);
      ctx.restore();
    }
    ig.game.setTextStyle('16px text', '#fff', 'center');
    const seat = !ig.game.botMode ? ig.global.gameState?.findIndex(p => p.playerId === player.serverId) : -1;
    ig.game.drawText(seat >= 0 ? 'Player ' + (seat + 1) : player.playerName, player.nameX, player.nameY);
  }
  window.LudoPlayerPanels = { layout, draw };
})();
