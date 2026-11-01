import {CHARACTER_DEFS,getCharacterSkill,MEND_SKILLS,VEIL_SKILLS,FROST_SKILLS,NOBI_SKILLS,URCHIN_SKILLS} from './abilities.js';

// Effect vocabulary, not a second definition of character stats. Execution
// remains in the existing authoritative skill and collision systems.
const effects={
 duelist:['screen','elevation','entry','weapon'],nope:['damage','flash','decoy','decoy'],
 mend:['slow','screen','heal','heal'],echo:['sensor','flash','mobility','recon'],
 veil:['screen','slow','mobility','screen'],ember:['robots','shield','robots','factory'],
 frost:['slow','screen','mobility','slow'],japan:['damage','armor','recovery','revive'],
 nobi:['vulnerability','suppression','work','weapon'],car:['displacement','clear-screen','weapon','repair'],
 cat:['return','disarm','recover-weapon','clock'],duck:['elevation','shield','flight','revive'],
 urchin:['damage','disarm','nearsight','weapon'],cap:['disruption','heal-or-damage','reflection','weapon'],
 onnara:['elevation','recon','air-hold','weapon'],renko:['displacement','entry','flight','refill']
};
export const BOT_SKILL_CAPABILITIES=Object.freeze(Object.fromEntries(Object.keys(CHARACTER_DEFS).map(character=>[
 character,Object.freeze(Object.fromEntries(['c','q','e','x'].map((key,i)=>[key,Object.freeze({
  effect:effects[character][i],name:key==='x'?CHARACTER_DEFS[character].ultName:getCharacterSkill(character,key).name
 })])))
])));
export const BOT_TEAM_RULES=Object.freeze({intelAge:1,decisionInterval:.25,prepareTime:1.1,flightWait:2.2,exploitTime:1.4,cooldown:3,allyRange:18,followRange:24,stopRange:7,minHealth:55});

// Only adapters with a real effect/safety query can be scheduled as setup.
// The other capabilities still identify roles; they retain their existing AI.
export const BOT_TEAM_SETUPS=Object.freeze([
 ['urchin','e','urchin-gloom',8,URCHIN_SKILLS.gloomRange,90],
 ['veil','q','veil-sensor',VEIL_SKILLS.rootsMinRange,VEIL_SKILLS.rootsThrowRange,80],
 ['mend','c','mend-seeds',1,18+MEND_SKILLS.seedsRadius,74],
 ['frost','c','frost-stitch',2,FROST_SKILLS.stitchRange,72],
 ['nobi','c','nobi-bell',1,NOBI_SKILLS.tagRange,68],
 ['nobi','q','nobi-whisker',1,NOBI_SKILLS.brakeRange,66],
 ['echo','q','echo-glint',1,18,64],
 ['nope','q','nope-flash',10,18,62]
].map(([character,key,type,min,max,score])=>Object.freeze({character,key,type,min,max,score})));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),position=p=>({x:p.x,y:p.y||0,z:p.z});
const available=a=>a.alive&&!a.human&&!a.impaired&&!a.busy&&!a.urgent&&a.hp>=BOT_TEAM_RULES.minHealth;
const follower=a=>available(a)&&a.ammo>0&&!a.scoped&&!['plant','defuse','recover'].includes(a.role);

