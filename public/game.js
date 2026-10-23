import { createSkillSpectacle, createSkillFeedback, SKILL_LOOKS } from './skill-spectacle.js';
import { createFullComboTracker, renderRoundBanner } from './full-combo.js';
import { ONNARA_SKILLS } from './abilities.js';
import { createOnnaraSkillFX } from './onnara-skill-fx.js';
import { createOrbView } from './onnara-orb-view.js';
import { chargeCrownTax, constellationTarget, createStarHold, orbViewYaw } from './onnara-rules.js';
import { URCHIN_SKILLS } from './abilities.js';
import { createUrchinSkillFX } from './urchin-skill-fx.js';
import { CAP_SKILLS } from './abilities.js';
import { capShotOffset } from './cap-optics.js';
import { createCapSkillFX } from './cap-skill-fx.js';
import { createJapanSkillFX } from './japan-skill-fx.js';
import { createNobiSkillFX } from './nobi-skill-fx.js';
import { carAimVector, carSmokeIntersection, carMovementSpread } from './car-targeting.js';
import { createCarSkillFX } from './car-skill-fx.js';
import { createCatSkillFX } from './cat-skill-fx.js';
import { createDuckSkillFX } from './duck-skill-fx.js';
import * as THREE from './vendor/three.module.js';
import { createMap, normalizeMapId } from './map.js';
import {trafficMarker, fitTrafficSnapshot} from './traffic-state.js';
import { resolveMapCallout, drawMapShapes, getMapCalloutLabels } from './map-callouts.js';
import { MatchRules, WEAPONS, applyArmorDamage } from './rules.js';
import { shotPattern, weaponDamage, weaponDescription } from './weapon-ballistics.js';
import { createArsenalShop } from './weapon-shop.js';
import { createNavigation } from './navigation.js';
import { createViewmodel } from './viewmodel.js';
import { createAgentModel } from './agent-model.js';
import { createCharacterPicker } from './character-preview.js';
import { roundDanceState, createVictoryDance } from './victory-dance.js';
import { createGameAudio } from './audio.js';
import { createVictoryMusic, bindVictoryMusicSettings } from './victory-music.js';
import { createDeathView } from './death-view.js';
import { RangeSession } from './range.js';
import { RoomClient } from './online.js';
import { DuelistKit, CHARACTER_DEFS, normalizeCharacter, signatureCooldown, JAPAN_SKILLS, NOBI_SKILLS, CAR_SKILLS, CAT_SKILLS, DUCK_SKILLS, DUELIST, DUELIST_SKILLS, NOPE_SKILLS, MEND_SKILLS, IAGNU_SKILLS, VEIL_SKILLS, EMBER_SKILLS, FROST_SKILLS } from './abilities.js';
import { createTeamAbilities } from './team-abilities.js';
import { createCharacterFX } from './character-fx.js';
import { createZoneAbilities } from './zone-abilities.js';
import { createZoneFX } from './zone-fx.js';
import { isInsideSite, getSitePlantPosition } from './site-areas.js';
import { createBotTactics, inVisionCone, createBotHearing } from './bot-tactics.js';
import { createObjectiveModel } from './objective-model.js';
import { createDroppedEquipment } from './dropped-equipment.js';
import { createStationDetonation } from './detonation.js';
import { createStationTakeover } from './station-takeover.js';
import { createKeyboardProtection } from './keyboard-protection.js';
import { getCharacterSkill } from './abilities.js';
import { createCharacterSkills, skillProjectilePosition, selectMendTarget } from './character-skills.js';
import { createCharacterSkillUI } from './character-skill-ui.js';
import { createNopeSkillFX } from './nope-skill-fx.js';
import { createNopeDecoys } from './nope-decoys.js';
import { createNopeDecoyFX } from './nope-decoy-fx.js';
import { createMendSkillFX } from './mend-skill-fx.js';
import { createIagnuSkillFX } from './iagnu-skill-fx.js';
import { createGrassSkillFX } from './grass-skill-fx.js';
import { createEmberSkillFX } from './ember-skill-fx.js';
import { createFrostSkillFX } from './frost-skill-fx.js';
import { createDuelistSkillFX } from './duelist-skill-fx.js';

const $ = id => document.getElementById(id);
const canvas = $('game');
const clamp = THREE.MathUtils.clamp;
const keys = new Set();
const scene = new THREE.Scene();
scene.background = new THREE.Color('#8cbad7');
scene.fog = new THREE.Fog('#b7d0dd', 145, 380);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (error) {
  $('loading').hidden = true;
  $('error').hidden = false;
  $('error').textContent = '3D表示を開始できませんでした。WebGL対応のChrome / Edgeで開いてください。';
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
const camera = new THREE.PerspectiveCamera(76, innerWidth / innerHeight, 0.06, 500);
const deathView=createDeathView();
function syncDeathUI(){
  setVisible('death-card',!player.alive&&deathView.holding&&mode==='play');
  setVisible('crosshair',player.alive);
}
function beginDeathView(){
  deathView.begin([camera.position.x,camera.position.y,camera.position.z],[camera.rotation.x,camera.rotation.y,camera.rotation.z]);
  spectateIndex=0;gun.visible=false;clearCombatInput();reloading=0;
  setVisible('spectator-hint',false);syncDeathUI();
}
camera.rotation.order = 'YXZ';
scene.add(camera);
scene.add(new THREE.HemisphereLight('#d9edff', '#647063', 1.65));
const sun = new THREE.DirectionalLight('#fff0d6', 3.0);
sun.position.set(-65, 105, 55);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left:-108, right:108, top:108, bottom:-108, near:1, far:280 });
sun.shadow.normalBias = 0.025;
sun.shadow.bias = -0.00012;
scene.add(sun);
scene.add(sun.target);
const environment = new THREE.Group();
scene.add(environment);
let map = createMap(THREE, environment);
const arenaCache=new Map([['hashimoto',map]]);
const textureFiltering = Math.min(8,renderer.capabilities.getMaxAnisotropy());
environment.traverse(object=>{for(const material of Array.isArray(object.material)?object.material:[object.material])if(material?.map)material.map.anisotropy=textureFiltering;});
let navigation = createNavigation(map);
const botsGroup = new THREE.Group();
scene.add(botsGroup);
const effectsGroup = new THREE.Group();
scene.add(effectsGroup);
const v3 = new THREE.Vector3();
const direction = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const effects = [];
const stationDetonation=createStationDetonation(THREE);scene.add(stationDetonation.group);
const stationTakeover=createStationTakeover(THREE);scene.add(stationTakeover.group);
const teamAbilities=createTeamAbilities(),characterFX=createCharacterFX(THREE);scene.add(characterFX.group);
const zoneAbilities=createZoneAbilities(),zoneFX=createZoneFX(THREE);scene.add(zoneFX.group);
const skillSpectacle=createSkillSpectacle(THREE),skillFeedback=createSkillFeedback(document);scene.add(skillSpectacle.group);
const ordinarySkills=createCharacterSkills(),ordinaryFX=createNopeSkillFX(THREE,camera);scene.add(ordinaryFX.group);
const nopeDecoys=createNopeDecoys(),nopeDecoyFX=createNopeDecoyFX(THREE);scene.add(nopeDecoyFX.group);
let nopePopSequence=0,nopeSeenPopSequence=0,nopeDecoyTownCandidates=null;
const nopePops=[];
const mendSkillFX=createMendSkillFX(THREE,camera);scene.add(mendSkillFX.group);
const iagnuSkillFX=createIagnuSkillFX(THREE,camera);scene.add(iagnuSkillFX.group);
const grassSkillFX=createGrassSkillFX(THREE,camera);scene.add(grassSkillFX.group);
const emberSkillFX=createEmberSkillFX(THREE,camera);scene.add(emberSkillFX.group);
const onnaraSkillFX=createOnnaraSkillFX(THREE);scene.add(onnaraSkillFX.group);const onnaraOrbView=createOrbView(THREE),starHold=createStarHold();
const urchinSkillFX=createUrchinSkillFX(THREE);scene.add(urchinSkillFX.group);
const capSkillFX=createCapSkillFX(THREE);scene.add(capSkillFX.group);
const japanSkillFX=createJapanSkillFX(THREE);scene.add(japanSkillFX.group);
const nobiSkillFX=createNobiSkillFX(THREE);scene.add(nobiSkillFX.group);
const carSkillFX=createCarSkillFX(THREE);scene.add(carSkillFX.group);const carImpulseSeen=new Set();
const catSkillFX=createCatSkillFX(THREE);scene.add(catSkillFX.group);const catReturnSeen=new Set();
const duckSkillFX=createDuckSkillFX(THREE);scene.add(duckSkillFX.group);
const frostSkillFX=createFrostSkillFX(THREE,camera);scene.add(frostSkillFX.group);
const duelistSkillFX=createDuelistSkillFX(THREE,camera);scene.add(duelistSkillFX.group);
const stoppedServiceEvents=new Map();
const ordinaryAudio=new Map();
const ordinaryMarkerAudio=new Set();
const zonePulseAudio=new Map();
let duckAim=null;
let zoneTargetPreview=null,zoneTargetPreviewAt=-Infinity,zoneTargetCharacter=null;
let takeoverState=null,takeoverClock=0,netCharacterRequested=false;
const selectedCharacter=()=>normalizeCharacter($('agent-select')?.value);
const characterIds=Object.keys(CHARACTER_DEFS);
let detonationState=null,detonationClock=0;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const renderCameraPosition=new THREE.Vector3(),renderCameraRotation=new THREE.Euler();
const bots = [];
const player = { id:'player',team:'blue',x:0,z:26,y:0,vy:0,yaw:0,pitch:0,hp:100,armor:0,alive:true,ammo:12,reserve:36,recoil:0,dash:0,scan:0,vx:0,vz:0,crouch:0 };
player.kit=new DuelistKit();
const smokes=[];let smokeSequence=0,netHostPaused=false;
let match = null;
let lastRoundAudio='';
const fullComboTracker=createFullComboTracker();
let exploring = false;
let rangeSession=null,rangeRespawn=0;
let objectivePractice=null;
let online=null,onlinePlaying=false,netHasSnapshot=false,netSequence=0,netActionSequence=0,netLastSnapshot=0,netClock=0,netRound=0;
const netPositionHistory=new Map();
let netPositionAck=0,netPositionCorrectionX=0,netPositionCorrectionZ=0;
let netActions=[],netParticipants=new Map(),netApplied=new Map(),netInputs=new Map();
let netCueSequence=0,netSeenCueSequence=0,skillImpactSequence=0;const netCues=[];
const actionCueTypes=new Set(['shot','enemy','smoke','frost','updraft','dash-armed','dash','knives','heal','recon','veil','ember-warning']);
const dashFeedback={round:null,state:null,expires:0,charge:null,signatureAt:0};
const signatureReadyNotices=new Set();
let signatureFeedbackMatch=null;
const isGuest=()=>onlinePlaying&&online&&!online.host;
const ownSide=()=>player.team===match?.attackerTeam?'attack':'defend';
let inventory = {primary:null,secondary:'classic',active:'classic'};
let ammoStore = {};
let roundPurchases = {};
let roster = [];
let redLossStreak=0,spectateIndex=0,spectatedBot=null,interactionHeld=false,shotSequence=0,stepClock=0;
let targetSite='A',lastSpikeBeep=0,botThinkTick=0;
const originalNames=['YOU',CHARACTER_DEFS.ember.label,'NOVA','ATLAS',CHARACTER_DEFS.echo.label,'VIPER UNIT','ONYX','CIPHER UNIT','BLAZE','ORBIT'];
const sideNames={attack:'ATTACKERS / 攻撃',defend:'DEFENDERS / 防衛'};
let mode = 'menu', pausedFrom = 'play', locked = false, firing = false, aiming = false;
let elapsed = 0, timeLeft = 150, round = 1, totalKills = 0, shots = 0, hits = 0, reloading = 0;
let lastShot = -10, damageFlash = 0, hitFlash = 0, scanTime = 0, roundWait = 0, kick = 0;
let difficulty = 'normal', soundEnabled = true, volume = .45, sensitivity = .35;
let menuT = 0, pointerRequested = false, inputActive = false;
let touchMove = { x:0, y:0 }, touchLook = null, movePointer = null;
let mouseAnchor=null,renderedRecoil=0;
const levels = { easy:{ damage:6, interval:1.6, aim:.48, speed:1.6 }, normal:{ damage:9, interval:1.25, aim:.68, speed:2.1 }, hard:{ damage:13, interval:.95, aim:.82, speed:2.7 } };
const settings = (() => { try { return JSON.parse(localStorage.getItem('hashimoto-settings') || '{}'); } catch { return {}; } })();
const savedSensitivity=Number(settings.sensitivity);
if(Number.isFinite(savedSensitivity)&&savedSensitivity>0)sensitivity=clamp(savedSensitivity*(settings.lookVersion===2?1:.35),.05,1.5);
if (settings.volume !== undefined) volume = clamp(Number(settings.volume), 0, 1);
const characterPicker=createCharacterPicker(THREE,{document});
const victoryDance=createVictoryDance(THREE,{document});
const skillUI=createCharacterSkillUI({document});
const keyboardProtection=createKeyboardProtection({document,navigator,onStatus:state=>{
  const messages={idle:'しゃがみは V 長押し。Ctrl＋Wなどはブラウザーによって停止できません。',enabling:'全画面とキー保護を準備しています…',protected:'ゲームキー保護中。Escで一時停止。全画面が戻らない場合はEscを長押し。',fullscreen:'全画面モード。キー保護の対応はブラウザー次第です。しゃがみは V を使えます。',unavailable:'この環境では全画面のキー保護を使えません。しゃがみは V を使ってください。'};
  if($('keyboard-protection-status'))$('keyboard-protection-status').textContent=messages[state]||messages.idle;
  if($('keyboard-protect'))$('keyboard-protect').disabled=state==='enabling';
}});

let victoryMusicEnabled=settings.victoryMusicEnabled!==false;
let victoryMusicVolume=Number.isFinite(Number(settings.victoryMusicVolume))?clamp(Number(settings.victoryMusicVolume),0,1):.6;
let victoryMusicUI;
const victoryMusic=createVictoryMusic({onChange:()=>victoryMusicUI?.render()});
function syncVictoryMusic(){victoryMusic.setGate({enabled:victoryMusicEnabled,musicVolume:victoryMusicVolume,soundEnabled,masterVolume:volume,hidden:document.hidden});}
syncVictoryMusic();
const gameAudio=createGameAudio();
const botHearing=createBotHearing();
function audioInit(){gameAudio.init();}
function sound(type,{weapon:id=inventory.active,entity=null,localOnly=false}={}){
  if(['step','land'].includes(type)&&ordinarySkills.quiet((entity||player).id,elapsed))return;
  if(!localOnly&&onlinePlaying&&online?.host&&actionCueTypes.has(type)){
    const actor=entity||player;
    netCues.push({seq:++netCueSequence,round:match?.round,type,weapon:id,id:actor.id,x:actor.x,y:actor.y||0,z:actor.z,time:elapsed});
    if(netCues.length>64)netCues.splice(0,netCues.length-64);
  }
  if(!localOnly&&!isGuest()&&match?.phase==='live'){const actor=entity||player;if(actor===player||bots.includes(actor))botHearing.emit(actor,type==='enemy'||type==='shot'?(id==='knife'?null:'shot'):type,elapsed);}
  if(!soundEnabled||!volume)return;
  const dx=entity?entity.x-player.x:0,dz=entity?entity.z-player.z:0,distance=Math.hypot(dx,dz);
  if(type!=='explosion'&&distance>65)return;
  const pan=distance?(dx*Math.cos(player.yaw)-dz*Math.sin(player.yaw))/distance:0;
  const occluded=entity&&distance>2&&!map.collision.rayClear(player.x,player.y+1.5,player.z,entity.x,1.3,entity.z);
  gameAudio.play(type,{volume,weapon:id,pan,distance:type==='explosion'?distance*.2:distance,occluded});
}
function resetDetonation(){detonationState=null;detonationClock=0;stationDetonation.reset();if($('detonation-flash'))$('detonation-flash').style.opacity='0';}
function resetTakeover(){takeoverState=null;takeoverClock=0;stationTakeover.reset();}
function resetZoneAbilities(){zoneAbilities.reset();zoneFX.reset();zonePulseAudio.clear();zoneTargetPreview=null;zoneTargetPreviewAt=-Infinity;zoneTargetCharacter=null;if($('status-effects')){$('status-effects').hidden=true;$('status-effects').textContent='';}}
const stoppedTurfEvents=new Map();
const stoppedFrostEvents=new Map();
function resetOrdinarySkills(){skillSpectacle.reset();skillFeedback.reset();starHold.reset();onnaraSkillFX.reset();urchinSkillFX.reset();capSkillFX.reset();japanSkillFX.reset();nobiSkillFX.reset();carImpulseSeen.clear();carSkillFX.reset();catReturnSeen.clear();catSkillFX.reset();duckAim=null;duckSkillFX.reset();botHearing.reset();ordinarySkills.reset();ordinaryFX.reset();nopeDecoys.reset();nopeDecoyFX.reset();nopePops.length=0;nopeSeenPopSequence=0;mendSkillFX.reset();iagnuSkillFX.reset();grassSkillFX.reset();emberSkillFX.reset();frostSkillFX.reset();duelistSkillFX.reset();for(const actor of [player,...bots]){cancelServiceReload(actor);actor.lastHeard=null;actor.netStepClock=0;}stoppedServiceEvents.clear();stoppedTurfEvents.clear();stoppedFrostEvents.clear();ordinaryAudio.clear();ordinaryMarkerAudio.clear();const overlay=$('skill-blind-overlay');if(overlay){overlay.hidden=true;overlay.style.opacity='0';}}
function resetTeamAbilities(){teamAbilities.reset();characterFX.reset();resetZoneAbilities();resetOrdinarySkills();}
function actorGrounded(actor){
  if(!actor?.alive||!Number.isFinite(actor.y)||Number.isFinite(actor.vy)&&Math.abs(actor.vy)>1e-5)return false;
  let floor=0;const ramp=rampFloor(actor.x,actor.z);
  if(ramp!==null&&ramp<=actor.y+.001)floor=ramp;
  for(const c of map.collision.query(actor.x,actor.z,.34))if(c.height<=actor.y+.001&&c.height>floor&&map.collision.overlaps(c,actor.x,actor.z,.34))floor=c.height;
  return Math.abs(actor.y-floor)<=.035;
}
function transferEmberControl(actor,toRemote){
  if(actor.kit?.character!=='ember')return;cancelServiceReload(actor);
  if(toRemote&&actor.aiWeapon){actor.netWeapon=actor.aiWeapon;actor.netAmmo=actor.aiAmmo;actor.netReserve=actor.aiReserve;actor.netReload=0;}
  else if(!toRemote&&actor.netWeapon){actor.aiWeapon=actor.netWeapon;actor.aiAmmo=actor.netAmmo;actor.aiReserve=actor.netReserve;actor.aiReload=0;}
}
function actorWeaponId(actor){return actor===player?inventory.active:actor.remoteId?actor.netWeapon:actor.aiWeapon||actor.record?.primary||actor.record?.secondary||'classic';}
function canServiceReload(actor){
  const id=actorWeaponId(actor),spec=WEAPONS[id],local=actor===player,remote=!!actor.remoteId;
  const ammo=local?player.ammo:remote?actor.netAmmo:actor.aiAmmo,reserve=local?player.reserve:remote?actor.netReserve:actor.aiReserve;
  const pending=local?reloading:remote?actor.netReload:actor.aiReload;
  return !ordinarySkills.urchinJammed(actor.id,elapsed)&&actor.alive&&match?.phase==='live'&&!actor.planting&&!actor.defusing&&!(local&&interactionHeld)&&!pending&&!actor.serviceReload
    &&spec&&['primary','secondary'].includes(spec.slot)&&Number.isInteger(ammo)&&ammo>=0&&ammo<spec.mag&&Number.isInteger(reserve)&&reserve>0;
}
function serviceFromSnapshot(value,state,now){
  if(!value||typeof value!=='object'||Array.isArray(value)||!Object.keys(value).every(key=>['eventId','weaponId','endsAt'].includes(key)))return null;
  const spec=WEAPONS[value.weaponId];
  if(!/^skill-ember-service-[1-9][0-9]{0,14}$/.test(value.eventId)||!spec||!['primary','secondary'].includes(spec.slot)||value.weaponId!==state.weapon
    ||!Number.isFinite(value.endsAt)||!Number.isFinite(state.reloading)||state.reloading<=0||state.reloading>EMBER_SKILLS.serviceDuration+1e-8||Math.abs(value.endsAt-now-state.reloading)>1e-6)return null;
  return{eventId:value.eventId,weaponId:value.weaponId,endsAt:value.endsAt};
}
function beginServiceReload(actor,event){
  actor.serviceReload={eventId:event.id,weaponId:event.weaponId,endsAt:event.endsAt};
  if(actor===player){reloading=EMBER_SKILLS.serviceDuration;firing=false;}
  else if(actor.remoteId)actor.netReload=EMBER_SKILLS.serviceDuration;
  else{actor.aiReload=EMBER_SKILLS.serviceDuration;actor.fire=Math.max(actor.fire||0,EMBER_SKILLS.serviceDuration);}
}
function cancelServiceReload(actor){
  const service=actor?.serviceReload;if(!service)return;
  if(actor===player&&isGuest()){stoppedServiceEvents.set(service.eventId,service.endsAt);while(stoppedServiceEvents.size>20)stoppedServiceEvents.delete(stoppedServiceEvents.keys().next().value);}
  ordinarySkills.cancelService(actor.id);actor.serviceReload=null;
  if(actor===player)reloading=0;else if(actor.remoteId)actor.netReload=0;else{actor.aiReload=0;actor.fire=0;}
}
function tickServiceReload(actor,dt){
  const service=actor.serviceReload;if(!service)return false;
  if(!actor.alive||match?.phase!=='live'||actorWeaponId(actor)!==service.weaponId||actor.planting||actor.defusing){cancelServiceReload(actor);return true;}
  const local=actor===player,remote=!!actor.remoteId,remaining=local?reloading:remote?actor.netReload:actor.aiReload;
  const next=Math.max(0,remaining-dt);
  if(local)reloading=next;else if(remote)actor.netReload=next;else actor.aiReload=next;
  if(next>1e-8)return true;
  // Guests wait for authoritative ammunition, including during a delayed ACK.
  if(local&&isGuest())return true;
  const spec=WEAPONS[service.weaponId],ammo=local?player.ammo:remote?actor.netAmmo:actor.aiAmmo,reserve=local?player.reserve:remote?actor.netReserve:actor.aiReserve;
  const count=Math.max(0,Math.min(spec.mag-ammo,reserve));
  if(local){player.ammo+=count;player.reserve-=count;}
  else if(remote){actor.netAmmo+=count;actor.netReserve-=count;}
  else{actor.aiAmmo+=count;actor.aiReserve-=count;actor.fire=0;}
  actor.serviceReload=null;ordinarySkills.cancelService(actor.id);return true;
}
function ordinaryActorView(actor){return {...actor,grounded:actorGrounded(actor),weaponId:actorWeaponId(actor)};}
function actorMovementScale(actor,grounded=actorGrounded(actor)){
  const view={...actor,grounded};
  if(!view.grounded)for(const event of ordinarySkills.events(elapsed))if(event.type==='veil-turf'&&event.sourceId===actor.id){
    if(actor===player)actor.turfMovementEnded=true;
    if(isGuest()&&actor===player)stoppedTurfEvents.set(event.id,event.endsAt);
  }
  return ordinarySkills.movementScale(view,elapsed);
}
function actorSpeedScale(actor,movementGrounded=actorGrounded(actor)){
  if(match?.phase!=='live')return 1;
  const view={...ordinaryActorView(actor),grounded:movementGrounded};
  if((!view.grounded||!view.alive)&&isGuest()&&actor===player)for(const event of ordinarySkills.events(elapsed))if(event.type==='frost-unravel'&&event.sourceId===actor.id){
    stoppedFrostEvents.set(event.id,event.endsAt);while(stoppedFrostEvents.size>20)stoppedFrostEvents.delete(stoppedFrostEvents.keys().next().value);
  }
  const raw=Math.min(zoneAbilities.speedMultiplier(actor,elapsed),ordinarySkills.speedScale(view,elapsed,{reachable:ordinaryReachable,groundHeight:ordinaryGroundHeight}));
  return ordinarySkills.mitigateSlow(view,raw,elapsed)*actorMovementScale(actor,movementGrounded);
}
function frostSlideSpeed(actor,grounded=actorGrounded(actor)){
  if(match?.phase!=='live'||!actor||actor.kit?.character!=='frost')return 0;
  // Preserve the guest tombstone before the speed query removes an airborne
  // event; otherwise the next delayed host snapshot could revive its entry.
  if(isGuest()&&actor===player&&(!grounded||!actor.alive))for(const event of ordinarySkills.events(elapsed))if(event.type==='frost-unravel'&&event.sourceId===actor.id){
    stoppedFrostEvents.set(event.id,event.endsAt);while(stoppedFrostEvents.size>20)stoppedFrostEvents.delete(stoppedFrostEvents.keys().next().value);
  }
  if(isGuest()&&actor===player&&ordinarySkills.events(elapsed).some(event=>event.type==='frost-unravel'&&event.sourceId===actor.id&&stoppedFrostEvents.has(event.id)))return 0;
  return ordinarySkills.frostSlideSpeed?.({...ordinaryActorView(actor),grounded},elapsed)||0;
}
function emberPulseIndex(age){return age>=3.6?2:age>=2.4?1:age>=1.2?0:-1;}
function updateCharacterDescription(){
  const definition=CHARACTER_DEFS[selectedCharacter()];
  if($('agent-description'))$('agent-description').textContent=`${definition.role} · ${definition.description}`;
  characterPicker.sync();
  skillUI.updateSelection(selectedCharacter());
}
function mendReachable(actor,target){return actor===target||visibleBetween(actor,target);}
function ordinaryReachable(event,actor){
  if(event.type==='japan-border'||event.type==='veil-roots'||event.type==='frost-stitch')return map.collision.rayClear(event.x,event.y+.18,event.z,actor.x,(actor.y||0)+.18,actor.z);
  const eye=(actor.y||0)+1.7-clamp(actor.crouch||0,0,1)*.55;
  const y=['nope-bottle','mend-seeds','echo-tag'].includes(event.type)?event.y+.18:event.y;
  return map.collision.rayClear(event.x,y,event.z,actor.x,eye,actor.z)&&(event.type==='mend-seeds'||!smokeBlocks({x:event.x,y:y-1.45,z:event.z},actor));
}
const ordinaryAudioTime=event=>event.type==='echo-tag'?event.startedAt+event.flight:event.triggerAt;
function allNopeDecoys(){return [...ordinarySkills.events(elapsed).filter(event=>event.type==='nope-decoy'),...nopeDecoys.events(elapsed)];}
function chooseNopeDecoyPoints(actor){
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  // Cache only existing street floors. Decoys add no solid geometry/support.
  if(!nopeDecoyTownCandidates){
    nopeDecoyTownCandidates=[];
    for(let z=-72;z<=73;z+=5)for(let x=-76;x<=74;x+=5){
      if(navigation.isWalkable(x,z)&&canStand(x,z,.5,0)&&Math.abs(rampFloor(x,z)||0)<.01)
        nopeDecoyTownCandidates.push({x,y:0,z});
    }
  }
  const candidates=nopeDecoyTownCandidates.filter(p=>![player,...bots].some(a=>a.alive&&distance(a,p)<1.4));
  if(candidates.length<30)return [];
  const chosen=[],scores=candidates.map(p=>-distance(actor,p));
  for(let i=0;i<30;i++){
    let best=-1;for(let j=0;j<candidates.length;j++)if(scores[j]!==-Infinity&&(best<0||scores[j]>scores[best]))best=j;
    const point=candidates[best];chosen.push({...point,yaw:Math.atan2(actor.x-point.x,actor.z-point.z)});scores[best]=-Infinity;
    for(let j=0;j<candidates.length;j++)if(scores[j]!==-Infinity)scores[j]=i===0?distance(candidates[j],point):Math.min(scores[j],distance(candidates[j],point));
  }
  return chosen;
}
function raycastNopeDecoy(origin,aim,maxDistance,shooterTeam){
  if(!['blue','red'].includes(shooterTeam)||!Number.isFinite(maxDistance)||maxDistance<=0)return null;
  const ray=new THREE.Ray(origin,aim),point=new THREE.Vector3();let nearest=null;
  // Separate head, torso/arms and legs: a low miss below the body stays a miss.
  for(const event of allNopeDecoys()){
    if(event.team===shooterTeam)continue;
    for(const [width,bottom,top,depth]of [[.32,1.34,1.96,.32],[.34,.72,1.35,.23],[.23,.02,.76,.20]]){
      const box=new THREE.Box3(new THREE.Vector3(event.x-width,event.y+bottom,event.z-depth),new THREE.Vector3(event.x+width,event.y+top,event.z+depth));
      if(!ray.intersectBox(box,point))continue;
      const d=origin.distanceTo(point);if(d>=maxDistance||nearest&&d>=nearest.distance)continue;
      nearest={event,distance:d,point:point.clone()};
    }
  }
  return nearest;
}
function showNopePop(pop){const entity={x:pop[1],y:pop[2],z:pop[3]};burst(new THREE.Vector3(entity.x,entity.y+1.55,entity.z),'#ff70c7',8);sound('flash',{entity,localOnly:true});}
function serializeNopePops(){return nopePops.filter(pop=>elapsed-pop[4]<.6).map(pop=>pop.slice());}
function applyNetNopePops(values,fresh){
  if(!Array.isArray(values)||values.length>8)return;
  for(const pop of values){
    if(!Array.isArray(pop)||pop.length!==5||!Number.isSafeInteger(pop[0])||pop[0]<=0||!pop.slice(1).every(Number.isFinite)||pop.slice(1,4).some(v=>Math.abs(v)>1000)||pop[4]<0||pop[4]>elapsed+.05)continue;
    if(pop[0]<=nopeSeenPopSequence)continue;
    nopeSeenPopSequence=pop[0];if(!fresh&&elapsed-pop[4]<.6)showNopePop(pop);
  }
}
function hitNopeDecoy(event,shooter){
  if(isGuest()||netHostPaused||match?.phase!=='live'||!shooter?.alive||shooter.team===event?.team)return false;
  const consumed=ordinarySkills.consumeDecoy(event.id,shooter.team,elapsed,match.round)||nopeDecoys.consume(event.id,shooter.team,elapsed,match.round);
  if(!consumed)return false;
  const actors=[player,...bots],views=actors.map(actor=>{
    const input=netInputs.get(actor.remoteId)?.input;
    return ordinaryActorView(input?{...actor,yaw:input.yaw,pitch:input.pitch}:actor);
  });
  for(const effect of ordinarySkills.flashDecoy(consumed,ordinaryActorView(shooter),views,elapsed,match.round,{reachable:ordinaryReachable})){
    const target=actors.find(a=>a.id===effect.targetId);if(target){target.target=null;target.reactionUntil=Math.max(target.reactionUntil||0,elapsed+effect.duration);}
  }
  const pop=[++nopePopSequence,consumed.x,consumed.y,consumed.z,elapsed];nopePops.push(pop);if(nopePops.length>8)nopePops.shift();showNopePop(pop);return true;
}
function updateOrdinarySkills(){
  if(!match)return;
  if(match.phase!=='live'){resetOrdinarySkills();return;}
  if(ordinarySkills.capLocked(player.id,elapsed))aiming=false;
  if(!isGuest()){
    const actors=[player,...bots],views=actors.map(actor=>{
      if(!actor.remoteId)return ordinaryActorView(actor);
      const input=netInputs.get(actor.remoteId)?.input;
      return ordinaryActorView(input?{...actor,yaw:input.yaw,pitch:input.pitch}:actor);
    });
    for(const effect of ordinarySkills.update(views,elapsed,match.round,{reachable:ordinaryReachable,groundHeight:ordinaryGroundHeight})){
      const target=actors.find(actor=>actor.id===effect.targetId),source=actors.find(actor=>actor.id===effect.sourceId);
      if(effect.type==='damage'&&target&&source)damageEntity(target,effect.amount,source,{skill:source.kit?.character});
      if(effect.type==='heal'&&target?.alive&&source?.alive&&target.team===source.team){const before=target.hp;target.hp=Math.min(100,target.hp+effect.amount);if(target.hp>before)skillImpact(target,source,'mend','heal');}
      if(effect.type==='blind'&&target?.target)target.target=null;
    }
  }
  const events=ordinarySkills.events(elapsed),ids=new Set(events.map(event=>event.id));
  if(!isGuest()&&events.some(event=>['mend-pollen','veil-dust','frost-mist','duelist-comet'].includes(event.type)&&elapsed>=event.triggerAt))for(const bot of bots)if(bot.target&&!visibleBetween(bot,bot.target))bot.target=null;
  for(const id of ordinaryAudio.keys())if(!ids.has(id))ordinaryAudio.delete(id);
  for(const event of events){
    const previous=ordinaryAudio.get(event.id),age=elapsed-event.startedAt;
    if(event.type==='nope-decoy'){
      const beat=Math.floor(age/.65);
      if(previous===undefined&&age>=0&&age<.18)sound('decoy',{entity:event,localOnly:true});
      if(beat>(previous??-1)&&age% .65<.18)sound('step',{entity:event});
      ordinaryAudio.set(event.id,beat);
    }else{
      const trigger=ordinaryAudioTime(event),triggered=elapsed>=trigger;
      if(triggered&&previous!==true&&elapsed-trigger<.18)sound({'onnara-tax':'onnara-tax','onnara-orb':'onnara-orb','onnara-hover':'onnara-hover','onnara-chain':'onnara-chain','nope-bottle':'bottle-pop','nope-flash':'flash','mend-seeds':'seed-bloom','mend-pollen':'pollen','mend-heal':'flower-heal','echo-tag':'echo-tag-set','echo-glint':'echo-glint','echo-kerning':'echo-kerning','veil-dust':'grass-dust','veil-roots':'grass-roots','veil-turf':'grass-turf','ember-solder':'solder-pop','ember-shade':'shade-check','ember-service':'quick-solder','frost-stitch':'frost-stitch','frost-mist':'frost-mist','frost-unravel':'frost-unravel','duelist-comet':'duelist-comet','duelist-lift':'duelist-lift','duck-seal':'duck-seal','duck-shield':'duck-shield','duck-hush':'duck-hush','duck-egg':'duck-egg','cat-bookmark':'cat-bookmark','cat-return':'cat-return','cat-pluck':'cat-pluck','cat-fetch':'cat-fetch','cat-clock':'cat-clock','urchin-jam':'urchin-jam','urchin-disarm':'urchin-disarm','urchin-pearl':'urchin-pearl','urchin-trident':'urchin-trident','cap-lock':'cap-lock','cap-clean':'cap-clean','cap-bank':'cap-bank','cap-magazine':'cap-magazine','japan-border':'japan-border','japan-levy':'japan-levy','japan-return':'japan-return','japan-muster':'japan-muster','nobi-tag':'nobi-tag','nobi-brake':'nobi-brake','nobi-tool':'nobi-tool','nobi-legend':'nobi-legend','car-bumper':'car-bumper','car-wash':'car-wash','car-gyro':'car-gyro','car-pit':'car-pit'}[event.type]||'smoke',{entity:event,localOnly:true});
      ordinaryAudio.set(event.id,triggered);
    }
  }
  const markers=ordinarySkills.markers(player.team,elapsed),markerIds=new Set(markers.map(marker=>marker.eventId));
  for(const id of ordinaryMarkerAudio)if(!markerIds.has(id))ordinaryMarkerAudio.delete(id);
  for(const marker of markers){
    if(!ordinaryMarkerAudio.has(marker.eventId)&&elapsed-marker.detectedAt<.18)sound('echo-tag-detect',{entity:marker,localOnly:true});
    ordinaryMarkerAudio.add(marker.eventId);
  }
}
function renderOrdinarySkills(){
  const live=match?.phase==='live',viewer=player.alive?player:spectatedBot;
  const spectacleEvents=live?[...ordinarySkills.events(elapsed),...teamAbilities.events(elapsed),...zoneAbilities.events(elapsed)]:[];
  skillFeedback.observe(spectacleEvents,elapsed,player.id);skillFeedback.render(elapsed,{active:live&&mode==='play'&&player.alive,reducedMotion:reducedMotion.matches});
  skillSpectacle.update(spectacleEvents,elapsed,{actors:[player,...bots],viewer:viewer||player,reducedMotion:reducedMotion.matches,visible:p=>ordinarySkills.blindUntil((viewer||player).id,elapsed)<=elapsed&&visibleBetween(viewer||player,p)});
  ordinaryFX.update(live?ordinarySkills.events(elapsed).filter(event=>event.type!=='nope-decoy'):[],elapsed,{viewer:viewer||player,showHand:live&&mode==='play'&&player.alive,reducedMotion:reducedMotion.matches});
  nopeDecoyFX.update(live?allNopeDecoys():[],elapsed,{viewer:viewer||player,reducedMotion:reducedMotion.matches});
  mendSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{viewer:viewer||player,showHand:live&&mode==='play'&&player.alive,reducedMotion:reducedMotion.matches});
  iagnuSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{viewer:viewer||player,actors:[player,...bots],showHand:live&&mode==='play'&&player.alive,reducedMotion:reducedMotion.matches});
  grassSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{viewer:viewer||player,actors:[player,...bots].map(ordinaryActorView),groundHeight:ordinaryGroundHeight,showHand:live&&mode==='play'&&player.alive,reducedMotion:reducedMotion.matches});
  emberSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{viewer:viewer||player,actors:[player,...bots].map(ordinaryActorView),showHand:live&&mode==='play'&&player.alive,reducedMotion:reducedMotion.matches});
  onnaraSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{actors:[player,...bots].filter(a=>a.team===player.team||ordinarySkills.blindUntil(player.id,elapsed)<=elapsed&&visibleBetween(player,a)),reducedMotion:reducedMotion.matches});
  urchinSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{actors:[player,...bots].filter(a=>a.team===player.team||ordinarySkills.blindUntil(player.id,elapsed)<=elapsed&&visibleBetween(player,a))});
  capSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{actors:[player,...bots].filter(a=>a.team===player.team||ordinarySkills.blindUntil(player.id,elapsed)<=elapsed&&visibleBetween(player,a)),reducedMotion:reducedMotion.matches,hiddenActorId:viewer?.id});
  japanSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{actors:[player,...bots].filter(a=>a.team===player.team||ordinarySkills.blindUntil(player.id,elapsed)<=elapsed&&visibleBetween(player,a))});
  nobiSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{actors:[player,...bots].filter(a=>a.team===player.team||ordinarySkills.blindUntil(player.id,elapsed)<=elapsed&&visibleBetween(player,a))});
  carSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{actors:[player,...bots],preview:live&&mode==='play'&&player.alive&&player.kit.character==='car'&&duckAim?carSkillTarget(player,duckAim):null});
  catSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{actors:[player,...bots],preview:live&&mode==='play'&&player.alive&&player.kit.character==='cat'&&duckAim?{...(duckAim==='q'?catEnemyTarget(player):catDropTarget(player)),type:duckAim}:null});
  duckSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{actors:[player,...bots],preview:live&&mode==='play'&&player.alive&&player.kit.character==='duck'&&duckAim?{...getDuckTarget(player,duckAim==='c'?'duck-seal':'duck-shield'),type:duckAim}:null});
  frostSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{viewer:viewer||player,actors:[player,...bots].map(ordinaryActorView),groundHeight:ordinaryGroundHeight,reachable:ordinaryReachable,showHand:live&&mode==='play'&&player.alive,reducedMotion:reducedMotion.matches});
  duelistSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{viewer:viewer||player,showHand:live&&mode==='play'&&player.alive,reducedMotion:reducedMotion.matches});
  const remaining=live&&viewer?.alive?Math.max(0,ordinarySkills.blindUntil(viewer.id,elapsed)-elapsed):0,overlay=$('skill-blind-overlay');
  if(overlay){overlay.hidden=!(remaining>0&&mode==='play');overlay.style.opacity=String(clamp(remaining/.35,0,.94));}
  if(['play','pause','shop','map','score'].includes(mode))gun.visible=player.alive&&inventory.active!=='spike'&&!ordinaryFX.throwing(elapsed)&&!mendSkillFX.throwing(elapsed)&&!iagnuSkillFX.throwing(elapsed)&&!grassSkillFX.throwing(elapsed)&&!emberSkillFX.throwing(elapsed)&&!frostSkillFX.throwing(elapsed)&&!duelistSkillFX.throwing(elapsed);
}
function updateTeamAbilities(){
  if(!match)return;
  if(!isGuest()&&match.phase==='live'){
    const discoveries=teamAbilities.update([player,...bots],elapsed,match.round);
    for(const sighting of discoveries){
      const target={id:sighting.targetId,team:sighting.observerTeam==='blue'?'red':'blue',alive:true,x:sighting.x,z:sighting.z};
      updateBots.tactics?.observe(sighting.observerTeam,'recon',target,sighting.seenAt);
    }
    const actors=[player,...bots];
    for(const impact of zoneAbilities.update(actors,elapsed,match.round)){
      const target=actors.find(actor=>actor.id===impact.targetId),source=actors.find(actor=>actor.id===impact.sourceId&&actor.team===impact.team);
      if(target&&source&&target.team!==source.team)damageEntity(target,impact.damage,source,{skill:source.kit?.character});
    }
  }
  characterFX.update(teamAbilities.events(elapsed),elapsed,{reducedMotion:reducedMotion.matches});
  const zones=zoneAbilities.events(elapsed),zoneIds=new Set(zones.map(event=>event.id));
  for(const id of zonePulseAudio.keys())if(!zoneIds.has(id))zonePulseAudio.delete(id);
  for(const event of zones){
    if(event.type!=='ember')continue;
    const age=elapsed-event.startedAt,index=emberPulseIndex(age),previous=zonePulseAudio.get(event.id)??-1;
    if(index>previous&&age-[1.2,2.4,3.6][index]<.18)sound('ember-impact',{entity:event});
    zonePulseAudio.set(event.id,Math.max(previous,index));
  }
  zoneFX.update(zones,elapsed,{reducedMotion:reducedMotion.matches,preview:getZonePreview()});
  updateOrdinarySkills();
}
function startTakeover(data,{audible=true}={}){
  if(takeoverState?.id===data.id)return false;
  takeoverState={id:data.id,round:data.round,startedAt:data.startedAt,endsAt:data.endsAt};takeoverClock=elapsed;stationTakeover.start(takeoverState);
  if(audible&&elapsed-data.startedAt>=0&&elapsed-data.startedAt<.25)sound('takeover',{localOnly:true});
  return true;
}
function applyNetTakeover(packet,{audible=true}={}){
  const d=packet.takeover;if(!d){resetTakeover();return;}
  if(typeof d.id!=='string'||!d.id.length||d.id.length>96||d.round!==match.round||![d.startedAt,d.endsAt].every(Number.isFinite)||d.startedAt<0||d.startedAt>elapsed+.05||d.endsAt<=d.startedAt||d.endsAt-d.startedAt>12.001)return;
  startTakeover(d,{audible});
}
function startDetonation(data,{audible=true}={}){
  if(detonationState?.id===data.id)return false;
  detonationState={id:data.id,round:data.round,startedAt:data.startedAt,x:data.x,z:data.z,seed:data.seed};detonationClock=elapsed;
  stationDetonation.start({x:data.x,z:data.z,time:data.startedAt,seed:data.seed});
  if(audible&&elapsed-data.startedAt>=0&&elapsed-data.startedAt<.25)sound('explosion',{entity:data});
  return true;
}
function applyNetDetonation(packet){
  if(packet.rules?.spike?.status!=='detonated'){if(detonationState)resetDetonation();return;}
  const d=packet.detonation;
  if(!d||typeof d.id!=='string'||!d.id.length||d.id.length>96||d.round!==match.round||![d.startedAt,d.x,d.z].every(Number.isFinite)||!Number.isSafeInteger(d.seed)||d.seed<0||d.seed>4294967295||d.startedAt<0||d.startedAt>elapsed+.05||d.x<activeArenaBounds().minX||d.x>activeArenaBounds().maxX||d.z<activeArenaBounds().minZ||d.z>activeArenaBounds().maxZ)return;
  startDetonation(d);
}
function renderWithDetonation(dt=0){
  renderOrdinarySkills();
  if(takeoverState){if(mode==='result'&&!netHostPaused)takeoverClock+=dt;takeoverClock=Math.max(takeoverClock,elapsed);}
  stationTakeover.update(takeoverClock);
  if(match)characterFX.update(teamAbilities.events(elapsed),elapsed,{reducedMotion:reducedMotion.matches});
  if(match)zoneFX.update(zoneAbilities.events(elapsed),elapsed,{reducedMotion:reducedMotion.matches,preview:getZonePreview()});
  if(detonationState){
    if(mode==='result'&&!netHostPaused)detonationClock+=dt;
    detonationClock=Math.max(detonationClock,elapsed);
  }
  const fx=stationDetonation.update(detonationClock,{reducedMotion:reducedMotion.matches});
  renderCameraPosition.copy(camera.position);renderCameraRotation.copy(camera.rotation);
  const exposure=renderer.toneMappingExposure;
  try{
    if(fx.active){
      const shake=clamp(fx.shake,0,1),t=detonationClock-(detonationState?.startedAt||0);
      camera.position.x+=Math.sin(t*73)*.065*shake;camera.position.y+=Math.sin(t*91)*.045*shake;
      camera.rotation.z+=Math.sin(t*67)*.009*shake;camera.rotation.x+=Math.sin(t*57)*.006*shake;
      renderer.toneMappingExposure=exposure+clamp(fx.flash,0,1)*.8;
    }
    if($('detonation-flash'))$('detonation-flash').style.opacity=String(clamp(fx.flash,0,1)*.32);
    renderer.render(scene,camera);
    renderOnnaraOrb();
  }finally{camera.position.copy(renderCameraPosition);camera.rotation.copy(renderCameraRotation);renderer.toneMappingExposure=exposure;}
}
function skillImpact(target,source,character,kind='hit'){
  if(isGuest()||!Object.hasOwn(SKILL_LOOKS,character)||!target||!source)return;
  const point={x:target.x,y:(target.y||0)+1.1,z:target.z};
  skillSpectacle.impact(character,point,elapsed,{kind});
  if(source.id===player.id)skillFeedback.note(kind,'local:'+match.round+':'+(++skillImpactSequence),character,elapsed);
  if(onlinePlaying&&online?.host){netCues.push({seq:++netCueSequence,round:match.round,type:kind==='heal'?'skill-heal':'skill-hit',weapon:character,id:source.id,...point,time:elapsed});if(netCues.length>64)netCues.splice(0,netCues.length-64);}
}
function serializeNetCues(){return netCues.filter(c=>c.round===match?.round&&c.time>=elapsed-1.5);}
function applyNetCues(packet,fresh,ownId){
  const cues=Array.isArray(packet.cues)?packet.cues.slice(-64):[],previous=netSeenCueSequence,seen=new Set();
  for(const cue of cues){
    if(!Number.isSafeInteger(cue.seq)||cue.seq<=previous||seen.has(cue.seq))continue;seen.add(cue.seq);
    netSeenCueSequence=Math.max(netSeenCueSequence,cue.seq);
    if(fresh||cue.round!==packet.rules.round||packet.time-cue.time>1||packet.time<cue.time||![cue.x,cue.z].every(Number.isFinite))continue;
    if(['skill-hit','skill-heal'].includes(cue.type)){if(!Object.hasOwn(SKILL_LOOKS,cue.weapon)||!Number.isFinite(cue.y)||Math.max(Math.abs(cue.x),Math.abs(cue.y),Math.abs(cue.z))>1000||packet.time-cue.time>.65||packet.rules.phase!=='live')continue;const kind=cue.type==='skill-heal'?'heal':'hit';skillSpectacle.impact(cue.weapon,cue,cue.time,{kind});if(cue.id===ownId)skillFeedback.note(kind,'receipt:'+cue.round+':'+cue.seq,cue.weapon,cue.time);continue;}
    if(cue.id===ownId||!actionCueTypes.has(cue.type))continue;
    sound(cue.type,{weapon:cue.weapon,entity:cue});
  }
}
function updateAbilityFeedback(){
  if(signatureFeedbackMatch!==match){signatureFeedbackMatch=match;signatureReadyNotices.clear();Object.assign(dashFeedback,{round:null,state:null,expires:0,charge:null,signatureAt:0});}
  const kit=player.kit,state=kit.armExpiresAt===null?'idle':elapsed<kit.armReadyAt?'charging':'ready';
  if(dashFeedback.round===match.round&&player.alive&&match.phase==='live'){
    if(dashFeedback.state==='charging'&&state==='ready')sound('dash-ready');
    if(dashFeedback.state==='ready'&&state==='idle'&&elapsed>=dashFeedback.expires)sound('dash-expired');
    const cooldown=signatureCooldown(kit.character),signatureReady=cooldown>0?dashFeedback.signatureAt>0&&elapsed>=dashFeedback.signatureAt:kit.character==='duelist';
    const noticeKey=cooldown>0?`${match.round}:${kit.character}:${dashFeedback.signatureAt}`:null;
    if(dashFeedback.charge===0&&kit.dash===1&&signatureReady&&(!noticeKey||!signatureReadyNotices.has(noticeKey))){
      if(noticeKey){signatureReadyNotices.add(noticeKey);while(signatureReadyNotices.size>32)signatureReadyNotices.delete(signatureReadyNotices.values().next().value);}
      sound('dash-ready');const definition=getCharacterSkill(kit.character,'e');showMessage(`${definition.name} / 再使用可能`,cooldown>0?`${cooldown}秒経過 · Eで${definition.name}を使えます`:`${DUELIST.signatureKills}キル達成 · Eを再び準備できます`,1.8);
    }
  }
  Object.assign(dashFeedback,{round:match.round,state,expires:kit.armExpiresAt??dashFeedback.expires,charge:kit.dash,signatureAt:kit.nextSignatureAt||0});
}

const viewmodel=createViewmodel(THREE,camera);
const gun=viewmodel.group,flash=viewmodel.flash;
const gunDark=new THREE.MeshStandardMaterial({color:'#26363d',roughness:.5,metalness:.5});

const buyBarrier=new THREE.Mesh(new THREE.CylinderGeometry(1,1,4,80,1,true),new THREE.MeshBasicMaterial({color:'#8ad8ed',transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false}));
buyBarrier.position.y=2;buyBarrier.visible=false;scene.add(buyBarrier);
const objectiveModel=createObjectiveModel(THREE),spikeModel=objectiveModel.group;scene.add(spikeModel);spikeModel.visible=false;
const droppedWeapons=[];
let dropSequence=0;
function removeDrop(drop){const index=droppedWeapons.indexOf(drop);if(index<0)return;drop.visual.dispose();droppedWeapons.splice(index,1);}
function clearDrops(){for(const drop of [...droppedWeapons])removeDrop(drop);}
function addDrop(data){
  const visual=createDroppedEquipment(THREE,{weapon:data.weapon,yaw:data.yaw}),mesh=visual.group;
  mesh.position.set(data.x,0,data.z);scene.add(mesh);const drop={...data,mesh,visual};droppedWeapons.push(drop);return drop;
}
function dropItem(weapon,entity){
  const spec=WEAPONS[weapon];if(!spec||weapon==='classic'||!['primary','secondary'].includes(spec.slot))return;
  const local=entity===player,active=local?inventory.active:entity.remoteId?entity.netWeapon:entity.aiWeapon;
  const saved=local?ammoStore[weapon]:entity.netStores?.[weapon];
  const ammo=active===weapon?(local?player.ammo:entity.remoteId?entity.netAmmo:entity.aiAmmo):saved?.ammo;
  const reserve=active===weapon?(local?player.reserve:entity.remoteId?entity.netReserve:entity.aiReserve??spec.reserve):saved?.reserve;
  const data={id:++dropSequence,weapon,x:entity.x,z:entity.z,yaw:Math.random()*Math.PI*2,ammo:clamp(Math.floor(ammo??spec.mag),0,spec.mag),reserve:clamp(Math.floor(reserve??spec.reserve),0,spec.reserve)};
  while(droppedWeapons.length>=32)removeDrop(droppedWeapons[0]);return addDrop(data);
}
function serializeDrops(){return droppedWeapons.map(({id,weapon,x,z,yaw,ammo,reserve})=>({id,weapon,x,z,yaw,ammo,reserve}));}
function syncDrops(values){
  const valid=new Map();
  for(const value of Array.isArray(values)?values.slice(0,32):[]){
    const spec=WEAPONS[value?.weapon];if(!spec||value.weapon==='classic'||!['primary','secondary'].includes(spec.slot)||!Number.isSafeInteger(value.id)||value.id<1||![value.x,value.z,value.yaw,value.ammo,value.reserve].every(Number.isFinite)||value.x<activeArenaBounds().minX||value.x>activeArenaBounds().maxX||value.z<activeArenaBounds().minZ||value.z>activeArenaBounds().maxZ)continue;
    valid.set(value.id,{id:value.id,weapon:value.weapon,x:value.x,z:value.z,yaw:value.yaw,ammo:clamp(Math.floor(value.ammo),0,spec.mag),reserve:clamp(Math.floor(value.reserve),0,spec.reserve)});
  }
  for(const drop of [...droppedWeapons])if(!valid.has(drop.id)||valid.get(drop.id).weapon!==drop.weapon)removeDrop(drop);
  for(const data of valid.values()){
    const old=droppedWeapons.find(d=>d.id===data.id);
    if(old){Object.assign(old,data);old.mesh.position.set(data.x,0,data.z);old.mesh.rotation.y=data.yaw;}
    else addDrop(data);
  }
}
function pickupDroppedWeapon(actor,dropId,{catFetch=false}={}){
  if(!actor.alive||match?.phase!=='live')return false;
  const remoteFetch=catFetch&&actor.kit?.character==='cat'&&!isGuest();
  const drop=droppedWeapons.find(d=>d.id===dropId&&(remoteFetch?Math.hypot(d.x-actor.x,actor.y||0,d.z-actor.z)<=CAT_SKILLS.fetchRange&&catDropVisible(actor,d):Math.hypot(d.x-actor.x,d.z-actor.z)<1.5));if(!drop)return false;
  const slot=WEAPONS[drop.weapon].slot,local=actor===player;
  if(local)ammoStore[inventory.active]={ammo:player.ammo,reserve:player.reserve};
  else{actor.netStores||={};actor.netStores[actor.netWeapon]={ammo:actor.netAmmo,reserve:actor.netReserve};}
  const previous=local?inventory[slot]:actor.record?.[slot];dropItem(previous,actor);
  if(local){inventory[slot]=drop.weapon;ammoStore[drop.weapon]={ammo:drop.ammo,reserve:drop.reserve};equip(drop.weapon,true);}
  else{
    cancelServiceReload(actor);actor.record[slot]=drop.weapon;actor.netWeapon=drop.weapon;actor.netAmmo=drop.ammo;actor.netReserve=drop.reserve;actor.netReload=0;
    if(remoteFetch&&!actor.remoteId){actor.aiWeapon=drop.weapon;actor.aiAmmo=drop.ammo;actor.aiReserve=drop.reserve;actor.aiReload=0;}
    actor.netStores||={};actor.netStores[drop.weapon]={ammo:drop.ammo,reserve:drop.reserve};
  }
  removeDrop(drop);return true;
}
const BLADE={name:'BLADE STORM',mag:0,reserve:0,interval:.23,reload:0,spread:0,head:150,body:50,leg:42,auto:true,slot:'ultimate'};
function weapon(){return player.kit.knivesActive&&inventory.active==='knife'?BLADE:WEAPONS[inventory.active]||WEAPONS.classic;}
function equip(id,fresh=false){
  if(netHostPaused&&!fresh)return;
  if(isGuest()&&!fresh)queueNetAction('equip',{weapon:id});
  if(!id)return;if(!fresh)ammoStore[inventory.active]={ammo:player.ammo,reserve:player.reserve};
  cancelServiceReload(player);inventory.active=id;const spec=WEAPONS[id]||WEAPONS.classic;const saved=ammoStore[id];
  player.ammo=saved?.ammo??spec.mag;player.reserve=saved?.reserve??spec.reserve;reloading=0;shotSequence=0;kick=0;firing=false;aiming=false;
  gun.visible=player.alive&&id!=='spike';
  viewmodel.setWeapon(id==='spike'?'knife':id);
}
function openShop(){
  if(netHostPaused)return;
  if(!match||(!exploring&&match.phase!=='buy')||!player.alive){showMessage('ショップは購入フェーズのみ','装備は生き残れば次のラウンドへ持ち越します',2);return;}
  if(mode==='shop'){resumeGame();return;}
  mode='shop';keys.clear();firing=false;aiming=false;setVisible('shop-overlay',true);if(document.pointerLockElement)document.exitPointerLock();updateShop();
  if($('shop-status'))$('shop-status').textContent=exploring?'練習中は全武器を無料で選択できます。':'装備を選択してください。';
}
function buy(id){
  if(netHostPaused)return false;
  if(exploring){const spec=WEAPONS[id];if(!spec||spec.slot==='melee')return false;inventory[spec.slot]=id;delete ammoStore[id];equip(id,true);updateShop();updateHUD();return true;}
  if(isGuest()){queueNetAction('buy',{id});return true;}
  if(!match||match.phase!=='buy')return false;
  if(id==='smoke'||id==='updraft'){const ok=player.kit.buy(id,price=>match.purchase(price));if(ok){sound('buy');updateShop();updateHUD();}return ok;}
  const armor=id==='light'||id==='heavy';const spec=armor?{price:id==='light'?400:1000,slot:'armor'}:WEAPONS[id];if(!spec)return false;
  const slot=spec.slot;const oldId=armor?null:inventory[slot];
  if((armor&&player.armor>=(id==='light'?25:50))||(!armor&&oldId===id)){if($('shop-status'))$('shop-status').textContent='すでに装備しています';return false;}
  const purchase=roundPurchases[slot],refund=purchase&&(armor||purchase.id===oldId)?purchase.price:0;
  if(match.credits+refund<spec.price){if($('shop-status'))$('shop-status').textContent='しばくでコインが不足しています';return false;}
  match.addCredits(refund);if(!match.purchase(spec.price))return false;
  roundPurchases[slot]={id,price:spec.price};
  if(armor)player.armor=id==='light'?25:50;
  else{inventory[slot]=id;delete ammoStore[id];equip(id);}
  if($('shop-status'))$('shop-status').textContent=`${armor?(id==='heavy'?'ヘヴィーシールド':'ライトシールド'):spec.name} を購入しました`;
  sound('buy');updateShop();updateHUD();return true;
}
function updateShop(){
  if(!match)return;
  setVisible('start-round',!onlinePlaying&&!exploring);
  if($('shop-rule-summary'))$('shop-rule-summary').textContent=exploring?'マップ練習 / 全10銃を無料で選択':'購入は購入フェーズ中のみ可能です';
  if($('shop-credits'))$('shop-credits').textContent=exploring?'練習 / FREE':match.credits.toLocaleString();
  document.querySelectorAll('[data-buy]').forEach(button=>{const id=button.dataset.buy;if(id==='smoke'||id==='updraft'){const max=id==='smoke'?2:1,price=id==='smoke'?200:150;button.disabled=match.phase!=='buy'||player.kit[id]>=max||match.credits<price;button.classList.toggle('owned',player.kit[id]>=max);return;}const armor=id==='light'||id==='heavy';const spec=armor?{price:id==='light'?400:1000,slot:'armor'}:WEAPONS[id];if(!spec)return;const owned=armor?player.armor>=(id==='light'?25:50):inventory[spec.slot]===id;
    button.disabled=exploring?armor:match.phase!=='buy'||(!owned&&match.credits+(roundPurchases[spec.slot]?.price||0)<spec.price);button.classList.toggle('owned',owned);button.classList.toggle('selected',inventory.active===id);
  });
  skillUI.updateShop({kit:player.kit,credits:match.credits,phase:match.phase,alive:player.alive});
}
function startRound(){if(onlinePlaying&&!online.host){showMessage('開始を待っています','購入終了とラウンド進行はホストが管理します',2);return;}if(match?.startLive()){resumeGame();handleMatchEvents();updateHUD();}}
function showScoreboard(){
  if(!match)return;mode='score';setVisible('scoreboard',true);firing=false;keys.clear();if(document.pointerLockElement)document.exitPointerLock();updateScoreboard();
}
function updateScoreboard(){
  const body=$('scoreboard-body');if(!body)return;body.replaceChildren();
  for(const r of roster){const tr=document.createElement('tr');const entity=r.id===player.id?player:bots.find(b=>b.id===r.id);tr.className=`${r.team!==player.team?'enemy':''} ${r.id===player.id?'player':''} ${entity?.alive?'':'dead'}`;
    for(const value of [r.name,r.team===player.team?'味方':'敵',r.k,r.d,r.a,r.id===player.id?match.credits:r.credits,r.id===player.id?weapon().name:(WEAPONS[r.primary||r.secondary]?.name||'CLASSIC')]){const td=document.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);
  }
}
function aliveCount(team){return bots.filter(b=>b.alive&&b.team===team).length+(team===player.team&&player.alive?1:0);}
function recordOf(entity){return entity.id==='player'?roster[0]:entity.record;}
function damageEntity(entity,amount,killer,{firearm=false,returned=false,chain=true,skill=null}={}){
  if(isGuest())return;
  if(!entity.alive||match?.phase!=='live'||(killer&&entity.team===killer.team))return;
  if(rangeSession&&entity.rangeTarget){
    entity.hp=Math.max(0,entity.hp-amount);
    if(!entity.hp){entity.alive=false;entity.death=.35;rangeRespawn=.18;totalKills++;sound('kill');}
    return;
  }
  const returnScale=!returned&&firearm&&killer?.alive?ordinarySkills.japanReturn(entity.id,elapsed):0,healthBefore=entity.hp,armorBefore=entity.armor;
  const result=applyArmorDamage(entity.hp,entity.armor,amount);entity.hp=result.hp;entity.armor=result.armor;if(entity.hp<=0&&ordinarySkills.guardLethal(entity.id,elapsed,match.round)){entity.hp=1;if(entity===player)showMessage('不屈の卵 / 殻が割れた','致死攻撃をHP1で耐えました',1.5);}
  if(skill&&killer&&Math.max(0,healthBefore-entity.hp)+Math.max(0,armorBefore-entity.armor)>0)skillImpact(entity,killer,skill);
  if(entity===player)damageFlash=.45;
  if(returnScale){const actual=Math.max(0,healthBefore-entity.hp)+Math.max(0,armorBefore-entity.armor);if(actual>0)damageEntity(killer,actual*returnScale,entity,{returned:true,skill:'japan'});}
  if(firearm&&chain&&!returned&&killer?.alive&&ordinarySkills.onnaraEvent?.('onnara-chain',killer.id,elapsed)){const actual=Math.max(0,healthBefore-entity.hp)+Math.max(0,armorBefore-entity.armor);const next=actual>0?constellationTarget(entity,killer,[player,...bots],visibleBetween):null;if(next){const from=new THREE.Vector3(entity.x,(entity.y||0)+1.2,entity.z),to=new THREE.Vector3(next.x,(next.y||0)+1.2,next.z);ordinarySkills.recordConstellation(killer.id,from,to,elapsed);damageEntity(next,actual*ONNARA_SKILLS.chainScale,killer,{chain:false,skill:'onnara'});}}
  if(entity.hp>0)return;
  fullComboTracker.record(match.round,entity,killer);
  entity.alive=false;cancelServiceReload(entity);entity.kit?.awardPoint();const record=recordOf(entity);if(record)record.d++;
  match.dropSpike(entity.id,entity.x,entity.z);match.cancelPlant(entity.id);match.cancelDefuse(entity.id);
  const item=entity===player?inventory.primary:record?.primary;dropItem(item,entity);
  if(killer){killer.kit?.awardKill();const k=recordOf(killer);if(k)k.k++;if(killer===player){totalKills++;match.awardKill();sound('kill');}else if(k)k.credits=Math.min(9000,k.credits+200);feed(`${k?.name||'SENTINEL'}  ⌁  ${record?.name||'YOU'}`);}
  if(entity===player)beginDeathView();
  else{entity.death=.85;entity.defusing=false;entity.planting=false;}
}
function showRoundResult(team,reason,{audible=true}={}){
  const key=`${match?.round}:${team}`;
  syncVictoryMusic();victoryMusic.result({key,won:team===player.team,audible:audible&&match?.phase==='post'&&!netHostPaused&&mode!=='pause'});
  if(lastRoundAudio!==key){lastRoundAudio=key;if(audible&&match?.phase==='post'&&!match.winner)sound(team===player.team?'round-win':'round-loss');}
  const banner=$('round-banner');if(!banner)return;
  renderRoundBanner(banner,{document,match,roster,viewerTeam:player.team,team,reason});setVisible('round-banner',true);
}
function handleMatchEvents(){
  if(!match)return;
  for(const event of match.drainEvents()){
    if(event.type==='live'){if(!exploring&&!rangeSession&&!objectivePractice)fullComboTracker.begin(match.round,[player,...bots]);buyBarrier.visible=false;if(mode==='shop')resumeGame();showMessage(sideNames[match.side],match.side==='attack'?'A/Bサイトで F を4秒長押しして設置':'設置を阻止 · 設置されたら F を7秒長押しで電源オフ',3);}
    if(event.type==='planted'){
      const planter=event.actorId==='player'?player:bots.find(b=>b.id===event.actorId);planter?.kit?.awardPoint();
      showMessage('BOMBER PLANTED',`${event.site}サイト · 起爆まで45秒`,3);sound('plant',{entity:match.spike});lastSpikeBeep=0;
      for(const r of roster)if(r.id!=='player'&&r.team===event.team)r.credits=Math.min(9000,r.credits+300);
    }
    if(event.type==='dropped')showMessage('BOMBER DROPPED','落ちたボンバーは攻撃側が接近すると回収',2);
    if(event.type==='defused'){sound('defuse',{entity:match.spike});const defuser=event.actorId==='player'?player:bots.find(b=>b.id===event.actorId);defuser?.kit?.awardPoint();}
    if(event.type==='detonated')startDetonation({id:`${match.round}:${elapsed.toFixed(6)}`,round:match.round,startedAt:elapsed,x:match.spike.x,z:match.spike.z,seed:(Math.imul(match.round,16807)+Math.floor(elapsed*1000))>>>0});
    if(event.type==='round-end'){
      const comboId=fullComboTracker.winner(match.round,event.team),comboSeat=roster.findIndex(r=>r.id===comboId);
      if(match.lastRound&&comboSeat>=0)match.lastRound.fullCombo=comboSeat;
      clearCombatInput();reloading=0;
      resetZoneAbilities();
      showRoundResult(event.team,event.reason);
      const redWon=event.team==='red';
      const swiftGrant=won=>match.round%4===1?2400+(won?600:0):match.round%4===2||match.round%4===3?4250:0;
      const redBase=match.format==='swift'?swiftGrant(redWon):redWon?3000:1900+Math.min(redLossStreak,2)*500;
      redLossStreak=redWon?Math.max(0,redLossStreak-1):redLossStreak+1;
      for(const r of roster){if(r.id==='player')continue;const e=bots.find(b=>b.id===r.id);r.survived=!!e?.alive;r.armor=e?.armor||0;
        let reward=r.team==='red'?redBase:match.format==='swift'?swiftGrant(event.won):event.won?3000:1900+Math.min(Math.max(0,match.lossStreak-1),2)*500;
        const side=r.team===match.attackerTeam?'attack':'defend';
        if(match.format==='standard'&&r.team!==event.team&&r.survived&&((side==='attack'&&event.reason==='timeout')||(side==='defend'&&event.reason==='detonation')))reward=1000;
        r.credits=Math.min(9000,r.credits+reward);
      }
    }
    if(event.type==='round-start')spawnRound(event.reset);
    if(event.type==='match-end')finish(event.winner==='blue');
  }
}

function makeBot(spawn,index,team='red',record=null) {
  const bot={id:record?.id||`${team}-${index}`,team,record,x:spawn.x,z:spawn.z,y:Number.isFinite(spawn.y)?spawn.y:0,vy:0,hp:100,armor:record?.armor||0,alive:true,phase:Math.random()*6.28,fire:1.5+index*.12,index,flash:0,spawnX:spawn.x,spawnZ:spawn.z,path:[],pathTime:0,target:null,lastSeen:null,reactionUntil:0,flankComplete:false,plantPositionId:null,planting:false,defusing:false};
  const savedKit=record?.kit;
  bot.kit=typeof savedKit?.restore==='function'?savedKit:new DuelistKit({character:savedKit?.character||characterIds[index%characterIds.length]});
  if(savedKit&&typeof savedKit.restore!=='function')bot.kit.restore(savedKit);
  const visual=createAgentModel(THREE,{bot,team,variant:index,character:bot.kit.character});
  Object.assign(bot,{visual,group:visual.group,meshes:visual.meshes,muzzle:visual.muzzle});
  const side=team===match?.attackerTeam?'attack':'defend';
  bot.group.rotation.y=(map.spawnYaw?.[side]??(side==='attack'?0:Math.PI))+Math.PI;
  bot.group.position.set(spawn.x,bot.y,spawn.z);botsGroup.add(bot.group);bots.push(bot);
  visual.update(0,{...agentEquipment(bot),time:elapsed,alive:bot.alive});
}
function clearBots() {
  spectatedBot=null;
  for(const bot of bots)bot.visual.dispose();
  bots.length=0;
}
function spawnRound(reset=false) {
  deathView.reset();syncDeathUI();
  resetTraffic();
  victoryMusic.stop();lastRoundAudio='';
  fullComboTracker.reset();delete $('round-banner').dataset.roundResult;
  clearCombatInput();
  resetDetonation();
  resetTakeover();
  resetTeamAbilities();
  clearBots();
  clearDrops();
  syncSmokes([]);player.kit.resetRound({reset});player.dashTimer=0;player.dashVec=null;
  if(reset||!player.alive){inventory={primary:null,secondary:'classic',active:'classic'};player.armor=0;}
  ammoStore={};roundPurchases={};player.alive=true;player.hp=100;reloading=0;round=match.round;timeLeft=match.phaseTime;
  const positions=match.side==='attack'?map.teamSpawns.attack:map.teamSpawns.defend;
  player.x=positions[0].x;player.z=positions[0].z;player.y=0;player.vy=0;player.vx=0;player.vz=0;
  player.yaw=map.spawnYaw?.[match.side]??(match.side==='attack'?0:Math.PI);player.pitch=0;player.recoil=0;renderedRecoil=0;resetMouseLook();
  player.dash=1;player.scan=1;scanTime=0;roundWait=0;shotSequence=0;lastShot=-10;
  stepClock=0;
  targetSite=null;
  updateBots.tactics||=createBotTactics({sites:map.sites,navigation,collision:map.collision,lanes:map.lanes,attackSpawn:map.teamSpawns.attack[0],defendSpawn:map.teamSpawns.defend[0]});
  updateBots.tactics.reset(match.round);
  for(const record of roster){
    if(record.id==='player')continue;
    if(reset){record.credits=match.overtime?5000:800;record.primary=null;record.secondary='classic';record.armor=0;}
    if(!record.survived){record.primary=null;record.secondary='classic';record.armor=0;}
    if(!record.memberId||record.netFallback)autoBuyBot(record);
    record.kit||=new DuelistKit({character:record.memberId?'duelist':characterIds[(Number(record.id.split('-')[1])+(record.team==='red'?4:0))%characterIds.length]});
    record.kit.resetRound({reset});
    if(record.memberId)record.netPurchases={};
    const attack=record.team===match.attackerTeam;
    const points=attack?map.teamSpawns.attack:map.teamSpawns.defend;
    const index=Number(record.id.split('-')[1]);
    makeBot(points[index],index,record.team,record);
    const actor=bots[bots.length-1];if(record.memberId){actor.kit=record.kit;actor.remoteId=record.netFallback?null:record.memberId;actor.netYaw=actor.group.rotation.y-Math.PI;actor.netAmmo=(WEAPONS[record.primary||record.secondary]||WEAPONS.classic).mag;actor.netReserve=(WEAPONS[record.primary||record.secondary]||WEAPONS.classic).reserve;actor.netWeapon=record.primary||record.secondary;actor.lastNetShot=-10;actor.lastNetInput=elapsed;}
  }
  equip(inventory.primary||inventory.secondary,true);setVisible('spectator-hint',false);setVisible('round-banner',false);
  const area=map.buyAreas?.[match.side];buyBarrier.visible=!exploring&&!!area;
  if(area){buyBarrier.position.set(area.x,2,area.z);buyBarrier.scale.set(area.radius,1,area.radius);}
  showMessage('購入フェーズ',`ROUND ${String(match.round).padStart(2,'0')} · ${sideNames[match.side]} · Bで購入`,3);
  updateHUD();
}
function autoBuyBot(r){
  r.secondary||='classic';
  const roleGuns=['vandal','scout','forge','drum','pump','phantom','atlas'],roleGun=roleGuns[(Number(String(r.id).split('-').pop())||0)+(r.team==='red'?2:0)]||'vandal';
  if(!r.primary&&WEAPONS[roleGun].price+1000<=r.credits){r.primary=roleGun;r.credits-=WEAPONS[roleGun].price;}
  else if(!r.primary&&r.credits>=3900){r.primary=r.team==='blue'?'phantom':'vandal';r.credits-=2900;}
  else if(!r.primary&&r.credits>=2000){r.primary='spectre';r.credits-=1600;}
  else if(r.secondary==='classic'&&r.credits>=500){r.secondary='ghost';r.credits-=500;}
  if(r.armor<50&&r.credits>=1000){r.armor=50;r.credits-=1000;}
  else if(r.armor<25&&r.credits>=400){r.armor=25;r.credits-=400;}
  if(['duelist','nope','mend','echo','veil','ember','frost','duck','cat','car','nobi','japan','cap','urchin','onnara'].includes(r.kit?.character))for(const key of ['c','q'])while(r.kit.buy(key,price=>{if(r.credits<price)return false;r.credits-=price;return true;})){}
}
function setVisible(id,visible) { if($(id))$(id).hidden=!visible; if(visible&&(id==='menu'||id==='result'))keyboardProtection.release(); if(id==='menu'||id==='online-overlay'||id==='online-lobby')characterPicker.sync(); }
function clearCombatInput(){duckAim=null;
  keys.clear();firing=false;aiming=false;interactionHeld=false;touchMove={x:0,y:0};touchLook=null;movePointer=null;
  const movePad=$('move-pad');if(movePad){movePad.style.setProperty('--stick-x','0px');movePad.style.setProperty('--stick-y','0px');}
  setVisible('interaction',false);resetMouseLook();
}
function requestLock() {
  resetMouseLook();
  if(document.fullscreenElement&&!keyboardProtection.pending&&keyboardProtection.state!=='protected')void keyboardProtection.enable();
  if (navigator.maxTouchPoints>0 && matchMedia('(pointer:coarse)').matches) return;
  pointerRequested=true;
  try { const p=canvas.requestPointerLock(); if(p?.catch)p.catch(()=>{inputActive=true;showMessage('MOUSE LOOK','マウスを動かすだけで視点を操作できます',3);}); } catch { inputActive=true; }
}
function selectArena(id){
  id=normalizeMapId(id);if((map.id||'hashimoto')===id){updateMapLabels();return;}
  map.traffic?.reset();map.world?.removeFromParent();
  if(!arenaCache.has(id))arenaCache.set(id,createMap(THREE,environment,id));
  map=arenaCache.get(id);environment.add(map.world);navigation=createNavigation({...map,bounds:map.combatBounds||map.bounds});updateBots.tactics=null;nopeDecoyTownCandidates=null;
  environment.traverse(object=>{for(const material of Array.isArray(object.material)?object.material:[object.material])if(material?.map)material.map.anisotropy=textureFiltering;});
  map.world.updateMatrixWorld(true);updateMapLabels();
}
function activeArenaBounds(){return exploring&&!onlinePlaying?map.bounds:map.combatBounds||map.bounds;}
function updateMapLabels(){
  const name=map.name||'橋本駅',short=map.shortName||'HASHIMOTO',viewBounds=activeArenaBounds();
  const copies={'mission-map':name+' 爆破・電源オフ作戦','menu-map-name':name+'前','character-preview-map':name+'前','hud-map-name':short+' STATION','map-title':name+' / 戦術マップ','map-area-name':name+' · '+(viewBounds.maxX-viewBounds.minX)+'m × '+(viewBounds.maxZ-viewBounds.minZ)+'m','map-route-copy':map.id==='hirakata'?'屋内A / 屋内B / MID横挟みルート':'バス通り / 中央連絡路 / ミウィ通り'};
  copies['map-site-a-name']=map.sites[0].name;copies['map-site-b-name']=map.sites[1].name;copies['map-detail']=map.id==='hirakata'?'対戦は従来の164m四方。マップ練習では周辺224m四方も探索できます。車道の京阪バスに注意。':'橋本駅前の景観をもとに構成したオリジナルマップです。';
  copies['map-coordinate-copy']=copies['menu-coordinate-copy']=map.id==='hirakata'?'34.815°N / 135.649°E':'35°35′42″N / 139°20′42″E';copies['menu-map-note']=map.id==='hirakata'?'枚方市駅 / 南北広場・自由通路・駅周辺街区':'非公式ファンメイド / 橋本駅前をモチーフにしたオリジナルマップ';copies['radar-map-copy']=short+' / 2 SITES';
  canvas.setAttribute('aria-label',name+'の3D競技マップ');$('large-minimap')?.setAttribute('aria-label',name+'の戦術マップ');
  for(const[id,text]of Object.entries(copies))if($(id))$(id).textContent=text;
  for(const id of ['map-select','online-map'])if($(id)&&(!online||id==='map-select'))$(id).value=map.id||'hashimoto';
  if($('start-subtitle'))$('start-subtitle').textContent=(['explore','range','plant','defuse'].includes($('match-format')?.value)?'PRACTICE IN ':'DEPLOY TO ')+short;
}
function resetTraffic(){map.traffic?.reset();for(const actor of [player,...bots])actor.trafficLaunch=null;}
function updateTraffic(dt){
  map.busModels?.update(elapsed);if(!map.traffic)return;
  const actors=[player,...bots];
  if(!isGuest()){
    for(const hit of map.traffic.impacts(actors,elapsed,{enabled:match.phase==='live'})){
      const actor=actors.find(a=>a.id===hit.actorId);actor.trafficLaunch={seq:hit.sequence,endsAt:hit.endsAt,vx:hit.vx,vz:hit.vz,vy:hit.vy};actor.vy=hit.vy;actor.dashTimer=0;actor.vx=0;actor.vz=0;actor.path=[];actor.planAt=0;
      cancelServiceReload(actor);match.cancelPlant(actor.id);match.cancelDefuse(actor.id);damageEntity(actor,hit.damage,null);
      if(actor===player){damageFlash=.55;showMessage('京阪バスと接触','100ダメージ · 車道から離れてください',3);}
    }
  }
  for(const actor of actors){const hit=actor.trafficLaunch;if(!hit)continue;
    // Remote victims follow the host snapshot; their client only predicts itself.
    if(isGuest()&&actor!==player)continue;
    if(match.phase!=='live'&&!(match.phase==='post'&&!actor.alive)){actor.trafficLaunch=null;continue;}
    if(elapsed<hit.endsAt)moveEntity(actor,hit.vx*dt,hit.vz*dt,actor===player?.34:.4);
    // Living vertical physics already ran once. Dead bodies still fly and land.
    if(!actor.alive||actor.remoteId&&!isGuest())updateActorVertical(actor,dt,actor===player?.34:.4);
    if(elapsed>=hit.endsAt&&(actor.alive||actor.vy===0))actor.trafficLaunch=null;
    if(actor.group){actor.group.position.set(actor.x,actor.y,actor.z);if(!actor.alive){actor.death=Math.max(actor.death||0,hit.endsAt-elapsed+.2);actor.group.visible=true;}}
  }
}
function startGame() {
  deathView.reset();
  victoryMusic.reset();
  player.kit=new DuelistKit({character:selectedCharacter()});netCharacterRequested=false;
  if(onlinePlaying&&mode!=='menu'){leaveOnline();return;}
  if(online&&!onlinePlaying){online.close(true);online=null;}
  selectArena(onlinePlaying?online.room.settings.mapId:$('map-select')?.value);resetTraffic();
  netHostPaused=false;syncSmokes([]);scene.fog.near=145;scene.fog.far=380;scene.fog.color.set('#b7d0dd');
  player.id='player';player.team='blue';
  audioInit();difficulty=$('difficulty')?.value||'normal';
  round=1;totalKills=0;shots=0;hits=0;elapsed=0;lastShot=-10;
  player.recoil=0;scanTime=0;kick=0;hitFlash=0;reloading=0;redLossStreak=0;
  const selectedFormat=$('match-format')?.value||'standard';
  rangeSession=selectedFormat==='range'?new RangeSession():null;rangeRespawn=0;
  objectivePractice=['plant','defuse'].includes(selectedFormat)?{kind:selectedFormat,site:'A',completed:false,elapsed:0,duration:0}:null;
  exploring=selectedFormat==='explore'||!!rangeSession||!!objectivePractice;
  navigation=createNavigation({...map,bounds:activeArenaBounds()});updateBots.tactics=null;nopeDecoyTownCandidates=null;updateMapLabels();
  match=new MatchRules({format:exploring?'standard':selectedFormat,startingSide:objectivePractice?(selectedFormat==='plant'?'attack':'defend'):$('starting-side')?.value||'attack'});
  if($('economy-note'))$('economy-note').textContent=match.format==='swift'?'SWIFT · ROUND GRANTS SC 2,400 / 4,250  +  ELIMINATION SC 200':'WIN SC 3,000  +  ELIMINATION SC 200';
  inventory={primary:null,secondary:'classic',active:'classic'};player.armor=0;player.alive=true;
  roster=[{id:'player',team:'blue',name:'YOU',k:0,d:0,a:0,credits:800},...Array.from({length:9},(_,i)=>({id:i<4?`blue-${i+1}`:`red-${i-4}`,team:i<4?'blue':'red',name:originalNames[i+1],k:0,d:0,a:0,credits:800,primary:null,secondary:'classic',armor:0,survived:false}))];
  if(exploring)roster=roster.slice(0,1);
  if(onlinePlaying){
    const blue=online.room.members.filter(m=>m.team==='blue'),red=online.room.members.filter(m=>m.team==='red');
    const hostIndex=blue.findIndex(m=>m.id===online.room.hostId);if(hostIndex>0)[blue[0],blue[hostIndex]]=[blue[hostIndex],blue[0]];
    netParticipants.clear();
    for(const [team,members] of [['blue',blue],['red',red]])members.forEach((member,index)=>{const id=team==='blue'?(index===0?'player':`blue-${index}`):`red-${index}`;netParticipants.set(member.id,id);const record=roster.find(r=>r.id===id);if(record){record.memberId=member.id;record.name=member.name;}});
  }
  mode='play';inputActive=true;clearCombatInput();damageFlash=0;
  for(const id of ['menu','result','pause-menu','map-overlay','shop-overlay','scoreboard','interaction','range-result'])setVisible(id,false);setVisible('hud',true);
  $('killfeed').replaceChildren();gun.visible=true;
  spawnRound(true);
  if(isGuest()){player.id=netParticipants.get(online.session.memberId);player.team=online.room.members.find(m=>m.id===online.session.memberId)?.team||'red';clearBots();netHasSnapshot=false;gun.visible=false;setVisible('hud',false);$('loading-text').textContent='ホストの試合状態を受信しています…';setVisible('loading',true);}
  else setVisible('loading',false);
  if(exploring){
    match.startLive();match.drainEvents();match.credits=9000;inventory.primary='vandal';equip('vandal',true);buyBarrier.visible=false;
    player.kit.ultPoints=7;player.kit.smoke=getCharacterSkill(player.kit.character,'c').max;player.kit.updraft=getCharacterSkill(player.kit.character,'q').max;
    const entry=map.landmarks?.find(l=>l.id==='north');if(entry)relocate(entry);
    if(objectivePractice)resetObjectivePractice('A');
    else if(rangeSession){
      relocate(map.rangeArea?.spawn||{x:-20.75,z:-25.5,yaw:0});spawnRangeTarget();
      showMessage('AIM DRILL / 60秒','標的を撃破して次へ · 頭で撃破150点 / 胴で撃破100点 · Bで武器選択',5);
    }else showMessage((map.shortName||'HASHIMOTO')+' / マップ練習','時間制限なし · Mでルート確認・地点移動 · Bで武器選択',5);
  }
  updateTravelButtons();requestLock();updateHUD();
}
function pauseGame(showMap=false) {
  victoryMusic.stop();
  if(!['play','shop','map','score'].includes(mode)) return;
  pausedFrom='play';mode=showMap?'map':'pause';clearCombatInput();
  if(document.pointerLockElement) document.exitPointerLock();
  setVisible('shop-overlay',false);setVisible('scoreboard',false);
  setVisible(showMap?'map-overlay':'pause-menu',true);
  if(showMap)drawMinimap($('large-minimap'),true);
}
function resumeGame() {
  if(!['pause','map','shop','score'].includes(mode))return;
  clearCombatInput();mode='play';for(const id of ['pause-menu','map-overlay','shop-overlay','scoreboard'])setVisible(id,false);audioInit();requestLock();
}
function backMenu() {
  fullComboTracker.reset();
  deathView.reset();syncDeathUI();
  resetTraffic();victoryMusic.reset();
  if(online){leaveOnline();return;}
  netHostPaused=false;syncSmokes([]);scene.fog.near=145;scene.fog.far=380;scene.fog.color.set('#b7d0dd');
  updateFormatSummary();
  mode='menu';clearCombatInput();gun.visible=false;spikeModel.visible=false;setVisible('loading',false);clearDrops();resetDetonation();resetTakeover();resetTeamAbilities();
  rangeSession=null;rangeRespawn=0;objectivePractice=null;exploring=false;
  navigation=createNavigation({...map,bounds:activeArenaBounds()});updateBots.tactics=null;updateMapLabels();
  clearBots();for(const id of ['hud','result','pause-menu','shop-overlay','scoreboard','map-overlay'])setVisible(id,false);setVisible('menu',true);buyBarrier.visible=false;
  if(document.pointerLockElement)document.exitPointerLock();
}
function finish(won) {
  deathView.reset();syncDeathUI();
  resetTeamAbilities();
  if(!match||mode==='result')return;mode='result';clearCombatInput();reloading=0;gun.visible=false;buyBarrier.visible=false;
  if(document.pointerLockElement)document.exitPointerLock();
  for(const id of ['hud','shop-overlay','scoreboard','map-overlay'])setVisible(id,false);setVisible('result',true);
  $('result-title').textContent=won?'開米':'閉米';
  $('result-title').classList.add('japanese-result');
  $('result-title').classList.toggle('defeat',!won);
  $('result-description').textContent=`${match.score.blue} — ${match.score.red} · ${match.format==='swift'?'スイフト':'スタンダード'} · ${map.name||'橋本駅'}の試合が終了しました。`;
  $('result-kills').textContent=totalKills;
  $('result-accuracy').textContent=`${shots?Math.round(hits/shots*100):0}%`;
  $('result-time').textContent=formatTime(elapsed);
  sound(won?'match-win':'match-loss');
}
function spawnRangeTarget(){
  clearBots();
  const candidates=(map.rangeArea?.targets||[-25.8,-22,-18,-16].flatMap(x=>[-37,-45,-53].map(z=>({x,z})))).filter(point=>
    navigation.isWalkable(point.x,point.z)&&map.collision.rayClear(player.x,player.y+1.5,player.z,point.x,1.5,point.z));
  if(!candidates.length){
    relocate(map.rangeArea?.spawn||{x:-20.75,z:-25.5,yaw:0});
    candidates.push(...(map.rangeArea?.targets||[{x:-20.75,z:-42}]).filter(point=>navigation.isWalkable(point.x,point.z)));
  }
  const point=candidates[rangeSession.nextTarget(candidates.length)];
  if(!point)return;
  makeBot(point,0,'red',{id:'range-target',name:'TRAINING TARGET',armor:0,secondary:'classic',k:0,d:0,a:0,credits:0});
  const target=bots[0];target.rangeTarget=true;target.group.rotation.y=Math.atan2(player.x-target.x,player.z-target.z);rangeRespawn=0;
}
function finishRange(){
  if(!rangeSession||mode==='result')return;
  resetTeamAbilities();
  const result=rangeSession.summary();let best=0;
  try{best=Math.max(0,Math.min(1000000,Number(localStorage.getItem('hashimoto-range-best'))||0));if(result.score>best)localStorage.setItem('hashimoto-range-best',String(result.score));}catch{}
  mode='result';keys.clear();firing=false;aiming=false;gun.visible=false;clearBots();
  if(document.pointerLockElement)document.exitPointerLock();
  for(const id of ['hud','pause-menu','shop-overlay','scoreboard','map-overlay','interaction'])setVisible(id,false);
  setVisible('result',true);setVisible('range-result',true);
  $('result-title').classList.remove('japanese-result','defeat');$('result-title').textContent='DRILL COMPLETE';$('result-description').textContent='橋本駅コンコース / 60秒の射撃訓練';
  $('result-kills').textContent=result.kills;$('result-accuracy').textContent=`${result.accuracy}%`;$('result-time').textContent='01:00';
  $('range-score').textContent=result.score.toLocaleString();$('range-head-rate').textContent=`${result.headRate}%`;
  $('range-best').textContent=Math.max(best,result.score).toLocaleString();$('range-best-note').textContent=result.score>best?'NEW PERSONAL BEST':'自己ベストに挑戦';sound('kill');
}
let messageTimeout;
function showMessage(title,description='',seconds=2) {
  const node=$('message');node.replaceChildren();
  const strong=document.createElement('strong');strong.textContent=title;node.append(strong);
  if(description){const small=document.createElement('small');small.textContent=description;node.append(small);}
  node.classList.add('visible');clearTimeout(messageTimeout);messageTimeout=setTimeout(()=>node.classList.remove('visible'),seconds*1000);
}
function feed(text) {
  const item=document.createElement('div');item.className='feed-item';item.textContent=text;$('killfeed').prepend(item);
  while($('killfeed').children.length>4)$('killfeed').lastElementChild.remove();
  setTimeout(()=>item.remove(),5500);
}
function formatTime(t){return `${String(Math.floor(Math.max(0,t)/60)).padStart(2,'0')}:${String(Math.floor(Math.max(0,t)%60)).padStart(2,'0')}`;}
function relocate(point){
  const upper=Number.isFinite(point.y)&&point.y>0,safe=upper&&canStand(point.x,point.z,.34,point.y)?point:upper?null:navigation.nearest(point.travelX??point.x,point.travelZ??point.z);if(!safe)return false;
  player.x=safe.x;player.z=safe.z;player.y=upper?point.y:0;player.vy=0;player.vx=0;player.vz=0;player.trafficLaunch=null;player.pitch=0;player.recoil=0;renderedRecoil=0;
  if(Number.isFinite(point.yaw))player.yaw=point.yaw;resetMouseLook();return true;
}
function resetObjectivePractice(siteId='A'){
  if(!objectivePractice||!['A','B'].includes(siteId))return false;
  const site=map.sites.find(s=>s.id===siteId),point=getSitePlantPosition(site,player.x,player.z,{preferredId:`${siteId}-open`,collision:map.collision});
  if(!point)return false;
  const kind=objectivePractice.kind;
  objectivePractice={kind,site:siteId,completed:false,elapsed:0,duration:0};
  clearCombatInput();reloading=0;clearDrops();resetDetonation();resetTakeover();
  match=new MatchRules({format:'standard',startingSide:kind==='plant'?'attack':'defend'});
  match.startLive();match.credits=9000;match.drainEvents();
  player.hp=100;player.armor=0;player.alive=true;player.crouch=0;player.dashTimer=0;player.dashVec=null;
  relocate({...point,yaw:0});
  if(kind==='defuse'){
    match.interactPlant(4,{actorId:'red-0',team:match.attackerTeam,site:siteId,x:point.x,z:point.z,stationary:true});
    match.drainEvents();
    const positions=[[0,1.4],[1.4,0],[0,-1.4],[-1.4,0]];
    for(const [dx,dz] of positions){const safe=navigation.nearest(point.x+dx,point.z+dz);if(safe&&Math.hypot(safe.x-point.x,safe.z-point.z)>=.8&&Math.hypot(safe.x-point.x,safe.z-point.z)<2.1&&map.collision.rayClear(safe.x,1.2,safe.z,point.x,.4,point.z)){relocate(safe);break;}}
    player.yaw=Math.atan2(player.x-point.x,player.z-point.z);player.pitch=-.64;
  }
  inventory.active='vandal';equip('vandal',true);buyBarrier.visible=false;setVisible('round-banner',false);
  objectiveModel.update({time:elapsed,status:'hidden',practice:true});
  objectiveModel.update({time:elapsed,...match.spike,practice:true});spikeModel.position.set(match.spike.x,0,match.spike.z);
  showMessage(`${siteId} / ${kind==='plant'?'設置練習':'電源オフ練習'}`,kind==='plant'?'止まって F を4秒長押し · MでA/Bを切替':'F を7秒長押し · 3.5秒で進捗50%を保存 · 起爆なし',4);
  updateHUD();return true;
}
function updateObjectivePractice(dt){
  if(!objectivePractice)return;
  if(!objectivePractice.completed)objectivePractice.elapsed+=dt;
  const event=match.drainEvents().find(e=>e.type===(objectivePractice.kind==='plant'?'planted':'defused'));
  if(event&&!objectivePractice.completed){
    objectivePractice.completed=true;objectivePractice.duration=objectivePractice.elapsed;
    clearCombatInput();sound(objectivePractice.kind==='plant'?'plant':'defuse');
    showMessage(objectivePractice.kind==='plant'?'設置成功':'電源オフ成功',`${objectivePractice.site} サイト · MからA/Bでもう一度 · 自由に近くで確認できます`,6);
  }
}
function startCharacterTrial(){
  if(!exploring||rangeSession||objectivePractice||onlinePlaying)return false;
  clearCombatInput();clearBots();clearDrops();syncSmokes([]);resetTeamAbilities();resetTakeover();resetDetonation();
  relocate(map.rangeArea?.spawn||{x:-20.75,z:-25.5,yaw:0});
  player.kit.resetRound();player.kit.ultPoints=7;player.kit.smoke=getCharacterSkill(player.kit.character,'c').max;player.kit.updraft=getCharacterSkill(player.kit.character,'q').max;
  player.hp=player.kit.character==='mend'?40:100;player.armor=0;player.alive=true;
  const support=player.kit.character==='mend',points=map.rangeArea?.targets||[];
  for(let index=0;index<(support?2:3)&&index<points.length;index++){
    const team=support?player.team:(player.team==='blue'?'red':'blue'),character=characterIds[(characterIds.indexOf(player.kit.character)+index)%characterIds.length];
    const record={id:`trial-${index}`,team,name:`${CHARACTER_DEFS[character].label} / 練習`,k:0,d:0,a:0,credits:0,secondary:'classic',kit:new DuelistKit({character})};
    makeBot(points[index],index,team,record);const target=bots.at(-1);target.rangeTarget=true;target.hp=support?35+index*25:100;target.group.rotation.y=0;
    if(['cat','car','nobi','japan','urchin','onnara'].includes(player.kit.character)){target.aiWeapon='classic';target.aiAmmo=WEAPONS.classic.mag;target.aiReserve=WEAPONS.classic.reserve;target.aiReload=0;}
    if(player.kit.character==='japan')target.armor=50;
  }
  if(player.kit.character==='urchin'){match.credits=800;for(const b of bots){b.record.primary='spectre';b.aiWeapon='spectre';b.aiAmmo=18;b.aiReserve=40;}}
  if(player.kit.character==='cap'&&bots[0])ordinarySkills.cast('cap-lock',ordinaryActorView(bots[0]),{...ordinaryActorView(player),targetId:player.id},elapsed,match.round);
  if(player.kit.character==='cat')addDrop({id:++dropSequence,weapon:'ghost',x:player.x,z:player.z-6,yaw:0,ammo:9,reserve:12});
  resumeGame();updateHUD();
  showMessage(`${CHARACTER_DEFS[player.kit.character].label} / スキル試用`,support?'X：自身と負傷した味方を回復 · Mから何度でもやり直せます':'X：固有ULTを試す · Mから何度でもやり直せます',5);
  return true;
}
function updateTravelButtons(){
  const container=$('landmark-travel');if(!container)return;container.replaceChildren();
  if(objectivePractice){for(const siteId of ['A','B']){const button=document.createElement('button');button.type='button';button.textContent=`${siteId}でやり直す`;button.addEventListener('click',()=>{if(resetObjectivePractice(siteId))resumeGame();});container.append(button);}return;}
  for(const landmark of map.landmarks||[]){const button=document.createElement('button');button.type='button';button.textContent=landmark.name;button.disabled=!exploring;button.title=exploring?'この地点から練習':'マップ練習モードで移動できます';
    button.disabled=!exploring||!!rangeSession;
    button.addEventListener('click',()=>{if(!exploring||rangeSession)return;if(relocate(landmark)){resumeGame();showMessage(landmark.name,'Mでルート確認 · Bで武器選択',2);}});container.append(button);
  }
  const demo=document.createElement('button');demo.type='button';demo.textContent='大爆発デモ';demo.disabled=!exploring||!!rangeSession;demo.title='マップ練習で駅全体の起爆演出を試す';
  demo.addEventListener('click',()=>{
    if(!exploring||rangeSession)return;
    if(relocate({x:-23,z:-11,yaw:0})){player.pitch=.24;resumeGame();startDetonation({id:`demo:${elapsed.toFixed(6)}`,round:match.round,startedAt:elapsed,x:-36.5,z:-19.5,seed:73521});showMessage('橋本駅 大爆発','M → 大爆発デモ で繰り返し再生',2);}
  });container.append(demo);
  const recharge=document.createElement('button');recharge.type='button';recharge.textContent='スキル・ULT補充';recharge.disabled=!exploring||!!rangeSession;
  recharge.addEventListener('click',()=>{if(!exploring||rangeSession)return;player.kit.resetRound();player.kit.ultPoints=7;player.kit.smoke=getCharacterSkill(player.kit.character,'c').max;player.kit.updraft=getCharacterSkill(player.kit.character,'q').max;resumeGame();showMessage('SKILLS READY',['c','q','e'].map(key=>`${key.toUpperCase()}：${getCharacterSkill(player.kit.character,key).shortName}`).join(' / ')+' / X：アルティメット',2);});container.append(recharge);
  const trial=document.createElement('button');trial.type='button';trial.textContent='キャラ能力を試す';trial.disabled=!exploring||!!rangeSession;
  trial.addEventListener('click',startCharacterTrial);container.append(trial);
}
function canStand(x,z,r=.34,feet=player.y) {
  const b=activeArenaBounds();
  if(x<b.minX+r||x>b.maxX-r||z<b.minZ+r||z>b.maxZ-r)return false;
  // Ground details under 2 cm are harmless; raised solids require feet above their real top.
  return !map.collision.blocked(x,z,r,feet);
}
function rampFloor(x,z) {
  let floor=null;
  for(const ramp of map.ramps||[]){
    if(x<ramp.minX||x>ramp.maxX||z<ramp.minZ||z>ramp.maxZ)continue;
    const along=ramp.axis==='x'?x:z,min=ramp.axis==='x'?ramp.minX:ramp.minZ,max=ramp.axis==='x'?ramp.maxX:ramp.maxZ;
    const fraction=clamp((along-min)/Math.max(.001,max-min),0,1);
    const height=(ramp.base||0)+ramp.height*(ramp.direction===-1?1-fraction:fraction);
    floor=Math.max(floor??0,height);
  }
  return floor;
}
function moveEntity(entity,dx,dz,r=.34) {
  // Substeps prevent sprint/dash from crossing thin cover at a low frame rate.
  const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.16));
  for(let i=0;i<n;i++){
    const area=entity===player&&!exploring&&match?.phase==='buy'?map.buyAreas?.[ownSide()]:null;
    const permitted=(x,z)=>!area||Math.hypot(x-area.x,z-area.z)<area.radius-r;
    function attempt(x,z){
      if(!permitted(x,z))return;
      const controlled=entity===player||!!entity.remoteId;
      let feet=entity.y||0;
      const ramp=controlled?rampFloor(x,z):null;
      const followsFloor=entity===player?player.vy===0:!!entity.remoteId;
      // Grounded feet may step up; an airborne actor must clear the slope rather
      // than enter just below it and miss the downward landing intersection.
      if(ramp!==null&&ramp>feet+(followsFloor?.22:.00001))return;
      if(followsFloor){
        if(ramp!==null&&Math.abs(ramp-feet)<=.22)feet=ramp;
        // Only ankle-height ledges can be stepped onto; crates still require jumping.
        for(const c of map.collision.query(x,z,r))if(c.height>feet&&c.height<=entity.y+.22&&map.collision.overlaps(c,x,z,r))feet=c.height;
      }
      if(canStand(x,z,r,feet)){entity.x=x;entity.z=z;if(followsFloor)entity.y=feet;}
    }
    attempt(entity.x+dx/n,entity.z);
    attempt(entity.x,entity.z+dz/n);
  }
}
function visibleBetween(a,b) {
  const eye=entity=>(entity.y||0)+1.45-(entity===player?player.crouch*.5:0);
  return !smokeBlocks(a,b)&&map.collision.rayClear(a.x,eye(a),a.z,b.x,eye(b),b.z)&&(!map.traffic||map.traffic.rayClear({x:a.x,y:eye(a),z:a.z},{x:b.x,y:eye(b),z:b.z},elapsed));
}
function safeDropPoint(entity=player){
  const forwardX=-Math.sin(entity.yaw||0),forwardZ=-Math.cos(entity.yaw||0);
  for(let distance=2;distance>=0;distance-=.2){
    const x=entity.x+forwardX*distance,z=entity.z+forwardZ*distance;
    if(navigation.isWalkable(x,z)&&map.collision.rayClear(entity.x,(entity.y||0)+.3,entity.z,x,.15,z))return {x,z};
  }
  const nearest=navigation.nearest(entity.x,entity.z);
  return nearest&&Math.hypot(nearest.x-entity.x,nearest.z-entity.z)<3?nearest:{x:entity.x,z:entity.z};
}
function lineOfSight(x,z){return visibleBetween({x,z},player);}
function tracer(from,to,color='#ffeab0',life=.07) {
  const geometry=new THREE.BufferGeometry().setFromPoints([from,to]);
  const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity:.8}));effectsGroup.add(line);effects.push({object:line,life,max:life});
}
function burst(position,color='#ffac6b',number=7) {
  for(let i=0;i<number;i++){
    const m=new THREE.Mesh(new THREE.BoxGeometry(.045,.045,.045),new THREE.MeshBasicMaterial({color,transparent:true}));m.position.copy(position);effectsGroup.add(m);
    effects.push({object:m,life:.3+Math.random()*.22,max:.52,velocity:new THREE.Vector3((Math.random()-.5)*3,Math.random()*3,(Math.random()-.5)*3)});
  }
}
function shoot(shotTime=elapsed) {
  const spec=weapon();
  if(netHostPaused||mode!=='play'||!player.alive||match?.phase!=='live'||inventory.active==='spike'||interactionHeld||ordinaryFX.throwing(elapsed)||mendSkillFX.throwing(elapsed)||iagnuSkillFX.throwing(elapsed)||grassSkillFX.throwing(elapsed)||emberSkillFX.throwing(elapsed)||frostSkillFX.throwing(elapsed)||duelistSkillFX.throwing(elapsed)||player.serviceReload||reloading>0||shotTime-lastShot+1e-8<nobiShotInterval(spec,player))return;
  const ultimate=player.kit.knivesActive&&inventory.active==='knife',melee=inventory.active==='knife'&&!ultimate;
  if(ultimate&&!player.kit.consumeKnife())return;
  if(!melee&&!ultimate&&player.ammo<=0){reload();return;}
  if(!melee&&!ultimate&&!ordinarySkills.capMagazine(player.id,elapsed))player.ammo--;if(!melee&&!ultimate)crownShot(player);shots++;rangeSession?.recordShot();lastShot=shotTime;kick=melee?.1:.035;shotSequence++;
  if(!ultimate)player.recoil=Math.min(.085,player.recoil+(spec.slot==='primary'?.012:.008));sound('shot');
  camera.position.set(player.x,1.7-player.crouch*.55+player.y,player.z);camera.rotation.set(player.pitch+renderedRecoil,player.yaw,0);
  camera.getWorldDirection(direction);
  if(spec.arsenal){
    if(isGuest())queueNetAction('fire',{yaw:player.yaw,pitch:player.pitch+renderedRecoil,ultimate:false,ads:aiming===true});
    fireArsenal(player,camera.position,direction,spec,aiming,{visualOnly:isGuest()});if(!spec.auto)firing=false;updateHUD();return;
  }
  const moving=Math.hypot(player.vx,player.vz)>1.2;
  const spread=ultimate?0:spec.spread*(aiming?.65:player.crouch>.5?.8:1)+carMovementSpread({airborne:!actorGrounded(player),moving,gyro:ordinarySkills.carGyro(player.id,elapsed)&&actorGrounded(player)})+Math.min(.04,Math.max(0,shotSequence-3)*.004);
  direction.x+=(Math.random()-.5)*spread;direction.y+=(Math.random()-.5)*spread;direction.normalize();
  if(!ultimate&&shotSequence>3)direction.x+=Math.sin(shotSequence*1.8)*.008;
  direction.normalize();if(!melee&&!ultimate)capDistortAim(player,direction);raycaster.set(camera.position,direction);raycaster.far=melee?2.2:120;
  if(isGuest())queueNetAction('fire',{yaw:player.yaw,pitch:player.pitch+renderedRecoil,ultimate});
  // A target can spawn between rendered frames, including while the trigger is held.
  botsGroup.updateMatrixWorld(true);
  const targets=raycaster.intersectObjects([environment,botsGroup],true).filter(h=>!h.object.userData.bot||h.object.userData.bot.alive);
  const hit=targets[0],fake=!melee?raycastNopeDecoy(camera.position,direction,hit?.distance??120,player.team):null;
  const shield=!melee?ordinarySkills.interceptShield(camera.position,direction,fake?.distance??hit?.distance??120,spec.body||1,elapsed,match.round,{consume:!isGuest()}):null;
  const to=shield?new THREE.Vector3(shield.point.x,shield.point.y,shield.point.z):fake?.point||hit?.point||camera.position.clone().addScaledVector(direction,90);
  const muzzle=new THREE.Vector3();viewmodel.muzzle.getWorldPosition(muzzle);if(!melee)tracer(muzzle,to);
  if(shield){burst(to,'#f8dc72',4);}
  else if(fake){if(!isGuest())hitNopeDecoy(fake.event,player);}
  else if(hit){
    const bot=hit.object.userData.bot;
    if(bot&&bot.alive&&bot.team!==player.team&&!isGuest()){
      hits++;const head=hit.object.userData.head;let damage=nobiBulletDamage(player,bot,head?spec.head:hit.point.y-(bot.y||0)<.7?spec.leg:spec.body,spec.head,!melee&&!ultimate);
      if(['phantom','spectre','ghost','classic'].includes(inventory.active)&&hit.distance>15)damage*=hit.distance>30?.8:.9;
      damageEntity(bot,damage,player,{firearm:!melee&&!ultimate,skill:ultimate?'duelist':null});hitFlash=.14;burst(hit.point,head?'#fff3c8':'#ff737e',5);sound('hit');
      if(rangeSession&&bot.rangeTarget)rangeSession.recordHit({head,eliminated:!bot.alive});
    }else{burst(hit.point,'#f9ce9a',4);if(!melee&&!ultimate)capBounceShot(player,camera.position,direction,hit,spec);}
  }
  if(!melee&&!ultimate)urchinTridentShot(player,camera.position,direction,spec);
  if(!spec.auto)firing=false;
  raycaster.far=190;updateHUD();
}
// Shared by local host, remote actions and BOTs. Geometry, stock, cadence and
// damage remain host owned; the network carries only the trigger and aim.
function fireArsenal(actor,origin,aim,spec,ads=false,{visualOnly=false}={}){
  const id=actor===player?inventory.active:actor.netWeapon||actor.aiWeapon;
  const moving=actor===player?Math.hypot(player.vx,player.vz)>1.2:!!actor.moving||!!actor.remoteMoving;
  const sequence=actor===player?shotSequence:actor.shotSequence||1;
  const forward=capDistortAim(actor,aim.clone().normalize()),right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
  const up=new THREE.Vector3().crossVectors(right,forward).normalize(),totals=new Map();
  botsGroup.updateMatrixWorld(true);
  const targets=[environment,botsGroup];
  let anyHit=false,headHit=false,bounced=false;
  for(const offset of shotPattern(id,{ads,moving,airborne:!actorGrounded(actor),sequence})){
    const dir=forward.clone().addScaledVector(right,offset.x).addScaledVector(up,offset.y).normalize();
    const ray=new THREE.Raycaster(origin,dir,0,120);
    const hit=ray.intersectObjects(targets,true).find(h=>h.object.userData.bot!==actor&&(!h.object.userData.bot||h.object.userData.bot.alive));
    let target=hit?.object.userData.bot,point=hit?.point,part=hit?.object.userData.head?'head':point&&target&&point.y-(target.y||0)<.7?'leg':'body',nearest=hit?.distance??120;
    if(actor!==player&&player.alive){
      const crouch=player.crouch*.55;
      const head=ray.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(player.x,1.62+player.y-crouch,player.z),.19),new THREE.Vector3());
      const body=ray.ray.intersectBox(new THREE.Box3(new THREE.Vector3(player.x-.28,.4+player.y,player.z-.28),new THREE.Vector3(player.x+.28,1.45+player.y-crouch,player.z+.28)),new THREE.Vector3());
      for(const [p,zone] of [[head,'head'],[body,'body']])if(p&&origin.distanceTo(p)<nearest){target=player;point=p;part=zone==='body'&&p.y-player.y<.7?'leg':zone;nearest=origin.distanceTo(p);}
    }
    const fake=raycastNopeDecoy(origin,dir,nearest,actor.team);
    const shield=ordinarySkills.interceptShield(origin,dir,fake?.distance??nearest,weaponDamage(id,'body',fake?.distance??nearest),elapsed,match.round,{consume:!visualOnly});
    const end=shield?new THREE.Vector3(shield.point.x,shield.point.y,shield.point.z):fake?.point||point||origin.clone().addScaledVector(dir,90);
    tracer(origin,end,actor.team==='blue'?'#a5eee0':'#ff7b76',.07);
    if(shield){burst(end,'#f8dc72',2);continue;}
    if(fake){if(!visualOnly)hitNopeDecoy(fake.event,actor);continue;}
    if(target?.alive&&target.team!==actor.team){
      const damage=nobiBulletDamage(actor,target,weaponDamage(id,part,nearest),weaponDamage(id,'head',nearest),true);
      totals.set(target,(totals.get(target)||0)+damage);anyHit=true;headHit||=part==='head';
      burst(end,part==='head'?'#fff3c8':'#ff737e',2);
    }else if(hit&&!visualOnly&&!bounced){capBounceShot(actor,origin,dir,hit,spec);bounced=true;}
  }
  // Apply one damage event per victim per cartridge, so kill awards, reflection
  // and chain reactions cannot multiply by pellet count.
  if(!visualOnly)for(const [target,damage] of totals){damageEntity(target,damage,actor,{firearm:true});if(actor===player&&rangeSession&&target.rangeTarget)rangeSession.recordHit({head:headHit,eliminated:!target.alive});}
  if(actor===player&&anyHit){hits++;hitFlash=.14;sound('hit');}
  if(!visualOnly)urchinTridentShot(actor,origin,forward,spec);
}
function reload(){
  if(ordinarySkills.urchinJammed(player.id,elapsed))return;
  const spec=weapon();if(netHostPaused||mode!=='play'||!player.alive||interactionHeld||inventory.active==='spike'||!spec.mag||reloading||player.ammo===spec.mag||player.reserve<=0||player.serviceReload)return;
  if(isGuest())queueNetAction('reload');
  reloading=spec.reload;firing=false;sound('reload');
}
function serializeSmokes(){return smokes.map(s=>({id:s.id,x:s.x,y:s.y,z:s.z,expires:s.expires,kind:s.kind,radius:s.radius}));}
let smokeTexture=null,smokeGeometry=null,veilGeometry=null;
function cloudTexture(){
  if(smokeTexture)return smokeTexture;
  const surface=document.createElement('canvas');surface.width=256;surface.height=128;const ctx=surface.getContext('2d');ctx.fillStyle='#9db5c3';ctx.fillRect(0,0,256,128);
  let seed=173;for(let i=0;i<80;i++){seed=(seed*16807)%2147483647;const x=seed%256;seed=(seed*16807)%2147483647;const y=seed%128,radius=12+seed%28;for(const shift of [-256,0,256]){if(x+shift+radius<0||x+shift-radius>256)continue;const g=ctx.createRadialGradient(x+shift,y,0,x+shift,y,radius);g.addColorStop(0,i%2?'#e3eef474':'#536d7a66');g.addColorStop(1,i%2?'#e3eef400':'#536d7a00');ctx.fillStyle=g;ctx.fillRect(x+shift-radius,y-radius,radius*2,radius*2);}}
  smokeTexture=new THREE.CanvasTexture(surface);smokeTexture.colorSpace=THREE.SRGBColorSpace;smokeTexture.wrapS=THREE.RepeatWrapping;return smokeTexture;
}
function syncSmokes(values=[]){
  const valid=[],seen=new Set();
  for(const value of Array.isArray(values)?values:[]){
    if(!value||![value.id,value.x,value.y,value.z,value.expires].every(Number.isFinite)||!Number.isSafeInteger(value.id)||value.id<0||value.expires<0||Math.max(Math.abs(value.x),Math.abs(value.y),Math.abs(value.z))>1000||seen.has(value.id))continue;
    const kind=value.kind===undefined?'smoke':value.kind,radius=kind==='veil'?9:3.6;
    if(!['smoke','veil'].includes(kind)||value.radius!==undefined&&value.radius!==radius)continue;
    valid.push({id:value.id,x:value.x,y:value.y,z:value.z,expires:value.expires,kind,radius});seen.add(value.id);if(valid.length===20)break;
  }
  for(let i=smokes.length-1;i>=0;i--)if(!valid.some(s=>s.id===smokes[i].id)){const old=smokes.splice(i,1)[0];scene.remove(old.mesh);old.mesh.material.dispose();}
  for(const value of valid){
    let s=smokes.find(s=>s.id===value.id);
    const geometry=value.kind==='veil'?(veilGeometry||=new THREE.SphereGeometry(3.6,64,40)):(smokeGeometry||=new THREE.SphereGeometry(3.6,36,24));
    if(!s){const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map:cloudTexture(),roughness:1,metalness:0,transparent:true,opacity:.98,side:THREE.DoubleSide}));s={...value,mesh};scene.add(mesh);smokes.push(s);}
    s.mesh.geometry=geometry;
    Object.assign(s,value);s.mesh.position.set(s.x,s.y,s.z);s.mesh.scale.setScalar(s.radius/3.6);s.mesh.material.color.set(s.kind==='veil'?'#77718f':'#c9dce7');
  }
  if(!smokes.some(s=>s.kind==='smoke')&&smokeGeometry){smokeGeometry.dispose();smokeGeometry=null;}
  if(!smokes.some(s=>s.kind==='veil')&&veilGeometry){veilGeometry.dispose();veilGeometry=null;}
}
function updateSmokeAppearance(time){
  for(const s of smokes){s.mesh.rotation.y=time*.13;s.mesh.scale.setScalar(s.radius/3.6);const fade=clamp((s.expires-time)/.4,0,1);s.mesh.material.opacity=.98*fade;}
}
function activePollenFields(){return match?.phase==='live'?ordinarySkills.events(elapsed).filter(event=>event.type==='mend-pollen'&&elapsed>=event.triggerAt):[];}
function activeOrdinarySmokeFields(){return match?.phase==='live'?ordinarySkills.events(elapsed).filter(event=>['mend-pollen','veil-dust','frost-mist','duelist-comet'].includes(event.type)&&elapsed>=event.triggerAt):[];}
function smokeBlocks(a,b){const start=new THREE.Vector3(a.x,(a.y||0)+1.45,a.z),end=new THREE.Vector3(b.x,(b.y||0)+1.45,b.z),delta=end.clone().sub(start),length=delta.lengthSq();return [...smokes,...activeOrdinarySmokeFields()].some(s=>{const center=new THREE.Vector3(s.x,s.y,s.z),t=length?clamp(center.clone().sub(start).dot(delta)/length,0,1):0;return start.clone().addScaledVector(delta,t).distanceToSquared(center)<s.radius*s.radius;});}
function getZoneFloor(x,z,ceiling){
  let floor=rampFloor(x,z)||0;
  for(const collider of map.collision.query(x,z,0))if(collider.height<=ceiling&&collider.height>floor&&map.collision.overlaps(collider,x,z,0))floor=collider.height;
  return floor;
}
function ordinaryGroundHeight(x,z,referenceY){
  if(![x,z,referenceY].every(Number.isFinite)||x<map.bounds.minX||x>map.bounds.maxX||z<map.bounds.minZ||z>map.bounds.maxZ)return null;
  const floor=getZoneFloor(x,z,referenceY+VEIL_SKILLS.rootsHeightTolerance);
  return Math.abs(floor-referenceY)<=VEIL_SKILLS.rootsHeightTolerance&&canStand(x,z,.12,floor)?floor:null;
}
function getRootsTarget(actor,point=null,aim=null){
  if(!actorGrounded(actor))return null;
  if(ordinarySkills.blindUntil(actor.id,elapsed)>elapsed)return null;
 const input=netInputs.get(actor.remoteId)?.input,yaw=aim?.yaw??(actor===player?player.yaw:input?.yaw??actor.yaw??0);
  let dx=point&&Number.isFinite(point.x)?point.x-actor.x:-Math.sin(yaw)*VEIL_SKILLS.rootsRange;
  let dz=point&&Number.isFinite(point.z)?point.z-actor.z:-Math.cos(yaw)*VEIL_SKILLS.rootsRange;
  const length=Math.hypot(dx,dz),reach=Math.min(length,VEIL_SKILLS.rootsRange);if(length<.5)return null;
  dx*=reach/length;dz*=reach/length;
  const steps=Math.max(1,Math.ceil(reach/.25));let target={x:actor.x,y:actor.y,z:actor.z};
  // Follow support outwards: never search backwards to a surface behind a wall.
  for(let i=1;i<=steps;i++){
    const x=actor.x+dx*i/steps,z=actor.z+dz*i/steps,y=ordinaryGroundHeight(x,z,target.y);
    if(y===null||Math.abs(y-target.y)>.22||!map.collision.rayClear(target.x,target.y+.18,target.z,x,y+.18,z))break;
    target={x,y,z};
  }
  return Math.hypot(target.x-actor.x,target.z-actor.z)>=.5?target:null;
}
function getZoneTarget(actor,point=null,aim=null){
  const input=netInputs.get(actor.remoteId)?.input;
  const yaw=aim?.yaw??(actor===player?player.yaw:Number.isFinite(input?.yaw)?input.yaw:actor.yaw||0);
  const pitch=aim?.pitch??(actor===player?player.pitch:clamp(Number(input?.pitch)||0,-1.35,1.35));
  const eye=(actor.y||0)+1.6,ground=getZoneFloor(actor.x,actor.z,eye);
  const maxReach=20-1e-6,reach=pitch<-.03?clamp((eye-ground)/-Math.tan(pitch),0,maxReach):maxReach;
  let dx=point&&Number.isFinite(point.x)?point.x-actor.x:-Math.sin(yaw)*reach;
  let dz=point&&Number.isFinite(point.z)?point.z-actor.z:-Math.cos(yaw)*reach;
  const length=Math.hypot(dx,dz);if(length>maxReach){dx*=maxReach/length;dz*=maxReach/length;}
  const steps=Math.max(1,Math.ceil(Math.min(length,20)/.25));
  for(let i=steps;i>=0;i--){
    const x=actor.x+dx*i/steps,z=actor.z+dz*i/steps,y=getZoneFloor(x,z,eye);
    if(canStand(x,z,.12,y)&&map.collision.rayClear(actor.x,eye,actor.z,x,y+.12,z))return{x,y,z};
  }
  return{x:actor.x,y:actor.y||0,z:actor.z};
}
function getZonePreview(){
  const type=player.kit.character;
  if(netHostPaused||mode!=='play'||match?.phase!=='live'||!player.alive||interactionHeld||objectivePractice||player.kit.ultPoints<7||!['ember','frost'].includes(type))return null;
  if(type!==zoneTargetCharacter||elapsed-zoneTargetPreviewAt>=.1){zoneTargetCharacter=type;zoneTargetPreviewAt=elapsed;zoneTargetPreview={...getZoneTarget(player),type,radius:type==='ember'?6:7};}
  return zoneTargetPreview;
}
function getCometTarget(actor,point=null,aim=null){
  const input=netInputs.get(actor.remoteId)?.input,origin={x:actor.x,y:(actor.y||0)+1.7-clamp(actor.crouch||0,0,1)*.55,z:actor.z};
  const yaw=aim?.yaw??(actor===player?player.yaw:Number.isFinite(input?.yaw)?input.yaw:actor.yaw||0),pitch=aim?.pitch??(actor===player?player.pitch:clamp(Number(input?.pitch)||0,-1.35,1.35));
  let dx,dy,dz,reach=DUELIST_SKILLS.cometRange;
  if(point&&Number.isFinite(point.x)&&Number.isFinite(point.z)){
    dx=point.x-origin.x;dy=(Number.isFinite(point.y)?point.y:(actor.y||0)+1.4)-origin.y;dz=point.z-origin.z;
    const length=Math.hypot(dx,dy,dz);if(!Number.isFinite(length)||length<.22)return null;
    reach=Math.min(reach,length);dx/=length;dy/=length;dz/=length;
  }else{dx=-Math.sin(yaw)*Math.cos(pitch);dy=Math.sin(pitch);dz=-Math.cos(yaw)*Math.cos(pitch);}
  // Ground zero is a support plane rather than an AABB in the station map.
  if(dy<0)reach=Math.min(reach,Math.max(0,(origin.y-.20)/-dy));
  const at=length=>({x:origin.x+dx*length,y:origin.y+dy*length,z:origin.z+dz*length}),clear=length=>{const end=at(length);return map.collision.rayClear(origin.x,origin.y,origin.z,end.x,end.y,end.z);};
  // A straight eye-to-point path also clips ceilings; never force an air cast to a floor.
  if(!clear(reach)){let low=0,high=reach;for(let i=0;i<24;i++){const middle=(low+high)/2;if(clear(middle))low=middle;else high=middle;}reach=Math.max(0,low-.20);}
  if(reach<.22)return null;
  const target=at(reach);return [target.x,target.y,target.z].every(Number.isFinite)?target:null;
}
function getDuckTarget(actor,type,aim=null){
  if(type==='duck-hush'||type==='duck-egg')return{x:actor.x,y:actor.y||0,z:actor.z};
  if(ordinarySkills.blindUntil(actor.id,elapsed)>elapsed)return null;
 const input=netInputs.get(actor.remoteId)?.input,yaw=aim?.yaw??(actor===player?player.yaw:input?.yaw??actor.yaw??0),pitch=aim?.pitch??(actor===player?player.pitch:input?.pitch??0);
  if(!Number.isFinite(yaw)||!Number.isFinite(pitch))return null;
  const origin={x:actor.x,y:(actor.y||0)+1.7-(actor.crouch||0)*.55,z:actor.z},dx=-Math.sin(yaw)*Math.cos(pitch),dy=Math.sin(pitch),dz=-Math.cos(yaw)*Math.cos(pitch);
  if(type==='duck-seal'){
    let best=null;for(const enemy of [player,...bots])if(enemy.alive&&enemy.team!==actor.team){
      const ey=(enemy.y||0)+1.3-(enemy.crouch||0)*.55,vx=enemy.x-origin.x,vy=ey-origin.y,vz=enemy.z-origin.z,along=vx*dx+vy*dy+vz*dz;
      if(along<0||along>DUCK_SKILLS.sealRange||Math.hypot(vx-dx*along,vy-dy*along,vz-dz*along)>.55||!visibleBetween(actor,enemy))continue;
      if(!best||along<best.distance)best={x:enemy.x,y:ey,z:enemy.z,targetId:enemy.id,distance:along};
    }if(best){delete best.distance;return best;}return null;
  }
  const horizontal=Math.hypot(dx,dz);if(horizontal<.05)return null;
  let limit=DUCK_SKILLS.shieldRange;if(dy<-.01)limit=Math.min(limit,Math.max(1,(origin.y-(actor.y||0))/-dy));
  for(let distance=limit;distance>=1;distance-=.4){
    const x=origin.x+dx*distance,z=origin.z+dz*distance,y=getZoneFloor(x,z,origin.y);
    if(Math.hypot(x-origin.x,y-origin.y,z-origin.z)>DUCK_SKILLS.shieldRange||ordinaryGroundHeight(x,z,y)===null||!map.collision.rayClear(origin.x,origin.y,origin.z,x,y+.15,z))continue;
    return{x,y,z,yaw:Math.atan2(-dx,-dz)};
  }return null;
}
function catEnemyTarget(actor,aim=null){
 if(ordinarySkills.blindUntil(actor.id,elapsed)>elapsed)return null;
 const input=netInputs.get(actor.remoteId)?.input,yaw=aim?.yaw??(actor===player?player.yaw:input?.yaw??actor.yaw??0),pitch=aim?.pitch??(actor===player?player.pitch:input?.pitch??0);
 if(!Number.isFinite(yaw)||!Number.isFinite(pitch))return null;
 const origin=new THREE.Vector3(actor.x,(actor.y||0)+1.7-(actor.crouch||0)*.55,actor.z),direction=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
 let best=null;for(const enemy of [player,...bots])if(enemy.alive&&enemy.team!==actor.team&&visibleBetween(actor,enemy)){
  const state=isGuest()?enemy.netTarget:null,w=state?.weapon||actorWeaponId(enemy),ammo=state?state.ammo:enemy===player?player.ammo:enemy.remoteId?enemy.netAmmo:enemy.aiAmmo;
  if(!WEAPONS[w]?.mag||!(ammo>0)||enemy===player&&reloading>0||(state?state.reloading:enemy.remoteId?enemy.netReload:enemy.aiReload)>0||(state?state.serviceReload:enemy.serviceReload))continue;
  const center=new THREE.Vector3(enemy.x,(enemy.y||0)+1.3-(enemy.crouch||0)*.55,enemy.z),offset=center.clone().sub(origin),along=offset.dot(direction);
  if(along<0||Math.hypot(enemy.x-actor.x,center.y-(actor.y||0),enemy.z-actor.z)>CAT_SKILLS.pluckRange||offset.addScaledVector(direction,-along).length()>.55)continue;
  if(!best||along<best.distance)best={enemy,weapon:w,ammo,distance:along,x:enemy.x,y:center.y,z:enemy.z,targetId:enemy.id};
 }return best;
}
function catDropVisible(actor,drop){return ordinarySkills.blindUntil(actor.id,elapsed)<=elapsed&&!smokeBlocks(actor,{x:drop.x,y:-1.25,z:drop.z})&&map.collision.rayClear(actor.x,(actor.y||0)+1.7-(actor.crouch||0)*.55,actor.z,drop.x,.2,drop.z);}
function catDropTarget(actor,aim=null){
 if(ordinarySkills.blindUntil(actor.id,elapsed)>elapsed)return null;
 const input=netInputs.get(actor.remoteId)?.input,yaw=aim?.yaw??(actor===player?player.yaw:input?.yaw??actor.yaw??0),pitch=aim?.pitch??(actor===player?player.pitch:input?.pitch??0);
 if(!Number.isFinite(yaw)||!Number.isFinite(pitch))return null;
 const origin=new THREE.Vector3(actor.x,(actor.y||0)+1.7-(actor.crouch||0)*.55,actor.z),direction=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
 let best=null;for(const drop of droppedWeapons){const target=new THREE.Vector3(drop.x,.2,drop.z),offset=target.clone().sub(origin),along=offset.dot(direction);if(along<0||Math.hypot(drop.x-actor.x,actor.y||0,drop.z-actor.z)>CAT_SKILLS.fetchRange||offset.addScaledVector(direction,-along).length()>.8||!catDropVisible(actor,drop))continue;if(!best||along<best.distance)best={drop,distance:along,x:drop.x,y:0,z:drop.z};}return best;
}
function japanBorderTarget(actor,aim=null){
 if(ordinarySkills.blindUntil(actor.id,elapsed)>elapsed)return null;const d=carAim(actor,aim);if(!d||Math.hypot(d.x,d.z)<.05)return null;
 const origin={x:actor.x,y:(actor.y||0)+1.7-(actor.crouch||0)*.55,z:actor.z};let reach=JAPAN_SKILLS.borderRange;
 if(d.y<-.01)reach=Math.min(reach,Math.max(1,(origin.y-(actor.y||0))/-d.y));
 for(let distance=reach;distance>=1;distance-=.4){const x=origin.x+d.x*distance,z=origin.z+d.z*distance,y=getZoneFloor(x,z,origin.y);
  if(Math.hypot(x-actor.x,y-(actor.y||0),z-actor.z)>JAPAN_SKILLS.borderRange||ordinaryGroundHeight(x,z,y)===null||!map.collision.rayClear(origin.x,origin.y,origin.z,x,y+.1,z))continue;
  return{x,y,z,yaw:Math.atan2(-d.x,-d.z)};
 }return null;
}
function japanLevyTarget(actor,aim=null){
 if((actor.armor||0)>=JAPAN_SKILLS.armorCap||ordinarySkills.blindUntil(actor.id,elapsed)>elapsed)return null;const d=carAim(actor,aim);if(!d)return null;
 const origin={x:actor.x,y:(actor.y||0)+1.7-(actor.crouch||0)*.55,z:actor.z};let best=null;
 for(const enemy of[player,...bots]){if(!enemy.alive||enemy.team===actor.team||!(enemy.armor>0)||!visibleBetween(actor,enemy))continue;
  const v={x:enemy.x-origin.x,y:(enemy.y||0)+1.3-(enemy.crouch||0)*.55-origin.y,z:enemy.z-origin.z},along=v.x*d.x+v.y*d.y+v.z*d.z;
  if(along<0||Math.hypot(v.x,v.y,v.z)>JAPAN_SKILLS.levyRange||Math.hypot(v.x-d.x*along,v.y-d.y*along,v.z-d.z*along)>.55)continue;
  if(!best||along<best.distance)best={x:enemy.x,y:enemy.y||0,z:enemy.z,targetId:enemy.id,enemy,distance:along};
 }return best;
}

function crownShot(actor){if(isGuest()||!ordinarySkills.consumeCrownTax)return;const before=actor.hp;chargeCrownTax(ordinarySkills,actor,elapsed,actor===player?match:actor.record);if(actor===player&&actor.hp<before)damageFlash=.3;}
function onnaraOrbTarget(actor,aim){
 if(ordinarySkills.blindUntil(actor.id,elapsed)>elapsed)return null;const d=carAim(actor,aim);if(!d||Math.hypot(d.x,d.z)<.05)return null;
 const origin={x:actor.x,y:(actor.y||0)+1.7-(actor.crouch||0)*.55,z:actor.z};let reach=ONNARA_SKILLS.orbRange;
 if(d.y<-.01)reach=Math.min(reach,Math.max(1,1.7/-d.y));
 for(let distance=reach;distance>=1;distance-=.4){const x=origin.x+d.x*distance,z=origin.z+d.z*distance,y=getZoneFloor(x,z,origin.y);
  if(Math.hypot(x-actor.x,y-(actor.y||0),z-actor.z)>ONNARA_SKILLS.orbRange||ordinaryGroundHeight(x,z,y)===null||!map.collision.rayClear(origin.x,origin.y,origin.z,x,y+1.65,z)||!visibleBetween(actor,{x,y,z}))continue;
  return{x,y,z,yaw:Math.atan2(-d.x,-d.z)};
 }return null;
}
function activateOnnaraAbility(actor,key,{predict=false,aim=null}={}){
 if(netHostPaused||!actor?.alive||match?.phase!=='live'||actor.planting||actor.defusing||actor.serviceReload||!['c','q','e','x'].includes(key))return;
 const type={c:'onnara-tax',q:'onnara-orb',e:'onnara-hover',x:'onnara-chain'}[key];
 const target=key==='c'?urchinTarget(actor,'c',aim):key==='q'?onnaraOrbTarget(actor,aim):{x:actor.x,y:actor.y||0,z:actor.z};if(!target)return;
 if(key==='c'&&ordinarySkills.onnaraTax(target.targetId,elapsed)||key==='e'&&actorGrounded(actor)||key!=='c'&&ordinarySkills.onnaraEvent(type,actor.id,elapsed))return;
 const before=actor.kit.snapshot(),effect=actor.kit.activate(key,elapsed);if(!effect)return;
 if(!predict&&!ordinarySkills.cast(effect,ordinaryActorView(actor),target,elapsed,match.round)){actor.kit.restore(before);return;}
 if(actor===player)showMessage(key==='x'?'星座裁定':getCharacterSkill('onnara',key).name,key==='x'?'8秒、命中した敵から12m以内の別の敵1人へ実被害70%を連鎖':getCharacterSkill('onnara',key).description,3);return effect;
}
function confirmOnnaraSkill(key){
 if(netHostPaused||mode!=='play'||!player.alive||interactionHeld||objectivePractice)return;refillMapPracticeSkills();
 const aim={yaw:player.yaw,pitch:player.pitch},effect=activateAbility(player,key,{predict:isGuest(),aim});
 if(effect&&isGuest())queueNetAction('ability',{key,...aim});
 if(!effect)showMessage('発動できません','Cは見える敵 / Qは見える実床 / Eは空中で使用 · 重複や満杯は消費しません',2);
 refillMapPracticeSkills();updateHUD();
}
function applyStarHold(actor){
 const event=ordinarySkills.onnaraEvent?.('onnara-hover',actor.id,elapsed);if(!event||match?.phase!=='live')return false;
 const held=starHold.apply(actor,event,elapsed,(a,e)=>canStand(a.x,a.z,.34,e.y)&&getZoneFloor(a.x,a.z,e.y+.04)<e.y-.035);
 if(!held&&starHold.stopped(event.id))ordinarySkills.cancelOnnaraEvent(event.id,actor.id);return held;
}
function renderOnnaraOrb(){
 const event=ordinarySkills.onnaraEvent?.('onnara-orb',player.id,elapsed),show=event&&match?.phase==='live'&&mode==='play'&&player.alive&&!netHostPaused&&!document.hidden&&ordinarySkills.blindUntil(player.id,elapsed)<=elapsed;
 const label=$('onnara-orb-label');if(label){label.hidden=!show;if(show)label.textContent=`星見の宝玉 · 360°周回 · ${Math.ceil(event.endsAt-elapsed)}秒`;}
 if(show){const obscured=[...smokes,...activeOrdinarySmokeFields()].some(s=>(event.x-s.x)**2+(event.y+1.65-s.y)**2+(event.z-s.z)**2<s.radius*s.radius);if(obscured){if(label)label.textContent='星見の宝玉 · 煙で映像が遮られています';return;}
  onnaraOrbView.render(renderer,scene,event,{actors:bots,visible:visibleBetween,gun,hide:[onnaraSkillFX.group],now:elapsed});}

}
function urchinWeapon(actor){return actor===player?inventory.active:actor.remoteId?actor.netWeapon:actor.aiWeapon;}
function urchinCancelReload(actor){cancelServiceReload(actor);if(actor===player)reloading=0;else if(actor.remoteId)actor.netReload=0;else actor.aiReload=0;}
function urchinTarget(actor,key,aim=null){
 if(ordinarySkills.blindUntil(actor.id,elapsed)>elapsed)return null;
 const d=carAim(actor,aim);if(!d)return null;const range=key==='c'?URCHIN_SKILLS.jamRange:URCHIN_SKILLS.disarmRange,origin={x:actor.x,y:(actor.y||0)+1.7-(actor.crouch||0)*.55,z:actor.z};let best=null;
 for(const target of[player,...bots]){if(!target.alive||target===actor||target.team===actor.team||!visibleBetween(actor,target))continue;const v={x:target.x-origin.x,y:(target.y||0)+1.3-(target.crouch||0)*.55-origin.y,z:target.z-origin.z},along=v.x*d.x+v.y*d.y+v.z*d.z;if(along<0||Math.hypot(v.x,v.y,v.z)>range||Math.hypot(v.x-d.x*along,v.y-d.y*along,v.z-d.z*along)>.55)continue;if(!best||along<best.distance)best={x:target.x,y:target.y||0,z:target.z,targetId:target.id,actor:target,distance:along};}
 if(best&&key==='q'){const id=urchinWeapon(best.actor),r=best.actor===player?inventory:best.actor.record;if(WEAPONS[id]?.slot!=='primary'||!r||r[WEAPONS[id].slot]!==id||droppedWeapons.length>=32)return null;}
 return best;
}
function urchinDisarm(target){
 const id=urchinWeapon(target),slot=WEAPONS[id].slot,local=target===player,r=local?inventory:target.record;
 dropItem(id,target);urchinCancelReload(target);r[slot]=null;
 if(local){delete ammoStore[id];delete roundPurchases[slot];const next=inventory.secondary||inventory.primary||'knife';equip(next,true);}
 else{delete r.netPurchases?.[slot];if(target.netStores)delete target.netStores[id];const next=r.secondary||r.primary||'knife',spec=WEAPONS[next]||WEAPONS.knife,saved=target.netStores?.[next];target.netWeapon=target.aiWeapon=next;target.netAmmo=target.aiAmmo=saved?.ammo??spec.mag;target.netReserve=target.aiReserve=saved?.reserve??spec.reserve;target.netReload=target.aiReload=0;target.fire=.25;}
}
function activateUrchinAbility(actor,key,{predict=false,aim=null}={}){
 key=String(key).toLowerCase();if(netHostPaused||!actor?.alive||match?.phase!=='live'||actor.planting||actor.defusing||actor.serviceReload||!['c','q','e','x'].includes(key))return;
 const type={c:'urchin-jam',q:'urchin-disarm',e:'urchin-pearl',x:'urchin-trident'}[key];if(key==='x'&&ordinarySkills.urchinTrident(actor.id,elapsed))return;
 const target=['c','q'].includes(key)?urchinTarget(actor,key,aim):{x:actor.x,y:actor.y||0,z:actor.z};if(!target)return;
 const local=actor===player,remote=!!actor.remoteId,id=urchinWeapon(actor),ammo=local?player.ammo:remote?actor.netAmmo:actor.aiAmmo,r=local?null:actor.record,credits=local?match.credits:r?.credits;
 const count=key==='e'?Math.min(URCHIN_SKILLS.pearlBullets,Math.floor(ammo||0),Math.floor((9000-credits)/URCHIN_SKILLS.pearlValue)):0;
 if(key==='e'&&(!WEAPONS[id]?.mag||!(count>0)||!Number.isFinite(credits)||(local?reloading:remote?actor.netReload:actor.aiReload)>0))return;
 const before=actor.kit.snapshot(),effect=actor.kit.activate(key,elapsed);if(!effect)return;
 if(!predict){const event=ordinarySkills.cast(effect,ordinaryActorView(actor),target,elapsed,match.round);if(!event){actor.kit.restore(before);return;}
  if(key==='c')urchinCancelReload(target.actor);
  if(key==='q')urchinDisarm(target.actor);
  if(key==='e'){if(local){player.ammo-=count;match.credits+=count*URCHIN_SKILLS.pearlValue;}else{if(remote)actor.netAmmo-=count;else actor.aiAmmo-=count;r.credits+=count*URCHIN_SKILLS.pearlValue;}}
 }
 if(local)showMessage(key==='x'?'三叉潮':getCharacterSkill('urchin',key).name,key==='x'?'9秒、通常の射撃へ左右の副弾を追加。壁・盾・囮で止まります。':getCharacterSkill('urchin',key).description,3);return effect;
}
function confirmUrchinSkill(key){if(netHostPaused||mode!=='play'||!player.alive||interactionHeld||objectivePractice)return;refillMapPracticeSkills();const aim={yaw:player.yaw,pitch:player.pitch},effect=activateAbility(player,key,{predict:isGuest(),aim});if(effect&&isGuest())queueNetAction('ability',{key,...aim});if(!effect)showMessage('対象を確認','視線・距離・敵の購入銃・残弾や所持コインを確認 · 消費していません',2);refillMapPracticeSkills();updateHUD();}
function urchinTridentShot(actor,origin,incoming,spec){
 if(!ordinarySkills.urchinTrident?.(actor.id,elapsed)||!spec.mag)return [];
 botsGroup.updateMatrixWorld(true);const results=[];
 for(const side of[-1,1]){const aim=incoming.clone().normalize().applyAxisAngle(new THREE.Vector3(0,1,0),side*URCHIN_SKILLS.tridentAngle),from=origin.clone(),ray=new THREE.Raycaster(from,aim,0,URCHIN_SKILLS.tridentRange),all=ray.intersectObjects([environment,botsGroup],true).filter(h=>h.object.userData.bot!==actor&&(!h.object.userData.bot||h.object.userData.bot.alive));
  const hit=all[0];let target=hit?.object.userData.bot,point=hit?.point,head=!!hit?.object.userData.head,nearest=hit?.distance??URCHIN_SKILLS.tridentRange;
  if(player!==actor&&player.alive&&player.team!==actor.team){const c=(player.crouch||0)*.55;for(const[p,h]of[[ray.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(player.x,player.y+1.62-c,player.z),.19),new THREE.Vector3()),true],[ray.ray.intersectBox(new THREE.Box3(new THREE.Vector3(player.x-.28,player.y+.4,player.z-.28),new THREE.Vector3(player.x+.28,player.y+1.45-c,player.z+.28)),new THREE.Vector3()),false]])if(p&&from.distanceTo(p)<nearest){target=player;point=p;head=h;nearest=from.distanceTo(p);}}
  const fake=raycastNopeDecoy(from,aim,nearest,actor.team),shield=ordinarySkills.interceptShield(from,aim,fake?.distance??nearest,spec.body*URCHIN_SKILLS.tridentScale,elapsed,match.round,{consume:!isGuest()});
  if(shield){target=null;point=new THREE.Vector3(shield.point.x,shield.point.y,shield.point.z);}else if(fake){target=null;point=fake.point;if(!isGuest())hitNopeDecoy(fake.event,actor);}
  const end=point||from.clone().addScaledVector(aim,URCHIN_SKILLS.tridentRange);tracer(from,end,'#a9f1e4',.1);
  if(target?.alive&&target.team!==actor.team&&!isGuest()){let damage=nobiBulletDamage(actor,target,head?spec.head:point.y-(target.y||0)<.7?spec.leg:spec.body,spec.head,true)*URCHIN_SKILLS.tridentScale;const id=urchinWeapon(actor);if(['phantom','spectre','ghost','classic'].includes(id)&&nearest>15)damage*=nearest>30?.8:.9;damageEntity(target,damage,actor,{firearm:true,chain:false,skill:'urchin'});burst(point,'#a9f1e4',3);}
  results.push({targetId:target?.id||null,x:end.x,y:end.y,z:end.z});
 }return results;
}

function capTarget(actor,key,aim=null){
 if(ordinarySkills.blindUntil(actor.id,elapsed)>elapsed&&key==='c')return null;
 const d=carAim(actor,aim);if(!d)return null;const range=key==='c'?CAP_SKILLS.lockRange:CAP_SKILLS.cleanRange,origin={x:actor.x,y:(actor.y||0)+1.7-(actor.crouch||0)*.55,z:actor.z};let best=null;
 for(const target of[player,...bots]){if(!target.alive||target===actor||(key==='c'?target.team===actor.team:target.team!==actor.team)||!visibleBetween(actor,target))continue;const v={x:target.x-origin.x,y:(target.y||0)+1.3-(target.crouch||0)*.55-origin.y,z:target.z-origin.z},along=v.x*d.x+v.y*d.y+v.z*d.z;if(along<0||Math.hypot(v.x,v.y,v.z)>range||Math.hypot(v.x-d.x*along,v.y-d.y*along,v.z-d.z*along)>.55)continue;if(!best||along<best.distance)best={x:target.x,y:target.y||0,z:target.z,targetId:target.id,actor:target,distance:along};}
 if(key==='q'&&!best)best={x:actor.x,y:actor.y||0,z:actor.z,targetId:actor.id,actor};
 return best&&(key==='c'||ordinarySkills.hasImpairment(best.actor.id,best.actor.team,elapsed))?best:null;
}
function activateCapAbility(actor,key,{predict=false,aim=null}={}){
 key=String(key).toLowerCase();if(netHostPaused||!actor?.alive||match?.phase!=='live'||actor.planting||actor.defusing||actor.serviceReload||!['c','q','e','x'].includes(key))return;
 const type={c:'cap-lock',q:'cap-clean',e:'cap-bank',x:'cap-magazine'}[key];if(['e','x'].includes(key)&&ordinarySkills.events(elapsed).some(e=>e.sourceId===actor.id&&e.type===type))return;
 const target=['c','q'].includes(key)?capTarget(actor,key,aim):{x:actor.x,y:actor.y||0,z:actor.z};if(!target)return;
 const before=actor.kit.snapshot(),effect=actor.kit.activate(key,elapsed);if(!effect)return;
 if(!predict){const event=ordinarySkills.cast(effect,ordinaryActorView(actor),target,elapsed,match.round);if(!event){actor.kit.restore(before);return;}if(key==='q')ordinarySkills.cleanse(target.actor.id,target.actor.team,elapsed);if(key==='c'&&target.actor===player)aiming=false;}
 if(actor===player)showMessage(key==='x'?'エンドレスマガジン':getCharacterSkill('cap',key).name,key==='x'?'9秒、装填済みの銃弾を消費せず撃てます。空弾倉は装填が必要。':getCharacterSkill('cap',key).description,3);return effect;
}
function confirmCapSkill(key){if(netHostPaused||mode!=='play'||!player.alive||interactionHeld||objectivePractice)return;refillMapPracticeSkills();const aim={yaw:player.yaw,pitch:player.pitch},effect=activateAbility(player,key,{predict:isGuest(),aim});if(effect&&isGuest())queueNetAction('ability',{key,...aim});if(!effect)showMessage('対象を確認','敵・味方・現在の妨害・視線・距離を確認 · 消費していません',2);refillMapPracticeSkills();updateHUD();}
function capDistortAim(actor,aim){
 const sequence=actor===player?shotSequence:actor.shotSequence||1,offset=capShotOffset(sequence,ordinarySkills.capLocked(actor.id,elapsed));
 if(!offset.x&&!offset.y)return aim;
 const right=new THREE.Vector3().crossVectors(aim,new THREE.Vector3(0,1,0)).normalize(),up=new THREE.Vector3().crossVectors(right,aim).normalize();
 return aim.addScaledVector(right,offset.x).addScaledVector(up,offset.y).normalize();
}
function capBounceShot(actor,origin,incoming,hit,spec){
 if(!ordinarySkills.capBank(actor.id,elapsed)||!spec.mag||!hit?.face||hit.object.userData.bot||!Number.isFinite(hit.distance)||hit.distance>=CAP_SKILLS.bounceRange-.1)return null;
 const transform=hit.object.matrixWorld.clone();if(hit.object.isInstancedMesh&&Number.isInteger(hit.instanceId)){const instance=new THREE.Matrix4();hit.object.getMatrixAt(hit.instanceId,instance);transform.multiply(instance);}
 const normal=hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(transform));if(Math.abs(normal.y)>.3)return null;
 const aim=incoming.clone().normalize().reflect(normal).normalize();if(aim.dot(normal)<0)normal.negate();const from=hit.point.clone().addScaledVector(normal,.025),remaining=CAP_SKILLS.bounceRange-hit.distance;
 botsGroup.updateMatrixWorld(true);const ray=new THREE.Raycaster(from,aim,.005,remaining),hits=ray.intersectObjects([environment,botsGroup],true).filter(h=>h.object.userData.bot!==actor&&(!h.object.userData.bot||h.object.userData.bot.alive));
 const next=hits[0];let target=next?.object.userData.bot,point=next?.point,head=!!next?.object.userData.head,nearest=next?.distance??remaining;
 if(player!==actor&&player.alive&&player.team!==actor.team){const c=(player.crouch||0)*.55;for(const[p,h]of[[ray.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(player.x,player.y+1.62-c,player.z),.19),new THREE.Vector3()),true],[ray.ray.intersectBox(new THREE.Box3(new THREE.Vector3(player.x-.28,player.y+.4,player.z-.28),new THREE.Vector3(player.x+.28,player.y+1.45-c,player.z+.28)),new THREE.Vector3()),false]])if(p&&from.distanceTo(p)<nearest){target=player;point=p;head=h;nearest=from.distanceTo(p);}}
 const fake=raycastNopeDecoy(from,aim,nearest,actor.team),shield=ordinarySkills.interceptShield(from,aim,fake?.distance??nearest,spec.body*CAP_SKILLS.bounceScale,elapsed,match.round,{consume:!isGuest()});
 if(shield){target=null;point=new THREE.Vector3(shield.point.x,shield.point.y,shield.point.z);}else if(fake){target=null;point=fake.point;if(!isGuest())hitNopeDecoy(fake.event,actor);}
 const end=point||from.clone().addScaledVector(aim,remaining);tracer(hit.point,end,'#71e3ed',.12);
 if(target?.alive&&target.team!==actor.team&&!isGuest()){let amount=nobiBulletDamage(actor,target,head?spec.head:point.y-(target.y||0)<.7?spec.leg:spec.body,spec.head,true)*CAP_SKILLS.bounceScale;const weaponId=actor===player?inventory.active:actor.remoteId?actor.netWeapon:actor.aiWeapon;if(['phantom','spectre','ghost','classic'].includes(weaponId)&&hit.distance+nearest>15)amount*=hit.distance+nearest>30?.8:.9;damageEntity(target,amount,actor,{firearm:true,chain:false,skill:'cap'});burst(point,'#79e7ee',5);}
 return{targetId:target?.id||null,point:end,head};
}

function japanMusterTargets(source){
 const occupied=[player,...bots].filter(a=>a.alive),targets=[];
 for(const actor of[player,...bots]){if(actor.alive||actor.team!==source.team)continue;
  const points=actor.team===match.attackerTeam?map.teamSpawns.attack:map.teamSpawns.defend,index=actor===player?0:Math.max(0,Number(actor.id.split('-').at(-1))||0);
  const candidates=[points[index%points.length],...points];let point=null;
  for(const base of candidates)for(const[dx,dz]of[[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1]]){const x=base.x+dx,z=base.z+dz,y=getZoneFloor(x,z,.5);
   if(!point&&canStand(x,z,.34,y)&&!occupied.some(a=>Math.hypot(a.x-x,a.z-z)<.8))point={x,y,z};
  }
  if(point){targets.push({actor,point});occupied.push(point);}
 }return targets;
}
function japanRevive(actor,point){
 cancelServiceReload(actor);ordinarySkills.resetActor(actor.id);match.cancelPlant(actor.id);match.cancelDefuse(actor.id);
 Object.assign(actor,point,{hp:100,armor:0,alive:true,vy:0,vx:0,vz:0,death:0,crouch:0,planting:false,defusing:false,dashTimer:0,dashVec:null,path:[],target:null,lastSeen:null,lastHeard:null,fire:.7});
 actor.kit.resetRound();actor.kit.smoke=0;actor.kit.updraft=0;actor.kit.dash=0;actor.kit.nextSignatureAt=elapsed+signatureCooldown(actor.kit.character);actor.kit.armReadyAt=null;actor.kit.armExpiresAt=null;
 const record=recordOf(actor);if(record){record.primary=null;record.secondary='classic';record.armor=0;}
 if(actor===player){inventory={primary:null,secondary:'classic',active:'classic'};ammoStore={};roundPurchases={};equip('classic',true);player.ammo=WEAPONS.classic.mag;player.reserve=WEAPONS.classic.reserve;reloading=0;clearCombatInput();gun.visible=true;spectatedBot=null;setVisible('spectator-hint',false);showMessage('総動員','開始地点へ復帰しました',3);}
 else{actor.group.visible=true;actor.netWeapon='classic';actor.netAmmo=actor.aiAmmo=WEAPONS.classic.mag;actor.netReserve=actor.aiReserve=WEAPONS.classic.reserve;actor.netReload=actor.aiReload=0;actor.netStores={};actor.lastNetShot=-10;actor.shotSequence=0;actor.group.position.set(point.x,point.y,point.z);}
 if(actor.remoteId){const data=netInputs.get(actor.remoteId);if(data){for(const a of data.actions||[])netApplied.set(actor.remoteId,Math.max(netApplied.get(actor.remoteId)||0,a.seq||0));data.actions=[];data.input={};data.received=-Infinity;}actor.lastNetInput=elapsed;}
}
function activateJapanAbility(actor,key,{predict=false,aim=null}={}){
 key=String(key).toLowerCase();if(netHostPaused||!actor?.alive||match?.phase!=='live'||actor.planting||actor.defusing||actor.serviceReload||!['c','q','e','x'].includes(key))return;
 if(key==='e'&&ordinarySkills.japanReturn(actor.id,elapsed)>0)return;
 const target=key==='c'?japanBorderTarget(actor,aim):key==='q'?japanLevyTarget(actor,aim):{x:actor.x,y:actor.y||0,z:actor.z};if(!target)return;
 const revive=key==='x'?japanMusterTargets(actor):[];if(key==='x'&&!revive.length)return;
 const before=actor.kit.snapshot(),effect=actor.kit.activate(key,elapsed);if(!effect)return;
 if(!predict){const event=ordinarySkills.cast(effect,ordinaryActorView(actor),target,elapsed,match.round);if(!event){actor.kit.restore(before);return;}
  if(key==='q'){const amount=Math.min(JAPAN_SKILLS.levyAmount,target.enemy.armor,JAPAN_SKILLS.armorCap-(actor.armor||0));target.enemy.armor-=amount;actor.armor=(actor.armor||0)+amount;}
  if(key==='x')for(const entry of revive)japanRevive(entry.actor,entry.point);
 }
 if(actor===player)showMessage(key==='x'?'総動員':getCharacterSkill('japan',key).name,key==='x'?(predict?'味方の復帰を要請しました':'倒れた味方を開始地点へ呼び戻しました'):getCharacterSkill('japan',key).description,3);return effect;
}
function confirmJapanSkill(key){if(netHostPaused||mode!=='play'||!player.alive||interactionHeld||objectivePractice)return;refillMapPracticeSkills();const aim={yaw:player.yaw,pitch:player.pitch},effect=activateAbility(player,key,{predict:isGuest(),aim});if(effect&&isGuest())queueNetAction('ability',{key,...aim});if(!effect)showMessage('対象を確認','床・視線・敵の装甲・自身の空き装甲を確認 · 消費していません',2);refillMapPracticeSkills();updateHUD();}

function nobiEnemyTarget(actor,key,aim=null){
 if(ordinarySkills.blindUntil(actor.id,elapsed)>elapsed)return null;const d=carAim(actor,aim);if(!d)return null;
 const origin={x:actor.x,y:(actor.y||0)+1.7-(actor.crouch||0)*.55,z:actor.z},range=key==='c'?NOBI_SKILLS.tagRange:NOBI_SKILLS.brakeRange;let best=null;
 for(const enemy of[player,...bots]){if(!enemy.alive||enemy.team===actor.team||!visibleBetween(actor,enemy))continue;const y=(enemy.y||0)+1.3-(enemy.crouch||0)*.55,v={x:enemy.x-origin.x,y:y-origin.y,z:enemy.z-origin.z},along=v.x*d.x+v.y*d.y+v.z*d.z;if(along<0||Math.hypot(v.x,v.y,v.z)>range||Math.hypot(v.x-d.x*along,v.y-d.y*along,v.z-d.z*along)>.55)continue;if(!best||along<best.distance)best={x:enemy.x,y:enemy.y||0,z:enemy.z,targetId:enemy.id,enemy,distance:along};}return best;
}
function activateNobiAbility(actor,key,{predict=false,aim=null}={}){
 key=String(key).toLowerCase();if(netHostPaused||!actor?.alive||match?.phase!=='live'||actor.planting||actor.defusing||actor.serviceReload||!['c','q','e','x'].includes(key))return;
 const type={c:'nobi-tag',q:'nobi-brake',e:'nobi-tool',x:'nobi-legend'}[key];if(ordinarySkills.events(elapsed).some(e=>e.sourceId===actor.id&&e.type===type&&['e','x'].includes(key)))return;
 const target=['c','q'].includes(key)?nobiEnemyTarget(actor,key,aim):{x:actor.x,y:actor.y||0,z:actor.z};if(!target)return;
 const before=actor.kit.snapshot(),effect=actor.kit.activate(key,elapsed);if(!effect)return;
 if(!predict&&!ordinarySkills.cast(effect,ordinaryActorView(actor),target,elapsed,match.round)){actor.kit.restore(before);return;}
 if(actor===player)showMessage(key==='x'?'逆転えり':getCharacterSkill('nobi',key).name,key==='x'?'8秒、胴・脚への銃撃も頭相当の威力。照準・壁・反動は通常通り。':getCharacterSkill('nobi',key).description,2.5);return effect;
}
function confirmNobiSkill(key){if(netHostPaused||mode!=='play'||!player.alive||interactionHeld||objectivePractice)return;refillMapPracticeSkills();const aim={yaw:player.yaw,pitch:player.pitch},effect=activateAbility(player,key,{predict:isGuest(),aim});if(effect&&isGuest())queueNetAction('ability',{key,...aim});if(!effect)showMessage('対象を確認','照準の敵・距離・壁・煙を確認 · 回数は消費していません',2);refillMapPracticeSkills();updateHUD();}
function nobiShotInterval(spec,actor){return spec.interval*(spec.mag>0?ordinarySkills.nobiInterval(actor.id,elapsed):1);}
function nobiBulletDamage(source,target,damage,headDamage,firearm=true){if(!firearm)return damage;return (ordinarySkills.nobiLegend(source.id,elapsed)?Math.max(damage,headDamage):damage)*ordinarySkills.nobiVulnerability(target.id,elapsed);}
function carAim(actor,aim=null){const input=netInputs.get(actor.remoteId)?.input;return carAimVector(aim?.yaw??(actor===player?player.yaw:input?.yaw??actor.yaw??0),aim?.pitch??(actor===player?player.pitch:input?.pitch??0));}
function carSkillTarget(actor,key,aim=null){
 if(ordinarySkills.blindUntil(actor.id,elapsed)>elapsed)return null;
 const d=carAim(actor,aim);if(!d)return null;
 const origin={x:actor.x,y:(actor.y||0)+1.7-(actor.crouch||0)*.55,z:actor.z};
 if(key==='q'){
  let best=null;for(const field of [...smokes,...activeOrdinarySmokeFields()]){
   const centerDistance=Math.hypot(field.x-actor.x,field.y-origin.y,field.z-actor.z),along=carSmokeIntersection(origin,d,field);
   if(along===null||centerDistance>CAR_SKILLS.washRange||!map.collision.rayClear(origin.x,origin.y,origin.z,field.x,field.y,field.z))continue;
   if(!best||along<best.distance)best={x:field.x,y:field.y,z:field.z,field,distance:along};
  }return best;
 }
 let best=null;for(const enemy of [player,...bots]){
  if(!enemy.alive||enemy.team===actor.team||!actorGrounded(enemy)||!visibleBetween(actor,enemy))continue;
  const center={x:enemy.x,y:(enemy.y||0)+1.3-(enemy.crouch||0)*.55,z:enemy.z},vx=center.x-origin.x,vy=center.y-origin.y,vz=center.z-origin.z,along=vx*d.x+vy*d.y+vz*d.z;
  if(along<0||Math.hypot(vx,vy,vz)>CAR_SKILLS.bumperRange||Math.hypot(vx-d.x*along,vy-d.y*along,vz-d.z*along)>.55)continue;
  const distance=Math.hypot(enemy.x-actor.x,enemy.z-actor.z);if(distance<.1)continue;
  const dx=(enemy.x-actor.x)/distance,dz=(enemy.z-actor.z)/distance;let x=enemy.x,y=enemy.y||0,z=enemy.z;
  for(let i=1;i<=30;i++){
   const nx=enemy.x+dx*CAR_SKILLS.bumperDistance*i/30,nz=enemy.z+dz*CAR_SKILLS.bumperDistance*i/30,ny=ordinaryGroundHeight(nx,nz,y);
   if(ny===null||Math.abs(ny-y)>.22||!canStand(nx,nz,.34,ny)||!map.collision.rayClear(x,y+.5,z,nx,ny+.5,nz)||[player,...bots].some(a=>a.alive&&a!==enemy&&Math.hypot(a.x-nx,a.z-nz)<.65&&Math.abs((a.y||0)-ny)<1.8))break;
   x=nx;y=ny;z=nz;
  }
  if(Math.hypot(x-enemy.x,z-enemy.z)<.2)continue;
  if(!best||along<best.distance)best={x,y,z,targetId:enemy.id,enemy,distance:along};
 }return best;
}
function carPitTargets(actor){return[player,...bots].filter(a=>a.alive&&a.team===actor.team&&a.kit&&Math.hypot(a.x-actor.x,(a.y||0)-(actor.y||0),a.z-actor.z)<=CAR_SKILLS.pitRange&&(a===actor||ordinarySkills.blindUntil(actor.id,elapsed)<=elapsed&&visibleBetween(actor,a))&&(a.kit.smoke<getCharacterSkill(a.kit.character,'c').max||a.kit.updraft<getCharacterSkill(a.kit.character,'q').max||a.kit.dash<1||a.kit.armExpiresAt!==null));}
function activateCarAbility(actor,key,{predict=false,aim=null}={}){
 key=String(key).toLowerCase();if(!['c','q','e','x'].includes(key)||netHostPaused||!actor?.alive||match?.phase!=='live'||actor.planting||actor.defusing||actor.serviceReload)return;
 const targets=key==='x'?carPitTargets(actor):null;
 if(key==='x'&&!targets.length)return;
 if(key==='e'&&ordinarySkills.carGyro(actor.id,elapsed))return;
 const target=['c','q'].includes(key)?carSkillTarget(actor,key,aim):{x:actor.x,y:actor.y||0,z:actor.z};if(!target)return;
 const before=actor.kit.snapshot(),effect=actor.kit.activate(key,elapsed);if(!effect)return;
 const event=predict?null:ordinarySkills.cast(effect,ordinaryActorView(actor),target,elapsed,match.round);if(!predict&&!event){actor.kit.restore(before);return;}
 if(!predict&&key==='c'){
  const victim=target.enemy;Object.assign(victim,{x:target.x,y:target.y,z:target.z,vy:0,vx:0,vz:0,dashTimer:0,carImpulseUntil:elapsed+.25});cancelServiceReload(victim);victim.path=[];victim.pathIndex=0;victim.planAt=0;
  victim.planting=false;victim.defusing=false;match.cancelPlant(victim.id);match.cancelDefuse(victim.id);
  if(victim===player){clearCombatInput();interactionHeld=false;}
  if(victim.remoteId){const data=netInputs.get(victim.remoteId);if(data){Object.assign(data.input,{x:victim.x,y:victim.y,z:victim.z});victim.netPositionAck={seq:data.seq,connection:data.connection,round:data.round,x:victim.x,z:victim.z};}}
 }
 if(!predict&&key==='q'){
  const field=target.field,removed=typeof field.id==='string'?ordinarySkills.disperseSmoke(event.id,field.id,elapsed,match.round):smokes.some(s=>s.id===field.id);
  if(!removed){ordinarySkills.cancelCarEvent(event.id);actor.kit.restore(before);return;}
  if(typeof field.id!=='string')syncSmokes(serializeSmokes().filter(s=>s.id!==field.id));
 }
 if(!predict&&key==='x')for(const ally of targets){ally.kit.smoke=getCharacterSkill(ally.kit.character,'c').max;ally.kit.updraft=getCharacterSkill(ally.kit.character,'q').max;ally.kit.dash=1;ally.kit.nextSignatureAt=0;ally.kit.dashKills=0;ally.kit.armReadyAt=null;ally.kit.armExpiresAt=null;}
 if(actor===player)showMessage(key==='x'?'ピットクルー':getCharacterSkill('car',key).name,key==='x'?'視線内24mの味方と自身のC/Q/Eを補給 · HP・弾・ULTは変わりません':getCharacterSkill('car',key).description,2.5);
 return effect;
}
function confirmCarSkill(key){
 if(netHostPaused||mode!=='play'||!player.alive||interactionHeld||objectivePractice)return;
 refillMapPracticeSkills();const aim={yaw:player.yaw,pitch:player.pitch},effect=activateAbility(player,key,{predict:isGuest(),aim});if(effect&&isGuest())queueNetAction('ability',{key,...aim});
 if(!effect)showMessage('発動できません',key==='c'?'接地した敵と押し出せる床を確認 · 回数は消費しません':'照準に重なる煙と壁を確認 · 回数は消費しません',2);
 refillMapPracticeSkills();updateHUD();
}
function activateCatAbility(actor,key,{predict=false,aim=null}={}){
 key=String(key).toLowerCase();if(!['c','q','e','x'].includes(key)||netHostPaused||!actor?.alive||match?.phase!=='live'||actor.planting||actor.defusing||actor.serviceReload)return;
 const view=ordinaryActorView(actor),before=actor.kit.snapshot();let target=null;
 const bookmark=key==='c'?ordinarySkills.catBookmark(actor.id,elapsed):null;
 if(bookmark){
  if(Math.hypot(actor.x-bookmark.x,(actor.y||0)-bookmark.y,actor.z-bookmark.z)>CAT_SKILLS.returnRange||ordinaryGroundHeight(bookmark.x,bookmark.z,bookmark.y)===null||!canStand(bookmark.x,bookmark.z,.34,bookmark.y))return;
  if(predict)return{type:'cat-return'};
  const event=ordinarySkills.returnToCatBookmark(bookmark.id,view,elapsed,match.round);if(!event)return;
  Object.assign(actor,{x:bookmark.x,y:bookmark.y,z:bookmark.z,vy:0,vx:0,vz:0,dashTimer:0});cancelServiceReload(actor);
  if(actor===player){clearCombatInput();firing=false;reloading=0;}
  if(actor.remoteId){const data=netInputs.get(actor.remoteId);if(data){Object.assign(data.input,{x:actor.x,y:actor.y,z:actor.z});actor.netPositionAck={seq:data.seq,connection:data.connection,round:data.round,x:actor.x,z:actor.z};}}
  if(actor===player)showMessage('白いしおり / 帰還','保存した場所へ戻りました · HPと弾は巻き戻しません',2);return{type:'cat-return'};
 }
 if(key==='c'){if(!actorGrounded(actor))return;target={x:actor.x,y:actor.y||0,z:actor.z};}
 if(key==='q'){target=catEnemyTarget(actor,aim);if(!target)return;}
 if(key==='e'){target=catDropTarget(actor,aim);if(!target)return;}
 if(key==='x')target={x:actor.x,y:actor.y||0,z:actor.z};
 const effect=actor.kit.activate(key,elapsed);if(!effect)return;
 const event=predict?null:ordinarySkills.cast(effect,view,target,elapsed,match.round);if(!predict&&!event){actor.kit.restore(before);return;}
 if(!predict&&key==='q'){
  const victim=target.enemy,remaining=Math.max(0,target.ammo-CAT_SKILLS.pluckAmmo);
  if(victim===player){player.ammo=remaining;ammoStore[inventory.active]={ammo:remaining,reserve:player.reserve};showMessage('ひげの弾抜き','装填中の弾を抜かれました · 予備弾は残っています',1.5);}
  else{if(victim.remoteId)victim.netAmmo=remaining;else victim.aiAmmo=remaining;if(victim.netStores?.[target.weapon])victim.netStores[target.weapon].ammo=remaining;}
 }
 if(!predict&&key==='e'&&!pickupDroppedWeapon(actor,target.drop.id,{catFetch:true})){ordinarySkills.cancelCatEvent(event.id);actor.kit.restore(before);return;}
 if(actor===player)showMessage(key==='x'?'白紙の8秒':getCharacterSkill('cat',key).name,key==='x'?'8秒、試合時計を停止 · 移動・射撃・設置・電源オフは続きます':getCharacterSkill('cat',key).description,2);
 return effect;
}
function confirmCatSkill(key){
 if(netHostPaused||mode!=='play'||!player.alive||interactionHeld||objectivePractice)return;
 refillMapPracticeSkills();const aim={yaw:player.yaw,pitch:player.pitch},effect=activateAbility(player,key,{predict:isGuest(),aim});
 if(effect&&isGuest())queueNetAction('ability',{key,...aim});
 if(!effect)showMessage('発動できません',key==='q'?'視線の通る敵の銃と装填弾を確認してください · 回数は消費しません':'見える落ちた銃を狙ってください · 回数は消費しません',2);
 refillMapPracticeSkills();updateHUD();
}

function activateDuckEgg(actor,{predict=false}={}){
  if(netHostPaused||!actor?.alive||match?.phase!=='live'||actor.planting||actor.defusing||actor.serviceReload)return;
  const before=actor.kit.snapshot(),effect=actor.kit.activate('x',elapsed);if(!effect)return;
  if(!predict&&!ordinarySkills.cast(effect,ordinaryActorView(actor),{x:actor.x,y:actor.y||0,z:actor.z},elapsed,match.round)){actor.kit.restore(before);return;}
  if(actor===player)showMessage('不屈の卵','8秒間、致死攻撃を2回までHP1で耐える',2);return effect;
}
function getSkillTarget(actor,type,point=null,aim=null){
  if(type.startsWith('duck-'))return getDuckTarget(actor,type,aim);
  if(type==='duelist-comet')return getCometTarget(actor,point,aim);
  if(type==='duelist-lift')return{x:actor.x,y:actor.y||0,z:actor.z};
  if(type==='frost-unravel')return actorGrounded(actor)?{x:actor.x,y:actor.y||0,z:actor.z}:null;
  if(type==='ember-shade'||type==='ember-service')return{x:actor.x,y:actor.y||0,z:actor.z,...(type==='ember-service'?{weaponId:actorWeaponId(actor)}:{})};
  if(type==='echo-kerning')return{x:actor.x,y:actor.y||0,z:actor.z};
  if(type.startsWith('veil-')){
    if(!actorGrounded(actor))return null;
    if(type==='veil-roots')return getRootsTarget(actor,point,aim);
    return{x:actor.x,y:actor.y+(type==='veil-dust'?VEIL_SKILLS.dustCenterOffset:0),z:actor.z};
  }
  const target=getZoneTarget(actor,point,aim),limit=type==='nope-decoy'?6:type==='echo-tag'?IAGNU_SKILLS.tagRange:type==='ember-solder'?EMBER_SKILLS.solderRange:type==='frost-stitch'?FROST_SKILLS.stitchRange:type==='frost-mist'?FROST_SKILLS.mistRange:20;
  let dx=target.x-actor.x,dz=target.z-actor.z,length=Math.hypot(dx,dz);
  if(length>limit){dx*=limit/length;dz*=limit/length;length=limit;}
  const eye=(actor.y||0)+1.7-clamp(actor.crouch||0,0,1)*.55;
  const flight=type==='nope-bottle'?NOPE_SKILLS.bottleFlight:type==='mend-seeds'?MEND_SKILLS.seedsFlight:type==='nope-flash'?NOPE_SKILLS.flashFlight:type==='mend-pollen'?MEND_SKILLS.pollenFlight:type==='echo-tag'?IAGNU_SKILLS.tagFlight:type==='echo-glint'?IAGNU_SKILLS.glintFlight:type==='ember-solder'?EMBER_SKILLS.solderFlight:type==='frost-stitch'?FROST_SKILLS.stitchFlight:type==='frost-mist'?FROST_SKILLS.mistFlight:0;
  // Check the same arc that will be drawn, including ceilings and stair landings.
  for(let step=Math.max(1,Math.ceil(length/.4));step>=0;step--){
    const ratio=step/Math.max(1,Math.ceil(length/.4)),x=actor.x+dx*ratio,z=actor.z+dz*ratio;
    const floor=getZoneFloor(x,z,eye),y=floor+(type==='nope-flash'||type==='echo-glint'?1.6:type==='mend-pollen'?1.7:type==='frost-mist'?FROST_SKILLS.mistCenterOffset:type==='frost-stitch'?FROST_SKILLS.stitchGroundOffset:['nope-bottle','mend-seeds','echo-tag','ember-solder'].includes(type)?.12:0);
    if(!canStand(x,z,.12,floor))continue;
    if(type.startsWith('frost-')&&(ordinaryGroundHeight(x,z,floor)===null||!map.collision.rayClear(actor.x,eye,actor.z,x,floor+.12,z)))continue;
    if(type==='nope-decoy'){
      if(map.collision.rayClear(actor.x,eye,actor.z,x,y+1.4,z))return{x,y,z};
      continue;
    }
    const event={type,x,y,z,fromX:actor.x,fromY:eye,fromZ:actor.z,startedAt:elapsed,flight};
    let previous={x:actor.x,y:eye,z:actor.z},clear=true;
    for(let index=1;index<=32;index++){
      const next=skillProjectilePosition(event,elapsed+flight*index/32);
      if(!next||!map.collision.rayClear(previous.x,previous.y,previous.z,next.x,next.y,next.z)){clear=false;break;}
      previous=next;
    }
    if(clear)return{x,y,z};
  }
  return null;
}
function activateAbility(actor,key,{predict=false,zonePoint=null,aim=null}={}){
  if(ordinarySkills.sealUntil(actor?.id,elapsed)>elapsed){if(actor===player)showMessage('羽根の封印', '新しいスキルは使えません · 銃と移動は使えます',1);return;}
  if(actor?.kit?.character==='onnara')return activateOnnaraAbility(actor,key,{predict,aim});
  if(actor?.kit?.character==='urchin')return activateUrchinAbility(actor,key,{predict,aim});
  if(actor?.kit?.character==='cap')return activateCapAbility(actor,key,{predict,aim});
 if(actor?.kit?.character==='japan')return activateJapanAbility(actor,key,{predict,aim});
  if(actor?.kit?.character==='nobi')return activateNobiAbility(actor,key,{predict,aim});
  if(actor?.kit?.character==='car')return activateCarAbility(actor,key,{predict,aim});
  if(actor?.kit?.character==='cat')return activateCatAbility(actor,key,{predict,aim});
  if(actor?.kit?.character==='duck'&&String(key).toLowerCase()==='x')return activateDuckEgg(actor,{predict});
  if(netHostPaused||!actor?.alive||match?.phase!=='live'||actor.planting||actor.defusing)return;
  actor.kit||=new DuelistKit();
  if(String(key).toLowerCase().replace(/^key/,'')==='x'&&actor.kit.character==='mend'&&!teamAbilities.canMend(actor,[player,...bots],mendReachable)){
    if(actor===player)showMessage(`${CHARACTER_DEFS.mend.label} / 回復対象なし`,'18m以内で視線の通る負傷した味方が必要です · ポイントは消費しません',2);
    return;
  }
  const definition=getCharacterSkill(actor.kit.character,key),ordinary=definition&&['duck-','nope-','mend-','echo-','veil-','ember-','frost-','duelist-'].some(prefix=>definition.type.startsWith(prefix));
  if(actor.serviceReload)return;
  if(definition?.type==='ember-service'&&!canServiceReload(actor))return;
  const healing=definition?.type==='mend-heal',healTarget=healing?selectMendTarget(actor,[player,...bots],mendReachable):null;
  if(healing&&!healTarget){if(actor===player)showMessage('ひまわりの手当て / 回復対象なし','12m以内で視線の通る負傷した味方が必要です · 回数は消費しません',2);return;}
  const target=healing?{x:healTarget.x,y:healTarget.y||0,z:healTarget.z,targetId:healTarget.id}:ordinary?getSkillTarget(actor,definition.type,zonePoint,aim):null;
  if(ordinary&&!target){if(actor===player&&(definition.type.startsWith('veil-')||definition.type.startsWith('frost-')))showMessage(`${definition.name} / 床を確認`,definition.type==='veil-roots'?'根を伸ばせる床が必要です · 回数は消費しません':definition.type==='frost-unravel'?'床や階段に着地してから使えます · 回数は消費しません':definition.type.startsWith('frost-')?'視線と投げる道が通る床を狙ってください · 回数は消費しません':'床や階段に着地してから使えます · 回数は消費しません',1.5);return;}
  const takeover=String(key).toLowerCase().replace(/^key/,'')==='x'&&actor.kit.character==='nope';
  const takeoverPoints=takeover&&!predict?chooseNopeDecoyPoints(actor):null;
  if(takeover&&!predict&&takeoverPoints.length!==30)return;
  const before=ordinary||takeover?actor.kit.snapshot():null;
  const effect=actor.kit.activate(key,elapsed);if(!effect)return;
  const yaw=aim?.yaw??(actor===player?player.yaw:(netInputs.get(actor.remoteId)?.input?.yaw??actor.yaw??0)),pitch=aim?.pitch??(actor===player?player.pitch:(netInputs.get(actor.remoteId)?.input?.pitch??0));
  if(ordinary){
    const event=predict?null:ordinarySkills.cast(effect,ordinaryActorView(actor),target,elapsed,match.round);
    if(!predict&&!event){actor.kit.restore(before);return;}
    if(effect.type==='ember-service'&&!predict)beginServiceReload(actor,event);
    if(!['duck-hush','nope-decoy','echo-kerning','veil-turf','ember-shade','ember-service','frost-unravel','duelist-lift'].includes(effect.type))actor.skillThrowUntil=elapsed+.32;
    if(!['duck-hush','echo-kerning','veil-turf','ember-shade','ember-service','frost-unravel','duelist-lift'].includes(effect.type)){
      if(actor.remoteId)actor.netReload=0;
      if(actor===player){ordinaryFX.playThrow(effect.type,elapsed);mendSkillFX.playThrow(effect.type,elapsed);iagnuSkillFX.playThrow(effect.type,elapsed);grassSkillFX.playThrow(effect.type,elapsed);emberSkillFX.playThrow(effect.type,elapsed);frostSkillFX.playThrow(effect.type,elapsed);duelistSkillFX.playThrow(effect.type,elapsed);firing=false;reloading=0;}
    }
    if(healing&&!predict)updateOrdinarySkills();
  }
  if(!predict&&actor===player)skillFeedback.note('cast','accepted:'+match.round+':'+effect.type+':'+elapsed,actor.kit.character,elapsed,definition?.name||CHARACTER_DEFS[actor.kit.character]?.ultName);
  if(effect.type==='smoke'&&!predict){const origin=new THREE.Vector3(actor.x,(actor.y||0)+1.6,actor.z),aim=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));raycaster.set(origin,aim);raycaster.far=16;const hit=raycaster.intersectObject(environment,true)[0],end=origin.clone().addScaledVector(aim,hit?Math.max(.8,hit.distance-1):16);end.y=Math.max(1.7,end.y);syncSmokes([...serializeSmokes().slice(-19),{id:++smokeSequence,x:end.x,y:end.y,z:end.z,expires:elapsed+effect.duration,kind:'smoke',radius:3.6}]);raycaster.far=190;}
  if(effect.type==='veil'&&!predict)syncSmokes([...serializeSmokes().slice(-19),{id:++smokeSequence,x:actor.x,y:(actor.y||0)+1.7,z:actor.z,expires:elapsed+effect.duration,kind:'veil',radius:effect.radius}]);
  // Remote casts can happen between two BOT updates. Invalidate sightings now,
  // before another BOT uses a target acquired earlier in the same frame.
  if(!predict&&['smoke','veil'].includes(effect.type))for(const other of bots)if(other.target&&!visibleBetween(other,other.target))other.target=null;
  if(effect.type==='updraft'||effect.type==='duelist-lift')actor.vy=effect.velocity;
  if(effect.type==='nope'&&!predict){
    if(!nopeDecoys.start(ordinaryActorView(actor),takeoverPoints,elapsed,match.round)){actor.kit.restore(before);return;}
    startTakeover({id:`${match.round}:${actor.id}:${elapsed.toFixed(6)}`,round:match.round,startedAt:elapsed,endsAt:elapsed+effect.duration});
  }
  if(effect.type==='mend'&&!predict)teamAbilities.castMend(actor,[player,...bots],elapsed,match.round,mendReachable);
  if(effect.type==='recon'&&!predict){teamAbilities.castRecon(actor,elapsed,match.round);updateTeamAbilities();}
  if(['ember','frost'].includes(effect.type)&&!predict)zoneAbilities.cast(effect.type,actor,getZoneTarget(actor,zonePoint,aim),elapsed,match.round);
  if(effect.type==='dash'){let dx=-Math.sin(yaw),dz=-Math.cos(yaw);if(actor===player){const side=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),forward=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0);if(side||forward){dx=-Math.sin(yaw)*forward+Math.cos(yaw)*side;dz=-Math.cos(yaw)*forward-Math.sin(yaw)*side;}}const len=Math.hypot(dx,dz)||1;actor.dashVec={x:dx/len,z:dz/len};actor.dashTimer=effect.duration;}
  if(effect.type==='knives'){if(actor===player){ammoStore[inventory.active]={ammo:player.ammo,reserve:player.reserve};equip('knife',true);}else{actor.netStores||={};actor.netStores[actor.netWeapon]={ammo:actor.netAmmo,reserve:actor.netReserve};actor.netWeapon='knife';}}
  if(ordinary){if(!effect.type.startsWith('veil-')&&!['mend-heal','nope-decoy','echo-kerning','ember-shade','ember-service','frost-unravel','duelist-lift','duck-hush'].includes(effect.type))sound('skill-throw',{entity:actor,localOnly:true});}
  else if(effect.type!=='nope')sound({mend:'heal',recon:'recon',veil:'veil',ember:'ember-warning'}[effect.type]||effect.type,{entity:actor});
  if(actor===player&&ordinary)showMessage(definition.name,definition.description,2);
  if(actor===player){const texts={smoke:['CLOUD VEIL','4.5秒間、視線と射線の判断を遮る煙幕'],updraft:['UPDRAFT','上昇中もナイフは正確に飛びます'],'dash-armed':['TAILWIND READY',`${DUELIST.dashArmDelay}秒後から E でもう一度発動 · ${DUELIST.dashWindow}秒以内`],dash:['TAILWIND',`${DUELIST.signatureKills}キルで再チャージ`],knives:['BLADE STORM','5本 · 撃破すると全回復'],nope:['NOPE TAKEOVER','12秒間、街中に30体の全身デコイ＋駅ロゴ化 · 敵が撃つと閃光'],mend:['RECOVERY WAVE','18m以内・視線の通る味方と自身を最大75HP回復'],recon:['RECON PULSE','30mを3回索敵 · 検知した地点だけをミニマップへ表示'],veil:['BLACKOUT DOME','発動地点に半径9m・12秒の煙幕 · 敵味方双方の視界を遮断'],ember:['FLARE STRIKE','照準の先20m以内 · 1.2秒の予告後に3回爆撃 · 味方は無傷'],frost:['CRYO FIELD','照準の先20m以内 · 10秒の氷結地帯 · 敵の歩く速さを55%に']};const text=texts[effect.type];if(text)showMessage(...text,2);}
  return effect;
}
function refillMapPracticeSkills(){
  if(!exploring||rangeSession||objectivePractice||onlinePlaying||!player.alive)return;
  const kit=player.kit;if(!kit)return;
  kit.smoke=getCharacterSkill(kit.character,'c').max;kit.updraft=getCharacterSkill(kit.character,'q').max;
  if(kit.armExpiresAt===null&&!(player.dashTimer>0)){kit.dash=1;kit.dashKills=0;kit.nextSignatureAt=0;}
  kit.ultPoints=DUELIST.ultimatePoints;if(kit.knivesActive)kit.knives=DUELIST.knives;
}
function confirmDuckSkill(key){
 if(player.kit?.character==='onnara')return confirmOnnaraSkill(key);
 if(player.kit?.character==='urchin')return confirmUrchinSkill(key);
 if(player.kit?.character==='cap')return confirmCapSkill(key);
 if(player.kit?.character==='japan')return confirmJapanSkill(key);
 if(player.kit?.character==='nobi')return confirmNobiSkill(key);
 if(player.kit?.character==='car')return confirmCarSkill(key);
 if(player.kit?.character==='cat')return confirmCatSkill(key);
 if(netHostPaused||mode!=='play'||!player.alive||interactionHeld||objectivePractice)return;
 refillMapPracticeSkills();const aim={yaw:player.yaw,pitch:player.pitch},effect=activateAbility(player,key,{predict:isGuest(),aim});
 if(effect&&isGuest())queueNetAction('ability',{key,...aim});
 if(!effect)showMessage('発動できません',key==='c'?'視線の通る敵の胴体へ照準を合わせてください · 回数は消費しません':'床・在庫・封印状態を確認してください · 回数は消費しません',2);
 refillMapPracticeSkills();updateHUD();
}
function useAbility(key){
 if(player.kit?.character==='onnara'&&['c','q'].includes(key)&&mode==='play'&&player.alive&&match?.phase==='live'&&!netHostPaused&&!interactionHeld&&!objectivePractice){duckAim=duckAim===key?null:key;firing=false;aiming=false;if(duckAim)showMessage(getCharacterSkill('onnara',key).name,'照準で狙う → 左クリックで確定 / 右クリックで取消',30);return;}
 if(player.kit?.character==='urchin'&&['c','q'].includes(key)&&mode==='play'&&player.alive&&match?.phase==='live'&&!netHostPaused&&!interactionHeld&&!objectivePractice){duckAim=duckAim===key?null:key;firing=false;aiming=false;if(duckAim)showMessage(getCharacterSkill('urchin',key).name,'照準で狙う → 左クリックで確定 / 右クリックで取消',30);return;}
 if(player.kit?.character==='cap'&&['c','q'].includes(key)&&mode==='play'&&player.alive&&match?.phase==='live'&&!netHostPaused&&!interactionHeld&&!objectivePractice){duckAim=duckAim===key?null:key;firing=false;aiming=false;if(duckAim)showMessage(getCharacterSkill('cap',key).name,'照準で狙う → 左クリックで確定 / 右クリックで取消',30);return;}
 if(player.kit?.character==='japan'&&['c','q'].includes(key)&&mode==='play'&&player.alive&&match?.phase==='live'&&!netHostPaused&&!interactionHeld&&!objectivePractice){duckAim=duckAim===key?null:key;firing=false;aiming=false;if(duckAim)showMessage(getCharacterSkill('japan',key).name,'照準で狙う → 左クリックで確定 / 右クリックで取消',30);return;}
 if(player.kit?.character==='nobi'&&['c','q'].includes(key)&&mode==='play'&&player.alive&&match?.phase==='live'&&!netHostPaused&&!interactionHeld&&!objectivePractice){duckAim=duckAim===key?null:key;firing=false;aiming=false;if(duckAim)showMessage(getCharacterSkill('nobi',key).name,'照準で狙う → 左クリックで確定 / 右クリックで取消',30);return;}
 if(player.kit?.character==='car'&&['c','q'].includes(key)&&mode==='play'&&player.alive&&match?.phase==='live'&&!netHostPaused&&!interactionHeld&&!objectivePractice){duckAim=duckAim===key?null:key;firing=false;aiming=false;if(duckAim)showMessage(getCharacterSkill('car',key).name,'照準で狙う → 左クリックで確定 / 右クリックで取消',30);return;}
 if(player.kit?.character==='cat'&&['q','e'].includes(key)&&mode==='play'&&player.alive&&match?.phase==='live'&&!netHostPaused&&!interactionHeld&&!objectivePractice){duckAim=duckAim===key?null:key;firing=false;aiming=false;if(duckAim)showMessage(getCharacterSkill('cat',key).name,'狙って左クリックで確定 / 右クリックで取消',30);return;}
 const catReturning=player.kit?.character==='cat'&&key==='c'&&!!ordinarySkills.catBookmark(player.id,elapsed);
 if(player.kit?.character==='duck'&&['c','q'].includes(key)&&mode==='play'&&player.alive&&match?.phase==='live'&&!netHostPaused&&!interactionHeld){
  duckAim=duckAim===key?null:key;firing=false;aiming=false;if(duckAim)showMessage(getCharacterSkill('duck',key).name,'照準で狙う → 左クリックで確定 / 右クリックで取消',30);return;
 }
 refillMapPracticeSkills();if(netHostPaused||mode!=='play'||!player.alive||interactionHeld||objectivePractice)return;const aim={yaw:player.yaw,pitch:player.pitch};const effect=activateAbility(player,key,{predict:isGuest(),aim});if(isGuest()){queueNetAction('ability',{key,...aim,...(catReturning?{catReturning:true}:{}),direction:effect?.type==='dash'?player.dashVec:null});if(effect?.type==='dash')player.netPredictDashUntil=elapsed+.6;}refillMapPracticeSkills();updateHUD();}
function dash(){useAbility('q');}
function scan(){useAbility('e');}
function jump(){if(!netHostPaused&&mode==='play'&&player.alive&&player.vy===0&&!ordinarySkills.onnaraEvent?.('onnara-hover',player.id,elapsed)&&!interactionHeld){player.vy=6.552;sound('reload');}}
function updateHUD(){
  if(!match)return;
  const armedWeapon=weapon(),ultimateKnives=player.kit.knivesActive&&inventory.active==='knife',firearm=inventory.active!=='spike'&&armedWeapon.mag>0;
  $('hud')?.classList.toggle('objective-practice',!!objectivePractice);
  $('health').textContent=Math.ceil(player.hp);$('ammo').textContent=firearm?player.ammo:ultimateKnives?player.kit.knives:'—';$('reserve').textContent=firearm?player.reserve:ultimateKnives?'∞':'—';
  $('timer').textContent=formatTime(Math.ceil(timeLeft));$('kills').textContent=String(totalKills).padStart(2,'0');
  $('remaining').textContent=aliveCount(player.team==='blue'?'red':'blue');$('ally-alive').textContent=aliveCount(player.team);
  $('round-label').textContent=`ROUND ${String(match.round).padStart(2,'0')}${match.overtime?' · OVERTIME':''}`;
  $('team-score').textContent=match.score[player.team];$('enemy-score').textContent=match.score[player.team==='blue'?'red':'blue'];
  $('side-label').textContent=sideNames[ownSide()];$('credits').textContent=match.credits.toLocaleString();$('armor').textContent=Math.ceil(player.armor);
  $('weapon-name').textContent=inventory.active==='spike'?'BOMBER':weapon().name;
  $('mobile-ads')?.setAttribute('aria-pressed',String(aiming&&weapon().slot==='primary'));
  $('mobile-crouch')?.setAttribute('aria-pressed',String(keys.has('TouchCrouch')));
  if($('mobile-ads'))$('mobile-ads').disabled=weapon().slot!=='primary'||!player.alive;
  const interactButton=$('mobile-interact'),practiceComplete=!!objectivePractice?.completed;
  if(interactButton){
    const reset=interactButton.disabled&&!practiceComplete;interactButton.disabled=practiceComplete;
    if(practiceComplete||reset){
      if($('mobile-interact-label'))$('mobile-interact-label').textContent=practiceComplete?'完了':'F';
      if($('mobile-interact-hint'))$('mobile-interact-hint').textContent=practiceComplete?'Mで再挑戦':'長押し';
    }
  }
  const s=match.spike;
  $('phase-label').textContent=match.phase==='buy'?'BUY PHASE / 購入':match.phase==='post'?'ROUND OVER':s.status==='planted'?'BOMBER PLANTED':'ROUND LIVE';
  $('objective-label').textContent=match.phase==='buy'?(onlinePlaying?'Bで購入 · フェーズ終了で全員同時に開始':'Bで購入 · 購入終了ボタンで開始'):ownSide()==='attack'?(s.status==='planted'?'起爆までボンバーを守れ':'A / B サイトで F 長押し → 4秒で設置'):(s.status==='planted'?'ボンバー付近で F 長押し → 7秒で電源オフ':'敵の設置を阻止せよ');
  $('spike-state').textContent=s.status==='planted'?`${s.site} · 起爆まで ${Math.ceil(s.timer)}s`:s.status==='dropped'?'BOMBER DROPPED / 回収可能':s.status==='defused'?'BOMBER POWERED OFF':s.status==='detonated'?'BOMBER DETONATED':s.carrier===player.id?'BOMBER · YOU':`BOMBER · ${ownSide()==='attack'?'味方が所持':'敵が所持'}`;
  $('health').style.color=player.hp<35?'#ff5a67':'';
  $('ammo').style.color=firearm&&player.ammo<8?'#ff5a67':'';
  $('reload-state').textContent=player.serviceReload?'クイックソルダー…':reloading>0?'RELOADING…':firearm&&player.ammo===0?(player.reserve>0?'R  リロード':'弾薬切れ · 武器を持ち替え'):'';
  $('reload-state').hidden=!player.alive||!firearm||!(reloading>0||player.serviceReload||player.ammo===0);
  const kit=player.kit,k=kit.snapshot();
  const character=CHARACTER_DEFS[normalizeCharacter(k.character)];
  if($('ability-x-glyph'))$('ability-x-glyph').setAttribute('d',character.ultIcon);
  if($('status-effects')){
    const scale=player.alive?actorSpeedScale(player):1,boosted=player.alive&&actorMovementScale(player)>1,slowed=scale<1,blind=player.alive&&ordinarySkills.blindUntil(player.id,elapsed)>elapsed;
    const statuses=[];
    const carGyro=ordinarySkills.carGyro(player.id,elapsed);
    const tax=ordinarySkills.onnaraTax?.(player.id,elapsed);if(tax)statuses.push(tax.power>0?`王冠の徴税 · 発砲ごとHP4 / 残り${Math.ceil(tax.power/ONNARA_SKILLS.taxPerShot)}回 · HP1で止まる`:'王冠の徴税 · 10発分の代償を払い終えました');
    if(ordinarySkills.onnaraEvent?.('onnara-hover',player.id,elapsed)&&!starHold.stopped(ordinarySkills.onnaraEvent('onnara-hover',player.id,elapsed).id))statuses.push('星留め · 空中静止');
    if(ordinarySkills.onnaraEvent?.('onnara-chain',player.id,elapsed))statuses.push('星座裁定 · 近くの敵へ70%連鎖');
    if(ordinarySkills.urchinJammed(player.id,elapsed))statuses.push('棘錠 · 装填不可');
    if(ordinarySkills.urchinTrident(player.id,elapsed))statuses.push('三叉潮 · 三方向射撃');
    if(ordinarySkills.capLocked(player.id,elapsed))statuses.push('レンズブレイク · 銃弾が拡散 / ADS不可');
    if(ordinarySkills.capBank(player.id,elapsed))statuses.push('バンクレンズ · 1回跳弾');
    if(ordinarySkills.capMagazine(player.id,elapsed))statuses.push('エンドレスマガジン · 銃弾消費なし');
    if(ordinarySkills.japanReturn(player.id,elapsed)>0)statuses.push('弾丸返送 · 被銃撃の65%を返す');
    if(ordinarySkills.nobiVulnerability(player.id,elapsed)>1)statuses.push('鈴の弱点 · 被銃撃135%');
    if(ordinarySkills.nobiInterval(player.id,elapsed)>1)statuses.push('ひげブレーキ · 銃の射撃間隔160%');
    if(ordinarySkills.nobiWork(player.id,elapsed)>1)statuses.push('ポケット工具 · 設置・電源オフ150%');
    if(ordinarySkills.nobiLegend(player.id,elapsed))statuses.push('逆転えり · 胴・脚も頭相当');
    const catBook=ordinarySkills.catBookmark(player.id,elapsed),catClock=ordinarySkills.clockFrozen(elapsed);
    const duckSeal=ordinarySkills.sealUntil(player.id,elapsed)>elapsed,duckQuiet=ordinarySkills.quiet(player.id,elapsed),duckEgg=ordinarySkills.events(elapsed).find(e=>e.type==='duck-egg'&&e.sourceId===player.id);
    const personal=player.alive?ordinarySkills.events(elapsed).filter(event=>event.sourceId===player.id):[],shade=personal.some(event=>event.type==='ember-shade'),unravel=personal.some(event=>event.type==='frost-unravel')&&actorGrounded(player);
    $('status-effects').hidden=!statuses.length&&!carGyro&&!catBook&&!catClock&&!duckAim&&!duckSeal&&!duckQuiet&&!duckEgg&&!slowed&&!boosted&&!blind&&!shade&&!unravel;
    $('status-effects').textContent=[...statuses,carGyro?'タイヤジャイロ · 接地中の移動射撃安定':'',catBook?`白いしおり · Cで帰還 ${Math.max(0,Math.ceil(catBook.endsAt-elapsed))}秒`:'',catClock?'白紙の8秒 · 試合時計停止 / 行動は継続':'',duckAim?'狙って左クリックで確定 / 右クリックで取消':'',duckSeal?'羽根の封印 · 新規スキル使用不可':'',duckQuiet?'忍びガモ · 足音・着地音なし':'',duckEgg?`不屈の卵 · 残り${duckEgg.power}回`:'',slowed?`足止め中 · 移動速度 ${Math.round(scale*100)}%`:'',boosted?`${CHARACTER_DEFS[player.kit.character].label} / ${getCharacterSkill(player.kit.character,'e').name} · ${Math.round(scale*100)}%`:'',blind?'FLASH · 視界回復中':'',shade?`遮光チェック · 新しい閃光の時間${Math.round(EMBER_SKILLS.shadeFlashScale*100)}%`:'',unravel?`${getCharacterSkill('frost','e').name} · ${frostSlideSpeed(player)>0?'滑走中 / ':''}減速分を${Math.round((1-FROST_SKILLS.unravelSlowFraction)*100)}%軽減`:''].filter(Boolean).join(' / ');
  }
  if($('ability-x-name'))$('ability-x-name').textContent=character.ultShortName;
  if($('mobile-ult-name'))$('mobile-ult-name').textContent=character.ultShortName;
  $('mobile-ult')?.setAttribute('aria-label',`X ${character.ultName}`);
  skillUI.updateHUD(kit,elapsed,{alive:player.alive});
  if($('ability-x-count'))$('ability-x-count').textContent=k.knivesActive?`${k.knives}本`:`${k.ultPoints}/7`;
  $('ability-x')?.classList.toggle('cooldown',!player.alive||!(k.ultPoints>=7||k.knivesActive));
  setVisible('online-session-status',onlinePlaying);if($('online-session-status')&&onlinePlaying)$('online-session-status').textContent=netHostPaused?'ホストが戻るまで試合を一時停止':`ONLINE · ${online.room.code}`;
  setVisible('restart',!onlinePlaying);if($('pause-note'))$('pause-note').textContent=onlinePlaying?'この画面を開いている間も試合は進みます。':'準備ができたら、作戦を再開しよう。';
  if($('health-bar'))$('health-bar').style.width=`${player.hp}%`;
  const zone=resolveMapCallout(map,!player.alive&&spectatedBot?spectatedBot:player);
  $('zone').textContent=zone?.name||'NORTH PLAZA / 北口広場';
  if(exploring){
    $('timer').textContent='∞';$('round-label').textContent=(map.shortName||'HASHIMOTO')+' / MAP PRACTICE';$('side-label').textContent='マップ練習';
    $('phase-label').textContent='2 SITES / 3 LANES';$('objective-label').textContent=!rangeSession&&!objectivePractice?'C/Q/E/X 無限 · M：ルート確認・地点移動 · B：武器選択':'M：ルート確認・地点移動 · WASD：移動 · B：武器選択';
    $('spike-state').textContent=map.id==='hirakata'?'南北自由通路 / バス車道に注意 / 接触100ダメージ':'バス通り / 中央連絡路 / ミウィ通り';$('zone').textContent=zone?.name||((map.name||'橋本駅')+'前');
  }
  if($('ally-label'))$('ally-label').textContent=rangeSession?'SCORE':'YOUR TEAM';
  if($('enemy-label'))$('enemy-label').textContent=rangeSession?'HEADSHOT':'ENEMY TEAM';
  setVisible('ally-status',!rangeSession&&!objectivePractice);setVisible('enemy-status',!rangeSession&&!objectivePractice);
  if(rangeSession){
    const result=rangeSession.summary();
    $('timer').textContent=formatTime(Math.ceil(rangeSession.remaining));$('round-label').textContent='60 SECOND AIM DRILL';
    $('phase-label').textContent='SHOOTING RANGE / 射撃訓練';$('side-label').textContent='射撃訓練';
    $('team-score').textContent=result.score;$('enemy-score').textContent=rangeSession.headKills;
    $('objective-label').textContent='頭で撃破150点 / 胴で撃破100点 · Bで武器選択';
    $('spike-state').textContent=`${result.kills}撃破 · 命中 ${result.accuracy}% · ヘッド ${result.headRate}%`;
  }
  if(objectivePractice){
    const p=objectivePractice,plant=p.kind==='plant';
    $('timer').textContent='∞';$('round-label').textContent=`${p.site} SITE / OBJECTIVE PRACTICE`;
    $('side-label').textContent=plant?'設置練習':'電源オフ練習';$('phase-label').textContent=p.completed?'練習成功':plant?'F 長押し · 4秒で設置':'F 長押し · 7秒で電源オフ';
    $('objective-label').textContent=p.completed?'M → A/Bでやり直す · 設置した本体を近くで確認できます':plant?'設置区画内で静止して F · MでA/Bを切替':'3.5秒で進捗50%を保存 · 離して再開できます · MでA/Bを切替';
    $('spike-state').textContent=p.completed?`${p.site} · ${plant?'設置成功':'電源オフ成功'} · 起爆なし`:`${p.site} · BOTなし / 時間制限なし / 起爆なし`;
    if($('ally-label'))$('ally-label').textContent='SITE';if($('enemy-label'))$('enemy-label').textContent='TARGET';
    $('team-score').textContent=p.site;$('enemy-score').textContent=plant?'4s':'7s';
    for(const key of ['c','q','e','x']){if($(`ability-${key}-count`))$(`ability-${key}-count`).textContent='—';$(`ability-${key}`)?.classList.add('cooldown');}
  }
}
function drawMinimap(target,large=false){
  if(!target)return;const ctx=target.getContext('2d'),w=target.width,h=target.height,pad=large?40:14;
  const bounds=activeArenaBounds();
  const scale=Math.min((w-pad*2)/(bounds.maxX-bounds.minX),(h-pad*2)/(bounds.maxZ-bounds.minZ));
  const ox=(w-(bounds.maxX-bounds.minX)*scale)/2,oz=(h-(bounds.maxZ-bounds.minZ)*scale)/2;
  const px=x=>ox+(x-bounds.minX)*scale,pz=z=>oz+(z-bounds.minZ)*scale;
  ctx.clearRect(0,0,w,h);ctx.fillStyle=large?'#101f28':'rgba(12,28,36,.88)';ctx.fillRect(0,0,w,h);
  ctx.save();ctx.beginPath();ctx.rect(pad,pad,w-pad*2,h-pad*2);ctx.clip();
  const grid=large?20:20;ctx.strokeStyle='rgba(156,197,200,.08)';ctx.lineWidth=1;
  for(let x=Math.ceil(bounds.minX/grid)*grid;x<bounds.maxX;x+=grid){ctx.beginPath();ctx.moveTo(px(x),0);ctx.lineTo(px(x),h);ctx.stroke();}
  for(let z=Math.ceil(bounds.minZ/grid)*grid;z<bounds.maxZ;z+=grid){ctx.beginPath();ctx.moveTo(0,pz(z));ctx.lineTo(w,pz(z));ctx.stroke();}
  drawMapShapes(ctx,map.mapShapes,{bounds,px,pz,scale,large});
  if(large&&map.tactical?.flanks){ctx.save();ctx.strokeStyle='#8bc9bd';ctx.lineWidth=2;ctx.setLineDash([5,4]);for(const flank of map.tactical.flanks){const points=flank.points;ctx.beginPath();ctx.moveTo(px(points[0][0]),pz(points[0][1]));for(const[x,z]of points.slice(1))ctx.lineTo(px(x),pz(z));ctx.stroke();const[a,b]=points.slice(-2),angle=Math.atan2(b[1]-a[1],b[0]-a[0]);ctx.setLineDash([]);ctx.beginPath();for(const side of[-1,1]){ctx.moveTo(px(b[0]),pz(b[1]));ctx.lineTo(px(b[0])-Math.cos(angle+side*.5)*9,pz(b[1])-Math.sin(angle+side*.5)*9);}ctx.stroke();ctx.setLineDash([5,4]);}ctx.restore();}
  if(large&&exploring&&map.combatBounds&&map.combatBounds!==map.bounds){const b=map.combatBounds;ctx.save();ctx.strokeStyle='#e68172';ctx.lineWidth=2;ctx.setLineDash([6,5]);ctx.strokeRect(px(b.minX),pz(b.minZ),(b.maxX-b.minX)*scale,(b.maxZ-b.minZ)*scale);ctx.setLineDash([]);ctx.fillStyle='#efb4a8';ctx.font='12px sans-serif';ctx.textAlign='left';ctx.fillText('対戦エリア / 164m',px(b.minX)+5,pz(b.minZ)+15);ctx.restore();}
  if(map.traffic)for(const bus of map.traffic.poses(elapsed)){ctx.save();ctx.translate(px(bus.x),pz(bus.z));ctx.rotate(-bus.yaw);ctx.fillStyle='#ee6675';ctx.fillRect(-1.25*scale,-5.3*scale,2.5*scale,10.6*scale);ctx.restore();}
  ctx.textAlign='center';ctx.textBaseline='middle';
  for(const pos of map.sites){
    if(pos.polygon?.length){ctx.beginPath();ctx.moveTo(px(pos.polygon[0][0]),pz(pos.polygon[0][1]));for(const [x,z] of pos.polygon.slice(1))ctx.lineTo(px(x),pz(z));ctx.closePath();ctx.fillStyle='rgba(237,178,132,.13)';ctx.fill();ctx.strokeStyle='#c5b080';ctx.lineWidth=large?1.8:1;ctx.stroke();}
    ctx.fillStyle='#edb284';ctx.font=`bold ${large?26:14}px sans-serif`;ctx.fillText(pos.id,px(pos.x),pz(pos.z));
  }
  if(large){ctx.font='600 13px "Yu Gothic",sans-serif';for(const label of getMapCalloutLabels(map)){ctx.textAlign=label.align;ctx.strokeStyle='#101f28';ctx.lineWidth=4;ctx.strokeText(label.name,px(label.x),pz(label.z));ctx.fillStyle='#d7e2dc';ctx.fillText(label.name,px(label.x),pz(label.z));}}
  for(const bot of bots){if(!bot.alive||bot.team!==player.team&&!(bot.spottedUntil>elapsed))continue;ctx.fillStyle=bot.team===player.team?'#8edcca':'#ff626b';ctx.beginPath();ctx.arc(px(bot.x),pz(bot.z),large?6:3.5,0,Math.PI*2);ctx.fill();}
  for(const ping of teamAbilities.markers(player.team,elapsed)){
    const size=large?8:5,alpha=clamp((ping.endsAt-elapsed)/1.25,0,1);
    ctx.globalAlpha=.35+alpha*.65;ctx.strokeStyle='#d5b5ff';ctx.lineWidth=large?2.5:1.7;
    ctx.beginPath();ctx.moveTo(px(ping.x),pz(ping.z)-size);ctx.lineTo(px(ping.x)+size,pz(ping.z));ctx.lineTo(px(ping.x),pz(ping.z)+size);ctx.lineTo(px(ping.x)-size,pz(ping.z));ctx.closePath();ctx.stroke();ctx.globalAlpha=1;
  }
  for(const marker of ordinarySkills.markers(player.team,elapsed)){
    const size=large?7:4,alpha=clamp((marker.endsAt-elapsed)/IAGNU_SKILLS.tagRevealDuration,0,1);
    ctx.globalAlpha=.35+alpha*.65;ctx.strokeStyle='#ffe39b';ctx.lineWidth=large?2.5:1.7;
    ctx.strokeRect(px(marker.x)-size,pz(marker.z)-size,size*2,size*2);ctx.globalAlpha=1;
  }
  if(match&&['dropped','planted'].includes(match.spike.status)){ctx.fillStyle='#ffe5a8';ctx.fillRect(px(match.spike.x)-4,pz(match.spike.z)-4,8,8);}
  const viewer=!player.alive&&spectatedBot?spectatedBot:player;
  ctx.save();ctx.translate(px(viewer.x),pz(viewer.z));ctx.rotate(-(viewer===player?player.yaw:viewer.group.rotation.y+Math.PI));
  ctx.fillStyle='#adf4e6';ctx.beginPath();ctx.moveTo(0,-(large?13:7));ctx.lineTo(large?9:5,large?9:5);ctx.lineTo(0,large?5:3);ctx.lineTo(large?-9:-5,large?9:5);ctx.closePath();ctx.fill();ctx.restore();
  if(scanTime>0){ctx.strokeStyle=`rgba(120,245,220,${.3+Math.sin(elapsed*5)*.2})`;ctx.beginPath();ctx.arc(px(player.x),pz(player.z),(elapsed%1.5)/1.5*100*scale,0,Math.PI*2);ctx.stroke();}
  ctx.restore();ctx.fillStyle='#c5d0ca';ctx.font=`${large?16:10}px monospace`;ctx.textAlign='left';ctx.fillText('N ↑',pad,large?24:11);
  const metres=large?20:20;ctx.strokeStyle='#b4c8c5';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(pad,h-12);ctx.lineTo(pad+metres*scale,h-12);ctx.stroke();ctx.font='10px monospace';ctx.fillText(`${metres} m`,pad,h-17);
  if(large){ctx.font='11px "Yu Gothic",sans-serif';ctx.textAlign='right';ctx.fillText('塗り：壁・遮蔽物　破線：頭上の屋根',w-pad,h-14);}
}

function enemyRimFor(bot){const viewerTeam=!player.alive&&spectatedBot?spectatedBot.team:player.team;return mode!=='menu'&&(viewerTeam==='blue'||viewerTeam==='red')&&(bot.team==='blue'||bot.team==='red')&&bot.team!==viewerTeam;}
function agentEquipment(bot){const weapon=bot.remoteId?bot.netWeapon:bot.netTarget?.weapon||bot.record?.primary||bot.record?.secondary||"classic";return {weapon,character:bot.kit?.character||bot.netTarget?.kit?.character||'duelist',ultimate:bot.kit?.knivesActive&&weapon==="knife",knives:bot.kit?.knives||0,shotSequence:bot.netTarget?.shotSequence??bot.shotSequence??0,enemyRim:enemyRimFor(bot),sliding:frostSlideSpeed(bot)>0&&!!bot.moving,...roundDanceState(match,bot),...(reducedMotion.matches?{danceTime:0}:{})};}
function updateBots(dt){
  const cfg=levels[difficulty]||levels.normal;
  const actors=[player,...bots];
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  const spike=match?.spike;
  const tactics=updateBots.tactics||=createBotTactics({sites:map.sites,navigation,collision:map.collision,lanes:map.lanes,attackSpawn:map.teamSpawns.attack[0],defendSpawn:map.teamSpawns.defend[0]});
  let plan=null;
  // Share only sightings. A remembered enemy position never updates through a wall or smoke.
  if(match?.phase==='live'&&!isGuest()){
    for(const bot of bots){
      if(!bot.alive||bot.remoteId||bot.rangeTarget)continue;
      bot.think=(bot.think||0)-dt;
      const sees=enemy=>ordinarySkills.blindUntil(bot.id,elapsed)<=elapsed&&enemy.alive&&enemy.team!==bot.team&&inVisionCone(bot,enemy,{yaw:bot.group.rotation.y})&&visibleBetween(bot,enemy);
      if(bot.think<=0||bot.target&&!bot.target.alive){
        let target=bot.target&&sees(bot.target)?bot.target:null,best=target?distance(bot,target)-4:240;
        for(const enemy of actors){
          if(enemy.team===bot.team||!enemy.alive)continue;
          const dist=distance(bot,enemy);
          if(dist<best&&sees(enemy)){best=dist;target=enemy;}
        }
        if(target&&target!==bot.target)bot.reactionUntil=elapsed+.12+cfg.interval*.1;
        bot.target=target;bot.think=.18+Math.random()*.12;
      }
      if(bot.target&&!sees(bot.target))bot.target=null;
      const heard=botHearing.listen(bot,elapsed,{occluded:(a,b)=>!map.collision.rayClear(a.x,(a.y||0)+1.4,a.z,b.x,b.y+1.4,b.z)});
      if(heard)bot.lastHeard=heard;
      if(bot.target){
        const enemy=bot.target;
        bot.lastSeen={id:enemy.id,team:enemy.team,x:enemy.x,z:enemy.z,seenAt:elapsed};
        tactics.observe(bot.team,bot.id,enemy,elapsed);
        if(bot.team==='blue')enemy.spottedUntil=elapsed+.6;
      }
    }
    plan=tactics.update({actors,attackerTeam:match.attackerTeam,defenderTeam:match.defenderTeam,spike,now:elapsed,remaining:match.roundTime});
    targetSite=plan.siteId;
  }
  function face(bot,point,speed=7){
    const desired=Math.atan2(point.x-bot.x,point.z-bot.z),delta=Math.atan2(Math.sin(desired-bot.group.rotation.y),Math.cos(desired-bot.group.rotation.y));
    bot.group.rotation.y+=clamp(delta,-speed*dt,speed*dt);return Math.abs(delta)<.24;
  }
  function advance(bot,goal,intent='objective'){
    const safe=navigation.nearest(goal.x,goal.z);if(!safe)return false;
    const dist=distance(bot,safe);if(dist<.32){bot.path=[];return false;}
    bot.pathTime=(bot.pathTime||0)-dt;
    if(bot.pathTime<=0||!bot.path?.length||!bot.goal||distance(bot.goal,safe)>2||bot.pathIntent!==intent){
      bot.path=navigation.path(bot.x,bot.z,safe.x,safe.z);bot.pathTime=.8+Math.random()*.15;bot.goal=safe;bot.pathIntent=intent;
    }
    while(bot.path.length&&distance(bot,bot.path[0])<.22)bot.path.shift();
    const point=bot.path[0];if(!point)return false;
    const dx=point.x-bot.x,dz=point.z-bot.z,length=Math.hypot(dx,dz)||1;
    const speed=(frostSlideSpeed(bot)||(3.35+cfg.speed*.25)*1.15)*actorSpeedScale(bot);
    const step=Math.min(length,speed*dt),oldX=bot.x,oldZ=bot.z;
    if(elapsed<(bot.trafficLaunch?.endsAt||0)||map.traffic&&map.traffic.dangerous(bot.x+dx/length*step,bot.z+dz/length*step,elapsed))return false;
    moveEntity(bot,dx/length*step,dz/length*step,.4);
    bot.group.rotation.y=Math.atan2(dx,dz);
    const moved=Math.hypot(bot.x-oldX,bot.z-oldZ)>.002;
    if(!moved)bot.pathTime=0;
    return moved;
  }
  function reloadCover(bot,enemy){
    let best=null,bestScore=Infinity;
    for(let index=0;index<8;index++){
      const angle=index*Math.PI/4,point={x:bot.x+Math.sin(angle)*2.8,z:bot.z+Math.cos(angle)*2.8};
      if(!navigation.clearSegment(bot.x,bot.z,point.x,point.z))continue;
      const hidden=!map.collision.rayClear(enemy.x,(enemy.y||0)+1.45,enemy.z,point.x,1.45,point.z);
      const score=(hidden?-12:0)-distance(enemy,point)*.12;
      if(score<bestScore){best=point;bestScore=score;}
    }
    return best;
  }
  for(const bot of bots){
    bot.flash=Math.max(0,(bot.flash||0)-dt);bot.muzzle.visible=bot.flash>0;
    if(!bot.alive){
      if(isGuest()&&bot.netTarget?.trafficHit){const t=1-Math.exp(-dt*15);bot.x=THREE.MathUtils.lerp(bot.x,bot.netTarget.x,t);bot.z=THREE.MathUtils.lerp(bot.z,bot.netTarget.z,t);bot.y=THREE.MathUtils.lerp(bot.y||0,bot.netTarget.y||0,t);bot.group.position.set(bot.x,bot.y,bot.z);}
      bot.visual.update(dt,{...agentEquipment(bot),time:elapsed,moving:false,planting:false,defusing:false,firing:false,alive:false});
      if(bot.death>0){bot.death-=dt;if(bot.death<=0)bot.group.visible=false;}
      continue;
    }
    if(bot.rangeTarget){
      bot.visual.update(dt,{...agentEquipment(bot),time:elapsed,moving:false,planting:false,defusing:false,firing:false,alive:true});
      continue;
    }
    if(bot.remoteId||isGuest()){
      if(!isGuest())updateRemoteActor(bot,dt);
      else if(bot.netTarget){const t=1-Math.exp(-dt*15);bot.x=THREE.MathUtils.lerp(bot.x,bot.netTarget.x,t);bot.z=THREE.MathUtils.lerp(bot.z,bot.netTarget.z,t);bot.y=THREE.MathUtils.lerp(bot.y||0,bot.netTarget.y||0,t);bot.group.rotation.y=bot.netTarget.yaw+Math.PI;}
      bot.group.position.set(bot.x,bot.y||0,bot.z);
      bot.visual.update(dt,{...agentEquipment(bot),time:elapsed,moving:!!bot.moving,planting:!!bot.planting,defusing:!!bot.defusing,firing:bot.flash>0,alive:true});continue;
    }
    if(!match||match.phase!=='live'){
      bot.planting=false;bot.defusing=false;bot.moving=false;bot.muzzle.visible=false;
      bot.visual.update(dt,{...agentEquipment(bot),time:elapsed,moving:false,planting:false,defusing:false,firing:false,alive:true});continue;
    }
    if(bot.vy||bot.y)updateActorVertical(bot,dt,.4);
    bot.fire=Math.max(0,(bot.fire||0)-dt);
    const weaponId=bot.record?.primary||bot.record?.secondary||'classic';
    const spec=WEAPONS[weaponId]||WEAPONS.classic;
    if(bot.aiWeapon!==weaponId){cancelServiceReload(bot);bot.aiWeapon=weaponId;bot.aiAmmo=spec.mag;bot.aiReserve=spec.reserve;bot.aiReload=0;bot.burst=0;}
    if(ordinarySkills.urchinJammed(bot.id,elapsed))urchinCancelReload(bot);
    if(!tickServiceReload(bot,dt)&&bot.aiReload>0){bot.aiReload-=dt;if(bot.aiReload<=0)bot.aiAmmo=spec.mag;}
    let enemy=bot.target;
    let enemyDistance=enemy?distance(bot,enemy):Infinity;
    const role=plan?.roles.get(bot.id);
    bot.tacticRole=role?.role||'anchor';bot.tacticSite=role?.siteId||null;
    let goal=role?.goal||null,plantSite=null,shouldDefuse=false;
    const site=map.sites.find(s=>s.id===(role?.siteId||targetSite))||map.sites[0];
    const attacking=bot.team===match.attackerTeam;
    if(attacking){
      if(spike.status==='dropped'){
        if(plan?.recovererId===bot.id&&distance(bot,spike)<1.7)match.pickupSpike(bot.id,bot.team,bot.x,bot.z);
      }
      if(spike.status==='carried'){
        if(spike.carrier===bot.id){
          const point=getSitePlantPosition(site,bot.x,bot.z,{preferredId:role?.plantPositionId||bot.plantPositionId,collision:map.collision});
          if(point){
            bot.plantPositionId=point.id;goal=point;
            if(distance(bot,point)<.65&&isInsideSite(site,bot.x,bot.z,{margin:.1}))plantSite=site;
          }
        }
      }
    }else if(spike.status==='planted'){
      if(plan?.defuserId===bot.id)shouldDefuse=distance(bot,spike)<2.05;
    }
    const orb=ordinarySkills.onnaraEvent?.('onnara-orb',bot.id,elapsed);
    if(orb&&!enemy&&ordinarySkills.blindUntil(bot.id,elapsed)<=elapsed){const yaw=orbViewYaw(orb,elapsed),forward={x:-Math.sin(yaw),z:-Math.cos(yaw)};
      const observed=[player,...bots].filter(a=>a.alive&&a.team!==bot.team).filter(a=>{const dx=a.x-orb.x,dz=a.z-orb.z,d=Math.hypot(dx,dz);return d>.1&&d<=70&&(dx*forward.x+dz*forward.z)/d>.85&&visibleBetween(orb,a);}).sort((a,b)=>distance(orb,a)-distance(orb,b))[0];
      if(observed)bot.lastHeard={x:observed.x,y:observed.y||0,z:observed.z,at:elapsed};
    }
    const search=!enemy?tactics.investigation(bot,elapsed,role,spike):null;
    const heard=!enemy&&bot.lastHeard&&elapsed>=bot.lastHeard.at&&elapsed-bot.lastHeard.at<1.8&&!role?.urgent&&!['plant','defuse'].includes(role?.role)?bot.lastHeard:null;
    if(search||heard)goal=search||heard;
    // A tag is a short-lived, frozen contact. It can guide investigation, never
    // supply a live actor reference or bypass the BOT's visible-target checks.
    const tagContact=!enemy?ordinarySkills.markers(bot.team,elapsed).filter(point=>distance(bot,point)<24).sort((a,b)=>b.detectedAt-a.detectedAt||a.eventId.localeCompare(b.eventId))[0]:null;
    if(tagContact&&!role?.urgent&&ordinarySkills.blindUntil(bot.id,elapsed)<=elapsed)goal=tagContact;
    // Investigate a nearby audible/visible fake once, without inventing a sighting
    // of a real actor or overriding the objective during an urgent retake.
    let decoyTarget=null;
    if(!enemy&&!role?.urgent&&ordinarySkills.blindUntil(bot.id,elapsed)<=elapsed){
      const events=allNopeDecoys(),activeIds=new Set(events.map(event=>event.id));
      bot.decoySeen||=new Map();for(const id of bot.decoySeen.keys())if(!activeIds.has(id))bot.decoySeen.delete(id);
      const decoy=events.find(event=>event.type==='nope-decoy'&&event.team!==bot.team&&distance(bot,event)<18&&visibleBetween(bot,event)&&(!bot.decoySeen.has(event.id)||elapsed<bot.decoySeen.get(event.id)));
      if(decoy){if(!bot.decoySeen.has(decoy.id))bot.decoySeen.set(decoy.id,elapsed+1.5);goal=decoy;decoyTarget=decoy;}
    }
    // A close threat interrupts starting an interaction; an ongoing plant or urgent retake commits.
    const committedPlant=spike.plantActor===bot.id&&spike.plantProgress>0;
    const committedDefuse=spike.defuseActor===bot.id&&spike.defuseProgress>0;
    const interactPlant=actorGrounded(bot)&&plantSite&&(enemyDistance>10||committedPlant||role?.urgent);
    const interactDefuse=actorGrounded(bot)&&shouldDefuse&&(!spike.defuseActor||spike.defuseActor===bot.id)&&(enemyDistance>9||committedDefuse||role?.urgent);
    bot.planting=!!interactPlant;bot.defusing=!!interactDefuse;bot.moving=false;
    if(bot.kit?.character==='duelist'&&!interactPlant&&!interactDefuse&&ordinarySkills.blindUntil(bot.id,elapsed)<=elapsed&&elapsed>=(bot.nextSkillAt||0)){
      const known=enemy||(bot.lastSeen&&elapsed-bot.lastSeen.seenAt<1?bot.lastSeen:null);let cast=null;
      if(known){
        const dist=distance(bot,known),aim={yaw:Math.atan2(bot.x-known.x,bot.z-known.z),pitch:0},screen={x:bot.x+(known.x-bot.x)*.6,y:(bot.y||0)+1.4,z:bot.z+(known.z-bot.z)*.6};
        if(dist>5&&dist<18&&bot.kit.smoke>0&&(bot.hp<65||role?.urgent)&&!ordinarySkills.events(elapsed).some(event=>event.type==='duelist-comet'&&event.team===bot.team&&distance(event,screen)<event.radius))cast=activateAbility(bot,'c',{zonePoint:screen,aim});
        if(!cast&&enemy&&dist>6&&dist<16&&bot.hp<70&&bot.kit.updraft>0&&actorGrounded(bot)&&map.collision.rayClear(bot.x,(bot.y||0)+1.7,bot.z,bot.x,(bot.y||0)+3.2,bot.z))cast=activateAbility(bot,'q');
      }
      bot.nextSkillAt=elapsed+(cast?2:.5);
    }
    if(bot.kit?.character==='nope'&&!interactPlant&&!interactDefuse&&ordinarySkills.blindUntil(bot.id,elapsed)<=elapsed&&elapsed>=(bot.nextSkillAt||0)){
      const known=enemy||(bot.lastSeen&&elapsed-bot.lastSeen.seenAt<1.5?bot.lastSeen:null);
      let cast=null;
      if(known){
        const dist=distance(bot,known),aim={yaw:Math.atan2(bot.x-known.x,bot.z-known.z),pitch:0};
        if(dist>5&&dist<17&&bot.kit.smoke>0)cast=activateAbility(bot,'c',{zonePoint:known,aim});
        else if(enemy&&dist>10&&dist<18&&bot.kit.updraft>0&&!actors.some(ally=>ally!==bot&&ally.alive&&ally.team===bot.team&&distance(ally,known)<NOPE_SKILLS.flashRadius))cast=activateAbility(bot,'q',{zonePoint:known,aim});
        else if(bot.kit.dash>0&&(bot.hp<65||!enemy))cast=activateAbility(bot,'e',{aim});
      }
      bot.nextSkillAt=elapsed+(cast?2.5:.5);
    }
    if(bot.kit?.character==='mend'&&!interactPlant&&!interactDefuse&&ordinarySkills.blindUntil(bot.id,elapsed)<=elapsed&&elapsed>=(bot.nextSkillAt||0)){
      const injured=selectMendTarget(bot,actors,mendReachable),known=enemy||(bot.lastSeen&&elapsed-bot.lastSeen.seenAt<1.5?bot.lastSeen:null);
      let cast=null;
      if(injured&&injured.hp<=70&&bot.kit.dash>0&&enemyDistance>8)cast=activateAbility(bot,'e');
      if(!cast&&known){
        const dist=distance(bot,known),aim={yaw:Math.atan2(bot.x-known.x,bot.z-known.z),pitch:0};
        if(dist>5&&dist<17&&bot.kit.smoke>0&&!ordinarySkills.events(elapsed).some(event=>event.type==='mend-seeds'&&event.team===bot.team&&distance(event,known)<event.radius))cast=activateAbility(bot,'c',{zonePoint:known,aim});
        else if(dist>8&&dist<20&&bot.kit.updraft>0&&(bot.hp<65||role?.urgent)&&!activePollenFields().some(event=>event.team===bot.team&&distance(event,bot)<8))cast=activateAbility(bot,'q',{zonePoint:{x:bot.x+(known.x-bot.x)*.6,z:bot.z+(known.z-bot.z)*.6},aim});
      }
      bot.nextSkillAt=elapsed+(cast?2.5:.5);
    }
    if(bot.kit?.character==='echo'&&!interactPlant&&!interactDefuse&&ordinarySkills.blindUntil(bot.id,elapsed)<=elapsed&&elapsed>=(bot.nextSkillAt||0)){
      const known=enemy||(bot.lastSeen&&elapsed-bot.lastSeen.seenAt<1.5?bot.lastSeen:null),watch=known||role?.watch||goal;
      let cast=null;
      if(watch){
        const dist=distance(bot,watch),aim={yaw:Math.atan2(bot.x-watch.x,bot.z-watch.z),pitch:0};
        if(dist>4&&dist<=IAGNU_SKILLS.tagRange&&bot.kit.smoke>0&&!ordinarySkills.events(elapsed).some(event=>event.type==='echo-tag'&&event.team===bot.team&&distance(event,watch)<4))cast=activateAbility(bot,'c',{zonePoint:watch,aim});
        if(!cast&&enemy&&dist>8&&dist<16&&bot.kit.updraft>0&&!actors.some(ally=>ally!==bot&&ally.alive&&ally.team===bot.team&&distance(ally,watch)<IAGNU_SKILLS.glintRadius))cast=activateAbility(bot,'q',{zonePoint:watch,aim});
      }
      if(!cast&&!enemy&&goal&&distance(bot,goal)>9&&bot.kit.dash>0)cast=activateAbility(bot,'e');
      bot.nextSkillAt=elapsed+(cast?2.5:.5);
    }
    if(bot.kit?.character==='veil'&&!interactPlant&&!interactDefuse&&actorGrounded(bot)&&ordinarySkills.blindUntil(bot.id,elapsed)<=elapsed&&elapsed>=(bot.nextSkillAt||0)){
      const known=enemy||(bot.lastSeen&&elapsed-bot.lastSeen.seenAt<1.5?bot.lastSeen:null);let cast=null;
      if(known){
        const dist=distance(bot,known),aim={yaw:Math.atan2(bot.x-known.x,bot.z-known.z),pitch:0};
        if(dist>3&&dist<18&&bot.kit.smoke>0&&(bot.hp<65||role?.urgent)&&!activeOrdinarySmokeFields().some(event=>event.team===bot.team&&distance(event,bot)<event.radius))cast=activateAbility(bot,'c',{aim});
        else if(dist>2&&dist<=VEIL_SKILLS.rootsRange&&bot.kit.updraft>0&&!ordinarySkills.events(elapsed).some(event=>event.type==='veil-roots'&&event.team===bot.team&&distance(event,known)<3))cast=activateAbility(bot,'q',{zonePoint:known,aim});
      }
      if(!cast&&!enemy&&goal&&distance(bot,goal)>9&&bot.kit.dash>0)cast=activateAbility(bot,'e');
      bot.nextSkillAt=elapsed+(cast?2.5:.5);
    }
    if(bot.kit?.character==='ember'&&!interactPlant&&!interactDefuse&&!bot.serviceReload&&ordinarySkills.blindUntil(bot.id,elapsed)<=elapsed&&elapsed>=(bot.nextSkillAt||0)){
      const known=enemy||(bot.lastSeen&&elapsed-bot.lastSeen.seenAt<1?bot.lastSeen:null);let cast=null;
      if(bot.aiAmmo<=spec.mag*.4&&bot.aiReserve>0&&!role?.urgent&&canServiceReload(bot)){
        bot.reloadGoal=enemy?reloadCover(bot,enemy):goal;cast=activateAbility(bot,'e');
      }
      if(!cast&&known){
        const dist=distance(bot,known),aim={yaw:Math.atan2(bot.x-known.x,bot.z-known.z),pitch:0};
        const seenFlash=ordinarySkills.events(elapsed).some(event=>['nope-flash','echo-glint'].includes(event.type)&&event.team!==bot.team&&event.triggerAt>elapsed&&distance(bot,event)<9&&map.collision.rayClear(bot.x,(bot.y||0)+1.6,bot.z,event.x,event.y,event.z));
        if(bot.kit.updraft>0&&(seenFlash||enemy&&dist<12&&bot.hp<70))cast=activateAbility(bot,'q');
        if(!cast&&dist>=3&&dist<=14&&bot.kit.smoke>0)cast=activateAbility(bot,'c',{zonePoint:known,aim});
      }
      bot.nextSkillAt=elapsed+(cast?2:.4);
    }
    if(bot.kit?.character==='onnara'&&!interactPlant&&!interactDefuse&&elapsed>=(bot.nextSkillAt||0)){
      if(enemy&&visibleBetween(bot,enemy)){const aim={yaw:Math.atan2(bot.x-enemy.x,bot.z-enemy.z),pitch:Math.atan2((enemy.y||0)+1.3-((bot.y||0)+1.7),Math.max(.001,enemyDistance))};
        if(!ordinarySkills.onnaraTax(enemy.id,elapsed))activateAbility(bot,'c',{aim});
        if(!ordinarySkills.onnaraEvent('onnara-orb',bot.id,elapsed))activateAbility(bot,'q',{aim});
        if(bot.aiAmmo>0&&constellationTarget(enemy,bot,[player,...bots],visibleBetween)&&bot.kit.ultPoints>=7)activateAbility(bot,'x');
        if(!actorGrounded(bot))activateAbility(bot,'e');
      }bot.nextSkillAt=elapsed+1.2;
    }
    if(bot.kit?.character==='urchin'&&!interactPlant&&!interactDefuse&&elapsed>=(bot.nextSkillAt||0)){
      if(enemy&&visibleBetween(bot,enemy)){const aim={yaw:Math.atan2(bot.x-enemy.x,bot.z-enemy.z),pitch:Math.atan2((enemy.y||0)+1.3-((bot.y||0)+1.7),Math.max(.001,enemyDistance))};if(enemyDistance<URCHIN_SKILLS.jamRange&&!ordinarySkills.urchinJammed(enemy.id,elapsed))activateAbility(bot,'c',{aim});if(enemyDistance<URCHIN_SKILLS.disarmRange)activateAbility(bot,'q',{aim});if(bot.aiAmmo>0&&enemyDistance<30&&bot.kit.ultPoints>=7)activateAbility(bot,'x');}
      else if(bot.aiAmmo>=8&&bot.aiReserve>=10&&(bot.record?.credits||0)<8500)activateAbility(bot,'e');
      bot.nextSkillAt=elapsed+.7;
    }
    if(bot.kit?.character==='cap'&&!interactPlant&&!interactDefuse&&elapsed>=(bot.nextSkillAt||0)){
      const friend=[bot,...bots.filter(b=>b.team===bot.team),...(player.team===bot.team?[player]:[])].find(a=>a.alive&&ordinarySkills.hasImpairment(a.id,a.team,elapsed)&&distance(bot,a)<=CAP_SKILLS.cleanRange&&(a===bot||visibleBetween(bot,a)));
      if(friend)activateAbility(bot,'q',{aim:{yaw:Math.atan2(bot.x-friend.x,bot.z-friend.z),pitch:Math.atan2((friend.y||0)+1.3-((bot.y||0)+1.7),Math.max(.001,distance(bot,friend)))}});
      if(enemy&&enemyDistance<CAP_SKILLS.lockRange&&visibleBetween(bot,enemy)){const enemyWeapon=enemy===player?inventory.active:enemy.remoteId?enemy.netWeapon:enemy.aiWeapon;if(WEAPONS[enemyWeapon]?.mag>0&&!ordinarySkills.capLocked(enemy.id,elapsed))activateAbility(bot,'c',{aim:{yaw:Math.atan2(bot.x-enemy.x,bot.z-enemy.z),pitch:Math.atan2((enemy.y||0)+1.3-((bot.y||0)+1.7),Math.max(.001,enemyDistance))}});if(enemyDistance<35){activateAbility(bot,'e');if(bot.aiAmmo>0&&bot.kit.ultPoints>=7)activateAbility(bot,'x');}}
      bot.nextSkillAt=elapsed+1;
    }
    if(bot.kit?.character==='japan'&&!interactPlant&&!interactDefuse&&elapsed>=(bot.nextSkillAt||0)){
      let cast=activateJapanAbility(bot,'x');if(!cast&&enemy&&visibleBetween(bot,enemy)){const aim={yaw:Math.atan2(bot.x-enemy.x,bot.z-enemy.z),pitch:Math.atan2((enemy.y||0)+1.3-((bot.y||0)+1.7),Math.hypot(enemy.x-bot.x,enemy.z-bot.z))};if(bot.armor<50&&enemy.armor>0)cast=activateJapanAbility(bot,'q',{aim});if(!cast)cast=activateJapanAbility(bot,'e');if(!cast)cast=activateJapanAbility(bot,'c',{aim:{...aim,pitch:-.12}});}if(cast)bot.nextSkillAt=elapsed+1;
    }
    if(bot.kit?.character==='nobi'&&!interactPlant&&!interactDefuse&&elapsed>=(bot.nextSkillAt||0)){
      let cast=null;if(enemy&&visibleBetween(bot,enemy)){const aim={yaw:Math.atan2(bot.x-enemy.x,bot.z-enemy.z),pitch:Math.atan2((enemy.y||0)+1.3-((bot.y||0)+1.7),Math.hypot(enemy.x-bot.x,enemy.z-bot.z))};if(bot.kit.ultPoints>=7)cast=activateAbility(bot,'x');if(!cast&&ordinarySkills.nobiVulnerability(enemy.id,elapsed)===1)cast=activateAbility(bot,'c',{aim});if(!cast&&ordinarySkills.nobiInterval(enemy.id,elapsed)===1)cast=activateAbility(bot,'q',{aim});}
      if(!cast&&(match.spike.carrier===bot.id&&distance(bot,site)<8||match.spike.status==='planted'&&match.defenderTeam===bot.team&&distance(bot,match.spike)<8))cast=activateAbility(bot,'e');bot.nextSkillAt=elapsed+(cast?1:.5);
    }
    if(bot.kit?.character==='car'&&!interactPlant&&!interactDefuse&&elapsed>=(bot.nextSkillAt||0)){
      let cast=null;
      if(bot.kit.ultPoints>=7&&carPitTargets(bot).length>=2)cast=activateAbility(bot,'x');
      if(!cast&&enemy&&visibleBetween(bot,enemy)){const aim={yaw:Math.atan2(bot.x-enemy.x,bot.z-enemy.z),pitch:Math.atan2((enemy.y||0)+1.3-((bot.y||0)+1.7),Math.hypot(enemy.x-bot.x,enemy.z-bot.z))};cast=activateAbility(bot,'c',{aim});}
      if(!cast){const goal=bot.lastSeen||bot.goal;if(goal){const aim={yaw:Math.atan2(bot.x-goal.x,bot.z-goal.z),pitch:0};cast=activateAbility(bot,'q',{aim});}}
      bot.nextSkillAt=elapsed+(cast?1.2:.5);
    }
    if(bot.kit?.character==='cat'&&!interactPlant&&!interactDefuse&&elapsed>=(bot.nextSkillAt||0)){
      let cast=null;const bookmark=ordinarySkills.catBookmark(bot.id,elapsed);
      if(bot.kit.ultPoints>=7&&(match.spike.status==='planted'||match.roundTime<20)&&!ordinarySkills.clockFrozen(elapsed))cast=activateAbility(bot,'x');
      if(!cast&&bookmark&&bot.hp<45)cast=activateAbility(bot,'c');
      if(!cast&&enemy&&visibleBetween(bot,enemy)){const aim={yaw:Math.atan2(-(enemy.x-bot.x),-(enemy.z-bot.z)),pitch:Math.atan2((enemy.y||0)+1.3-((bot.y||0)+1.7),Math.hypot(enemy.x-bot.x,enemy.z-bot.z))};cast=activateAbility(bot,'q',{aim});if(!cast&&!bookmark&&bot.hp>60)cast=activateAbility(bot,'c');}
      if(!cast&&!enemy){const drop=droppedWeapons.find(d=>Math.hypot(d.x-bot.x,d.z-bot.z)<CAT_SKILLS.fetchRange);if(drop){const distance=Math.hypot(drop.x-bot.x,drop.z-bot.z),aim={yaw:Math.atan2(-(drop.x-bot.x),-(drop.z-bot.z)),pitch:Math.atan2(.2-((bot.y||0)+1.7),distance)};cast=activateAbility(bot,'e',{aim});}}
      bot.nextSkillAt=elapsed+(cast?1:.5);
    }
    if(bot.kit?.character==='duck'&&!interactPlant&&!interactDefuse&&elapsed>=(bot.nextSkillAt||0)){
      let cast=null;
      if(enemy&&visibleBetween(bot,enemy)){
        const aim={yaw:Math.atan2(-(enemy.x-bot.x),-(enemy.z-bot.z)),pitch:Math.atan2((enemy.y||0)+1.3-((bot.y||0)+1.7),Math.hypot(enemy.x-bot.x,enemy.z-bot.z))};
        if(bot.kit.ultPoints>=7)cast=activateAbility(bot,'x');
        if(!cast&&ordinarySkills.sealUntil(enemy.id,elapsed)<=elapsed)cast=activateAbility(bot,'c',{aim});
        if(!cast&&bot.hp<70)cast=activateAbility(bot,'q',{aim:{...aim,pitch:-.5}});
      }else if(bot.moving&&!ordinarySkills.quiet(bot.id,elapsed))cast=activateAbility(bot,'e');
      if(cast)bot.nextSkillAt=elapsed+1;
    }
    if(bot.kit?.character==='frost'&&!interactPlant&&!interactDefuse&&actorGrounded(bot)&&ordinarySkills.blindUntil(bot.id,elapsed)<=elapsed&&elapsed>=(bot.nextSkillAt||0)){
      const known=enemy||(bot.lastSeen&&elapsed-bot.lastSeen.seenAt<1?bot.lastSeen:null),watch=known||role?.watch||goal;
      const rawSlow=Math.min(zoneAbilities.speedMultiplier(bot,elapsed),ordinarySkills.speedScale(ordinaryActorView(bot),elapsed,{reachable:ordinaryReachable,groundHeight:ordinaryGroundHeight}));let cast=null;
      const travel=goal&&distance(bot,goal)>5&&(!enemy||role?.urgent||distance(bot,enemy)>25)&&!(bot.aiReload>0);
      if(bot.kit.dash>0&&goal&&(rawSlow<1&&distance(bot,goal)>2||travel&&navigation.nearest(goal.x,goal.z)&&navigation.path(bot.x,bot.z,goal.x,goal.z).length))cast=activateAbility(bot,'e');
      if(!cast&&known&&bot.kit.updraft>0){
        const dist=distance(bot,known),goalDistance=goal?distance(bot,goal):0;
        // Cover a nearby plant/recovery/defuse location, not every long-range
        // duel: indiscriminate forward fog also cuts off supporting gunfire.
        // Only a live sighting can request this objective use; memory alone
        // retains the existing short-range wounded/emergency behaviour.
        const advancing=enemy&&!(bot.aiReload>0)&&goal&&['plant','recover','defuse'].includes(role?.role)&&goalDistance>2.5&&goalDistance<=FROST_SKILLS.mistRange&&(role?.urgent||dist>25);
        const emergency=dist<20&&(bot.hp<65||role?.urgent);
        const reach=Math.min(dist*.6,FROST_SKILLS.mistRange-.5),fraction=dist>0?reach/dist:0;
        const screen=advancing?{x:goal.x,z:goal.z}:{x:bot.x+(known.x-bot.x)*fraction,z:bot.z+(known.z-bot.z)*fraction},aim={yaw:Math.atan2(bot.x-screen.x,bot.z-screen.z),pitch:0};
        const covered=ordinarySkills.events(elapsed).some(event=>event.team===bot.team&&['mend-pollen','veil-dust','frost-mist','duelist-comet'].includes(event.type)&&distance(event,screen)<event.radius);
        if(dist>5&&!covered&&(emergency||advancing&&navigation.nearest(goal.x,goal.z)&&navigation.path(bot.x,bot.z,goal.x,goal.z).length))cast=activateAbility(bot,'q',{zonePoint:screen,aim});
      }
      if(!cast&&watch&&bot.kit.smoke>0){
        const dist=distance(bot,watch),aim={yaw:Math.atan2(bot.x-watch.x,bot.z-watch.z),pitch:0};
        // Place the band on the known approach instead of trapping a target in
        // the safe center; only sightings/watch goals already held by the BOT.
        const ring={x:watch.x+Math.cos(aim.yaw)*2,z:watch.z-Math.sin(aim.yaw)*2};
        if(dist>3&&dist<=12&&!ordinarySkills.events(elapsed).some(event=>event.type==='frost-stitch'&&event.team===bot.team&&distance(event,ring)<3))cast=activateAbility(bot,'c',{zonePoint:ring,aim});
      }
      bot.nextSkillAt=elapsed+(cast?2.5:.5);
    }
    if(!interactPlant&&!interactDefuse&&bot.kit?.ultPoints>=7){
      if(bot.kit.character==='mend'&&actors.some(ally=>ally.alive&&ally.team===bot.team&&ally.hp<=65&&distance(bot,ally)<=18&&mendReachable(bot,ally)))activateAbility(bot,'x');
      else if(bot.kit.character==='echo'&&(bot.lastSeen||spike.status==='planted'))activateAbility(bot,'x');
      else if(bot.kit.character==='veil'&&!smokes.some(s=>s.kind==='veil'&&s.expires>elapsed&&distance(bot,s)<s.radius)&&
        (attacking&&spike.status==='carried'&&distance(bot,site)<12||spike.status==='planted'&&distance(bot,spike)<14)){
        activateAbility(bot,'x');enemy=null;enemyDistance=Infinity;
      }
      else if(['ember','frost'].includes(bot.kit.character)){
        const known=enemy||(bot.lastSeen&&elapsed-bot.lastSeen.seenAt<3?bot.lastSeen:null);
        if(known&&distance(bot,known)<=20&&!zoneAbilities.events(elapsed).some(event=>event.team===bot.team&&event.type===bot.kit.character&&distance(event,known)<event.radius))activateAbility(bot,'x',{zonePoint:known});
      }
    }
    if(interactPlant||interactDefuse)cancelServiceReload(bot);
    if(interactPlant){
      match.interactPlant(dt*(ordinarySkills.nobiWork?.(bot.id,elapsed)||1),{actorId:bot.id,team:bot.team,site:plantSite.id,x:bot.x,z:bot.z,stationary:true});
      bot.group.rotation.y=Math.atan2(site.x-bot.x,site.z-bot.z);
    }else if(interactDefuse){
      match.interactDefuse(dt*(ordinarySkills.nobiWork?.(bot.id,elapsed)||1),{actorId:bot.id,team:bot.team,near:true,stationary:true});
      bot.group.rotation.y=Math.atan2(spike.x-bot.x,spike.z-bot.z);
    }else if(enemy){
      // A deadline cannot be solved by standing still in an endless duel.
      if(goal&&role?.urgent&&distance(bot,goal)>1.7)bot.moving=advance(bot,goal,'urgent');
      else if(bot.aiReload>0&&bot.reloadGoal)bot.moving=advance(bot,bot.reloadGoal,'reload');
      else if(goal&&enemyDistance>25&&distance(bot,goal)>5)bot.moving=advance(bot,goal,'advance-contact');
      const aligned=face(bot,enemy,8);bot.pathTime=Math.min(bot.pathTime||0,.15);
      if(aligned&&elapsed>=bot.reactionUntil&&elapsed>=(bot.skillThrowUntil||0)&&bot.fire<=0&&!(bot.aiReload>0)){
        if(bot.aiAmmo<=0){if(ordinarySkills.urchinJammed(bot.id,elapsed))bot.fire=.2;else{bot.aiReload=spec.reload||1.7;bot.fire=bot.aiReload;bot.reloadGoal=role?.urgent?null:reloadCover(bot,enemy);}}
        else{
          // Gyro needs this tick's actual movement, not the cleared animation
          // flag above. Spend it only on a grounded, visible-target gun shot.
          if(bot.kit?.character==='car'&&bot.kit.dash>0&&spec.mag>0&&bot.moving&&actorGrounded(bot)&&!ordinarySkills.carGyro(bot.id,elapsed)&&elapsed>=(bot.nextGyroAt||0)){
            const gyro=activateAbility(bot,'e');bot.nextGyroAt=elapsed+(gyro?1:.5);
          }
          if(!ordinarySkills.capMagazine(bot.id,elapsed))bot.aiAmmo--;crownShot(bot);bot.flash=.065;if(spec.arsenal&&elapsed-(bot.lastArsenalShot??-10)>.3)bot.shotSequence=0;bot.lastArsenalShot=elapsed;bot.shotSequence=(bot.shotSequence||0)+1;bot.muzzle.visible=true;
          if(spec.auto){bot.burst=(bot.burst||0)+1;bot.fire=bot.burst<3?spec.interval+.035:cfg.interval*.46+Math.random()*.22;if(bot.burst>=3)bot.burst=0;}
          else bot.fire=Math.max(spec.interval,.19+cfg.interval*.25)+Math.random()*.12;
          if(spec.mag>0)bot.fire*=ordinarySkills.nobiInterval?.(bot.id,elapsed)||1;
          let chance=cfg.aim*(enemy===player?.54:.66)*Math.max(.48,1-enemyDistance/65);
          if(enemy===player&&Math.hypot(player.vx||0,player.vz||0)>2.5)chance*=.76;
          if(bot.moving&&!(ordinarySkills.carGyro(bot.id,elapsed)&&actorGrounded(bot)))chance*=.72;
          if(spec.mag>0&&!spec.arsenal&&ordinarySkills.capLocked?.(bot.id,elapsed))chance*=CAP_SKILLS.lockAimScale;
          const hit=Math.random()<chance,head=hit&&Math.random()<.065+cfg.aim*.07;
          const from=new THREE.Vector3(bot.x,(bot.y||0)+1.2,bot.z);
          const to=new THREE.Vector3(enemy.x,(enemy.y||0)+(head?1.62:1.15),enemy.z);
          if(!hit){to.x+=(Math.random()-.5)*1.8;to.y+=(Math.random()-.5)*.8;}
          if(spec.arsenal){fireArsenal(bot,from,to.clone().sub(from).normalize(),spec,!bot.moving);sound('enemy',{weapon:weaponId,entity:bot});}
          else{
          const clearShot=map.collision.rayClear(from.x,from.y,from.z,to.x,to.y,to.z);let bounceSurface=null;
          if(!clearShot){
            direction.subVectors(to,from).normalize();raycaster.set(from,direction);raycaster.far=from.distanceTo(to);
            const surface=raycaster.intersectObject(environment,true)[0];
            if(surface){to.copy(surface.point);bounceSurface=surface;}
            raycaster.far=190;
          }
          const fake=raycastNopeDecoy(from,to.clone().sub(from).normalize(),from.distanceTo(to),bot.team);
          const shield=ordinarySkills.interceptShield(from,to.clone().sub(from).normalize(),fake?.distance??from.distanceTo(to),spec.body||1,elapsed,match.round);
          if(shield)to.set(shield.point.x,shield.point.y,shield.point.z);
          else if(fake){to.copy(fake.point);hitNopeDecoy(fake.event,bot);}
          else if(bounceSurface)capBounceShot(bot,from,direction,bounceSurface,spec);
          tracer(from,to,bot.team==='blue'?'#a5eee0':'#ff7b76',.09);
          urchinTridentShot(bot,from,to.clone().sub(from).normalize(),spec);
          sound('enemy',{weapon:weaponId,entity:bot});
          if(hit&&clearShot&&!fake&&!shield)damageEntity(enemy,nobiBulletDamage(bot,enemy,head?spec.head:spec.body,spec.head,spec.mag>0),bot,{firearm:spec.mag>0});
          }
        }
      }
    }else if(decoyTarget&&!bot.serviceReload&&elapsed>=(bot.skillThrowUntil||0)){
      bot.goal={x:decoyTarget.x,z:decoyTarget.z};bot.pathTime=0;
      const aligned=face(bot,decoyTarget,8);
      if(aligned&&elapsed>=bot.decoySeen.get(decoyTarget.id)-1.05&&bot.fire<=0&&!(bot.aiReload>0)){
        if(bot.aiAmmo<=0){if(ordinarySkills.urchinJammed(bot.id,elapsed))bot.fire=.2;else{bot.aiReload=spec.reload||1.7;bot.fire=bot.aiReload;}}
        else{
          const from=new THREE.Vector3(bot.x,(bot.y||0)+1.7,bot.z),to=new THREE.Vector3(decoyTarget.x,decoyTarget.y+1.55,decoyTarget.z),aim=to.clone().sub(from).normalize();
          botsGroup.updateMatrixWorld(true);const ray=new THREE.Raycaster(from,aim,0,from.distanceTo(to)+1);
          const blocking=ray.intersectObjects([environment,botsGroup],true).find(hit=>hit.object.userData.bot!==bot&&(!hit.object.userData.bot||hit.object.userData.bot.alive));
          const fake=raycastNopeDecoy(from,aim,blocking?.distance??from.distanceTo(to)+1,bot.team);
          if(!ordinarySkills.capMagazine(bot.id,elapsed))bot.aiAmmo--;crownShot(bot);bot.fire=Math.max(spec.interval,.4)*(spec.mag>0?(ordinarySkills.nobiInterval?.(bot.id,elapsed)||1):1);bot.flash=.065;bot.shotSequence=(bot.shotSequence||0)+1;bot.muzzle.visible=true;
          const shield=ordinarySkills.interceptShield(from,aim,fake?.distance??blocking?.distance??from.distanceTo(to)+1,spec.body||1,elapsed,match.round);
          urchinTridentShot(bot,from,aim,spec);
          tracer(from,shield?new THREE.Vector3(shield.point.x,shield.point.y,shield.point.z):fake?.point||blocking?.point||to,bot.team==='blue'?'#a5eee0':'#ff7b76',.09);sound('enemy',{weapon:weaponId,entity:bot});
          if(fake&&!shield)hitNopeDecoy(fake.event,bot);
        }
      }
    }else if(bot.aiReload>0&&bot.reloadGoal&&!role?.urgent)bot.moving=advance(bot,bot.reloadGoal,'reload');
    else if(goal)bot.moving=advance(bot,goal,search?'search':heard?'heard':role?.role||'objective');
    if(!enemy&&!bot.moving&&!bot.planting&&!bot.defusing){
      const remembered=bot.lastSeen&&elapsed-bot.lastSeen.seenAt<2.8?bot.lastSeen:null;
      const shared=tactics.contacts(bot.team,elapsed).filter(c=>distance(bot,c)<32).sort((a,b)=>b.seenAt-a.seenAt)[0];
      if(remembered||shared||tagContact||heard||role?.watch)face(bot,remembered||shared||tagContact||heard||role.watch,3.5);
    }
    bot.crouch=frostSlideSpeed(bot)>0&&bot.moving?1:0;
    if(!bot.planting)match.cancelPlant(bot.id);
    if(!bot.defusing)match.cancelDefuse(bot.id);
    bot.group.position.x=bot.x;bot.group.position.z=bot.z;
    bot.group.position.y=bot.y||0;
    bot.visual.update(dt,{...agentEquipment(bot),time:elapsed,moving:bot.moving,planting:bot.planting,defusing:bot.defusing,firing:bot.flash>0,alive:bot.alive});
    bot.stepClock=bot.moving&&actorGrounded(bot)?(bot.stepClock||0)+dt:0;
    if(bot.stepClock>.41){bot.stepClock=0;if(distance(bot,player)<19)sound('step',{entity:bot});else botHearing.emit(bot,'step',elapsed);}
  }
  separateBots(dt);
}
function separateBots(dt){
  if(match?.phase!=='live')return;
  const actors=[...(player.alive&&player.y<1?[player]:[]),...bots.filter(bot=>bot.alive)];
  const movable=actor=>actor!==player&&!actor.planting&&!actor.defusing;
  // Resolve crowded escorts without moving the player or interrupting a committed plant.
  for(let pass=0;pass<2;pass++)for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++){
    const a=actors[i],b=actors[j];let dx=b.x-a.x,dz=b.z-a.z,dist=Math.hypot(dx,dz);
    if(dist>=.88||!movable(a)&&!movable(b))continue;
    if(dist<.0001){const angle=(i*2.39+j*1.57);dx=Math.sin(angle);dz=Math.cos(angle);dist=1;}
    else{dx/=dist;dz/=dist;}
    const overlap=.88-Math.hypot(a.x-b.x,a.z-b.z),share=movable(a)&&movable(b)?.5:1;
    const correction=Math.min(overlap*share,dt*4);
    const ax=a.x,az=a.z,bx=b.x,bz=b.z;
    if(movable(a))moveEntity(a,-dx*correction,-dz*correction,.4);
    if(movable(b))moveEntity(b,dx*correction,dz*correction,.4);
    // A wall may stop one actor; let the free actor absorb the remaining separation.
    const remaining=.88-Math.hypot(a.x-b.x,a.z-b.z);
    if(remaining>.005){
      if(movable(a)&&Math.hypot(b.x-bx,b.z-bz)<.001)moveEntity(a,-dx*Math.min(remaining,dt*4),-dz*Math.min(remaining,dt*4),.4);
      else if(movable(b)&&Math.hypot(a.x-ax,a.z-az)<.001)moveEntity(b,dx*Math.min(remaining,dt*4),dz*Math.min(remaining,dt*4),.4);
    }
  }
  for(const bot of bots){bot.group.position.x=bot.x;bot.group.position.z=bot.z;}
}
function updateActorVertical(actor,dt,radius=.34){
    if(applyStarHold(actor))return;
    const verticalSteps=Math.max(1,Math.ceil(dt*120)),verticalDt=dt/verticalSteps;
    for(let i=0;i<verticalSteps;i++){
      const previousFeet=actor.y,nextFeet=previousFeet+actor.vy*verticalDt-7.5*verticalDt*verticalDt;
      actor.vy-=15*verticalDt;let support=0,ceiling=Infinity;
      if(nextFeet>previousFeet){
        for(const c of map.collision.query(actor.x,actor.z,radius)){
          const underside=c.base||0;
          if(previousFeet+1.7>underside+.00001||nextFeet+1.7<underside)continue;
          if(map.collision.overlaps(c,actor.x,actor.z,radius))ceiling=Math.min(ceiling,underside-1.7);
        }
      }
      if(actor.vy<=0){
        const ramp=rampFloor(actor.x,actor.z);
        if(ramp!==null&&previousFeet>=ramp-.00001&&nextFeet<=ramp)support=ramp;
        for(const c of map.collision.query(actor.x,actor.z,radius)){
          if(c.height<=.02||c.height<=support||previousFeet<c.height-.00001||nextFeet>c.height)continue;
          if(map.collision.overlaps(c,actor.x,actor.z,radius))support=c.height;
        }
      }
      actor.y=nextFeet;
      if(actor.y>=ceiling){actor.y=ceiling;actor.vy=0;}
      if(actor.vy<=0&&actor.y<=support){actor.y=support;actor.vy=0;}
    }
}
function updatePlay(dt){
  if(!match)return;elapsed+=dt;
  if(isGuest()&&!netHasSnapshot)return;
  refillMapPracticeSkills();player.kit.tick(elapsed);for(const bot of bots)bot.kit?.tick(elapsed);updateAbilityFeedback();
  syncSmokes(serializeSmokes().filter(s=>s.expires>elapsed));updateSmokeAppearance(elapsed);
  if(rangeSession){
    if(rangeSession.tick(dt)){finishRange();return;}
    if(rangeRespawn>0){rangeRespawn-=dt;if(rangeRespawn<=0)spawnRangeTarget();}
  }
  if(spectatedBot){spectatedBot.group.visible=spectatedBot.alive||spectatedBot.death>0;spectatedBot=null;}
  const controlled=mode==='play'&&player.alive;
  const yaw=player.yaw;
  const forward=controlled?((keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)-touchMove.y):0;
  const side=controlled?((keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+touchMove.x):0;
  const moveX=-Math.sin(yaw)*forward+Math.cos(yaw)*side,moveZ=-Math.cos(yaw)*forward-Math.sin(yaw)*side;
  const len=Math.hypot(moveX,moveZ);
  const slideSpeed=frostSlideSpeed(player),crouching=controlled&&(slideSpeed>0||keys.has('KeyV')||keys.has('ControlLeft')||keys.has('ControlRight')||keys.has('TouchCrouch'));
  player.crouch=THREE.MathUtils.lerp(player.crouch,crouching?1:0,Math.min(1,dt*12));
  const walking=keys.has('ShiftLeft')||keys.has('ShiftRight');
  const slow=actorSpeedScale(player),speed=(slideSpeed|| (crouching?1.8:(walking?2.8:inventory.active==='knife'?6.3:5.4)*1.15))*(aiming?.78:1)*slow;
  const desiredX=moveX/Math.max(1,len)*speed,desiredZ=moveZ/Math.max(1,len)*speed;
  const rate=(len?45:75)*dt;
  player.vx+=clamp(desiredX-player.vx,-rate,rate);player.vz+=clamp(desiredZ-player.vz,-rate,rate);
  const velocity=Math.hypot(player.vx,player.vz);if((slow<1||player.turfMovementEnded)&&velocity>speed){player.vx*=speed/velocity;player.vz*=speed/velocity;}player.turfMovementEnded=false;
  const previousY=player.y,previousVy=player.vy,previousX=player.x,previousZ=player.z;
  if(player.alive){
    if(player.dashTimer>0){const step=Math.min(dt,player.dashTimer);moveEntity(player,player.dashVec.x*(12/.18)*step,player.dashVec.z*(12/.18)*step);player.dashTimer-=step;player.vx=0;player.vz=0;}else moveEntity(player,player.vx*dt,player.vz*dt);
    updateActorVertical(player,dt);
    const running=controlled&&(slideSpeed>0||!walking&&!crouching)&&player.vy===0&&Math.hypot(player.x-previousX,player.z-previousZ)>dt*2;
    stepClock=running?stepClock+dt:0;
    if(stepClock>.35){stepClock=0;sound('step');}
    if(previousVy<-.8&&player.vy===0&&previousY>player.y+.005)sound('land');
  }
  player.moving=controlled&&Math.hypot(player.x-previousX,player.z-previousZ)>dt*.5;
  scanTime=Math.max(0,scanTime-dt);
  player.recoil=Math.max(0,player.recoil-dt*.065);kick=Math.max(0,kick-dt*.4);
  renderedRecoil=THREE.MathUtils.lerp(renderedRecoil,player.recoil,1-Math.exp(-dt*22));
  if(elapsed-lastShot>.3)shotSequence=0;
  if(!exploring||objectivePractice&&!objectivePractice.completed)updateInteraction(dt,controlled&&Math.hypot(player.x-previousX,player.z-previousZ)<dt*.25&&player.vy===0);
  if(objectivePractice)updateObjectivePractice(dt);
  if(ordinarySkills.urchinJammed(player.id,elapsed))urchinCancelReload(player);
  if(!tickServiceReload(player,dt)&&reloading>0){reloading-=dt;if(reloading<=0){const n=Math.min(weapon().mag-player.ammo,player.reserve);player.ammo+=n;player.reserve-=n;reloading=0;sound('reload');}}
  if(exploring&&player.reserve<weapon().mag)player.reserve=weapon().reserve;
  if(player.alive){deathView.reset();camera.position.set(player.x,1.7-player.crouch*.55+player.y,player.z);camera.rotation.set(player.pitch+renderedRecoil,player.yaw,0);}
  else if(deathView.holding){
    const pose=deathView.view();camera.position.set(...pose.position);camera.rotation.set(...pose.rotation);
    setVisible('spectator-hint',false);if(mode==='play')deathView.tick(dt);
  }
  else{
    const team=bots.filter(b=>b.alive&&b.team===player.team);const watched=team[spectateIndex%Math.max(1,team.length)];
    if(watched){spectatedBot=watched;watched.group.visible=false;camera.position.set(watched.x,1.65+(watched.y||0),watched.z);camera.rotation.set(0,watched.group.rotation.y+Math.PI,0);$('spectator-hint').textContent=`${watched.record.name} を観戦中 · クリックで切り替え`;}
    else $('spectator-hint').textContent='倒されました · 次のラウンドで復帰します';
    setVisible('spectator-hint',true);
  }
  const withinSmoke=smokes.find(s=>camera.position.distanceToSquared(s.mesh.position)<s.radius*s.radius),withinField=activeOrdinarySmokeFields().find(s=>(camera.position.x-s.x)**2+(camera.position.y-s.y)**2+(camera.position.z-s.z)**2<s.radius*s.radius),obscured=withinSmoke||withinField;scene.fog.near=obscured?.1:145;scene.fog.far=obscured?2.5:380;scene.fog.color.set(withinSmoke?.kind==='veil'?'#77718f':withinField?.type==='veil-dust'?'#8d7659':withinField?.type==='frost-mist'?'#c3bfdb':withinField?.type==='duelist-comet'?'#abcddd':withinField?'#b6bb72':withinSmoke?'#a9c6d2':'#b7d0dd');
  const scoped=!!(aiming&&controlled&&weapon().scope&&!reloading&&!player.serviceReload&&!interactionHeld);
  setVisible('sniper-scope',scoped);gun.visible=player.alive&&inventory.active!=='spike'&&!scoped;
  camera.fov=THREE.MathUtils.lerp(camera.fov,scoped?weapon().scope:aiming&&controlled?62:76,Math.min(1,dt*12));camera.updateProjectionMatrix();
  if(firing&&controlled){
    for(let count=0;count<12&&firing&&elapsed-lastShot+1e-8>=nobiShotInterval(weapon(),player);count++){
      const previousShot=lastShot;
      shoot(Math.max(lastShot+nobiShotInterval(weapon(),player),elapsed-dt));
      if(lastShot===previousShot)break;
    }
  }
  updateTeamAbilities();
  updateBots(dt);
  updateTraffic(dt);
  botThinkTick-=dt;
  if(botThinkTick<=0){botThinkTick=.25;const front=new THREE.Vector3();camera.getWorldDirection(front);for(const bot of bots){if(bot.team===player.team||!bot.alive)continue;const offset=new THREE.Vector3(bot.x-player.x,0,bot.z-player.z);if(player.alive&&offset.length()<42&&offset.normalize().dot(front)>.55&&visibleBetween(player,bot))bot.spottedUntil=elapsed+.6;}}
  if(!exploring&&!isGuest()){match.tick(dt,{clockPaused:match.phase==='live'&&ordinarySkills.clockFrozen(elapsed),blueAlive:aliveCount('blue'),redAlive:aliveCount('red'),playerAlive:player.alive});handleMatchEvents();}
  timeLeft=match.phase==='buy'||match.phase==='post'?match.phaseTime:match.spike.status==='planted'?match.spike.timer:match.roundTime;
  viewmodel.update(dt,{aiming:aiming&&controlled,reloading,reloadDuration:player.serviceReload?EMBER_SKILLS.serviceDuration:weapon().reload,kick,moving:len>0,time:elapsed,crouching:player.crouch,interacting:interactionHeld&&controlled,ultimate:player.kit.knivesActive&&inventory.active==='knife',knives:player.kit.knives,shotSequence});
  flash.visible=player.alive&&inventory.active!=='knife'&&elapsed-lastShot<.045;flash.rotation.z=elapsed*40;
  const s=match.spike;spikeModel.position.set(s.x,0,s.z);objectiveModel.update({time:elapsed,...s,practice:!!objectivePractice});
  if(s.status==='planted'&&!objectivePractice){
    const interval=s.timer<5?.15:s.timer<10?.3:s.timer<20?.6:1;
    if(elapsed-lastSpikeBeep>=interval){lastSpikeBeep=elapsed;sound('spike',{entity:s});}
  }
  damageFlash=Math.max(0,damageFlash-dt);hitFlash=Math.max(0,hitFlash-dt);
  $('damage').style.opacity=damageFlash*1.4;$('hitmarker').style.opacity=hitFlash>0?'1':'0';
  $('crosshair').classList.toggle('aiming',aiming);$('crosshair').classList.toggle('moving',len>0&&!aiming);
  updateHUD();
  if(mode==='shop')updateShop();if(mode==='score')updateScoreboard();
}
function updateInteraction(dt,stationary){
  const grounded=Math.abs(player.y)<=.05&&player.vy===0;
  stationary=stationary&&grounded;
  const s=match.spike,live=match.phase==='live'&&player.alive;
  if(live&&!isGuest())match.pickupSpike(player.id,player.team,player.x,player.z);
  const site=map.sites.find(p=>isInsideSite(p,player.x,player.z));
  const plant=live&&ownSide()==='attack'&&s.status==='carried'&&s.carrier===player.id&&site;
  const defuse=live&&ownSide()==='defend'&&s.status==='planted'&&Math.hypot(player.x-s.x,player.z-s.z)<2.3;
  const nearbyDrop=live&&!plant&&!defuse?droppedWeapons.find(d=>Math.hypot(d.x-player.x,d.z-player.z)<1.5):null;
  const held=interactionHeld&&mode==='play';
  if(held&&stationary&&(plant||defuse)){
    cancelServiceReload(player);reloading=0;firing=false;
    if(!isGuest()){
      if(plant)match.interactPlant(dt*(ordinarySkills.nobiWork?.(player.id,elapsed)||1),{actorId:player.id,team:player.team,site:site.id,x:player.x,z:player.z,stationary:true});
      else match.interactDefuse(dt*(ordinarySkills.nobiWork?.(player.id,elapsed)||1),{actorId:player.id,team:player.team,near:true,stationary:true});
    }
  }else if(!isGuest()){match.cancelPlant(player.id);match.cancelDefuse(player.id);}
  const progress=plant?s.plantProgress/4:s.defuseProgress/7;
  const remaining=Math.max(0,(plant?4:7)-(held?(plant?s.plantProgress:s.defuseProgress):defuse?s.checkpoint:0))/(ordinarySkills.nobiWork(player.id,elapsed)||1);
  const teammateDefusing=defuse&&s.defuseActor&&s.defuseActor!==player.id;
  const instruction=!grounded?'地面に降りて':held&&!stationary?'静止して':teammateDefusing?'味方が電源オフ中':'';
  setVisible('interaction',!!(plant||defuse||nearbyDrop));
  if($('mobile-interact-label'))$('mobile-interact-label').textContent=plant?'設置':defuse?'電源オフ':nearbyDrop?'拾う':'F';
  if($('mobile-interact-hint'))$('mobile-interact-hint').textContent=(plant||defuse)?instruction?(instruction==='静止して'?'止まって':instruction):held?`${remaining.toFixed(1)}秒`:`${defuse&&s.checkpoint?'残り':''}${Number(remaining.toFixed(1))}秒長押し`:nearbyDrop?'タップ':'長押し';
  if(plant||defuse){$('interaction-title').textContent=`${instruction?`${instruction} · `:held?'':'F 長押し · '}BOMBER ${plant?'設置':'電源オフ'} 残り${remaining.toFixed(1)}秒${defuse&&s.checkpoint?' · 半分まで保存済み':''}`;$('interaction-progress').style.width=`${progress*100}%`;}
  else if(nearbyDrop){$('interaction-title').textContent=`F · ${WEAPONS[nearbyDrop.weapon].name} を拾う · ${nearbyDrop.ammo} / ${nearbyDrop.reserve}`;$('interaction-progress').style.width='0%';}
  if(held&&live&&!plant&&!defuse){
    const drop=nearbyDrop;
    if(drop){if(isGuest())queueNetAction('pickup',{dropId:drop.id});else if(pickupDroppedWeapon(player,drop.id))showMessage('WEAPON PICKED UP',weapon().name,1);interactionHeld=false;}
  }
}

function queueNetAction(type,data={}){
  if(netHostPaused||!isGuest()||netActions.length>=64)return;
  if(type==='ability'&&data.key==='e'&&getCharacterSkill(player.kit.character,'e')?.type==='dash'){
    const side=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),forward=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0);
    let x=-Math.sin(player.yaw),z=-Math.cos(player.yaw);
    if(side||forward){x=-Math.sin(player.yaw)*forward+Math.cos(player.yaw)*side;z=-Math.cos(player.yaw)*forward-Math.sin(player.yaw)*side;}
    const length=Math.hypot(x,z)||1;data={...data,dashX:x/length,dashZ:z/length};
  }
  netActions.push({...data,seq:++netActionSequence,type,round:match.round,at:elapsed});
}
function leaveOnline(notify=true){
  const client=online;online=null;onlinePlaying=false;netHasSnapshot=false;netHostPaused=false;
  netSeenCueSequence=0;netCues.length=0;
  client?.close(notify);netActions=[];netInputs.clear();netApplied.clear();netParticipants.clear();player.id='player';player.team='blue';
  $('online-intro').textContent='パーティーコードを共有して、同じマップへ。最大10人で参加でき、空いている枠はBOTが補充します。';
  setVisible('online-overlay',false);backMenu();
}
function updateRoom(room){
  if(!online)return;online.room=room;
  if(room.status==='closed'){leaveOnline(false);$('online-error').textContent='ホストが退出したため部屋を閉じました。新しい部屋を作ってください。';setVisible('online-entry',true);setVisible('online-lobby',false);setVisible('online-overlay',true);return;}
  if($('online-room-code').value!==room.code){$('online-room-code').value=room.code;$('online-copy-status').textContent='';}
  const list=$('online-members');list.replaceChildren();
  for(const member of room.members){const item=document.createElement('li');item.className=member.team;item.textContent=`${member.team==='blue'?'BLUE':'RED'} · ${member.name}${member.id===room.hostId?' / HOST':''} · ${member.connected?(member.ready?'準備OK':'準備中'):'再接続待ち'}`;list.append(item);}
  const me=room.members.find(m=>m.id===online.session.memberId);
  $('online-ready').textContent=me?.ready?'準備を取り消す':'準備完了';$('online-team').value=me?.team||'red';$('online-team').disabled=online.host;
  characterPicker.sync();
  const saving=online.settingsPending,locked=!online.host||saving||room.status!=='lobby';
  $('online-start').hidden=!online.host;$('online-start').disabled=!!saving;
  $('online-format').disabled=locked;$('online-map').disabled=locked;
  if(!saving||room.status==='playing'){
    $('online-map').value=normalizeMapId(room.settings.mapId);$('online-format').value=room.settings.format;
  }
  const roomMap=room.settings.mapId==='hirakata'?'枚方市駅 / 南北ロータリー':'橋本駅';
  $('online-intro').textContent=saving?'マップと試合形式を保存しています…':`${roomMap} · ${room.settings.format==='standard'?'STANDARD / 13ラウンド先取':'SWIFT / 5ラウンド先取'}。最大10人、空き枠にはBOTが参加します。`;
  if(room.status==='playing'&&!onlinePlaying){
    onlinePlaying=true;netSequence=0;netLastSnapshot=0;netActionSequence=0;netActions=[];netApplied.clear();netInputs.clear();netRound=0;netClock=0;netSeenCueSequence=0;netCues.length=0;
    $('match-format').value=room.settings.format;setVisible('online-overlay',false);startGame();
    showMessage('ONLINE MATCH',`${room.members.length} PLAYERS + BOTS · ${room.code}`,4);
  }
  if(onlinePlaying&&online.host)for(const [memberId,entityId] of netParticipants){
    if(memberId===room.hostId)continue;
    const member=room.members.find(m=>m.id===memberId),actor=bots.find(b=>b.id===entityId);
    if(!member){if(actor){match.cancelPlant(actor.id);match.cancelDefuse(actor.id);actor.planting=false;actor.defusing=false;transferEmberControl(actor,false);actor.remoteId=null;actor.record.memberId=null;actor.record.netFallback=false;actor.record.name=`${actor.record.name} / BOT`;}netParticipants.delete(memberId);}
    else if(actor){
      const fallback=member.connected===false&&Date.now()-(netInputs.get(memberId)?.receivedAt||0)>=20000;
      actor.record.netFallback=fallback;
      if(fallback){if(actor.remoteId){match.cancelPlant(actor.id);match.cancelDefuse(actor.id);transferEmberControl(actor,false);actor.remoteId=null;actor.planting=false;actor.defusing=false;}}
      else if(actor.remoteId!==memberId){transferEmberControl(actor,true);actor.remoteId=memberId;actor.netYaw=actor.group.rotation.y-Math.PI;actor.lastNetInput=elapsed;}
    }
  }
}
async function restoreRoomSession(){
  if(restoreRoomSession.pending)return true;
  if(online||mode!=='menu'||!RoomClient.savedSession())return false;
  restoreRoomSession.pending=true;
  for(const id of ['online-create','online-join'])$(id).disabled=true;
  setVisible('online-overlay',true);setVisible('online-entry',true);setVisible('online-lobby',false);$('online-error').textContent='前の部屋へ再接続しています…';
  try{
    const result=await RoomClient.resumeSession();
    if(!result?.session){$('online-error').textContent=result?.status==='host-ended'?'ホストの試合は再読み込みから復元できないため、部屋を終了しました。新しい部屋を作ってください。':'前の部屋は終了または期限切れです。新しい部屋へ参加してください。';return true;}
    if(online||mode!=='menu')return false;
    online=new RoomClient(result.session,{onRoom:updateRoom,onData:receiveNetPacket,onStatus:text=>{$('online-status').textContent=text;},onError:text=>{$('online-error').textContent=text;}});
    $('online-error').textContent='';setVisible('online-entry',false);setVisible('online-lobby',true);updateRoom(result.session);return true;
  }catch(error){$('online-error').textContent=`${error.message} オンライン画面を開き直すと再接続します。`;return true;}
  finally{restoreRoomSession.pending=false;for(const id of ['online-create','online-join'])$(id).disabled=false;}
}
async function enterRoom(join=false){
  if(restoreRoomSession.pending||enterRoom.pending)return;
  enterRoom.pending=true;for(const id of ['online-create','online-join'])$(id).disabled=true;
  $('online-error').textContent='接続しています…';
  try{
    const name=$('online-name').value.trim(),code=normalizePartyCode($('online-code').value);
    const session=await RoomClient.open(join?`/${encodeURIComponent(code)}/join`:'',{name,team:join?'red':'blue',...(!join?{mapId:map.id||'hashimoto',format:$('online-format').value}:{})});
    online?.close();online=new RoomClient(session,{onRoom:updateRoom,onData:receiveNetPacket,onStatus:text=>{$('online-status').textContent=text;},onError:text=>{$('online-error').textContent=text;}});
    $('online-error').textContent='';setVisible('online-entry',false);setVisible('online-lobby',true);updateRoom(session);
    if(!join)await online.ready(true,'blue');
  }catch(error){$('online-error').textContent=error.message;}
  finally{enterRoom.pending=false;for(const id of ['online-create','online-join'])$(id).disabled=false;}
}
function normalizePartyCode(value){return value.normalize('NFKC').replace(/[\s-]+/g,'').toUpperCase();}
function selectPartyCode(){const field=$('online-room-code');field.focus();field.select();field.setSelectionRange(0,field.value.length);}
async function copyPartyCode(){
  const code=online?.room?.code;if(!/^[A-Z2-9]{8}$/.test(code||''))return;
  let copied=false;
  try{await navigator.clipboard.writeText(code);copied=true;}catch{
    if(online?.room?.code!==code)return;
    selectPartyCode();try{copied=document.execCommand('copy');}catch{}
  }
  if(online?.room?.code===code)$('online-copy-status').textContent=copied?'コピーしました。友達に送って、参加画面に貼り付けてもらおう。':'コードを選択しました。コピーして友達へ共有してください。';
}
function receiveNetPacket(from,packet){
  if(!onlinePlaying||!packet||!Number.isSafeInteger(packet.seq)||packet.seq<1)return;
  if(online.host){
    const id=netParticipants.get(from);if(!id||id==='player'||packet.type!=='input')return;
    const previous=netInputs.get(from),connection=typeof packet.connection==='string'&&packet.connection.length<=64?packet.connection:'legacy';
    const previousConnection=previous?.connection||'legacy',retired=new Set(previous?.retiredConnections||[]),changed=previous&&connection!==previousConnection;
    if(retired.has(connection)||previous&&!changed&&packet.seq<=previous.seq)return;
    if(changed)retired.add(previousConnection);
    const ack=netApplied.get(from)||0,actions=new Map();
    for(const action of [...(!changed?previous?.actions||[]:[]),...(Array.isArray(packet.actions)?packet.actions.slice(0,64):[])])if(action&&Number.isSafeInteger(action.seq)&&action.seq>ack&&action.seq<=ack+64&&!actions.has(action.seq))actions.set(action.seq,action);
    netInputs.set(from,{seq:packet.seq,connection,retiredConnections:[...retired].slice(-16),round:packet.round,input:packet.input&&typeof packet.input==='object'?packet.input:{},actions:[...actions.values()].sort((a,b)=>a.seq-b.seq),received:elapsed,receivedAt:Date.now()});
  }else if(from===online.session.hostId&&packet.type==='snapshot'&&packet.seq>netLastSnapshot&&(packet.mapId||'hashimoto')===(map.id||'hashimoto')){netLastSnapshot=packet.seq;applyNetSnapshot(packet);}
}
function captureNetActor(actor){
  const local=actor===player,record=local?roster[0]:actor.record;
  return{id:actor.id,team:actor.team,x:actor.x,z:actor.z,y:actor.y||0,yaw:local?player.yaw:actor.remoteId?(actor.netYaw||0):actor.group.rotation.y-Math.PI,
    hp:actor.hp,armor:actor.armor,alive:actor.alive,moving:local?Math.hypot(player.vx,player.vz)>.5:!!actor.moving,
    weapon:local?inventory.active:actor.netWeapon||record?.primary||record?.secondary||'classic',primary:local?inventory.primary:record?.primary,secondary:local?inventory.secondary:record?.secondary,
    ammo:local?player.ammo:actor.remoteId?actor.netAmmo:actor.aiAmmo,reserve:local?player.reserve:actor.remoteId?actor.netReserve:actor.aiReserve,reloading:local?reloading:actor.remoteId?actor.netReload||0:actor.aiReload||0,credits:local?match.credits:record?.credits||0,
    ...(actor.trafficLaunch?{trafficHit:[actor.trafficLaunch.seq,actor.trafficLaunch.endsAt,actor.trafficLaunch.vx,actor.trafficLaunch.vz,actor.vy||0]}:{}),
    ...(match.phase==='buy'&&actor.remoteId&&actor.netPurchaseAck?{purchaseAck:[...actor.netPurchaseAck]}:{}),
    serviceReload:actor.serviceReload?{...actor.serviceReload}:null,
    kit:actor.kit?.snapshot(),dashTimer:actor.dashTimer||0,dashVec:actor.dashVec?{x:actor.dashVec.x,z:actor.dashVec.z}:null,
    shotSequence:local?shotSequence:actor.shotSequence||0,planting:match.spike.plantActor===actor.id,defusing:match.spike.defuseActor===actor.id,flash:local?elapsed-lastShot<.05:actor.flash>0};
}
// Success receipts are host-issued and matched to this guest's still-pending
// action before the ordinary cumulative ACK removes it. Rejoins stay silent.
function applyNetPurchaseFeedback(packet,self,fresh,ack){
  const receipt=self.purchaseAck;
  if(fresh||!player.alive||!self.alive||match.phase!=='buy'||packet.rules.phase!=='buy'||packet.rules.round!==match.round||
    !Number.isSafeInteger(ack)||!Array.isArray(receipt)||receipt.length!==3||!Number.isSafeInteger(receipt[0])||receipt[0]<1||
    receipt[0]>ack||receipt[1]!==match.round||typeof receipt[2]!=='string')return;
  const action=netActions.find(a=>a.type==='buy'&&a.seq===receipt[0]&&a.round===receipt[1]&&a.id===receipt[2]);if(!action)return;
  sound('buy',{localOnly:true});
  const id=action.id,label=id==='light'?'ライトシールド':id==='heavy'?'ヘヴィーシールド':
    ['c','smoke'].includes(id)?getCharacterSkill(player.kit.character,'c')?.name:
    ['q','updraft'].includes(id)?getCharacterSkill(player.kit.character,'q')?.name:WEAPONS[id]?.name;
  if(mode==='shop'&&$('shop-status'))$('shop-status').textContent=`${label||'装備'} を購入しました`;
}
function applyNetSnapshot(packet){
  if((packet.mapId||'hashimoto')!==(map.id||'hashimoto'))return;
  if(!packet.rules||!Array.isArray(packet.actors)||packet.actors.length>10||!Array.isArray(packet.roster)||!Number.isFinite(packet.time))return;
  const ownId=netParticipants.get(online.session.memberId),self=packet.actors.find(a=>a.id===ownId);if(!self)return;
  const fresh=netRound!==packet.rules.round||!netHasSnapshot,previousPhase=match.phase,previousSpikeStatus=match.spike.status,wasAlive=player.alive,wasPaused=netHostPaused;
  // A same-round reconnect resets rendering, but must not revive a grounded
  // effect already stopped by this player's movement before its host ACK.
  const retainedFrostStops=fresh&&netRound===packet.rules.round&&player.id===ownId&&player.team===self.team
    ?[...stoppedFrostEvents].filter(([,endsAt])=>endsAt>packet.time):[];
  const ack=packet.acks?.[online.session.memberId]||0;applyNetPurchaseFeedback(packet,self,fresh,ack);netActions=netActions.filter(a=>a.seq>ack);
  netActionSequence=Math.max(netActionSequence,ack,...netActions.map(a=>a.seq));
  applyNetCues(packet,fresh,ownId);
  Object.assign(match,packet.rules);match.events=[];match.credits=self.credits;elapsed=packet.time;roster=packet.roster;
  const stopped=fresh||wasAlive&&!self.alive||previousPhase!==match.phase&&['post','match'].includes(match.phase);
  if(stopped||wasPaused!==Boolean(packet.paused))clearCombatInput();
  if(mode==='shop'&&match.phase!=='buy')resumeGame();
  if(fresh){victoryMusic.reset();lastRoundAudio='';Object.assign(dashFeedback,{round:null,state:null,expires:0,charge:null,signatureAt:0});clearBots();clearDrops();resetDetonation();resetTakeover();resetTeamAbilities();netPositionHistory.clear();netPositionAck=0;netPositionCorrectionX=0;netPositionCorrectionZ=0;player.x=self.x;player.z=self.z;player.y=self.y;player.vy=0;player.yaw=self.yaw;player.pitch=0;player.recoil=0;renderedRecoil=0;player.vx=0;player.vz=0;player.dashTimer=0;player.dashVec=null;player.netPredictDashUntil=0;netRound=match.round;setVisible('round-banner',false);for(const [id,endsAt]of retainedFrostStops)stoppedFrostEvents.set(id,endsAt);}
  else if(!wasAlive&&self.alive){player.x=self.x;player.y=self.y;player.z=self.z;player.vy=0;player.vx=0;player.vz=0;player.dashTimer=0;netPositionHistory.clear();netPositionAck=packet.positionAcks?.[online.session.memberId]?.seq||0;netPositionCorrectionX=0;netPositionCorrectionZ=0;clearCombatInput();showMessage('総動員','開始地点へ復帰しました',3);}
  else if(!(player.netPredictDashUntil>elapsed)){
    const positionAck=packet.positionAcks?.[online.session.memberId],sent=positionAck&&netPositionHistory.get(positionAck.seq);
    if(sent&&positionAck.seq>netPositionAck&&positionAck.round===match.round&&positionAck.connection===(online.connectionId||'legacy')&&[positionAck.x,positionAck.z].every(Number.isFinite)){
      // Compare the host with that input's position, not with the player's newer
      // prediction. Retain movement since sending and subtract corrections that
      // have already been applied while this acknowledgement was in flight.
      let dx=positionAck.x-sent.x-(netPositionCorrectionX-sent.correctionX),dz=positionAck.z-sent.z-(netPositionCorrectionZ-sent.correctionZ);
      if(Math.hypot(dx,dz)>1e-5){
        const x=player.x+dx,z=player.z+dz;
        if(Math.hypot(positionAck.x-sent.x,positionAck.z-sent.z)>2||!canStand(x,z,.34,player.y)||!map.collision.segmentClear(player.x,player.z,x,z,.34,player.y)){dx=self.x-player.x;dz=self.z-player.z;player.y=self.y;}
        player.x+=dx;player.z+=dz;netPositionCorrectionX+=dx;netPositionCorrectionZ+=dz;
      }
      netPositionAck=positionAck.seq;for(const seq of netPositionHistory.keys())if(seq<=positionAck.seq)netPositionHistory.delete(seq);
    }else if(!packet.positionAcks){
      // Older hosts do not supply input references; keep their bounded recovery.
      const error=Math.hypot(self.x-player.x,self.z-player.z);if(error>2){player.x=self.x;player.z=self.z;player.y=self.y;}else{player.x=THREE.MathUtils.lerp(player.x,self.x,.18);player.z=THREE.MathUtils.lerp(player.z,self.z,.18);}
    }else if(!netPositionHistory.size&&Math.hypot(self.x-player.x,self.z-player.z)>2){
      // A denied prediction without any outstanding input still needs recovery.
      player.x=self.x;player.z=self.z;player.y=self.y;
    }
  }
  const launch=trafficMarker(self.trafficHit,packet.time);
  if(launch&&(match.phase==='live'||match.phase==='post'&&!self.alive)){
    player.trafficLaunch=launch;player.x=self.x;player.y=self.y;player.z=self.z;player.vy=launch.vy;player.vx=0;player.vz=0;player.dashTimer=0;
    netPositionHistory.clear();netPositionAck=Math.max(netPositionAck,packet.positionAcks?.[online.session.memberId]?.seq||0);netPositionCorrectionX=0;netPositionCorrectionZ=0;
  }else player.trafficLaunch=null;
  applyNetDetonation(packet);
  applyNetTakeover(packet,{audible:!fresh});
  if(match.phase==='live'){nopeDecoys.restore(packet.nopeDecoys??null,elapsed,match.round);applyNetNopePops(packet.nopePops||[],fresh);}
  else{nopeDecoys.reset();nopeDecoyFX.reset();}
  if(packet.teamAbilities)teamAbilities.restore(packet.teamAbilities,elapsed,match.round);
  else teamAbilities.reset();
  if(match.phase==='live'&&packet.zoneAbilities)zoneAbilities.restore(packet.zoneAbilities,elapsed,match.round);
  else resetZoneAbilities();
  if(match.phase==='live'&&packet.ordinarySkills){
    for(const [id,endsAt]of stoppedTurfEvents)if(endsAt<=elapsed)stoppedTurfEvents.delete(id);
    for(const [id,endsAt]of stoppedServiceEvents)if(endsAt<=elapsed)stoppedServiceEvents.delete(id);
    for(const [id,endsAt]of stoppedFrostEvents)if(endsAt<=elapsed)stoppedFrostEvents.delete(id);
    const state=packet.ordinarySkills;
    ordinarySkills.restore((stoppedTurfEvents.size||stoppedServiceEvents.size||stoppedFrostEvents.size)&&Array.isArray(state.events)?{...state,events:state.events.filter(event=>!stoppedTurfEvents.has(event.id)&&!stoppedServiceEvents.has(event.id)&&!stoppedFrostEvents.has(event.id))}:state,elapsed,match.round);
  }
  else resetOrdinarySkills();
  for(const event of ordinarySkills.events(elapsed))if(event.type==='car-bumper'&&event.targetId===ownId&&!carImpulseSeen.has(event.id)){carImpulseSeen.add(event.id);if(!fresh){player.x=self.x;player.y=self.y;player.z=self.z;player.vy=0;player.vx=0;player.vz=0;player.dashTimer=0;netPositionHistory.clear();netPositionAck=Math.max(netPositionAck,packet.positionAcks?.[online.session.memberId]?.seq||0);netPositionCorrectionX=0;netPositionCorrectionZ=0;}}
  while(carImpulseSeen.size>32)carImpulseSeen.delete(carImpulseSeen.values().next().value);
  for(const event of ordinarySkills.events(elapsed))if(event.type==='cat-return'&&event.sourceId===ownId&&!catReturnSeen.has(event.id)){catReturnSeen.add(event.id);if(!fresh){player.x=self.x;player.y=self.y;player.z=self.z;player.vy=0;player.vx=0;player.vz=0;player.dashTimer=0;netPositionHistory.clear();netPositionAck=Math.max(netPositionAck,packet.positionAcks?.[online.session.memberId]?.seq||0);netPositionCorrectionX=0;netPositionCorrectionZ=0;clearCombatInput();}}
  while(catReturnSeen.size>32)catReturnSeen.delete(catReturnSeen.values().next().value);
  if(fresh)for(const event of ordinarySkills.events(elapsed))ordinaryAudio.set(event.id,event.type==='nope-decoy'?Math.floor((elapsed-event.startedAt)/.65):elapsed>=ordinaryAudioTime(event));
  if(fresh)for(const event of zoneAbilities.events(elapsed))if(event.type==='ember')zonePulseAudio.set(event.id,emberPulseIndex(elapsed-event.startedAt));
  if(self.hp<player.hp)damageFlash=.35;
  player.id=ownId;player.team=self.team;player.hp=self.hp;player.armor=self.armor;player.alive=self.alive;
  if(fresh||self.alive)deathView.reset();
  else if(wasAlive)beginDeathView();
  if(fresh)for(const marker of ordinarySkills.markers(player.team,elapsed))ordinaryMarkerAudio.add(marker.eventId);
  if(!fresh&&previousSpikeStatus!==match.spike.status){
    if(match.spike.status==='planted'){sound('plant',{entity:match.spike,localOnly:true});lastSpikeBeep=0;}
    if(match.spike.status==='defused')sound('defuse',{entity:match.spike,localOnly:true});
  }
  if(fresh||netHostPaused||match.phase!=='post')victoryMusic.stop();
  if(match.phase==='post'&&match.lastRound?.round===match.round)showRoundResult(match.lastRound.team,match.lastRound.reason,{audible:!fresh});
  let predictedKnives=false;
  if(self.kit&&player.kit){
    player.kit.restore(self.kit);
    for(const action of netActions){
      if(action.round!==match.round)continue;
      if(action.type==='character'&&match.phase==='buy'&&match.round===1&&characterIds.includes(action.character))player.kit.character=action.character;
      else if(action.type==='ability'&&!(player.kit.character==='cat'&&action.key==='c'&&action.catReturning===true)){const effect=player.kit.activate(action.key,action.at);if(effect?.type==='knives')predictedKnives=true;}
      else if(action.type==='fire'&&action.ultimate)player.kit.consumeKnife();
    }
    player.kit.tick(elapsed);
  }
  netHostPaused=packet.paused===true;if(Array.isArray(packet.smokes))syncSmokes(packet.smokes);if(Array.isArray(packet.drops))syncDrops(packet.drops);
  inventory.primary=self.primary;inventory.secondary=self.secondary||'classic';
  const activeWeapon=predictedKnives?'knife':self.weapon;
  if(fresh||inventory.active!==activeWeapon){inventory.active=activeWeapon;viewmodel.setWeapon(activeWeapon==='spike'?'knife':activeWeapon);shotSequence=0;}
  player.ammo=self.ammo??weapon().mag;player.reserve=self.reserve??weapon().reserve;reloading=stopped||self.planting||self.defusing?0:self.reloading||0;gun.visible=self.alive&&inventory.active!=='spike';
  // Actor state carries the reload kind independently of the visual engine's
  // monotonic clock, which can run ahead during a delayed host ACK.
  const service=serviceFromSnapshot(self.serviceReload,self,elapsed),cancelledService=service&&stoppedServiceEvents.has(service.eventId);
  player.serviceReload=self.alive&&match.phase==='live'&&!self.planting&&!self.defusing&&!cancelledService?service:null;
  if(player.serviceReload)reloading=self.reloading;
  else if(self.serviceReload!=null)reloading=0;
  const ownRecord=roster.find(r=>r.id===ownId);totalKills=ownRecord?.k||0;
  for(const state of packet.actors){
    if(state.id===ownId)continue;let actor=bots.find(b=>b.id===state.id);
    if(!actor){makeBot(state,Number(state.id.split('-')[1])||0,state.team,roster.find(r=>r.id===state.id));actor=bots[bots.length-1];actor.id=state.id;actor.x=state.x;actor.z=state.z;actor.y=state.y;}
    if(actor.alive&&!state.alive)actor.death=.85;
    if(!actor.alive&&state.alive){actor.death=0;actor.group.visible=true;actor.x=state.x;actor.y=state.y;actor.z=state.z;}
    actor.hp=state.hp;actor.armor=state.armor;actor.alive=state.alive;actor.moving=state.moving;actor.netTarget=state;actor.planting=state.planting;actor.defusing=state.defusing;actor.flash=state.flash?.07:0;actor.shotSequence=state.shotSequence||0;
    if(state.kit&&actor.kit)actor.kit.restore(state.kit);
  }
  netHasSnapshot=true;setVisible('loading',false);setVisible('hud',true);setVisible('spectator-hint',!player.alive&&!deathView.holding);syncDeathUI();buyBarrier.visible=match.phase==='buy';const area=map.buyAreas[ownSide()];if(area){buyBarrier.position.set(area.x,2,area.z);buyBarrier.scale.set(area.radius,1,area.radius);}
  if(!netHostPaused&&!netCharacterRequested&&match.phase==='buy'&&match.round===1){netCharacterRequested=true;queueNetAction('character',{character:selectedCharacter()});player.kit.character=selectedCharacter();}
  if(match.phase==='match'&&mode!=='result')finish(match.winner===player.team);
  updateHUD();
}
function updateRemoteActor(actor,dt){
  const data=netInputs.get(actor.remoteId);if(!data){actor.planting=false;actor.defusing=false;match.cancelPlant(actor.id);match.cancelDefuse(actor.id);return;}
  const input=data.input,active=elapsed-data.received<.8&&actor.alive&&data.round===match.round,previousX=actor.x,previousY=actor.y||0,previousZ=actor.z,wasDashing=actor.dashTimer>0;
  if(active&&Number.isFinite(input.x)&&Number.isFinite(input.z)){
    // An accepted airborne pose ends turf before applying this input's speed cap.
    const inputFeet=Number.isFinite(input.y)?clamp(input.y,0,11):actor.y;
    const inputGrounded=actorGrounded({...actor,x:input.x,z:input.z,y:inputFeet,vy:0});
    let dx=input.x-actor.x,dz=input.z-actor.z;
    if(actor.dashTimer>0&&actor.dashVec){const step=Math.min(dt,actor.dashTimer)*12/.18;dx=actor.dashVec.x*step;dz=actor.dashVec.z*step;}
    else if(actor.netDashInputSequence===data.seq||elapsed<Math.max(actor.carImpulseUntil||0,actor.trafficLaunch?.endsAt||0)){dx=0;dz=0;}
    const distance=Math.hypot(dx,dz),limit=(actor.dashTimer>0?12/.18:(frostSlideSpeed(actor,inputGrounded)||(input.quiet===true?2.8:7)*1.15)*actorSpeedScale(actor,inputGrounded))*dt;
    if(distance>limit){dx*=limit/distance;dz*=limit/distance;}
    if(match.phase==='buy'){const area=map.buyAreas[actor.team===match.attackerTeam?'attack':'defend'];if(Math.hypot(actor.x+dx-area.x,actor.z+dz-area.z)>area.radius-.4){dx=0;dz=0;}}
    moveEntity(actor,dx,dz);
    const blocked=Math.hypot(actor.x-previousX-dx,actor.z-previousZ-dz)>1e-5;
    if(!wasDashing&&actor.netDashInputSequence!==data.seq&&(Math.hypot(input.x-actor.x,input.z-actor.z)<1e-5||blocked||distance>2))actor.netPositionAck={seq:data.seq,connection:data.connection,round:data.round,x:actor.x,z:actor.z};
    if(Number.isFinite(input.y)&&elapsed>=Math.max(actor.carImpulseUntil||0,actor.trafficLaunch?.endsAt||0)){
      const floor=inputGrounded?getZoneFloor(actor.x,actor.z,Math.max(actor.y,inputFeet)+.22):null;
      // A capped stair input follows support at the accepted XZ, not the feet
      // height of a point the host has not reached yet.
      actor.y=floor!==null&&Math.abs(floor-inputFeet)<=.45&&canStand(actor.x,actor.z,.34,floor)?floor:inputFeet;
      // Remote motion is consumed from its accepted pose; a prior lift impulse
      // must not leave a landed actor permanently classified as airborne.
      actor.vy=inputGrounded?0:(actor.y-previousY)/Math.max(dt,1e-6);
    }
    applyStarHold(actor);
    actor.crouch=frostSlideSpeed(actor)>0?1:clamp(Number(input.crouch)||0,0,1);
    actorMovementScale(actor);
    actor.netYaw=Number.isFinite(input.yaw)?input.yaw:0;actor.netPitch=clamp(Number(input.pitch)||0,-1.35,1.35);actor.group.rotation.y=actor.netYaw+Math.PI;
  }
  const remoteRunning=active&&match.phase==='live'&&(frostSlideSpeed(actor)>0||input.quiet!==true&&actor.crouch<.5)&&!wasDashing&&actorGrounded(actor)&&Math.hypot(actor.x-previousX,actor.z-previousZ)>dt*2;
  actor.netStepClock=remoteRunning?(actor.netStepClock||0)+dt:0;if(actor.netStepClock>.35){actor.netStepClock=0;sound('step',{entity:actor});}
  actor.kit?.tick(elapsed);actor.dashTimer=Math.max(0,(actor.dashTimer||0)-dt);actor.moving=Math.hypot(actor.x-previousX,actor.z-previousZ)>dt*.5;
  const stationary=Math.hypot(actor.x-previousX,actor.z-previousZ)<dt*.25&&Math.abs(actor.y||0)<=.05,held=active&&input.interact===true&&match.phase==='live';
  match.pickupSpike(actor.id,actor.team,actor.x,actor.z);const site=map.sites.find(s=>isInsideSite(s,actor.x,actor.z));
  actor.planting=!!(held&&stationary&&site&&match.spike.carrier===actor.id);
  actor.defusing=!!(held&&stationary&&actor.team===match.defenderTeam&&match.spike.status==='planted'&&Math.hypot(actor.x-match.spike.x,actor.z-match.spike.z)<2.3);
  if(actor.planting||actor.defusing){cancelServiceReload(actor);actor.netReload=0;}
  if(ordinarySkills.urchinJammed(actor.id,elapsed))urchinCancelReload(actor);
  if(!tickServiceReload(actor,dt)&&actor.netReload>0){actor.netReload=Math.max(0,actor.netReload-dt);if(!actor.netReload){const spec=WEAPONS[actor.netWeapon]||WEAPONS.classic,n=Math.min(spec.mag-actor.netAmmo,actor.netReserve);actor.netAmmo+=n;actor.netReserve-=n;}}
  const actions=data.actions.slice().sort((a,b)=>a.seq-b.seq);let ack=netApplied.get(actor.remoteId)||0;
  for(const action of actions){
    if(!Number.isSafeInteger(action.seq)||action.seq<=ack)continue;if(action.seq!==ack+1)break;
    if(action.round!==match.round||!active){ack=action.seq;continue;}
    let actionTime=elapsed;
    if(action.type==='fire'){
      if(!Number.isFinite(action.at)||action.at<elapsed-1){ack=action.seq;continue;}
      const spec=WEAPONS[actor.netWeapon]||WEAPONS.classic,interval=actor.kit?.knivesActive&&actor.netWeapon==='knife'?BLADE.interval:nobiShotInterval(spec,actor);
      actionTime=Math.max(clamp(action.at,data.received-.75,elapsed),(actor.lastNetShot??-10)+interval);if(actionTime>elapsed+1e-8)break;
    }
    applyRemoteAction(actor,action,actionTime);ack=action.seq;
  }
  netApplied.set(actor.remoteId,ack);data.actions=data.actions.filter(a=>a.seq>ack);
  if(actor.planting)match.interactPlant(dt*(ordinarySkills.nobiWork?.(actor.id,elapsed)||1),{actorId:actor.id,team:actor.team,site:site.id,x:actor.x,z:actor.z});else match.cancelPlant(actor.id);
  if(actor.defusing)match.interactDefuse(dt*(ordinarySkills.nobiWork?.(actor.id,elapsed)||1),{actorId:actor.id,team:actor.team});else match.cancelDefuse(actor.id);
}
function applyRemoteAction(actor,action,actionTime=elapsed){
  if(!actor.alive)return;const r=actor.record;
  if((actor.planting||actor.defusing)&&['fire','reload','equip','ability','drop'].includes(action.type))return;
  if(action.type==='character'){if(match.phase==='buy'&&match.round===1&&characterIds.includes(action.character))actor.kit.character=action.character;return;}
  if(action.type==='buy'&&match.phase==='buy'){
    if(['smoke','updraft','c','q'].includes(action.id)){if(actor.kit?.buy(action.id,price=>{if(r.credits<price)return false;r.credits-=price;return true;}))actor.netPurchaseAck=[action.seq,match.round,action.id];return;}
    const id=action.id,spec=WEAPONS[id],armor=id==='light'||id==='heavy',price=armor?(id==='light'?400:1000):spec?.price;
    if(!Number.isFinite(price))return;r.netPurchases||={};const slot=armor?'armor':spec.slot;if(slot!=='armor'&&!['primary','secondary'].includes(slot))return;
    if(armor?actor.armor>=(id==='light'?25:50):r[slot]===id)return;
    const purchase=r.netPurchases[slot],refund=purchase&&(armor||purchase.id===r[slot])?purchase.price:0;if(r.credits+refund<price)return;r.credits+=refund-price;r.netPurchases[slot]={id,price};
    if(armor)actor.armor=id==='light'?25:50;else{r[slot]=id;actor.netWeapon=id;actor.netAmmo=spec.mag;actor.netReserve=spec.reserve;actor.netReload=0;actor.netStores||={};actor.netStores[id]={ammo:spec.mag,reserve:spec.reserve};}actor.netPurchaseAck=[action.seq,match.round,id];return;
  }
  if(action.type==='ability'){
    if(['c','q','e','x'].includes(action.key)){
      let aim=null;
      if(action.yaw!==undefined||action.pitch!==undefined){
        if(!Number.isFinite(action.yaw)||!Number.isFinite(action.pitch))return;
        aim={yaw:action.yaw%(Math.PI*2),pitch:clamp(action.pitch,-1.35,1.35)};
      }
      const effect=activateAbility(actor,action.key,{aim});
      if(effect?.type==='dash'){
        actor.netDashInputSequence=netInputs.get(actor.remoteId)?.seq;
        if(Number.isFinite(action.dashX)&&Number.isFinite(action.dashZ)){
          const length=Math.hypot(action.dashX,action.dashZ);if(length>.5&&length<1.5)actor.dashVec={x:action.dashX/length,z:action.dashZ/length};
        }
      }
    }
    return;
  }
  if(action.type==='equip'){
    if(![r.primary,r.secondary,'knife','spike'].includes(action.weapon)||action.weapon==='spike'&&match.spike.carrier!==actor.id)return;
    cancelServiceReload(actor);actor.netStores||={};actor.netStores[actor.netWeapon]={ammo:actor.netAmmo,reserve:actor.netReserve};actor.netWeapon=action.weapon;const spec=WEAPONS[action.weapon]||WEAPONS.knife;
    const saved=actor.netStores[action.weapon];actor.netAmmo=saved?.ammo??spec.mag;actor.netReserve=saved?.reserve??spec.reserve;actor.netReload=0;return;
  }
  const knives=actor.kit?.knivesActive===true&&actor.netWeapon==='knife',spec=knives?BLADE:WEAPONS[actor.netWeapon]||WEAPONS.classic;
  if(action.type==='reload'&&!ordinarySkills.urchinJammed(actor.id,elapsed)&&actor.netAmmo<spec.mag&&actor.netReserve>0&&!actor.netReload&&!actor.serviceReload){actor.netReload=spec.reload;return;}
  if(action.type==='pickup'){if(match.phase==='live')pickupDroppedWeapon(actor,action.dropId);return;}
  if(action.type==='drop'){
    cancelServiceReload(actor);
    if(actor.netWeapon==='spike'&&match.spike.carrier===actor.id){const point=safeDropPoint({...actor,yaw:actor.netYaw});match.dropSpike(actor.id,point.x,point.z);actor.netWeapon=r.primary||r.secondary||'classic';}
    else if(actor.netWeapon===r.primary){dropItem(r.primary,actor);r.primary=null;delete r.netPurchases?.primary;actor.netWeapon=r.secondary||'classic';}
    else return;
    const next=WEAPONS[actor.netWeapon]||WEAPONS.classic,saved=actor.netStores?.[actor.netWeapon];actor.netAmmo=saved?.ammo??next.mag;actor.netReserve=saved?.reserve??next.reserve;actor.netReload=0;return;
  }
  if(action.type!=='fire'||match.phase!=='live'||actor.netWeapon==='spike'||actor.netReload>0||actor.serviceReload||actor.planting||actor.defusing||elapsed<(actor.skillThrowUntil||0)||actionTime-(actor.lastNetShot??-10)+1e-8<nobiShotInterval(spec,actor))return;
  const yaw=Number(action.yaw),pitch=Number(action.pitch);if(!Number.isFinite(yaw)||!Number.isFinite(pitch))return;
  const melee=!knives&&actor.netWeapon==='knife';if(knives){if(!actor.kit.consumeKnife())return;}else{if(!melee&&!(actor.netAmmo>0))return;if(!melee&&!ordinarySkills.capMagazine(actor.id,elapsed))actor.netAmmo--;}
  if(!melee&&!knives)crownShot(actor);
  if(spec.arsenal&&actionTime-(actor.lastNetShot??-10)>.3)actor.shotSequence=0;
  actor.lastNetShot=actionTime;actor.flash=.07;actor.shotSequence=(actor.shotSequence||0)+1;
  const origin=new THREE.Vector3(actor.x,1.7+(actor.y||0)-(actor.crouch||0)*.55,actor.z),aim=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
  if(spec.arsenal){sound('shot',{weapon:actor.netWeapon,entity:actor});fireArsenal(actor,origin,aim,spec,action.ads===true);return;}
  if(!melee&&!knives)capDistortAim(actor,aim);
  botsGroup.updateMatrixWorld(true);const ray=new THREE.Raycaster(origin,aim,0,melee?2.2:120);
  const all=ray.intersectObjects([environment,botsGroup],true).filter(h=>h.object.userData.bot!==actor&&(!h.object.userData.bot||h.object.userData.bot.alive));
  const hit=all[0];let target=hit?.object.userData.bot,point=hit?.point,head=!!hit?.object.userData.head,nearest=hit?.distance??120;
  if(player.alive&&player.team!==actor.team){
    const crouch=player.crouch*.55,headDistance=ray.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(player.x,1.62+player.y-crouch,player.z),.19),new THREE.Vector3());
    const bodyDistance=ray.ray.intersectBox(new THREE.Box3(new THREE.Vector3(player.x-.28,.4+player.y,player.z-.28),new THREE.Vector3(player.x+.28,1.45+player.y-crouch,player.z+.28)),new THREE.Vector3());
    for(const [p,isHead] of [[headDistance,true],[bodyDistance,false]])if(p&&origin.distanceTo(p)<nearest){target=player;point=p;head=isHead;nearest=origin.distanceTo(p);}
  }
  const fake=!melee?raycastNopeDecoy(origin,aim,nearest,actor.team):null;
  const shield=!melee?ordinarySkills.interceptShield(origin,aim,fake?.distance??nearest,spec.body||1,elapsed,match.round):null;
  if(shield){target=null;point=new THREE.Vector3(shield.point.x,shield.point.y,shield.point.z);nearest=shield.distance;}
  if(fake&&!shield){target=null;point=fake.point;nearest=fake.distance;hitNopeDecoy(fake.event,actor);}
  if(melee&&nearest>2.2)target=null;const end=point||origin.clone().addScaledVector(aim,90);if(!melee)tracer(origin,end);sound('shot',{weapon:actor.netWeapon,entity:actor});
  if(!target&&!fake&&!shield&&!melee&&!knives&&hit)capBounceShot(actor,origin,aim,hit,spec);
  if(!melee&&!knives)urchinTridentShot(actor,origin,aim,spec);
  if(target&&target.team!==actor.team){let damage=nobiBulletDamage(actor,target,head?spec.head:point.y-(target.y||0)<.7?spec.leg:spec.body,spec.head,!melee&&!knives);if(!knives&&['phantom','spectre','ghost','classic'].includes(actor.netWeapon)&&nearest>15)damage*=nearest>30?.8:.9;damageEntity(target,damage,actor,{firearm:!melee&&!knives,skill:knives?'duelist':null});burst(point,head?'#fff3c8':'#ff737e',5);}
}
function tickOnline(dt){
  if(!onlinePlaying||!online||!match)return;netClock+=dt;if(netClock<.065)return;netClock=0;
  if(online.host){
    const rules={format:match.format,startingSide:match.startingSide,round:match.round,score:{...match.score},phase:match.phase,phaseTime:match.phaseTime,roundTime:match.roundTime,winner:match.winner,lastRound:match.lastRound?{...match.lastRound}:null,spike:{...match.spike}};
    if(rules.lastRound&&match.phase!=='post')delete rules.lastRound.fullCombo;
    const teamState=teamAbilities.snapshot(),packet={type:'snapshot',mapId:map.id||'hashimoto',seq:++netSequence,time:elapsed,paused:netHostPaused,cues:serializeNetCues(),smokes:serializeSmokes(),drops:serializeDrops(),detonation:detonationState?{...detonationState}:null,takeover:takeoverState?{...takeoverState}:null,zoneAbilities:zoneAbilities.snapshot(),rules,roster:roster.map(r=>({...r,kit:r.kit?.snapshot()})),actors:[player,...bots].map(captureNetActor),acks:Object.fromEntries(netApplied),positionAcks:Object.fromEntries(bots.filter(b=>b.remoteId&&b.netPositionAck).map(b=>[b.remoteId,{...b.netPositionAck}]))};
    for(const team of ['blue','red']){let state={...packet,teamAbilities:{...teamState,pings:teamState.pings.filter(ping=>ping.observerTeam===team)},ordinarySkills:ordinarySkills.snapshot(team),nopeDecoys:nopeDecoys.snapshot(),nopePops:serializeNopePops()};if(map.traffic||match.phase==='post'||state.cues.some(c=>c.type==='skill-hit'||c.type==='skill-heal'))state=fitTrafficSnapshot(state);if(state)online.send(state,{team});}
  }else if(netHasSnapshot){
    const seq=++netSequence,input={x:player.x,z:player.z,y:player.y,yaw:player.yaw,pitch:player.pitch,crouch:player.crouch,quiet:keys.has('ShiftLeft')||keys.has('ShiftRight'),interact:mode==='play'&&interactionHeld};
    netPositionHistory.set(seq,{x:input.x,z:input.z,correctionX:netPositionCorrectionX,correctionZ:netPositionCorrectionZ});while(netPositionHistory.size>128)netPositionHistory.delete(netPositionHistory.keys().next().value);
    online.send({type:'input',seq,round:match.round,input,actions:netActions});
  }
}
$('online-open')?.addEventListener('click',async()=>{if(!online&&await restoreRoomSession())return;setVisible('online-overlay',true);setVisible('online-entry',!online);setVisible('online-lobby',!!online);$('online-error').textContent='';});
$('online-close')?.addEventListener('click',()=>setVisible('online-overlay',false));
$('online-create')?.addEventListener('click',()=>enterRoom(false));$('online-join')?.addEventListener('click',()=>enterRoom(true));
$('online-copy')?.addEventListener('click',copyPartyCode);
$('online-room-code')?.addEventListener('click',selectPartyCode);
$('online-code')?.addEventListener('paste',event=>{const code=normalizePartyCode(event.clipboardData?.getData('text')||'');if(/^[A-Z2-9]{8}$/.test(code)){event.preventDefault();$('online-code').value=code;}});
$('online-ready')?.addEventListener('click',async()=>{try{const me=online.room.members.find(m=>m.id===online.session.memberId);await online.ready(!me.ready,$('online-team').value);}catch(error){$('online-error').textContent=error.message;}});
$('online-team')?.addEventListener('change',()=>online?.ready(false,$('online-team').value).catch(error=>{$('online-error').textContent=error.message;}));
async function saveLobbySettings(){
  const client=online;if(!client?.host||client.room.status!=='lobby'||client.settingsPending)return;
  $('online-error').textContent='';
  const saving=client.configure($('online-format').value,normalizeMapId($('online-map').value));updateRoom(client.room);
  try{await saving;if(online===client&&!onlinePlaying){selectArena(client.room.settings.mapId);saveSettings();}}
  catch(error){if(online===client)$('online-error').textContent=error.message;}
}
for(const id of ['online-map','online-format'])$(id)?.addEventListener('change',saveLobbySettings);
$('online-start')?.addEventListener('click',()=>online?.start($('online-format').value,normalizeMapId($('online-map')?.value)).catch(error=>{$('online-error').textContent=error.message;}));
$('online-leave')?.addEventListener('click',()=>leaveOnline());
restoreRoomSession();

function resetMouseLook(){mouseAnchor=null;}
function look(dx,dy){
  if(netHostPaused||mode!=='play'||!player.alive||!Number.isFinite(dx)||!Number.isFinite(dy)||Math.abs(dx)>500||Math.abs(dy)>500)return;
  player.yaw-=dx*.002*sensitivity;player.pitch=clamp(player.pitch-dy*.002*sensitivity,-1.35,1.35);
}
function mouseLook(event){
  if(netHostPaused||mode!=='play'||!player.alive||event.sourceCapabilities?.firesTouchEvents){resetMouseLook();return;}
  const pointerLocked=document.pointerLockElement===canvas;
  // Do not mix viewport coordinates and relative deltas while lock state is changing.
  if(pointerLocked!==locked){resetMouseLook();return;}
  const time=Number.isFinite(event.timeStamp)?event.timeStamp:performance.now();
  const previous=mouseAnchor;
  const next={x:event.clientX,y:event.clientY,time,width:innerWidth,height:innerHeight,locked:pointerLocked,relativeMatchesX:0,relativeMatchesY:0,relativeOffsetX:0,relativeOffsetY:0};
  if(pointerLocked){
    // Pointer capture can emit a recenter movement; discard its first sample.
    mouseAnchor=next;
    if(!previous||!previous.locked||previous.width!==next.width||previous.height!==next.height)return;
    look(event.movementX,event.movementY);return;
  }
  if(event.target!==canvas||!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY)){resetMouseLook();return;}
  mouseAnchor=next;
  // Use viewport positions outside pointer lock, where relative browser deltas may jump.
  if(!previous||previous.locked||previous.width!==next.width||previous.height!==next.height||time<previous.time||time-previous.time>250)return;
  // Validate axes independently: ordinary horizontal movement must not hide a
  // vertical recenter. Keep coordinate gain, including fractional-pixel motion.
  const axisDelta=(delta,relative,field)=>{
    const matches=previous[field]||0;
    const offsetField=field==='relativeMatchesX'?'relativeOffsetX':'relativeOffsetY';
    const offset=previous[offsetField]||0;
    if(Number.isFinite(relative)){
      // Half-pixel rounding and duplicate stationary samples are normal browser
      // input. Neither should erase an already established reliable stream.
      if(Math.abs(delta-relative)<=.500001){
        next[field]=delta===0&&relative===0?matches:Math.min(2,matches+1);
        next[offsetField]=offset;
      }else if(matches>=2&&offset*(delta-relative)<0&&Math.abs(offset+delta-relative)<=1.000001){
        // The return from a small warp may be below the detection threshold.
        // Preserve real motion if the return and a flick arrive in one sample.
        next[field]=matches;return relative;
      }else if(matches>=2&&Math.abs(delta)>=4&&Math.abs(relative)<=Math.abs(delta)*.25){
        // Seed from the new position even when rejecting a warp, so both its
        // outward and return samples are harmless without delaying real motion.
        next[field]=matches;next[offsetField]=offset+delta-relative;return 0;
      }
    }
    return delta;
  };
  const dx=axisDelta(next.x-previous.x,event.movementX,'relativeMatchesX');
  const dy=axisDelta(next.y-previous.y,event.movementY,'relativeMatchesY');
  look(dx,dy);
}
function resize(){resetMouseLook();renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);resize();
document.addEventListener('fullscreenchange',()=>{resetMouseLook();keyboardProtection.synchronize();});
document.addEventListener('pointerlockchange',()=>{
  const wasLocked=locked;locked=document.pointerLockElement===canvas;resetMouseLook();
  if(wasLocked&&!locked&&mode==='play')pauseGame();
});
document.addEventListener('pointerlockerror',()=>{inputActive=true;resetMouseLook();if(mode==='play')showMessage('MOUSE LOOK','マウスを動かすだけで視点を操作できます',3);});
document.addEventListener('mousemove',mouseLook);
canvas.addEventListener('mouseenter',resetMouseLook);canvas.addEventListener('mouseleave',resetMouseLook);
canvas.addEventListener('mousedown',e=>{if(duckAim){e.preventDefault();if(e.button===2){duckAim=null;showMessage('スキルを取り消しました','回数は消費していません',1);return;}if(e.button===0){const key=duckAim;duckAim=null;confirmDuckSkill(key);return;}}if(netHostPaused||mode!=='play')return;if(!player.alive){if(e.button===0&&!deathView.holding)spectateIndex++;return;}if(e.button===0){firing=true;shoot();}if(e.button===2)aiming=weapon().slot==='primary'&&!ordinarySkills.capLocked(player.id,elapsed);});
document.addEventListener('mouseup',e=>{if(e.button===0)firing=false;if(e.button===2)aiming=false;});
window.addEventListener('contextmenu',e=>{if(mode==='play')e.preventDefault();});
document.addEventListener('keydown',e=>{
  const editing=e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.target?.tagName==='TEXTAREA'||e.target?.isContentEditable||e.target?.closest?.('[contenteditable]:not([contenteditable="false"])');
  if(!editing&&['play','pause','shop','map','score'].includes(mode)){
    // Reserved shortcuts must reach the page before they can be cancelled.
    // Keyboard Lock supplies that delivery on supporting fullscreen browsers.
    if(e.ctrlKey||e.metaKey||e.altKey||['F1','F3','F5','F6','F7','Backspace'].includes(e.code))e.preventDefault();
    // Ctrl remains a compatible crouch modifier; OS/Command/Alt shortcuts are
    // never also interpreted as movement or combat actions.
    if(e.metaKey||e.altKey)return;
  }
  if(e.code==='Escape'){if(e.repeat)return;if(mode==='play')pauseGame();else if(['pause','map','shop','score'].includes(mode))resumeGame();return;}
  if(editing)return;
  if(['Space','Tab','ControlLeft','ControlRight'].includes(e.code)&&mode!=='menu')e.preventDefault();
  if(e.repeat)return;
  if(e.code==='KeyM'){if(mode==='play')pauseGame(true);else if(mode==='map')resumeGame();return;}
  if(e.code==='KeyB'&&['play','shop'].includes(mode)){openShop();return;}
  if(e.code==='Tab'&&['play','score'].includes(mode)){if(mode==='play')showScoreboard();return;}
  if(netHostPaused||mode!=='play')return;
  keys.add(e.code);
  if(e.code==='KeyF'&&player.alive&&match?.phase==='live'&&!objectivePractice?.completed)interactionHeld=true;
  if(player.alive){
    if(e.code==='Digit1'&&inventory.primary)equip(inventory.primary);
    if(e.code==='Digit2')equip(inventory.secondary);
    if(e.code==='Digit3')equip('knife');
    if(e.code==='Digit4'&&match.spike.carrier===player.id)equip('spike');
    if(e.code==='KeyG'&&!objectivePractice){
      if(isGuest()){queueNetAction('drop');return;}
      if(inventory.active==='spike'){const point=safeDropPoint();match.dropSpike(player.id,point.x,point.z);equip(inventory.primary||inventory.secondary);}
      else if(inventory.active===inventory.primary){dropItem(inventory.primary,player);inventory.primary=null;delete roundPurchases.primary;equip(inventory.secondary);}
    }
  }
  if(e.code==='KeyR')reload();if(e.code==='KeyC')useAbility('c');if(e.code==='KeyQ')dash();if(e.code==='KeyE')scan();if(e.code==='KeyX')useAbility('x');if(e.code==='Space')jump();
},{capture:true});
document.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='KeyF')interactionHeld=false;if(e.code==='Tab'&&mode==='score')resumeGame();});
function suspendSession(){
  victoryMusic.stop();
  keyboardProtection.release();
  clearCombatInput();
  if(['play','map','shop','score'].includes(mode)){setVisible('map-overlay',false);pauseGame();}
}
window.addEventListener('blur',suspendSession);
document.addEventListener('visibilitychange',()=>{if(document.hidden)suspendSession();else resetMouseLook();if(onlinePlaying&&online?.host){if(!document.hidden)online.cancelPausedRelay();netHostPaused=document.hidden;tickOnline(.1);updateHUD();}});
$('start').addEventListener('click',startGame);$('resume').addEventListener('click',resumeGame);
$('victory-dance-preview')?.addEventListener('click',()=>victoryDance.preview(selectedCharacter(),performance.now()));
$('explore-start')?.addEventListener('click',()=>{$('match-format').value='explore';updateFormatSummary();startGame();});
$('range-start')?.addEventListener('click',()=>{$('match-format').value='range';updateFormatSummary();startGame();});
$('restart').addEventListener('click',startGame);$('play-again').addEventListener('click',startGame);$('back-menu').addEventListener('click',backMenu);
$('pause-back-menu')?.addEventListener('click',backMenu);
$('pause').addEventListener('click',()=>pauseGame());$('map-toggle').addEventListener('click',()=>pauseGame(true));$('close-map').addEventListener('click',resumeGame);
$('close-shop')?.addEventListener('click',resumeGame);$('start-round')?.addEventListener('click',startRound);$('scoreboard-close')?.addEventListener('click',resumeGame);
createArsenalShop(document);
document.querySelectorAll('[data-buy]').forEach(button=>button.addEventListener('click',()=>buy(button.dataset.buy)));
$('sound').addEventListener('click',()=>{soundEnabled=!soundEnabled;$('sound').textContent=soundEnabled?'SOUND ON':'SOUND OFF';$('sound').setAttribute('aria-pressed',String(soundEnabled));syncVictoryMusic();if(soundEnabled){audioInit();sound('scan');}});
function updateFormatSummary(){
  const format=$('match-format')?.value,objective=['plant','defuse'].includes(format),practice=objective||['explore','range'].includes(format);
  if($('starting-side')){$('starting-side').disabled=objective;if(objective)$('starting-side').value=format==='plant'?'attack':'defend';}
  if($('mission-tag'))$('mission-tag').textContent=practice?'SOLO PRACTICE':'SOLO + BOTS';
  if($('start-title')?.firstChild)$('start-title').firstChild.nodeValue=practice?'練習を始める ':'出撃する ';
  if($('start-subtitle'))$('start-subtitle').textContent=(practice?'PRACTICE IN ':'DEPLOY TO ')+(map.shortName||'HASHIMOTO');
  const summary=$('format-summary');if(!summary)return;
  summary.replaceChildren();summary.parentElement?.classList.toggle('explore-summary',practice);
  const strong=document.createElement('b'),small=document.createElement('i');
  strong.textContent=format==='plant'?'設置練習':format==='defuse'?'電源オフ練習':format==='range'?'60秒 / AIM':format==='explore'?'マップ練習':format==='swift'?'5先取':'13先取';
  small.textContent=format==='plant'?'Fを4秒 · A/Bで反復':format==='defuse'?'7秒 · 進捗50%の保存を練習':format==='range'?'命中・ヘッド率 · 自己ベスト':format==='explore'?'時間制限なし · ルートと射撃を確認':format==='swift'?'4Rで攻守交代':'12Rで攻守交代';summary.append(strong,small);
}
$('match-format')?.addEventListener('change',updateFormatSummary);updateFormatSummary();
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement){keyboardProtection.release();await document.exitFullscreen();}else{const state=await keyboardProtection.enable();if(state==='unavailable')showMessage('全画面のキー保護を使えません','しゃがみは V 長押しで操作できます',3);}}catch{showMessage('FULLSCREEN','このブラウザでは全画面に切り替えられません',2);}});
$('keyboard-protect')?.addEventListener('click',()=>keyboardProtection.enable());
function saveSettings(){try{localStorage.setItem('hashimoto-settings',JSON.stringify({mapId:map.id||'hashimoto',sensitivity,volume,victoryMusicEnabled,victoryMusicVolume,lookVersion:2,character:selectedCharacter()}));}catch{}}
for(const id of ['agent-select','online-agent'])if($(id)){$(id).value=normalizeCharacter(settings.character);$(id).addEventListener('change',e=>{const value=normalizeCharacter(e.target.value);for(const other of ['agent-select','online-agent'])if($(other))$(other).value=value;updateCharacterDescription();saveSettings();});}
updateCharacterDescription();
function updateSensitivityLabel(){if($('sensitivity-value'))$('sensitivity-value').textContent=sensitivity.toFixed(2);}
if($('map-select'))$('map-select').addEventListener('change',e=>{if(mode!=='menu'||onlinePlaying)return;selectArena(e.target.value);saveSettings();});
selectArena(settings.mapId);
if($('sensitivity')){$('sensitivity').value=sensitivity;$('sensitivity').addEventListener('input',e=>{const value=Number(e.target.value);if(Number.isFinite(value))sensitivity=clamp(value,.05,1.5);updateSensitivityLabel();saveSettings();});updateSensitivityLabel();}
if($('volume')){$('volume').value=volume;$('volume').addEventListener('input',e=>{volume=Number(e.target.value);syncVictoryMusic();saveSettings();});}

victoryMusicUI=bindVictoryMusicSettings({document,music:victoryMusic,preferences:{enabled:victoryMusicEnabled,volume:victoryMusicVolume},onChange:next=>{if(next.enabled!==undefined)victoryMusicEnabled=next.enabled;if(next.volume!==undefined)victoryMusicVolume=next.volume;syncVictoryMusic();saveSettings();}});
window.addEventListener('pagehide',event=>{if(event.persisted)victoryMusic.stop();else {victoryMusic.dispose();victoryDance.dispose();}});

// Touch controls use separate pointers for movement, aiming, and firing.
const pad=$('move-pad');
if(pad){
  pad.addEventListener('pointerdown',e=>{if(netHostPaused||mode!=='play'||!player.alive)return;movePointer=e.pointerId;pad.setPointerCapture(e.pointerId);updatePad(e);});
  pad.addEventListener('pointermove',e=>{if(e.pointerId===movePointer)updatePad(e);});
  const releasePad=()=>{movePointer=null;touchMove={x:0,y:0};pad.style.setProperty('--stick-x','0px');pad.style.setProperty('--stick-y','0px');};
  pad.addEventListener('pointerup',releasePad);pad.addEventListener('pointercancel',releasePad);
  function updatePad(e){if(netHostPaused)return;const r=pad.getBoundingClientRect();const x=(e.clientX-r.left-r.width/2)/(r.width*.35),y=(e.clientY-r.top-r.height/2)/(r.height*.35);touchMove={x:clamp(x,-1,1),y:clamp(y,-1,1)};pad.style.setProperty('--stick-x',`${touchMove.x*26}px`);pad.style.setProperty('--stick-y',`${touchMove.y*26}px`);}
}
canvas.addEventListener('pointerdown',e=>{if(!netHostPaused&&e.pointerType==='touch'&&mode==='play'&&player.alive){touchLook={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}});
canvas.addEventListener('pointermove',e=>{if(touchLook?.id===e.pointerId){look((e.clientX-touchLook.x)*1.5,(e.clientY-touchLook.y)*1.5);touchLook.x=e.clientX;touchLook.y=e.clientY;}});
canvas.addEventListener('pointerup',e=>{if(touchLook?.id===e.pointerId)touchLook=null;});
for(const [id,action] of [['mobile-jump',jump],['mobile-reload',reload],['mobile-dash',dash],['mobile-scan',scan],['mobile-smoke',()=>useAbility('c')],['mobile-ult',()=>useAbility('x')]]){$(id)?.addEventListener('pointerdown',e=>{e.preventDefault();action();});}
$('mobile-weapon')?.addEventListener('click',()=>{
  if(netHostPaused||mode!=='play'||!player.alive||interactionHeld)return;
  const items=[inventory.primary,inventory.secondary,'knife'].filter(Boolean);
  equip(items[(items.indexOf(inventory.active)+1)%items.length]);updateHUD();
});
$('mobile-ads')?.addEventListener('click',()=>{
  if(netHostPaused||mode!=='play'||!player.alive||interactionHeld||weapon().slot!=='primary')return;
  aiming=!aiming&&!ordinarySkills.capLocked(player.id,elapsed);updateHUD();
});
$('mobile-crouch')?.addEventListener('click',()=>{
  if(netHostPaused||mode!=='play'||!player.alive||interactionHeld)return;
  if(keys.has('TouchCrouch'))keys.delete('TouchCrouch');else keys.add('TouchCrouch');updateHUD();
});
$('mobile-fire')?.addEventListener('pointerdown',e=>{e.preventDefault();if(duckAim){const key=duckAim;duckAim=null;confirmDuckSkill(key);return;}if(netHostPaused||mode!=='play'||!player.alive||match?.phase!=='live')return;firing=true;shoot();$( 'mobile-fire').setPointerCapture(e.pointerId);});
for(const type of ['pointerup','pointercancel'])$('mobile-fire')?.addEventListener(type,()=>firing=false);
$('mobile-shop')?.addEventListener('click',openShop);
$('mobile-interact')?.addEventListener('pointerdown',e=>{e.preventDefault();if(netHostPaused||mode!=='play'||!player.alive||match?.phase!=='live'||objectivePractice?.completed)return;interactionHeld=true;$('mobile-interact').setPointerCapture(e.pointerId);});
for(const type of ['pointerup','pointercancel'])$('mobile-interact')?.addEventListener(type,()=>interactionHeld=false);
canvas.addEventListener('pointercancel',e=>{if(touchLook?.id===e.pointerId)touchLook=null;});

let previous=performance.now(),miniTick=0;
function frame(now){
  requestAnimationFrame(frame);const dt=Math.min(Math.max(0,(now-previous)/1000),.25);previous=now;
  if(mode==='menu'){
    menuT+=dt;const overview=map.menuCamera||{position:[-15,9,-86],target:[30,8,-20]};camera.position.set(overview.position[0]+Math.sin(menuT*.09)*1.2,overview.position[1],overview.position[2]);camera.lookAt(...overview.target);
  }else if(!netHostPaused&&(['play','shop','map','score'].includes(mode)||onlinePlaying&&mode==='pause')){
    let remaining=dt;
    while(remaining>1e-8&&(['play','shop','map','score'].includes(mode)||onlinePlaying&&mode==='pause')){const step=Math.min(remaining,.05);updatePlay(step);remaining-=step;}
  }
  tickOnline(dt);
  victoryDance.sync({match,player,mode,character:player.kit?.character||selectedCharacter(),now,paused:netHostPaused});
  for(let i=effects.length-1;i>=0;i--){const effect=effects[i];if(['play','shop','map','score'].includes(mode)){effect.life-=dt;if(effect.velocity){effect.velocity.y-=6*dt;effect.object.position.addScaledVector(effect.velocity,dt);}}
    if(effect.life<=0){effectsGroup.remove(effect.object);effect.object.geometry.dispose();effect.object.material.dispose();effects.splice(i,1);}else effect.object.material.opacity=Math.min(1,effect.life/effect.max);
  }
  miniTick+=dt;if(miniTick>.1&&['play','shop','map','score'].includes(mode)){drawMinimap($('minimap'));if(mode==='map')drawMinimap($('large-minimap'),true);miniTick=0;}
  syncDeathUI();renderWithDetonation(dt);
}
$('loading-text').textContent='HASHIMOTO / 駅前アリーナ、ロード完了';
setVisible('loading',false);requestAnimationFrame(frame);

// A read-only snapshot allows reproducible smoke checks without exposing mutation hooks.
window.hashimotoGame={snapshot:()=>({mode,exploring,round:match?.round||1,phase:match?.phase,side:match?.side,score:match?{...match.score}:null,credits:match?.credits,hp:player.hp,armor:player.armor,alive:player.alive,weapon:inventory.active,ammo:player.ammo,reserve:player.reserve,kills:totalKills,remaining:aliveCount('red'),allies:aliveCount('blue'),spike:match?{...match.spike}:null,player:{x:player.x,y:player.y,z:player.z},mapId:map.id||'hashimoto',buses:map.traffic?.poses(elapsed)||[],time:timeLeft,colliders:map.colliders.length,city:map.stats,renderCalls:renderer.info.render.calls,webgl:!!renderer.getContext()})};
