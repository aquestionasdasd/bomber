// Tactical knowledge is made only from copied observations. Actor references never enter intel.
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const aiActor=actor=>actor.alive&&!actor.remoteId&&!actor.rangeTarget&&actor.id!=='player'&&!actor.human;
const hash=(text)=>{let value=2166136261;for(const char of String(text))value=Math.imul(value^char.charCodeAt(0),16777619);return(value>>>0)/4294967296;};

export function inVisionCone(observer,target,{yaw=observer.yaw||0,range=240,angle=130}={}){
  const dx=target.x-observer.x,dz=target.z-observer.z,length=Math.hypot(dx,dz);
  if(!Number.isFinite(length)||length>range)return false;
  if(length<.001)return true;
  return (Math.sin(yaw)*dx+Math.cos(yaw)*dz)/length>=Math.cos(angle*Math.PI/360);
}

// Host-only sound pulses contain the position at emission, never a live target.
// Muting playback must not change the simulation's hearing rules.
export function createBotHearing(){
  const pulses=[];let sequence=0;
  function emit(actor,kind,now){
    const radius={step:19,land:15,shot:65}[kind];
    if(!Number.isFinite(radius)||!actor?.alive||!['blue','red'].includes(actor.team)||![actor.x,actor.z,now].every(Number.isFinite))return;
    pulses.push({x:actor.x,y:actor.y||0,z:actor.z,team:actor.team,at:now,radius,sequence:++sequence});
    if(pulses.length>64)pulses.splice(0,pulses.length-64);
  }
  function listen(observer,now,{occluded=()=>false}={}){
    while(pulses.length&&(now-pulses[0].at>.65||now<pulses[0].at))pulses.shift();
    let best=null;
    for(const pulse of pulses){
      if(pulse.team===observer.team||now<pulse.at||now-pulse.at>.65)continue;
      const distance=Math.hypot(observer.x-pulse.x,(observer.y||0)-pulse.y,observer.z-pulse.z);
      if(distance>pulse.radius||distance>pulse.radius*(occluded(observer,pulse) ? .55 : 1))continue;
      if(!best||pulse.at>best.at)best=pulse;
    }
    return best?{x:best.x,y:best.y,z:best.z,at:best.at,sequence:best.sequence}:null;
  }
  return {emit,listen,reset(){pulses.length=0;sequence=0;}};
}

