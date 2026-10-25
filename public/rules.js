// Match state is independent from rendering, input, and bot difficulty.
export const RULES = Object.freeze({ round:100, plant:4, spike:45, defuse:7, checkpoint:3.5, maxCredits:9000 });
export const WEAPONS = Object.freeze({
  pump:{name:'PUMP',category:'ショットガン',price:950,slot:'primary',mag:5,reserve:20,interval:.95,reload:3.1,body:18,head:27,leg:15,spread:.10,auto:false,pellets:12,falloff:[8,18,.5,.22],arsenal:true},
  drum:{name:'DRUM',category:'オートショットガン',price:1850,slot:'primary',mag:7,reserve:28,interval:.32,reload:3.4,body:15,head:22,leg:12,spread:.105,auto:true,pellets:10,falloff:[8,18,.5,.22],arsenal:true},
  scout:{name:'SCOUT',category:'軽量スナイパー',price:1500,slot:'primary',mag:5,reserve:15,interval:1.1,reload:2.6,body:90,head:180,leg:75,spread:.035,adsSpread:.0008,scope:34,auto:false,arsenal:true},
  atlas:{name:'ATLAS',category:'ヘヴィースナイパー',price:4700,slot:'primary',mag:5,reserve:10,interval:1.6,reload:3.6,body:150,head:255,leg:120,spread:.09,adsSpread:.0006,scope:28,auto:false,arsenal:true},
  forge:{name:'FORGE',category:'マシンガン',price:3200,slot:'primary',mag:60,reserve:120,interval:.09,reload:4.6,body:35,head:105,leg:29,spread:.007,adsSpread:.004,auto:true,arsenal:true},
  classic:{name:'CLASSIC',price:0,slot:'secondary',mag:12,reserve:36,interval:.22,reload:1.75,body:26,head:78,leg:22,spread:.005,auto:false},
  ghost:{name:'GHOST',price:500,slot:'secondary',mag:15,reserve:45,interval:.148,reload:1.5,body:30,head:105,leg:25,spread:.003,auto:false},
  spectre:{name:'SPECTRE',price:1600,slot:'primary',mag:30,reserve:90,interval:.075,reload:2.25,body:26,head:78,leg:22,spread:.004,auto:true},
  vandal:{name:'VANDAL',price:2900,slot:'primary',mag:25,reserve:75,interval:.103,reload:2.5,body:40,head:160,leg:34,spread:.002,auto:true},
  phantom:{name:'PHANTOM',price:2900,slot:'primary',mag:30,reserve:90,interval:.091,reload:2.5,body:39,head:156,leg:33,spread:.0015,auto:true},
  knife:{name:'TACTICAL KNIFE',price:0,slot:'melee',mag:0,reserve:0,interval:.5,reload:0,body:50,head:75,leg:50,spread:0,auto:false}
});
export function applyArmorDamage(hp,armor,damage) {
  const absorbed=Math.min(Math.max(0,armor),Math.max(0,damage)*2/3);
  return { hp:Math.max(0,hp-damage+absorbed), armor:Math.max(0,armor-absorbed) };
}
export class MatchRules {
  constructor({format='standard',startingSide='attack'}={}) {
    this.format=format==='swift'?'swift':'standard';this.startingSide=startingSide==='defend'?'defend':'attack';
    this.round=1;this.score={blue:0,red:0};this.phase='buy';this.phaseTime=45;this.roundTime=100;
    this.credits=800;this.lossStreak=0;this.roundKills=0;this.winner=null;this.lastRound=null;this.events=[];
    this.resetSpike();
  }
  get side(){
    const half=this.format==='swift'?4:12;
    const flip=this.round>half*2?(this.round-half*2-1)%2===1:this.round>half;
    return flip?(this.startingSide==='attack'?'defend':'attack'):this.startingSide;
  }
  get attackerTeam(){return this.side==='attack'?'blue':'red';}
  get defenderTeam(){return this.side==='defend'?'blue':'red';}
  get overtime(){return this.round>(this.format==='swift'?8:24);}
  get target(){return this.format==='swift'?5:13;}
  resetSpike(){
    this.spike={status:'carried',carrier:this.side==='attack'?'player':'red-0',site:null,x:0,z:0,timer:45,plantProgress:0,plantActor:null,defuseProgress:0,defuseActor:null,checkpoint:0};
    this.plantAwarded=false;
  }
  startLive(){if(this.phase!=='buy')return false;this.phase='live';this.phaseTime=100;this.roundTime=100;this.events.push({type:'live'});return true;}
  addCredits(amount){this.credits=Math.min(9000,Math.max(0,this.credits+amount));}
  purchase(price){if(this.phase!=='buy'||!Number.isFinite(price)||price<0||this.credits<price)return false;this.credits-=price;return true;}
  awardKill(){if(this.phase!=='live')return;this.roundKills++;this.addCredits(200);}
  dropSpike(actorId,x,z){
    const s=this.spike;if(s.status!=='carried'||s.carrier!==actorId)return false;
    s.status='dropped';s.carrier=null;s.x=x;s.z=z;s.plantProgress=0;s.plantActor=null;this.events.push({type:'dropped'});return true;
  }
  pickupSpike(actorId,team,x,z){
    const s=this.spike;if(!['buy','live'].includes(this.phase)||!Number.isFinite(x)||!Number.isFinite(z)||s.status!=='dropped'||team!==this.attackerTeam||Math.hypot(s.x-x,s.z-z)>1.8)return false;
    s.status='carried';s.carrier=actorId;this.events.push({type:'pickup',actorId});return true;
  }
  cancelPlant(actorId){const s=this.spike;if(s.plantActor===actorId){s.plantProgress=0;s.plantActor=null;}}
  interactPlant(dt,{actorId,team,site,x,z,stationary=true}){
    const s=this.spike;
    if(this.phase!=='live'||s.status!=='carried'||s.carrier!==actorId||team!==this.attackerTeam||!site||!stationary){this.cancelPlant(actorId);return false;}
    if(s.plantActor!==actorId){s.plantProgress=0;s.plantActor=actorId;}
    s.plantProgress=Math.min(4,s.plantProgress+Math.min(Math.max(0,dt),this.roundTime));
    if(s.plantProgress<4-1e-8)return false;
    s.status='planted';s.carrier=null;s.site=site;s.x=x;s.z=z;s.timer=45;s.plantProgress=4;
    if(team==='blue'&&!this.plantAwarded){this.addCredits(300);this.plantAwarded=true;}
    this.events.push({type:'planted',actorId,team,site});return true;
  }
  cancelDefuse(actorId){const s=this.spike;if(s.defuseActor===actorId){s.defuseProgress=s.checkpoint;s.defuseActor=null;}}
  interactDefuse(dt,{actorId,team,near=true,stationary=true}){
    const s=this.spike;
    if(this.phase!=='live'||s.status!=='planted'||team!==this.defenderTeam||!near||!stationary){this.cancelDefuse(actorId);return false;}
    // Keep the first defuser until they cancel; another held key must not reset
    // their progress or add a second contribution during the same frame.
    if(s.defuseActor!==null&&s.defuseActor!==actorId)return false;
    if(s.defuseActor!==actorId){s.defuseProgress=s.checkpoint;s.defuseActor=actorId;this.events.push({type:'defuse-start',actorId});}
    s.defuseProgress=Math.min(7,s.defuseProgress+Math.min(Math.max(0,dt),s.timer));
    if(s.defuseProgress>=3.5-1e-8){s.defuseProgress=Math.max(3.5,s.defuseProgress);s.checkpoint=3.5;}
    if(s.defuseProgress<7-1e-8)return false;
    s.status='defused';this.events.push({type:'defused',actorId});this.endRound(this.defenderTeam,'defuse');return true;
  }
  endRound(team,reason,context={}){
    if(this.phase!=='live'||!['blue','red'].includes(team))return false;
    this.score[team]++;const won=team==='blue';
    let reward;
    // Both match lengths use the standard economy; short rounds must not
    // grant a full buy independently of the previous round's result.
    if(won){reward=3000;this.lossStreak=0;}
    else{reward=1900+Math.min(this.lossStreak,2)*500;this.lossStreak++;
      if(context.playerAlive&&((this.side==='attack'&&reason==='timeout')||(this.side==='defend'&&reason==='detonation')))reward=1000;
    }
    this.addCredits(reward);this.lastRound={team,reason,won,reward,round:this.round,side:this.side};
    const a=this.score.blue,b=this.score.red;
    if(this.format==='swift'?Math.max(a,b)>=5:Math.max(a,b)>=13&&(Math.min(a,b)<12||Math.abs(a-b)>=2))this.winner=a>b?'blue':'red';
    this.phase='post';this.phaseTime=5;this.events.push({type:'round-end',...this.lastRound});return true;
  }
  nextRound(){
    if(this.phase!=='post')return false;
    if(this.winner){this.phase='match';this.events.push({type:'match-end',winner:this.winner});return false;}
    this.round++;const half=this.format==='swift'?4:12;const reset=this.round===half+1;
    if(reset){this.credits=800;this.lossStreak=0;}
    if(this.overtime)this.credits=5000;
    this.phase='buy';this.phaseTime=reset?45:30;this.roundTime=100;this.roundKills=0;this.resetSpike();
    this.events.push({type:'round-start',reset:reset||this.overtime,side:this.side,round:this.round});return true;
  }
  tick(dt,{blueAlive=5,redAlive=5,playerAlive=true,clockPaused=false}={}){
    if(!(dt>0)||!Number.isFinite(dt)||this.phase==='match')return;
    if(this.phase==='buy'){this.phaseTime=Math.max(0,this.phaseTime-dt);if(this.phaseTime<=0)this.startLive();return;}
    if(this.phase==='post'){this.phaseTime=Math.max(0,this.phaseTime-dt);if(this.phaseTime<=0)this.nextRound();return;}
    const s=this.spike;
    // Post-plant attackers can win while dead; defenders must still disarm the Spike.
    const attackers=this.attackerTeam==='blue'?blueAlive:redAlive,defenders=this.defenderTeam==='blue'?blueAlive:redAlive;
    if(defenders===0){this.endRound(this.attackerTeam,'elimination',{playerAlive});return;}
    if(attackers===0&&s.status!=='planted'){this.endRound(this.defenderTeam,'elimination',{playerAlive});return;}
    if(clockPaused===true)return;
    if(s.status==='planted'){
      s.timer=Math.max(0,s.timer-dt);
      if(s.timer<=0){s.status='detonated';this.events.push({type:'detonated'});this.endRound(this.attackerTeam,'detonation',{playerAlive});}
    }else{
      this.roundTime=Math.max(0,this.roundTime-dt);this.phaseTime=this.roundTime;
      if(this.roundTime<=0)this.endRound(this.defenderTeam,'timeout',{playerAlive});
    }
  }
  drainEvents(){return this.events.splice(0);}
}
