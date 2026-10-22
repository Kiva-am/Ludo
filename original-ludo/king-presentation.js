// King presentation adapted to Hero's renderer and private-room protocol.
(function () {
  const soundFiles = {
    button:'btnSound', dice:'diceRoll', jump:'tokenMove', kick:'tokenKill',
    safe:'safePoint', notification:'myTurn', home:'tokenHome', victory:'tokenHome',
    openingSound:'startGame', startGame:'startGame', searching:'searching'
  };
  const colors = ['#a45bf0', '#65dc2f', '#fa4242', '#38c9ff'];
  function installSounds(handler) {
    for (const [name, file] of Object.entries(soundFiles)) {
      const old = handler.sfxPlayer.soundList[name];
      const volume = old?.volume() ?? handler.sfxPlayer.getVolume();
      old?.unload();
      handler.sfxPlayer.soundList[name] = new Howl({src:['king/'+file+(file==='searching'?'.wav':'.mp3')],volume});
    }
    // Use one audio engine for King's music and effects. Temporary focus mute
    // and the two explicit settings still remain independent.
    handler.bgmPlayer.stop();
    const music = new Howl({src:['king/bgMusic.mp3'],loop:true,volume:.35});
    handler.bgmPlayer = {
      stayMuteFlag:false, bgmPlaying:false,
      play(){this.bgmPlaying=true;if(!document.hidden&&!this.stayMuteFlag&&!music.playing())music.play();},
      stop(){this.bgmPlaying=false;music.stop();},
      volume(value){music.volume(value);}, getVolume(){return music.volume();},
      mute(permanent){if(permanent!==false)this.stayMuteFlag=true;music.mute(true);},
      unmute(permanent){if(permanent!==false)this.stayMuteFlag=false;music.mute(this.stayMuteFlag);if(this.bgmPlaying&&!music.playing())music.play();},
      sync(){music.mute(document.hidden||this.stayMuteFlag);}
    };
  }
  function fitMenu(root) {
    const rect=document.querySelector('#canvas').getBoundingClientRect();
    Object.assign(root.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
  }
  function showMenu() {
    ig.soundHandler.bgmPlayer.play();
    document.getElementById('king-menu')?.remove();
    const root=document.createElement('main');root.id='king-menu';
    root.innerHTML='<header><span class="king-profile">♟</span><div>Ludo Hero<small>Play with friends</small></div><button id="king-sound" aria-label="Mute sound">♪</button><button id="king-music" aria-label="Mute music">♫</button></header><img class="king-logo" src="media/graphics/sprites/ui/logo.png" alt="Ludo Hero"><div class="king-modes"><button class="king-mode" id="king-online"><span class="king-phones"><i></i><b>🌐</b><i></i></span><strong>ONLINE<br>MULTIPLAYER</strong></button><button class="king-mode" id="king-computer"><span class="king-phones"><i>VS</i></span><strong>COMPUTER</strong></button></div><p class="king-caption">Private rooms · 2 or 4 players</p>';
    document.body.append(root);fitMenu(root);
    const click=()=>ig.soundHandler.sfxPlayer.play('button');
    const choose=bot=>{
      click();ig.game.botMode=bot;
      root.querySelector('.king-modes').innerHTML='<h1>'+ (bot?'Vs Computer':'Play with friends')+'</h1><p>Choose players</p><button class="king-choice" data-size="2">2 PLAYERS</button><button class="king-choice" data-size="4">4 PLAYERS</button><button class="king-back">Back</button>';
      root.querySelectorAll('[data-size]').forEach(button=>button.onclick=()=>{
        click();ig.game.roomSize=Number(button.dataset.size);ig.game.showTutorial=false;ig.game.nameInput.hide();
        if(bot){root.remove();ig.game.getEntityByName('HomeController').startGame();}
        else window.LudoRooms.open();
      });
      root.querySelector('.king-back').onclick=()=>{click();showMenu();};
    };
    root.querySelector('#king-online').onclick=()=>choose(false);
    root.querySelector('#king-computer').onclick=()=>choose(true);
    const sound=root.querySelector('#king-sound');
    const soundMuted=()=>ig.soundHandler.sfxPlayer.stayMuteFlag||ig.soundHandler.sfxPlayer.getVolume()===0;
    let soundVolume=ig.soundHandler.sfxPlayer.getVolume()||1;
    function updateSound(){const muted=soundMuted();sound.textContent=muted?'♫̸':'♪';sound.setAttribute('aria-label',muted?'Unmute sound':'Mute sound');sound.setAttribute('aria-pressed',String(muted));}
    sound.onclick=()=>{const h=ig.soundHandler,enabled=soundMuted();if(enabled){h.unmuteSFX();h.sfxPlayer.volume(soundVolume);}else{soundVolume=h.sfxPlayer.getVolume()||1;h.muteSFX();h.sfxPlayer.volume(0);}ig.game.save('sound',enabled?soundVolume:0);updateSound();if(enabled)click();};updateSound();
    const music=root.querySelector('#king-music');
    const musicMuted=()=>ig.soundHandler.bgmPlayer.stayMuteFlag||ig.soundHandler.bgmPlayer.getVolume()===0;
    let musicVolume=ig.soundHandler.bgmPlayer.getVolume()||.35;
    function updateMusic(){const muted=musicMuted();music.textContent=muted?'♫̸':'♫';music.setAttribute('aria-label',muted?'Unmute music':'Mute music');music.setAttribute('aria-pressed',String(muted));}
    music.onclick=()=>{const h=ig.soundHandler,enabled=musicMuted();if(enabled){h.bgmPlayer.volume(musicVolume);h.unmuteBGM();}else{musicVolume=h.bgmPlayer.getVolume()||.35;h.muteBGM();h.bgmPlayer.volume(0);}ig.game.save('music',enabled?musicVolume:0);updateMusic();};updateMusic();
  }
  function startBanner() {
    document.getElementById('king-menu')?.remove();
    document.getElementById('king-start')?.remove();
    const root=document.createElement('div');root.id='king-start';root.setAttribute('role','status');
    root.innerHTML='<img src="king/game_img_start.png" alt="Game Start">';document.body.append(root);
    ig.soundHandler.bgmPlayer.play();
    ig.soundHandler.sfxPlayer.play('startGame');
    setTimeout(()=>root.remove(),1400);
  }
  window.addEventListener('resize',()=>{const root=document.getElementById('king-menu');if(root)fitMenu(root);});
  document.addEventListener('visibilitychange',()=>ig.soundHandler?.bgmPlayer?.sync?.());
  window.addEventListener('load',()=>{
    ig.SoundHandler.inject({init(){this.parent();installSounds(this);}});
    EntityHomeController.inject({
      init(x,y,settings){this.parent(x,y,settings);showMenu();},
      update(){this.parent();if(document.getElementById('king-menu'))ig.game.nameInput.hide();},
      startGame(){document.getElementById('king-menu')?.remove();return this.parent();}
    });
    EntityGameController.inject({init(x,y,settings){this.parent(x,y,settings);startBanner();}});
    EntityHorse.inject({
      tween(properties,duration,options){
        if(properties.pos && (duration===.2||duration===.3)){
          this.kingMotion={time:ig.Timer.time,duration:duration===.2?.24:.4,x:this.pos.x,y:this.pos.y};
          duration=this.kingMotion.duration;
        }
        return this.parent(properties,duration,options);
      },
      updateState(steps){this.kingMotion=null;return this.parent(steps);},
      draw(){
        const ctx=ig.system.context, motion=this.kingMotion;
        const progress=motion?(ig.Timer.time-motion.time)/motion.duration:1;
        const active=motion&&progress>=0&&progress<1;
        ctx.save();
        if(active){
          const color=colors[this.parents.colorId];
          for(let i=3;i>=1;i--){const t=Math.max(0,progress-i*.13);ctx.globalAlpha=(1-i/4)*.35;ctx.fillStyle=color;ctx.beginPath();ctx.arc(motion.x+(this.pos.x-motion.x)*(t/Math.max(progress,.001))+this.size.x/2,motion.y+(this.pos.y-motion.y)*(t/Math.max(progress,.001))+this.size.y-5,Math.max(2,this.size.x*.22),0,Math.PI*2);ctx.fill();}
          ctx.globalAlpha=1;
        }
        const pulse=active?1+.10*Math.sin(progress*Math.PI):1;
        ctx.translate(this.pos.x+this.size.x/2,this.pos.y+this.size.y);
        ctx.scale(this.scale*pulse,this.scale*pulse);
        this.image.draw(-this.image.width/2,-this.image.height);
        if(this.drawSel)this.selectionAnim.draw(-this.image.width/2+this.selectionDx,-this.image.height+this.selectionDy);
        ctx.restore();
      }
    });
  });
})();