// Inputs contain own equipment, public objectives and copied observations only.
// Never pass an enemy actor/target reference into this planner.
export function createBotTeamPlanner(){
 const teams=new Map(),history=[];let sequence=0,lastTime=-Infinity;
 function finish(team,state,now,outcome){
  history.push({id:state.id,team,objective:state.objective,type:state.action.type,caster:state.caster,follower:state.follower,outcome,at:now});
  if(history.length>24)history.shift();teams.set(team,{nextAt:now+BOT_TEAM_RULES.cooldown});
 }
 function update({allies,contacts,spike,attackerTeam,now,effectState=()=>null,canSetup=()=>true}){
  if(now<lastTime)reset();lastTime=now;
  const orders=new Map();
  for(const team of ['blue','red']){
   const own=allies.filter(a=>a.team===team),intel=(contacts[team]||[]).filter(c=>now>=c.seenAt&&now-c.seenAt<=BOT_TEAM_RULES.intelAge);
   const objective=spike.status==='planted'?(team===attackerTeam?'postplant':'retake'):'entry';
   let state=teams.get(team);
   if(state?.id){
    const caster=own.find(a=>a.id===state.caster),follow=own.find(a=>a.id===state.follower);
    if(!caster||!follow||!available(caster)||!follower(follow)||objective!==state.objective||spike.status==='dropped'||
      distance(follow,state.point)>BOT_TEAM_RULES.followRange||Math.abs((follow.y||0)-state.point.y)>.8){finish(team,state,now,'interrupted');continue;}
    if(state.phase==='prepare'&&(now>state.until||!intel.some(c=>c.id===state.targetId))){finish(team,state,now,'setup-unavailable');continue;}
    if(state.phase==='flight'){
     const actual=effectState(state);
     if(!actual||!actual.alive||now>=state.until){finish(team,state,now,'effect-lost');continue;}
     if(actual.ready){state.phase='exploit';state.until=Math.min(now+BOT_TEAM_RULES.exploitTime,actual.endsAt);}
    }
    if(state.phase==='exploit'&&now>=state.until){finish(team,state,now,'completed');continue;}
    if(state.phase==='exploit'){
     const actual=effectState(state);
     if(!actual||!actual.alive||!actual.ready||now>=actual.endsAt){finish(team,state,now,'effect-lost');continue;}
    }
   }else{
    if(now<(state?.nextAt||0)||spike.status==='dropped')continue;
    teams.set(team,{nextAt:now+BOT_TEAM_RULES.decisionInterval});
    const candidates=[];
    for(const contact of intel){
     if(spike.status==='planted'&&distance(contact,spike)>26)continue;
     for(const caster of own.filter(a=>available(a)&&a.ready))for(const action of BOT_TEAM_SETUPS){
      const d=distance(caster,contact);
      if(caster.character!==action.character||!(caster.stock[action.key]>0)||d<action.min||d>action.max||Math.abs((caster.y||0)-(contact.y||0))>.8)continue;
      const follow=own.filter(a=>a.id!==caster.id&&follower(a)&&distance(a,caster)<=BOT_TEAM_RULES.allyRange&&distance(a,contact)<=BOT_TEAM_RULES.followRange&&distance(a,contact)>BOT_TEAM_RULES.stopRange+1&&Math.abs((a.y||0)-(contact.y||0))<.8)
       .sort((a,b)=>distance(a,contact)-distance(b,contact)||a.id.localeCompare(b.id))[0];
      if(follow&&canSetup(caster,action,contact))candidates.push({caster,follow,contact,action,score:action.score-distance(follow,contact)*.4-distance(caster,contact)*.2});
     }
    }
    candidates.sort((a,b)=>b.score-a.score||a.caster.id.localeCompare(b.caster.id)||a.action.key.localeCompare(b.action.key));
    const chosen=candidates[0];if(!chosen)continue;
    const {caster,follow,contact,action}=chosen;
    state={id:++sequence,team,objective,action,caster:caster.id,follower:follow.id,targetId:contact.id,point:position(contact),phase:'prepare',until:now+BOT_TEAM_RULES.prepareTime,startedAt:now};teams.set(team,state);
   }
   if(state.phase==='prepare')orders.set(state.caster,{kind:'setup',planId:state.id,key:state.action.key,type:state.action.type,targetId:state.targetId,point:{...state.point}});
   // Waiting delays advancing, never perception, turning, defending or work.
   orders.set(state.follower,{kind:state.phase==='exploit'?'follow':'wait',planId:state.id,targetId:state.targetId,point:{...state.point},objective:state.objective});
  }
  return orders;
 }
 function accepted(planId,event,now){
  const state=[...teams.values()].find(s=>s.id===planId&&s.phase==='prepare');
  if(!state||!event||event.type!==state.action.type||event.sourceId!==state.caster||event.team!==state.team||!Number.isFinite(event.triggerAt)||event.endsAt<=now)return false;
  state.eventId=event.id;state.phase='flight';state.until=Math.min(event.endsAt,now+BOT_TEAM_RULES.flightWait);return true;
 }
 function reset(){teams.clear();history.length=0;sequence=0;lastTime=-Infinity;}
 const snapshot=()=>({plans:[...teams.values()].filter(s=>s.id).map(s=>({...s,action:{...s.action},point:{...s.point}})),history:history.map(s=>({...s}))});
 return {update,accepted,reset,snapshot};
}
