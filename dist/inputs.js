'use strict';
// Devices produce the same press/release edges as the original keyboard game.
const MODES=[
  {id:'classic',name:'CLASSIC BN-89 / SHARED KEYS',short:'SHARED KEYBOARD',devices:['shared','shared']},
  {id:'keyboard-cpu',name:'KEYBOARD V CPU',short:'KEYBOARD V CPU',devices:['keyboard','cpu']},
  {id:'controller-cpu',name:'CONTROLLER V CPU',short:'CONTROLLER V CPU',devices:['controller','cpu']},
  {id:'keyboard-controller',name:'KEYBOARD V CONTROLLER',short:'KEYBOARD V PAD',devices:['keyboard','controller']},
  {id:'controller-keyboard',name:'CONTROLLER V KEYBOARD',short:'PAD V KEYBOARD',devices:['controller','keyboard']},
  {id:'controller-controller',name:'CONTROLLER V CONTROLLER',short:'CONTROLLER V CONTROLLER',devices:['controller','controller']}
];
let connectedPads=[],matchMode='classic',matchPads=[null,null],padHistory=new Map(),menuRepeat={code:null,at:0};
const physicalKeys=new Set(),inputSources={keyboard:new Set(),controller:new Set(),cpu:new Set()};
let appliedInputs=new Set(),brains=[];
function modeDefinition(id){const migrated=id==='cpu-keyboard'?'keyboard-cpu':id==='cpu-controller'?'controller-cpu':id;return MODES.find(m=>m.id===migrated)||MODES[0];}
function modeAvailable(id){return modeDefinition(id).devices.filter(d=>d==='controller').length<=connectedPads.length;}
function availableModes(){return MODES.filter(m=>modeAvailable(m.id));}
function cycleMode(delta){const modes=availableModes(),index=modes.findIndex(m=>m.id===settings.mode);settings.mode=modes[index<0?(delta>0?0:modes.length-1):(index+(delta>0?1:-1)+modes.length)%modes.length].id;}
function controllerStatus(){return connectedPads.length===0?'NO CONTROLLERS':connectedPads.length===1?'1 CONTROLLER':'2 CONTROLLERS';}
function configureMatch(){settings.mode=modeDefinition(settings.mode).id;if(!modeAvailable(settings.mode))settings.mode='classic';matchMode=settings.mode;bindMatchPads();}
function bindMatchPads(){let slot=0;matchPads=modeDefinition(matchMode).devices.map(d=>d==='controller'?(connectedPads[slot++]?.index??null):null);}
function controllersReady(){return modeDefinition(matchMode).devices.filter(d=>d==='controller').length<=connectedPads.length;}
function resetInputSources(){physicalKeys.clear();for(const source of Object.values(inputSources))source.clear();appliedInputs.clear();brains=[makeBrain(0),makeBrain(1)];}
function inputEvent(code,extra={}){return {code,repeat:false,preventDefault(){},...extra};}
function reconcileInputs(){
  const desired=new Set([...inputSources.keyboard,...inputSources.controller,...inputSources.cpu]);
  const before=appliedInputs;appliedInputs=desired;
  for(const code of before)if(!desired.has(code))gameKeyUp(inputEvent(code));
  for(const code of desired)if(!before.has(code)){
    const owner=controls.findIndex(c=>c.up===code);
    const noJump=owner>=0&&modeDefinition(matchMode).devices[owner]==='controller'&&!settings.tapJump;
    gameKeyDown(inputEvent(code,{noJump}));
    if(state!=='play')break;
  }
}
function mapKeyboard(){
  const result=new Set(),devices=modeDefinition(matchMode).devices;
  if(matchMode==='classic'){for(const code of physicalKeys)if(Object.values(controls[0]).includes(code)||Object.values(controls[1]).includes(code))result.add(code);}
  else{const owner=devices.indexOf('keyboard');if(owner>=0)for(const action of ['left','right','up','down','attack','block'])if(physicalKeys.has(controls[0][action])||physicalKeys.has(controls[1][action]))result.add(controls[owner][action]);}
  inputSources.keyboard=result;
}
window.addEventListener('keydown',e=>{
  if(gameKeys.has(e.code))e.preventDefault();
  if(e.repeat)return;
  if(state!=='play'||e.code==='Escape'||e.code==='KeyR'){gameKeyDown(e);return;}
  physicalKeys.add(e.code);mapKeyboard();reconcileInputs();
});
window.addEventListener('keyup',e=>{physicalKeys.delete(e.code);mapKeyboard();reconcileInputs();if(matchMode==='classic'&&!Object.values(inputSources).some(source=>source.has(e.code)))gameKeyUp(e);});
function readPads(){try{return typeof navigator!=='undefined'&&navigator.getGamepads?Array.from(navigator.getGamepads()).filter(p=>p&&p.connected!==false).sort((a,b)=>a.index-b.index).slice(0,2):[];}catch{return [];}}
function button(p,index){const b=p.buttons[index];return !!b&&(b.pressed||b.value>.5);}
function padDirections(p,previous=new Set()){
  const result=new Set();const threshold=dir=>previous.has(dir) ? .22 : .38;
  if(button(p,14)||(p.axes[0]||0)<-threshold('left'))result.add('left');
  if(button(p,15)||(p.axes[0]||0)>threshold('right'))result.add('right');
  if(button(p,12)||(p.axes[1]||0)<-threshold('up'))result.add('up');
  if(button(p,13)||(p.axes[1]||0)>threshold('down'))result.add('down');
  if(result.has('left')&&result.has('right')){result.delete('left');result.delete('right');}
  if(result.has('up')&&result.has('down')){result.delete('up');result.delete('down');}
  return result;
}
function padActions(p,directions){const result=new Set(directions);if(button(p,0)||button(p,1))result.add('attack');if([4,5,6,7].some(n=>button(p,n)))result.add('block');if(button(p,2))result.add('jump');if(button(p,3)){result.add('attack');result.add('block');}return result;}
function pollControllers(time){
  const previousIds=connectedPads.map(p=>p.index);connectedPads=readPads();
  const lost=modeDefinition(matchMode).devices.some((d,i)=>d==='controller'&&!connectedPads.some(p=>p.index===matchPads[i]));
  if(state==='play'&&lost){pause();status.textContent='Controller disconnected. Reconnect or return to title.';}
  if(state==='title'&&!modeAvailable(settings.mode))settings.mode='classic';
  const menu=state!=='play',desired=new Set();let navigation=null,selectEdge=false,backEdge=false,startEdge=false;
  for(const pad of connectedPads){
    const old=padHistory.get(pad.index)||{buttons:new Set(),directions:new Set()};
    const dirs=padDirections(pad,old.directions),buttons=new Set(pad.buttons.map((_,n)=>button(pad,n)?n:-1).filter(n=>n>=0));
    const pressed=n=>buttons.has(n)&&!old.buttons.has(n);
    if(menu){navigation=navigation||['up','down','left','right'].find(d=>dirs.has(d));selectEdge=selectEdge||pressed(0)||pressed(2)||pressed(3);backEdge=backEdge||pressed(1);startEdge=startEdge||pressed(9);}
    else{
      if(pressed(9))startEdge=true;
      const owner=matchPads.indexOf(pad.index);
      if(owner>=0)for(const action of padActions(pad,dirs))desired.add(controls[owner][action]);
    }
    padHistory.set(pad.index,{buttons,directions:dirs});
  }
  for(const id of previousIds)if(!connectedPads.some(p=>p.index===id))padHistory.delete(id);
  if(menu){
    inputSources.controller.clear();
    if(startEdge||selectEdge){gameKeyDown(inputEvent('Enter'));menuRepeat={code:null,at:time+.3};}
    else if(backEdge)gameKeyDown(inputEvent('Escape'));
    else if(navigation){const code={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}[navigation];if(code!==menuRepeat.code||time>=menuRepeat.at){gameKeyDown(inputEvent(code));menuRepeat={code,at:time+(code===menuRepeat.code ? .12 : .35)};}}
    else menuRepeat.code=null;
  }else if(startEdge){gameKeyDown(inputEvent('Escape'));}
  else{inputSources.controller=desired;reconcileInputs();}
}
window.addEventListener('gamepadconnected',()=>{connectedPads=readPads();});
window.addEventListener('gamepaddisconnected',()=>{pollControllers(typeof performance!=='undefined'?performance.now()/1000:0);});
// A CPU chooses ordinary inputs; it shares all cooldowns, movement limits and damage rules.
const CPU_LEVELS=[{reaction:.8,guard:.03,shoot:.025,predict:0,idle:.65,melee:.22},{reaction:.36,guard:.2,shoot:.18,predict:0},{reaction:.18,guard:.65,shoot:.35,predict:.08}];
function makeBrain(i){return {next:0,release:0,movement:[],actions:[],seed:4973+i*811,chargeUntil:0};}
function cpuRandom(brain){brain.seed=(Math.imul(brain.seed,1664525)+1013904223)>>>0;return brain.seed/4294967296;}
function cpuNeedsRecovery(p){return !!p.recovery||!p.ground&&(p.x<260||p.x+p.w>940||p.y>500);}
function cpuPlan(p,o,brain){
  const level=CPU_LEVELS[settings.cpu],c=controls[p.i],movement=[],actions=[];
  const x=o.x+o.vx*level.predict,dx=x-p.x,dy=o.y-p.y;
  const move=dir=>{if(p.ground&&(p.x<275&&dir<0||p.x>889&&dir>0))dir=-dir;if(dir)movement.push(dir<0?c.left:c.right);};
  const rescueX=p.x<600?300:900;
  if(p.recovery){const desired=p.y>620?Math.sign(rescueX-p.x)*.9:Math.atan2(rescueX-p.x,Math.max(320,p.y-250));move(Math.abs(desired-p.recovery.angle)<.04?0:Math.sign(desired-p.recovery.angle));actions.push(c.up,c.attack,c.block);return {movement,actions};}
  if(p.recoveryLock||now<p.stun||now<p.inv)return {movement,actions};
  const unsafe=cpuNeedsRecovery(p);
  if(unsafe){
    move(Math.sign(rescueX-p.x));
    if(p.heldBomb){actions.push(c.attack);return {movement,actions};}
    if(['charge','shoot','shield'].includes(p.kind)||now<p.switchReady)return {movement,actions};
    if(p.jumpRising&&p.vy<-80)actions.push(c.up);
    else if((p.wallDir||p.jumps<2)&&(p.vy>-100||p.y>650)){if(!keys.has(c.up))actions.push(c.up);}
    else if(p.y>510&&p.jumps>=2)actions.push(c.up,c.attack,c.block);
    return {movement,actions};
  }
  if(p.heldBomb){actions.push(c.attack);return {movement,actions};}
  if(o.respawnAt||o.lives<=0){if(p.x<300||p.x>900)move(Math.sign(600-p.x));return {movement,actions};}
  if(brain.chargeUntil>now&&Math.abs(dx)>140&&!o.projectileParry){actions.push(c.attack,c.block);return {movement,actions};}
  const threat=pellets.some(b=>b.owner!==p.i&&Math.sign(b.vx)===Math.sign(p.x-b.x)&&Math.abs(b.x-p.x)<180&&Math.abs(b.y-(p.y+20))<65)||o.attack&&Math.abs(dx)<100&&Math.abs(dy)<100;
  if(threat&&!p.projectileParry&&cpuRandom(brain)<level.guard&&now>=p.blockReady){actions.push(c.block);return {movement,actions};}
  if(level.idle&&cpuRandom(brain)<level.idle)return {movement,actions};
  if(Math.abs(dx)>53)move(Math.sign(dx));
  else if(p.face!==Math.sign(dx)&&dx)move(Math.sign(dx));
  if(dy<-65&&p.jumps<2&&(p.ground||p.vy>0))actions.push(c.up);
  if(dy>80&&p.ground&&platforms.some(t=>!t.solid&&Math.abs(p.y+p.h-t.y)<3&&p.x+p.w>t.x&&p.x<t.x+t.w))actions.push(c.down);
  if(Math.abs(dx)<85&&Math.abs(dy)<92&&now>=p.attackReady&&(!level.melee||cpuRandom(brain)<level.melee)){
    if(!p.ground&&dy>30)actions.push(c.down);
    if(!p.ground&&dy<-30)actions.push(c.up);
    actions.push(c.attack);
  }else if(Math.abs(dx)>120&&Math.abs(dx)<520&&Math.abs(dy)<45&&!o.projectileParry&&now>=p.shotReady&&cpuRandom(brain)<level.shoot){
    movement.length=0;actions.push(c.attack,c.block);
  }
  return {movement,actions};
}
function updateCpuInputs(){
  const desired=new Set();
  if(state!=='play'||countdown>0)return;
  for(const p of players){if(p.respawnAt||p.lives<=0||modeDefinition(matchMode).devices[p.i]!=='cpu')continue;
    const brain=brains[p.i]||(brains[p.i]=makeBrain(p.i)),level=CPU_LEVELS[settings.cpu];
    const edgeRisk=p.ground&&(p.x<275&&keys.has(controls[p.i].left)||p.x>889&&keys.has(controls[p.i].right));
    if(edgeRisk)brain.next=now;
    const rescuing=cpuNeedsRecovery(p),reaction=rescuing ? .04 : level.reaction;
    if(rescuing&&brain.next>now+.04)brain.next=now;
    if(now>=brain.next){const plan=cpuPlan(p,players[1-p.i],brain);brain.movement=plan.movement;brain.actions=plan.actions;brain.next=now+reaction;brain.release=now+(rescuing ? .2 : Math.min(.12,reaction*.65));}
    const rival=players[1-p.i];
    if(!rescuing&&p.ground&&Math.abs(rival.x-p.x)<53&&p.face===Math.sign(rival.x-p.x))brain.movement=[];
    for(const code of brain.movement)desired.add(code);
    if(now<brain.release||now<brain.chargeUntil)for(const code of brain.actions)desired.add(code);
  }
  inputSources.cpu=desired;reconcileInputs();
}
settings.mode=modeDefinition(settings.mode).id;
settings.cpu=Number.isInteger(settings.cpu)&&settings.cpu>=0&&settings.cpu<3?settings.cpu:1;
settings.tapJump=settings.tapJump===true;
connectedPads=readPads();if(!modeAvailable(settings.mode))settings.mode='classic';
resetInputSources();
requestAnimationFrame(frame);
