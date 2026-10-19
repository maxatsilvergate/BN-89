'use strict';
const BOMB={r:9,grabPadding:12,radius:115,damage:18,force:1.9,throwSpeed:650,dashThrowSpeed:820,straightTime:.08,dashStraightTime:.14,gravity:550};
let bombs=[],explosions=[],bombSequence=0;
function resetBombs(){bombs=[];explosions=[];bombSequence=0;}
function bombTouchesPlayer(b,p,padding=0){return Math.hypot(b.x-Math.max(p.x-padding,Math.min(p.x+p.w+padding,b.x)),b.y-Math.max(p.y-padding,Math.min(p.y+p.h+padding,b.y)))<=BOMB.r;}
function bombInAttack(b,p){if(!p.attack)return false;const [dx,dy]=p.attack.dir;return Math.abs(b.x-(p.x+p.w/2+dx*ATTACK.offset))<=BOMB.r+ATTACK.half&&Math.abs(b.y-(p.y+p.h/2+dy*ATTACK.offset))<=BOMB.r+ATTACK.half;}
function bombSolids(){return [...walls,...platforms.filter(t=>t.solid)];}
function plantBomb(p){
  let x=p.x+p.w/2+p.face*(p.w/2+BOMB.r+3),y=p.y+p.h-BOMB.r;
  if(bombSolids().some(t=>x+BOMB.r>t.x&&x-BOMB.r<t.x+t.w&&y+BOMB.r>t.y&&y-BOMB.r<t.y+t.h))x=p.x+p.w/2-p.face*(p.w/2+BOMB.r+3);
  const b={id:++bombSequence,x,y,alive:true,heldBy:null,flying:false,vx:0,vy:0,surface:null};
  bombs.push(b);sfx('plant');return b;
}
function pickupBomb(p,b){if(p.heldBomb||b.heldBy!==null)return false;b.thrower=null;b.releaseOwner=null;b.heldBy=p.i;b.flying=false;b.surface=null;b.vx=b.vy=0;p.heldBomb=b;sfx('block');return true;}
function dropHeldBomb(p){const b=p.heldBomb;if(!b)return;b.heldBy=null;b.x=p.x+p.w/2;b.y=p.y+p.h/2;b.flying=false;b.surface=null;p.heldBomb=null;}
function throwBomb(p){
  const b=p.heldBomb;if(!b)return;
  const dashing=!!p.sprint||Math.abs(p.vx)>=T.sprint*.75;
  endAction(p,false);p.heldBomb=null;b.heldBy=null;b.surface=null;b.flying=true;
  const c=controls[p.i],dy=keys.has(c.up)?-1:keys.has(c.down)?1:0,dx=dy?0:keys.has(c.left)?-1:keys.has(c.right)?1:p.face;
  b.x=p.x+p.w/2+dx*(p.w/2+BOMB.r+4);b.y=p.y+p.h/2+dy*(p.h/2+BOMB.r+4);b.vx=dx*(dashing?BOMB.dashThrowSpeed:BOMB.throwSpeed);b.vy=dy*BOMB.throwSpeed;b.thrower=p.i;b.releaseOwner=p.i;b.straightLeft=dx?(dashing?BOMB.dashStraightTime:BOMB.straightTime):0;
  if(dy>0&&!p.ground){p.bombSlowUntil=now+.65;p.vx*=.5;if(p.vy>0)p.vy=Math.min(p.vy*.5,425);p.dropNeedsRelease=keys.has(c.down);p.downPressedAt=-10;}
  // A downward release at floor level rests on top, rather than spawning inside the floor.
  if(dy>0)for(const t of platforms)if(b.x+BOMB.r>t.x&&b.x-BOMB.r<t.x+t.w&&p.y+p.h<=t.y+.1&&b.y+BOMB.r>=t.y){b.y=t.y-BOMB.r-.1;b.flying=false;b.vx=b.vy=0;b.surface=t;b.offsetX=b.x-t.x;b.offsetY=b.y-t.y;break;}
  p.switchReady=now+T.switch;sfx('swing');
}
function activateHeldBomb(p){const b=p.heldBomb;if(!b)return;endAction(p,false);p.kind='shield';p.blockUntil=now+T.block;p.blockReady=now+T.blockCooldown;positionHeldBomb(b,p);explodeBomb(b,p.i);}
function positionHeldBomb(b,p){b.x=p.x+p.w/2+p.face*(p.w/2+BOMB.r);b.y=p.y+18;}
function explodeBomb(b,activatedBy=null){
  if(!b.alive||b.heldBy!==null&&activatedBy!==b.heldBy)return;b.alive=false;
  if(b.heldBy!==null){const carrier=players[b.heldBy];if(carrier&&carrier.heldBomb===b)carrier.heldBomb=null;b.heldBy=null;}
  explosions.push({x:b.x,y:b.y,ttl:.32});burst(b.x,b.y,30);shake=12;sfx('explosion');
  for(const p of players){
    if(isInvulnerable(p)||p.i===b.thrower)continue;
    const nearX=Math.max(p.x,Math.min(p.x+p.w,b.x)),nearY=Math.max(p.y,Math.min(p.y+p.h,b.y));
    if(Math.hypot(nearX-b.x,nearY-b.y)>BOMB.radius)continue;
    p.damage+=BOMB.damage;p.shotCount=0;
    if(p.blockUntil>now){sfx('block');continue;}
    const dx=p.x+p.w/2-b.x,dy=p.y+p.h/2-b.y,distance=Math.hypot(dx,dy),launchX=distance?dx/distance:p.face,launchY=distance?dy/distance:-.42;
    const force=Math.max((310+p.damage*1.5)*BOMB.force,p.damage>=500?2600:0);
    recoil(p,launchX,Math.abs(launchY)<.2?-.42:launchY,force,.3);
  }
  for(const other of bombs)if(other.alive&&Math.hypot(other.x-b.x,other.y-b.y)<=BOMB.radius+BOMB.r)explodeBomb(other);
}
// Swept point versus an expanded rectangle keeps fast thrown bombs and pellets from tunnelling.
function bombSweep(x,y,nx,ny,box){
  let enter=0,exit=1,normal=[0,0];
  for(const [start,delta,min,max,axis] of [[x,nx-x,box.x,box.x+box.w,0],[y,ny-y,box.y,box.y+box.h,1]]){
    if(Math.abs(delta)<1e-9){if(start<min||start>max)return null;continue;}
    let first=(min-start)/delta,last=(max-start)/delta,sign=-Math.sign(delta);if(first>last)[first,last]=[last,first];
    if(first>enter){enter=first;normal=axis===0?[sign,0]:[0,sign];}exit=Math.min(exit,last);if(enter>exit)return null;
  }
  return enter>=0&&enter<=1?{t:enter,normal}:null;
}
function moveThrownBomb(b,dt){
  const straight=Math.min(dt,b.straightLeft||0);b.straightLeft=Math.max(0,(b.straightLeft||0)-dt);
  const x=b.x,y=b.y,nx=x+b.vx*dt,ny=y+(b.vy+=BOMB.gravity*(dt-straight))*(dt-straight);let closest=null;
  for(const surface of bombSolids()){
    const impact=bombSweep(x,y,nx,ny,{x:surface.x-BOMB.r,y:surface.y-BOMB.r,w:surface.w+BOMB.r*2,h:surface.h+BOMB.r*2});
    if(impact&&(!closest||impact.t<closest.t))closest={...impact,surface};
  }
  for(const surface of platforms.filter(t=>!t.solid))if(ny>y&&y+BOMB.r<=surface.y&&ny+BOMB.r>=surface.y){const t=(surface.y-BOMB.r-y)/(ny-y),hitX=x+(nx-x)*t;if(hitX+BOMB.r>surface.x&&hitX-BOMB.r<surface.x+surface.w&&(!closest||t<closest.t))closest={t,normal:[0,-1],surface};}
  if(closest){b.x=x+(nx-x)*closest.t+closest.normal[0]*.1;b.y=y+(ny-y)*closest.t+closest.normal[1]*.1;b.flying=false;b.vx=b.vy=0;b.surface=closest.surface;b.offsetX=b.x-b.surface.x;b.offsetY=b.y-b.surface.y;}
  else{b.x=nx;b.y=ny;}
}
function updateBombs(dt){
  for(const explosion of explosions)explosion.ttl-=dt;explosions=explosions.filter(e=>e.ttl>0);
  for(const b of bombs){
    if(!b.alive)continue;
    if(b.heldBy!==null){const p=players[b.heldBy];if(!p||p.respawnAt||p.lives<=0){if(p)dropHeldBomb(p);else b.heldBy=null;}else positionHeldBomb(b,p);}
    if(b.surface){b.x=b.surface.x+b.offsetX;b.y=b.surface.y+b.offsetY;}
    if(b.flying)moveThrownBomb(b,dt);
    // Clear only the release overlap; later contact still triggers the thrower's bomb.
    if(b.releaseOwner!=null&&!bombTouchesPlayer(b,players[b.releaseOwner],20))b.releaseOwner=null;
    if(b.x+BOMB.r<BLAST.left||b.x-BOMB.r>BLAST.right||b.y-BOMB.r>BLAST.bottom){b.alive=false;continue;}
    for(const p of players){if(!b.alive)break;if((isInvulnerable(p)&&!dashCanPickup(p))||p.i===b.heldBy||p.i===b.releaseOwner)continue;
      if(dashCanPickup(p)&&b.heldBy===null&&!p.heldBomb&&bombTouchesPlayer(b,p,BOMB.grabPadding)){pickupBomb(p,b);positionHeldBomb(b,p);}else if(p.i!==b.thrower&&!isInvulnerable(p)&&bombTouchesPlayer(b,p))explodeBomb(b);
    }
    for(const p of players){if(!b.alive)break;if(p.respawnAt||p.lives<=0)continue;if(bombInAttack(b,p)||launchingAttack(p)&&Math.abs(b.x-(p.x+p.w/2))<BOMB.r+ATTACK.half&&Math.abs(b.y-(p.y+p.h/2))<BOMB.r+ATTACK.half)explodeBomb(b);}
  }
  bombs=bombs.filter(b=>b.alive);
}
function pelletHitsBomb(pellet,oldX){
  let closest=null;const r=BOMB.r+(pellet.r||4);
  for(const b of bombs){if(!b.alive||b.heldBy!==null)continue;const impact=bombSweep(oldX,pellet.y,pellet.x,pellet.y,{x:b.x-r,y:b.y-r,w:r*2,h:r*2});if(impact&&(!closest||impact.t<closest.t))closest={...impact,b};}
  if(!closest)return false;
  const target=players[1-pellet.owner],pelletRadius=pellet.r||4;
  if(target&&!isInvulnerable(target)){const playerHit=bombSweep(oldX,pellet.y,pellet.x,pellet.y,{x:target.x-pelletRadius,y:target.y-pelletRadius,w:target.w+pelletRadius*2,h:target.h+pelletRadius*2});if(playerHit&&playerHit.t<closest.t)return false;}
  pellet.ttl=0;explodeBomb(closest.b);return true;
}
function drawBombs(){
  for(const b of bombs){if(!b.alive)continue;rect(b.x-7,b.y-9,14,18);rect(b.x-9,b.y-6,18,12);rect(b.x+2,b.y-14,3,6);rect(b.x-3,b.y-3,6,6,BG);}
  for(const e of explosions){const radius=BOMB.radius*(1-e.ttl/.32);for(let n=0;n<28;n++){const angle=n*Math.PI/14;rect(e.x+Math.cos(angle)*radius-3,e.y+Math.sin(angle)*radius-3,6,6,MID);}}
}