export function createBotTactics({sites,navigation,collision,lanes=[],attackSpawn={x:0,z:65},defendSpawn={x:0,z:-70}}){
  const intel=new Map(),plans=new Map(),routes=new Map();
  let round=1,cached=null,planTime=-Infinity,planKey='';
  const teamIntel=team=>{if(!intel.has(team))intel.set(team,new Map());return intel.get(team);};
  function reset(value=1){round=value;intel.clear();plans.clear();routes.clear();cached=null;planTime=-Infinity;planKey='';}
  function observe(team,observerId,enemy,now){
    if(!enemy||enemy.team===team||!Number.isFinite(enemy.x)||!Number.isFinite(enemy.z))return;
    teamIntel(team).set(enemy.id,{id:enemy.id,team:enemy.team,x:enemy.x,z:enemy.z,y:enemy.y||0,seenAt:now,observerId});
  }
  function contacts(team,now){
    const known=teamIntel(team),result=[];
    for(const [id,contact]of known){if(now-contact.seenAt>4||now<contact.seenAt)known.delete(id);else result.push({...contact});}
    return result;
  }
  function routeDistance(from,to,now=0){
    if(!from||!to)return Infinity;
    const direct=distance(from,to);if(direct<.3)return direct;
    const key=`${Math.round(from.x/2)},${Math.round(from.z/2)}:${Math.round(to.x*2)},${Math.round(to.z*2)}`;
    const previous=routes.get(key);if(previous&&now-previous.at<1.5&&now>=previous.at)return previous.cost;
    const path=navigation.path(from.x,from.z,to.x,to.z);
    let cost=path.length?0:Infinity,point=from;
    for(const next of path){cost+=distance(point,next);point=next;}
    if(path.length&&distance(point,to)>1.2)cost=Infinity;
    routes.set(key,{cost,at:now});if(routes.size>256)routes.delete(routes.keys().next().value);
    return cost;
  }
  function plantPosition(site,from,now=0,preferredId=null){
    const choices=site.plantPositions?.length?site.plantPositions:[{id:`${site.id}-center`,x:site.x,z:site.z}];
    let best=null,bestCost=Infinity;
    for(const point of choices){
      if(collision?.blocked(point.x,point.z,.45,0))continue;
      const cost=routeDistance(from,point,now)+(point.id===preferredId?-5:0)+(point.style==='cover'?-1.5:0);
      if(cost<bestCost){best=point;bestCost=cost;}
    }
    return best?{...best}:null;
  }
  function selectSite(team,carrier,now,{remaining=100}={}){
    const observations=contacts(team,now),previous=plans.get(team);
    const ranked=sites.map(site=>{
      const plant=plantPosition(site,carrier,now),cost=plant?routeDistance(carrier,plant,now):Infinity;
      const pressure=observations.reduce((sum,contact)=>sum+Math.max(0,1-distance(site,contact)/30)*(1-(now-contact.seenAt)/4),0);
      return {site,cost,score:cost+pressure*22+hash(`${round}:${team}:${site.id}`)*18};
    }).filter(entry=>Number.isFinite(entry.score)).sort((a,b)=>a.score-b.score);
    if(!ranked.length)return previous?.siteId||sites[0].id;
    const current=ranked.find(entry=>entry.site.id===previous?.siteId),best=ranked[0];
    // Commit to an approach; only fresh pressure or a carrier clearly choosing the other site rotates it.
    const carrierChoice=ranked.find(entry=>distance(carrier,entry.site)<18);
    if(carrierChoice){if(previous?.siteId!==carrierChoice.site.id)plans.set(team,{siteId:carrierChoice.site.id,chosenAt:now});return carrierChoice.site.id;}
    if(current&&(remaining<25||distance(carrier,current.site)<20||now-previous.chosenAt<7||best.score+18>=current.score))return current.site.id;
    plans.set(team,{siteId:best.site.id,chosenAt:now});return best.site.id;
  }
  function nearestReachable(candidates,goal,now){
    let chosen=null,best=Infinity;
    for(const actor of candidates){const cost=routeDistance(actor,goal,now);if(cost<best){best=cost;chosen=actor;}}
    return {actor:chosen,distance:best};
  }
  function safe(point){return navigation.nearest(point.x,point.z);}
  function ring(center,index,count,radius,watch){
    const base=Math.atan2(watch.x-center.x,watch.z-center.z),angle=base+(index-(count-1)/2)*.72;
    return safe({x:center.x+Math.sin(angle)*radius,z:center.z+Math.cos(angle)*radius})||{x:center.x,z:center.z};
  }
  function threat(team,site,now){return contacts(team,now).reduce((sum,c)=>sum+Math.max(0,1-distance(c,site)/36)*(1-(now-c.seenAt)/4),0);}
  function update({actors,attackerTeam,defenderTeam,spike,now,remaining=100}){
    const living=actors.filter(a=>a.alive),bots=living.filter(aiActor),roles=new Map();
    const key=`${spike.status}:${spike.carrier}:${spike.site}:${spike.defuseActor}:${living.map(a=>`${a.id}/${!!a.remoteId}`).join(',')}`;
    if(cached&&key===planKey&&now>=planTime&&now-planTime<.65)return cached;
    planKey=key;planTime=now;
    for(const known of intel.values())for(const id of known.keys())if(actors.some(a=>a.id===id&&!a.alive))known.delete(id);
    const attackers=bots.filter(a=>a.team===attackerTeam),defenders=bots.filter(a=>a.team===defenderTeam);
    const carrier=living.find(a=>a.id===spike.carrier&&a.team===attackerTeam);
    const chosenId=carrier?selectSite(attackerTeam,carrier,now,{remaining}):plans.get(attackerTeam)?.siteId||sites[0].id;
    const site=sites.find(s=>s.id===chosenId)||sites[0];
    let defuser=null,recoverer=null;
    if(spike.status==='carried'){
      const escorts=attackers.filter(bot=>bot!==carrier),route=carrier?navigation.path(carrier.x,carrier.z,site.x,site.z):[];
      for(const [index,bot]of attackers.entries()){
        if(bot===carrier){
          const point=plantPosition(site,bot,now,bot.plantPositionId);
          roles.set(bot.id,{role:'plant',siteId:site.id,goal:point||{x:site.x,z:site.z},plantPositionId:point?.id,urgent:remaining<15,watch:defendSpawn});continue;
        }
        const escortIndex=escorts.indexOf(bot);let goal;
        if(!carrier)goal=ring(site,index,attackers.length,8,defendSpawn);
        else if(distance(carrier,site)<20)goal=ring(site,escortIndex,escorts.length,8+escortIndex%2*3,defendSpawn);
        else{
          const next=route[0]||site,dx=next.x-carrier.x,dz=next.z-carrier.z,length=Math.hypot(dx,dz)||1;
          const forward=5+Math.floor(escortIndex/2)*4,flank=(escortIndex%2?1:-1)*(2.2+Math.floor(escortIndex/2)*1.2);
          goal=safe({x:carrier.x+dx/length*forward-dz/length*flank,z:carrier.z+dz/length*forward+dx/length*flank});
          // One outer escort uses a nearby alternate lane when it remains a practical route.
          if(escortIndex===escorts.length-1&&escorts.length>=3&&distance(carrier,site)>35){
            if(bot.flankGoal&&distance(bot,bot.flankGoal)<7)bot.flankComplete=true;
            const alternatives=lanes.map(lane=>{const p=lane.points[Math.floor(lane.points.length/2)];return Array.isArray(p)?{x:p[0],z:p[1]}:p;})
              .filter(point=>distance(point,bot)>6&&Math.abs(point.x-site.x)>15)
              .map(point=>({point,cost:routeDistance(bot,point,now)+routeDistance(point,site,now)}))
              .filter(entry=>entry.cost<routeDistance(bot,site,now)*1.35+8).sort((a,b)=>a.cost-b.cost);
            if(!bot.flankComplete){bot.flankGoal||=alternatives[0]?.point;if(bot.flankGoal)goal=bot.flankGoal;}
          }
        }
        roles.set(bot.id,{role:escortIndex===escorts.length-1&&escorts.length>=3?'flank':'escort',siteId:site.id,goal:goal||{x:site.x,z:site.z},watch:defendSpawn});
      }
    }else if(spike.status==='dropped'){
      recoverer=nearestReachable(attackers,spike,now).actor;
      for(const [index,bot]of attackers.entries())roles.set(bot.id,{role:bot===recoverer?'recover':'cover',goal:bot===recoverer?{x:spike.x,z:spike.z}:ring(spike,index,attackers.length,5+index%2*2,defendSpawn),urgent:bot===recoverer,watch:defendSpawn});
    }else if(spike.status==='planted'){
      for(const [index,bot]of attackers.entries())roles.set(bot.id,{role:'hold',goal:ring(spike,index,attackers.length,7+index%2*3,defendSpawn),watch:spike});
    }
    if(spike.status==='planted'){
      const active=living.find(a=>a.id===spike.defuseActor&&a.team===defenderTeam&&distance(a,spike)<2.5);
      const selected=active?{actor:active,distance:0}:nearestReachable(defenders,spike,now);defuser=selected.actor;
      const defuseTime=7-(spike.defuseActor===defuser?.id?spike.defuseProgress||0:spike.checkpoint||0);
      const urgent=spike.timer<selected.distance/3.9+defuseTime+3;
      const covers=defenders.filter(bot=>bot!==defuser);
      for(const bot of defenders){
        const index=covers.indexOf(bot),known=contacts(defenderTeam,now).sort((a,b)=>distance(a,spike)-distance(b,spike))[0];
        roles.set(bot.id,bot===defuser?{role:'defuse',goal:{x:spike.x,z:spike.z},urgent,watch:known||attackSpawn}:
          {role:'retake',goal:ring(spike,index,covers.length,6+index%2*2,known||attackSpawn),watch:known||attackSpawn});
      }
    }else{
      const ranked=sites.map(held=>({site:held,pressure:threat(defenderTeam,held,now)})).sort((a,b)=>b.pressure-a.pressure);
      const contested=ranked[0].pressure>.35&&ranked[0].pressure>(ranked[1]?.pressure||0)+.25?ranked[0]:null;
      const available=defenders.slice(),assignments=[];
      // Keep an anchor at the quiet site; do not send the entire team after one sighting.
      const quota=contested?Math.min(defenders.length-(defenders.length>1?1:0),Math.max(2,Math.ceil(defenders.length*.75))):Math.ceil(defenders.length/2);
      const first=contested?.site||sites[round%sites.length];
      for(const held of [first,...sites.filter(s=>s!==first)]){
        const count=held===first?quota:available.length;
        const humanCount=living.filter(a=>a.team===defenderTeam&&!aiActor(a)&&distance(a,held)<18).length;
        const take=Math.max(held===first?0:1,count-humanCount);
        const selected=available.map(bot=>({bot,cost:routeDistance(bot,held,now)})).sort((a,b)=>a.cost-b.cost).slice(0,take);
        for(const entry of selected){available.splice(available.indexOf(entry.bot),1);assignments.push({bot:entry.bot,site:held});}
      }
      for(const bot of available)assignments.push({bot,site:contested?.site||sites[bot.index%sites.length]});
      for(const {bot,site:held}of assignments){
        const peers=assignments.filter(a=>a.site===held),index=peers.findIndex(a=>a.bot===bot);
        const known=contacts(defenderTeam,now).filter(c=>distance(c,held)<36).sort((a,b)=>b.seenAt-a.seenAt)[0];
        roles.set(bot.id,{role:contested?.site===held?'rotate':'anchor',siteId:held.id,goal:ring(held,index,peers.length,8+index%2*2,attackSpawn),watch:known||attackSpawn});
      }
    }
    cached={siteId:site.id,roles,defuserId:defuser?.id||null,recovererId:recoverer?.id||null};return cached;
  }
  function investigation(bot,now,role,spike){
    const seen=bot.lastSeen;if(!seen||now-seen.seenAt>2.8||now<seen.seenAt||role?.urgent||role?.role==='plant'||role?.role==='defuse')return null;
    if(distance(bot,seen)<2||distance(bot,seen)>19)return null;
    if(spike.status==='planted'&&bot.team===seen.team)return null;
    if(spike.status==='planted'&&distance(seen,spike)>14)return null;
    return {x:seen.x,z:seen.z};
  }
  return {reset,observe,contacts,routeDistance,plantPosition,selectSite,nearestReachable,update,investigation};
}
