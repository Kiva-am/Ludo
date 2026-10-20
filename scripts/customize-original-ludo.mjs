import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
// Reapply presentation changes from the preserved upstream bundle.
const input=resolve('.reference/ludo-hero/game.js');
let source=await readFile(input,'utf8');
// This is a self-hosted build, so do not load the publisher's remote ad SDK
// (which injects an ad-blocker prompt over the game).
const gdSdkInjection="document['getElementById']('gamedistribution-jssdk')||(_0x4791f6=document['createElement']('script'),_0x4791f6['id']='gamedistribution-jssdk',_0x4791f6['src']='https://html5.api.gamedistribution.com/main.min.js',_0x21bd92['parentNode']['insertBefore'](_0x4791f6,_0x21bd92)),";
if(!source.includes(gdSdkInjection))throw Error('GameDistribution SDK injection was not found.');
source=source.replace(gdSdkInjection,'');
// Guard the SDK references that remain in optional ad callbacks; the game
// starts and plays normally when the publisher SDK is absent.
source=source.replace(/\bgdsdk\b/g,"window['gdsdk']");
const avatarPaths=/media\/graphics\/sprites\/avatars\/avatar\d+\.png/g;
const count=[...source.matchAll(avatarPaths)].length;
if(!count)throw Error('Original avatar references were not found; source needs inspection.');
source=source.replace(avatarPaths,'default-avatar.svg');
const clientInit="this['network_client']=new ig['MjsNetworkClient']()";
if(!source.includes(clientInit))throw Error('Network initialization hook was not found.');
source=source.replace(clientInit,"window.LudoRooms.install(),"+clientInit);
const loaderStart=source.indexOf("ig['SplashLoader']=ig['Loader']['extend']({");
if(loaderStart<0)throw Error('Splash loader was not found.');
source=source.slice(0,loaderStart)+source.slice(loaderStart).replace("'desktopCoverDIVID':", "'loadingLogo':new ig['Image']('white.png'),'desktopCoverDIVID':");
const loaderDraw=source.indexOf("'draw':function(){",loaderStart);
const loaderDrawEnd=source.indexOf(",'tapToStartDiv':",loaderDraw);
if(loaderDraw<0||loaderDrawEnd<0)throw Error('Splash loader drawing hook was not found.');
source=source.slice(0,loaderDraw)+"'draw':function(){window.LudoLoadingScreen.draw(this);}"+source.slice(loaderDrawEnd);
const loaderReady=source.indexOf("ig['system']['setGame'](MyGame)",loaderStart);
source=source.slice(0,loaderReady)+source.slice(loaderReady).replace("ig['system']['setGame'](MyGame)","ig['system']['setGame'](MyGame),document.getElementById('branded-loading').remove()");
const handDraw="'draw':function(){this['isShown']&&this['parent']();}";
if(!source.includes(handDraw))throw Error('Tutorial hand draw hook was not found.');
source=source.replace(handDraw,"'draw':function(){}");
const playerStart=source.indexOf('EntityPlayer=');
const needle="this['avatar']=this['avatars'][this['avatarId']]";
const assignment=source.indexOf(needle,playerStart);
if(playerStart<0||assignment<0)throw Error('Original player initialization changed; source needs inspection.');
source=source.slice(0,assignment)+"this['playerName']='Player '+(this['parents']['players']['length']+1),"+source.slice(assignment);
const setup="this['setupPos'](),this['isMainPlayer']";
const setupIndex=source.indexOf(setup,playerStart);
if(setupIndex<0)throw Error('Player layout hook was not found.');
source=source.slice(0,setupIndex)+source.slice(setupIndex).replace(setup,"this['setupPos'](),window.LudoPlayerPanels.layout(this),this['isMainPlayer']");
// Replace only EntityPlayer.draw, leaving the original simulation untouched.
const drawStart=source.indexOf("'draw':function(){",playerStart);
const bodyStart=source.indexOf('{',drawStart);
let depth=1,quote=null,end=bodyStart+1;
for(;end<source.length&&depth;end++){
 const c=source[end];
 if(quote){if(c==='\\')end++;else if(c===quote)quote=null;continue;}
 if(c==='\''||c==='"'||c==='`'){quote=c;continue;}
 if(c==='{')depth++;else if(c==='}')depth--;
}
if(depth!==0)throw Error('Could not locate the end of the player draw function.');
source=source.slice(0,drawStart)+"'draw':function(){window.LudoPlayerPanels.draw(this);}"+source.slice(end);
await writeFile(resolve('original-ludo/game.js'),source);
const indexPath=resolve('original-ludo/index.html');
let html=await readFile(indexPath,'utf8');
html=html.replace('content="initial-scale=1.0001, minimum-scale=1.0001, maximum-scale=1.0001, user-scalable=no, minimal-ui"','content="width=device-width, height=device-height, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"');
html=html.replace('<style>html,body { background: #0b0b13; }</style>','<style>html,body { background: #0b0b13; width:100%; height:100%; height:100dvh; margin:0; overflow:hidden; touch-action:none; } #ajaxbar,#game { width:100%; height:100%; height:100dvh; }</style>');
if(!html.includes('src="room-client.js"'))html=html.replace('<script src="player-panels.js"></script>','<link rel="stylesheet" href="rooms.css">\n    <script src="room-client.js"></script>\n    <script src="player-panels.js"></script>');
if(!html.includes('id="branded-loading"'))html=html.replace('<!--body-->','<!--body-->\n    <div id="branded-loading" role="status" aria-label="Loading game"><div><img src="white.png" alt="" /><p>Loading...</p></div></div>\n    <style>#branded-loading{position:fixed;inset:0;z-index:9999;background:#0b0b13;display:flex;align-items:center;justify-content:center;text-align:center;color:#dddde3;font:12px Arial}#branded-loading img{display:block;width:100px;height:100px;margin:0 auto}#branded-loading p{margin:-8px 0 0}</style>');
if(!html.includes('src="loading-screen.js"'))html=html.replace('<script src="player-panels.js"></script>','<style>html,body { background: #0b0b13; }</style>\n    <script src="loading-screen.js"></script>\n    <script src="player-panels.js"></script>');
if(!html.includes('src="player-panels.js"'))html=html.replace('<script type="text/javascript" src="game.js"></script>','<script src="player-panels.js"></script>\n    <script type="text/javascript" src="game.js"></script>');
if(!html.includes('window.gameStart();'))html=html.replace('<script type="text/javascript" src="game.js"></script>','<script type="text/javascript" src="game.js"></script>\n    <script>window.addEventListener("load",function(){if(typeof window.gameStart==="function")window.gameStart();});</script>');
await writeFile(indexPath,html);
console.log(`Applied self-hosted startup, portrait mobile viewport, default menu avatars (${count} references), numbered players and cone player panels.`);
