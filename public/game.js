import { getSkillUseMessage } from './skill-messages.js';
import { createKillBanner } from './kill-banner.js';
import { createPreparedSkillFX, preparedSkillType } from './prepared-skill-fx.js';
import { createCareerCoins, CAREER_COIN_KEY, CAREER_COIN_REWARDS } from './career-coins.js';
import { createRoundDamageTracker, renderCombatReport } from './combat-report.js';
import { createFlashStatusFX } from './flash-status-fx.js';
import { planNopeWalk, nopeWalkPose } from './nope-walk.js';
import {busPoint} from './bus-service.js';
import { createBusHornScheduler } from './bus-horn.js';
import {busHitsBox} from './bus-destruction.js';
import { createSkillSpectacle, createSkillFeedback, SKILL_LOOKS } from './skill-spectacle.js';
import { createFullComboTracker, renderRoundBanner } from './full-combo.js';
import { ONNARA_SKILLS } from './abilities.js';
import { renkoDriveMotion, renkoFlightVelocity } from './renko-motion.js';
import { createRenkoSkillFX } from './renko-skill-fx.js';
import { createOnnaraSkillFX } from './onnara-skill-fx.js';
import { cameraSweep } from './onnara-camera-motion.js';
import { createOrbReveal } from './onnara-reveal.js';
import { createOrbView } from './onnara-orb-view.js';
import { chargeCrownTax, constellationTarget, createStarHold, orbViewYaw, orbViewPose, orbSeesActor } from './onnara-rules.js';
import { URCHIN_SKILLS } from './abilities.js';
import { createUrchinSkillFX } from './urchin-skill-fx.js';
import { CAP_SKILLS } from './abilities.js';
import { capShotOffset, capBounceFrame } from './cap-optics.js';
import { traceCapBankPreview, createCapBankPreviewFX } from './cap-bank-preview.js';
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
import { buyAreaContains, buyAreaOutline } from './round-preparation.js';
import { MatchRules, WEAPONS, applyArmorDamage } from './rules.js';
import { shotPattern, weaponDamage, weaponDescription } from './weapon-ballistics.js';
import { createArsenalShop } from './weapon-shop.js';
import { createNavigation } from './navigation.js';
import { createViewmodel } from './viewmodel.js';
import { createAgentModel } from './agent-model.js';
import { createCharacterPicker } from './character-preview.js';
import { roundDanceState, createVictoryCamera } from './victory-dance.js';
import { createVictoryClub } from './victory-club.js';
import { createGameAudio } from './audio.js';
import { createVictoryMusic, bindVictoryMusicSettings } from './victory-music.js';
import { createDeathView } from './death-view.js';
import { RangeSession } from './range.js';
import { createRangeControl } from './range-control.js';
import { RoomClient } from './online.js';
import { RENKO_SKILLS, DuelistKit, CHARACTER_DEFS, normalizeCharacter, signatureCooldown, JAPAN_SKILLS, NOBI_SKILLS, CAR_SKILLS, CAT_SKILLS, DUCK_SKILLS, DUELIST, DUELIST_SKILLS, NOPE_SKILLS, MEND_SKILLS, IAGNU_SKILLS, VEIL_SKILLS, EMBER_SKILLS, FROST_SKILLS } from './abilities.js';
import { createTeamAbilities } from './team-abilities.js';
import { createCharacterFX } from './character-fx.js';
import { createZoneAbilities } from './zone-abilities.js';
import { createZoneFX } from './zone-fx.js';
import { isInsideSite, getSitePlantPosition } from './site-areas.js';
import { createBotTactics, inVisionCone, createBotHearing } from './bot-tactics.js';
import { createObjectiveModel } from './objective-model.js';
import { createDroppedEquipment } from './dropped-equipment.js';
import { createStationDetonation } from './detonation.js';
import { createBuildingCollapse } from './building-collapse.js';
import { createStationTakeover } from './station-takeover.js';
import { createKeyboardProtection } from './keyboard-protection.js';
import { bindFullscreenNotice } from './fullscreen-notice.js';
import { getCharacterSkill } from './abilities.js';
import { CHARACTER_SKILLS, createCharacterSkills, skillProjectilePosition, selectMendTarget } from './character-skills.js';
import { createCharacterSkillUI } from './character-skill-ui.js';
import { createNopeSkillFX } from './nope-skill-fx.js';
import { createNopeDecoys } from './nope-decoys.js';
import { createNopeDecoyFX } from './nope-decoy-fx.js';
import { createMendSkillFX } from './mend-skill-fx.js';
import { createIagnuSkillFX } from './iagnu-skill-fx.js';
import { createGrassSkillFX } from './grass-skill-fx.js';
import { grassPlatform, grassLocal, grassWorld, grassOverlaps, grassBlocks, validGrassRide } from './grass-platforms.js';
import { createEmberSkillFX } from './ember-skill-fx.js';
import { createFrostSkillFX } from './frost-skill-fx.js';
import { createDuelistSkillFX } from './duelist-skill-fx.js';

const $ = id => document.getElementById(id);
const careerCoins = createCareerCoins({ onChange({balance,saved}) {
  if($('career-coin-balance'))$('career-coin-balance').textContent=balance.toLocaleString('ja-JP');
  if($('career-wallet')){
    $('career-wallet').setAttribute('aria-label',`所持金 ${balance.toLocaleString('ja-JP')} 489coin`);
    $('career-wallet').title=saved?`このブラウザーに保存 · 1キル${CAREER_COIN_REWARDS.kill} / 試合勝利${CAREER_COIN_REWARDS.win}`: '保存できないため、今開いている画面でのみ保持しています';
  }
} });
window.addEventListener('storage',event=>{if(event.key===CAREER_COIN_KEY||event.key===null)careerCoins.refresh();});
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
  setVisible('death-card',!victoryCamera.active&&!player.alive&&deathView.holding&&mode==='play');
  setVisible('crosshair',player.alive&&!victoryCamera.active);
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
const rangeControl=createRangeControl(THREE);
let map = createMap(THREE, environment);
map.bomberCollapse=createBuildingCollapse(THREE,map);scene.add(map.bomberCollapse.group);
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
const killBanner=createKillBanner(document);
const skillSpectacle=createSkillSpectacle(THREE),skillFeedback=createSkillFeedback(document);scene.add(skillSpectacle.group);
const ordinarySkills=createCharacterSkills(),ordinaryFX=createNopeSkillFX(THREE,camera);scene.add(ordinaryFX.group);
const preparedSkillFX=createPreparedSkillFX(THREE,camera);scene.add(preparedSkillFX.group);
const flashStatusFX=createFlashStatusFX(THREE);scene.add(flashStatusFX.group);
const nopeDecoys=createNopeDecoys(),nopeDecoyFX=createNopeDecoyFX(THREE);scene.add(nopeDecoyFX.group);
let nopePopSequence=0,nopeSeenPopSequence=0,nopeDecoyTownCandidates=null;
const nopePops=[];
const mendSkillFX=createMendSkillFX(THREE,camera);scene.add(mendSkillFX.group);
const iagnuSkillFX=createIagnuSkillFX(THREE,camera);scene.add(iagnuSkillFX.group);
const grassSkillFX=createGrassSkillFX(THREE,camera);scene.add(grassSkillFX.group);
const emberSkillFX=createEmberSkillFX(THREE,camera);scene.add(emberSkillFX.group);
const renkoSkillFX=createRenkoSkillFX(THREE);scene.add(renkoSkillFX.group);
const onnaraSkillFX=createOnnaraSkillFX(THREE);scene.add(onnaraSkillFX.group);const onnaraOrbView=createOrbView(THREE),starHold=createStarHold(),onnaraReveal=createOrbReveal(THREE);scene.add(onnaraReveal.group);
const urchinSkillFX=createUrchinSkillFX(THREE);scene.add(urchinSkillFX.group);
const capSkillFX=createCapSkillFX(THREE);scene.add(capSkillFX.group);
const capBankPreviewFX=createCapBankPreviewFX(THREE);scene.add(capBankPreviewFX.group);
let capPreviewUntil=-Infinity,capPreviewPath=null;
const japanSkillFX=createJapanSkillFX(THREE);scene.add(japanSkillFX.group);
const nobiSkillFX=createNobiSkillFX(THREE,camera);scene.add(nobiSkillFX.group);
const carSkillFX=createCarSkillFX(THREE);scene.add(carSkillFX.group);
const catSkillFX=createCatSkillFX(THREE);scene.add(catSkillFX.group);const catReturnSeen=new Set();
const duckSkillFX=createDuckSkillFX(THREE);scene.add(duckSkillFX.group);
const frostSkillFX=createFrostSkillFX(THREE,camera);scene.add(frostSkillFX.group);
const duelistSkillFX=createDuelistSkillFX(THREE,camera);scene.add(duelistSkillFX.group);
const stoppedServiceEvents=new Map();
const ordinaryAudio=new Map();
const ordinaryMarkerAudio=new Set();
const zonePulseAudio=new Map();
let duckAim=null,veilPlacement=null;
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
const roundDamage=createRoundDamageTracker();let combatReportKey='';
let exploring = false;
let rangeSession=null,rangeRespawn=0;
let objectivePractice=null;
let online=null,onlinePlaying=false,netHasSnapshot=false,netSequence=0,netActionSequence=0,netLastSnapshot=0,netClock=0,netRound=0;
const netPositionHistory=new Map();
let netPositionAck=0,netPositionCorrectionX=0,netPositionCorrectionZ=0;
let netActions=[],netParticipants=new Map(),netApplied=new Map(),netInputs=new Map();
let netCueSequence=0,netSeenCueSequence=0,skillImpactSequence=0;const netCues=[];
const actionCueTypes=new Set(['defuse-start','vehicle-hit','bus-break','door-open','door-close','door-break','door-hit','duct-step','shot','enemy','smoke','frost','updraft','dash-armed','dash','knives','heal','recon','veil','ember-warning']);
const dashFeedback={round:null,state:null,expires:0,charge:null,signatureAt:0};
const signatureReadyNotices=new Set();
let signatureFeedbackMatch=null;
const isGuest=()=>onlinePlaying&&online&&!online.host;
const ownSide=()=>player.team===match?.attackerTeam?'attack':'defend';
let inventory = {primary:null,secondary:'classic',active:'classic'};
let ammoStore = {};
let roundPurchases = {};
let skillPurchaseLedger=new WeakMap(),bomberNoticeKey='',bomberNoticeUntil=0;
let roster = [];
let redLossStreak=0,spectateIndex=0,spectatedBot=null,lastSpectatedId=null,interactionHeld=false,shotSequence=0,stepClock=0;
let targetSite='A',lastSpikeBeep=0,botThinkTick=0;
const sideNames={attack:'ATTACKERS / 攻撃',defend:'DEFENDERS / 防衛'};
let mode = 'menu', pausedFrom = 'play', locked = false, firing = false, aiming = false;
let elapsed = 0, timeLeft = 150, round = 1, totalKills = 0, shots = 0, hits = 0, reloading = 0;
let lastShot = -10, damageFlash = 0, hitFlash = 0, scanTime = 0, roundWait = 0, kick = 0;
let difficulty = 'hard', soundEnabled = true, volume = .45, sensitivity = .35;
let menuT = 0, pointerRequested = false, inputActive = false;
let pointerLockRequest=0,pointerLockInput='unlocked';
let touchMove = { x:0, y:0 }, touchLook = null, movePointer = null;
let mouseAnchor=null,renderedRecoil=0;
// Explicit local diagnosis only. No storage, network transmission or per-event DOM work.
const mouseInputTrace=typeof location!=='undefined'&&new URLSearchParams(location.search).has('inputTrace')?{rows:new Array(2048),next:0,size:0}:null;
const levels = { hard:{ interval:.7, aim:.94, speed:2.7, turnRate:Math.PI*.8, reaction:.14 } };
const settings = (() => { try { return JSON.parse(localStorage.getItem('hashimoto-settings') || '{}'); } catch { return {}; } })();
const savedSensitivity=Number(settings.sensitivity);
if(Number.isFinite(savedSensitivity)&&savedSensitivity>0)sensitivity=clamp(savedSensitivity*(settings.lookVersion===2?1:.35),.05,1.5);
if (settings.volume !== undefined) volume = clamp(Number(settings.volume), 0, 1);
const characterPicker=createCharacterPicker(THREE,{document});
// Collision-index rays include walls/ceilings and omit demolished geometry.
function victoryCameraClearance(origin, direction, distance) {
  if (!map.collision?.rayClear) return distance;
  const clear = length => [-.14, 0, .14].every(offset => map.collision.rayClear(
    origin.x + direction.z * offset, origin.y, origin.z - direction.x * offset,
    origin.x + direction.x * length + direction.z * offset, origin.y + direction.y * length,
    origin.z + direction.z * length - direction.x * offset));
  if (clear(distance + .18)) return distance;
  let low = 0, high = distance + .18;
  for (let i = 0; i < 9; i++) { const middle = (low + high) / 2; if (clear(middle)) low = middle; else high = middle; }
  return Math.max(0, low - .18);
}
const victoryCamera=createVictoryCamera(THREE,{camera,scene,clearDistance:victoryCameraClearance});
function updateVictoryCamera(dt=0) {
  const active=(!isGuest()||netHasSnapshot)&&victoryCamera.update({match,player,actors:bots,watchedId:lastSpectatedId,
    weapon:inventory.active,mode,dt:netHostPaused||mode==='pause'?0:dt,reducedMotion:reducedMotion.matches});
  $('hud').classList.toggle('victory-camera',!!active);
  if(active){gun.visible=false;flash.visible=false;setVisible('sniper-scope',false);setVisible('spectator-hint',false);}
  return active;
}
const skillUI=createCharacterSkillUI({document});
const keyboardProtection=createKeyboardProtection({document,navigator,onStatus:state=>{
  const messages={idle:'しゃがみは V 長押し。Ctrl＋Wなどはブラウザーによって停止できません。',enabling:'全画面とキー保護を準備しています…',protected:'ゲームキー保護中。Escで一時停止。全画面が戻らない場合はEscを長押し。',fullscreen:'全画面モード。キー保護の対応はブラウザー次第です。しゃがみは V を使えます。',unavailable:'この環境では全画面のキー保護を使えません。しゃがみは V を使ってください。'};
  if($('keyboard-protection-status'))$('keyboard-protection-status').textContent=messages[state]||messages.idle;
  if($('keyboard-protect'))$('keyboard-protect').disabled=state==='enabling';
}});

const fullscreenNotice=bindFullscreenNotice({document,onEnable:()=>keyboardProtection.enable()});
let victoryMusicEnabled=settings.victoryMusicEnabled!==false;
let victoryMusicVolume=Number.isFinite(Number(settings.victoryMusicVolume))?clamp(Number(settings.victoryMusicVolume),0,1):.6;
let victoryMusicUI;
const victoryMusic=createVictoryMusic({trackId:settings.victoryMusicTrack,onChange:()=>victoryMusicUI?.render()});
const victoryClub=createVictoryClub({element:$('victory-club')});
function updateVictoryClub(){return victoryClub.render({...victoryMusic.playback(),eligible:mode==='play'&&!document.hidden&&!netHostPaused&&match?.phase==='post'&&match.phaseTime>0&&match.lastRound?.team===player.team,reducedMotion:reducedMotion.matches});}
function syncVictoryMusic(){victoryMusic.setGate({enabled:victoryMusicEnabled,musicVolume:victoryMusicVolume,soundEnabled,masterVolume:volume,hidden:document.hidden});victoryMusic.prepare();}
syncVictoryMusic();
const gameAudio=createGameAudio();
const botHearing=createBotHearing();
function audioInit(){gameAudio.init();victoryMusic.prepare();}
function sound(type,{weapon:id=inventory.active,entity=null,localOnly=false}={}){
  if(type==='step'&&map.ductAt?.((entity||player).x,(entity||player).z,(entity||player).y))type='duct-step';
  if(['step','land','duct-step'].includes(type)&&ordinarySkills.quiet((entity||player).id,elapsed))return;
  if(!localOnly&&onlinePlaying&&online?.host&&actionCueTypes.has(type)){
    const actor=entity||player;
    netCues.push({seq:++netCueSequence,round:match?.round,type,weapon:id,id:actor.id,x:actor.x,y:actor.y||0,z:actor.z,time:elapsed});
    if(netCues.length>64)netCues.splice(0,netCues.length-64);
  }
  if(!localOnly&&!isGuest()&&match?.phase==='live'){const actor=entity||player;if(actor===player||bots.includes(actor))botHearing.emit(actor,type==='enemy'||type==='shot'?(id==='knife'?null:'shot'):type,elapsed);}
  if(!soundEnabled||!volume)return;
  const dx=entity?entity.x-player.x:0,dz=entity?entity.z-player.z:0,distance=Math.hypot(dx,dz);
  const gunshot=(type==='shot'||type==='enemy')&&(WEAPONS[id]?.mag||0)>0;
  if(!['explosion','plant','spike'].includes(type)&&distance>(gunshot?100:65))return;
  const pan=distance?(dx*Math.cos(player.yaw)-dz*Math.sin(player.yaw))/distance:0;
  const occluded=entity&&distance>2&&!map.collision.rayClear(player.x,player.y+1.5,player.z,entity.x,(entity.y||0)+1.3,entity.z);
  const plantedNotice=type==='plant',bomberTick=type==='spike';
  gameAudio.play(type,{volume,weapon:id,pan:plantedNotice?0:pan,distance:plantedNotice?0:type==='explosion'?distance*.2:bomberTick?distance*.35:distance,occluded:plantedNotice||bomberTick?false:occluded});
}
function resetDetonation(){detonationState=null;detonationClock=0;stationDetonation.reset();map.bomberCollapse?.reset();if($('detonation-flash'))$('detonation-flash').style.opacity='0';}
function resetTakeover(){takeoverState=null;takeoverClock=0;stationTakeover.reset();}
function resetZoneAbilities(){zoneAbilities.reset();zoneFX.reset();zonePulseAudio.clear();zoneTargetPreview=null;zoneTargetPreviewAt=-Infinity;zoneTargetCharacter=null;if($('status-effects')){$('status-effects').hidden=true;$('status-effects').textContent='';}}
const stoppedTurfEvents=new Map();
const stoppedFrostEvents=new Map();
function resetOrdinarySkills(){clearVeilPlacement();grassFrame=null;grassPrevious=null;onnaraReveal.reset();preparedSkillFX.reset();renkoSkillFX.reset();flashStatusFX.reset();capBankPreviewFX.reset();capPreviewUntil=-Infinity;capPreviewPath=null;skillSpectacle.reset();skillFeedback.reset();starHold.reset();onnaraSkillFX.reset();urchinSkillFX.reset();capSkillFX.reset();japanSkillFX.reset();nobiSkillFX.reset();carSkillFX.reset();catReturnSeen.clear();catSkillFX.reset();duckAim=null;duckSkillFX.reset();botHearing.reset();ordinarySkills.reset();ordinaryFX.reset();nopeDecoys.reset();nopeDecoyFX.reset();nopePops.length=0;nopeSeenPopSequence=0;mendSkillFX.reset();iagnuSkillFX.reset();grassSkillFX.reset();emberSkillFX.reset();frostSkillFX.reset();duelistSkillFX.reset();for(const actor of [player,...bots]){actor.renkoPending=null;actor.renkoDrive=null;actor.renkoJetHeld=false;actor.renkoUltimate=null;if(actor.kit)actor.kit.renkoActive=false;actor.onnaraJumpPending=null;actor.nextNobiToolAt=0;actor.nextCatClockAt=0;actor.nextRenkoUltAt=0;actor.nextRenkoDriveAt=0;actor.nextMendHealAt=0;actor.decoySeen?.clear();actor.duckPadAt=-Infinity;actor.duckPadUntil=0;actor.duckPadRound=0;actor.duckPadTeam=null;actor.duckFlapEvent=null;actor.duckFlapAt=-Infinity;if(!(['play','pause'].includes(mode)&&match?.phase==='post'&&!actor.alive&&actor.carMotion?.round===match.round&&actor.carMotion?.endsAt>elapsed)){actor.carMotion=null;actor.carImpulseUntil=0;actor.carFallUntil=0;actor.carRecoveryUntil=0;}cancelServiceReload(actor);actor.lastHeard=null;actor.netStepClock=0;}stoppedServiceEvents.clear();stoppedTurfEvents.clear();stoppedFrostEvents.clear();ordinaryAudio.clear();ordinaryMarkerAudio.clear();const overlay=$('skill-blind-overlay');if(overlay){overlay.hidden=true;overlay.style.opacity='0';}const nearOverlay=$('skill-nearsight-overlay');if(nearOverlay){nearOverlay.hidden=true;nearOverlay.style.opacity='0';}}
function resetTeamAbilities(){teamAbilities.reset();characterFX.reset();resetZoneAbilities();resetOrdinarySkills();}
// The grass cube is a movement solid; it adds no targeting or network state.
let grassFrame=null,grassPrevious=null;
function grassUsable(actor){return actor?.alive&&!actor.trcLadder&&!actor.trafficLaunch&&!carMotionActive(actor)&&!busSeat(actor);}
function grassPlatforms(){
  if(!match||!['buy','live'].includes(match.phase))return [];
  return [player,...bots].filter(a=>grassUsable(a)&&a.kit?.character==='veil').map(a=>grassPlatform(a,a===player?a.yaw+Math.PI:a.remoteId&&Number.isFinite(a.netYaw)?a.netYaw+Math.PI:a.group.rotation.y));
}
function grassSupport(actor,shapes=grassPlatforms()){
  if(!grassUsable(actor)||Math.abs(actor.vy||0)>1e-5)return null;
  return shapes.find(p=>p.id!==actor.id&&Math.abs(actor.y-p.top)<=.035&&grassOverlaps(p,actor.x,actor.z))||null;
}
function grassHeadClear(actor,x,z,r,feet,height){return !grassPlatforms().some(p=>p.id!==actor.id&&p.id!==actor.grassCarryOwner&&grassBlocks(p,x,z,r,feet,height));}
function grassNearby(actor){return grassPlatforms().some(p=>p.id!==actor.id&&Math.hypot(p.x-actor.x,p.z-actor.z)<3);}
function grassRideInput(actor){const p=grassSupport(actor);if(!p)return null;const q=grassLocal(p,actor.x,actor.z);return [p.id,q.x,q.z];}
function grassRemoteInput(actor,input){
  if(!validGrassRide(input.ride))return input;
  const p=grassSupport(actor);if(!p||p.id!==input.ride[0])return input;
  const q=grassWorld(p,input.ride[1],input.ride[2]);if(!grassOverlaps(p,q.x,q.z))return input;
  return {...input,x:q.x,z:q.z};
}
function beginGrassFrame(){
  const current=grassPlatforms(),shapes=current.map(p=>{
    const old=grassPrevious?.round===match.round?grassPrevious.shapes.get(p.id):null;
    return old&&old.team===p.team&&Math.hypot(p.x-old.x,p.z-old.z,p.top-old.top)<2?old:p;
  });
  grassFrame={round:match.round,shapes:new Map(shapes.map(p=>[p.id,p])),riders:[]};
  for(const a of isGuest()?[player]:[player,...bots]){const p=grassSupport(a,shapes);if(p)grassFrame.riders.push({actor:a,owner:p.id,team:a.team});}
}
function carryGrassRiders(){
  const frame=grassFrame;grassFrame=null;if(!frame||frame.round!==match?.round)return;
  // Lower supports move first, including a grass character riding another cube.
  frame.riders.sort((a,b)=>frame.shapes.get(a.owner).top-frame.shapes.get(b.owner).top);
  for(const {actor:a,owner,team} of frame.riders){
    const old=frame.shapes.get(owner),now=grassPlatforms().find(p=>p.id===owner);
    if(!now||now.team!==old.team||a.team!==team||!grassUsable(a)||Math.abs(a.vy||0)>1e-5||Math.abs(a.y-old.top)>.04||!grassOverlaps(old,a.x,a.z))continue;
    const q=grassLocal(old,a.x,a.z),target=grassWorld(now,q.x,q.z),dx=target.x-a.x,dz=target.z-a.z,dy=now.top-old.top;
    const n=Math.max(1,Math.ceil(Math.hypot(dx,dy,dz)/.12));a.grassCarryOwner=owner;
    try{for(let i=0;i<n;i++){
      const y=a.y+dy/n;if(!canStand(a.x,a.z,.34,y,actorBodyHeight(a))||!grassHeadClear(a,a.x,a.z,.34,y,actorBodyHeight(a)))break;
      a.y=y;moveEntity(a,dx/n,dz/n);
    }}finally{delete a.grassCarryOwner;}
    if(a.group)a.group.position.set(a.x,a.y,a.z);
    if(a===player&&a.alive)camera.position.set(a.x,1.7-a.crouch*.55+a.y,a.z);
  }
  grassPrevious={round:match.round,shapes:new Map(grassPlatforms().map(p=>[p.id,p]))};
}
function actorGrounded(actor){
  if(!actor?.alive||!Number.isFinite(actor.y)||Number.isFinite(actor.vy)&&Math.abs(actor.vy)>1e-5)return false;
  let floor=map.floorBaseAt?.(actor.x,actor.z)??0;const ramp=rampFloor(actor.x,actor.z);
  if(ramp!==null&&ramp<=actor.y+.001)floor=ramp;
  for(const c of map.collision.query(actor.x,actor.z,.34))if(!c.disabled&&c.height<=actor.y+.001&&c.height>floor&&map.collision.overlaps(c,actor.x,actor.z,.34))floor=c.height;
  const head=grassSupport(actor);if(head)floor=Math.max(floor,head.top);
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
  if(event.type==='urchin-lance')return map.collision.rayClear(event.x,event.y,event.z,actor.x,(actor.y||0)+1.3-(actor.crouch||0)*.55,actor.z);
  if(event.type==='japan-border'||event.type==='veil-roots'||event.type==='veil-root-seed'||event.type==='frost-stitch')return map.collision.rayClear(event.x,event.y+.18,event.z,actor.x,(actor.y||0)+.18,actor.z);
  const eye=(actor.y||0)+1.7-clamp(actor.crouch||0,0,1)*.55;
  const y=(event.type.startsWith('nobi-')||['nope-bottle','mend-seeds','echo-tag'].includes(event.type))?event.y+.18:event.y;
  return map.collision.rayClear(event.x,y,event.z,actor.x,eye,actor.z)&&(event.type==='mend-seeds'||!smokeBlocks({x:event.x,y:y-1.45,z:event.z},actor));
}
const ordinaryAudioTime=event=>event.type==='echo-tag'?event.startedAt+event.flight:event.triggerAt;
function allNopeDecoys(){return [...ordinarySkills.events(elapsed).filter(event=>event.type==='nope-decoy').map(event=>nopeWalkPose(event,elapsed)),...nopeDecoys.events(elapsed)];}
function decoyWalkPath(point,yaw){return planNopeWalk(point,yaw,(x,y,z)=>navigation.isWalkable(x,z,y)&&canStand(x,z,.36,y,1.96)&&Math.abs(getZoneFloor(x,z,y+1.7)-y)<.08&&map.collision.rayClear(x,y+.1,z,x,y+1.96,z));}
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
    const point=candidates[best];chosen.push({...point,...decoyWalkPath(point,Math.atan2(actor.x-point.x,actor.z-point.z))});scores[best]=-Infinity;
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
  for(const actor of[player,...bots])renkoUltimateActive(actor);
  for(const actor of[player,...bots])if(!actor.alive||actor.renkoPending&&(actor.renkoPending.round!==match.round||actor.renkoPending.team!==actor.team)){actor.renkoPending=null;actor.renkoDrive=null;}
  for(const actor of [player,...bots])if(actor.onnaraJumpPending&&(!actor.alive||actor.onnaraJumpPending.round!==match.round||actor.onnaraJumpPending.team!==actor.team))actor.onnaraJumpPending=null;
  if(match.phase!=='live'){resetOrdinarySkills();return;}
  if(ordinarySkills.capLocked(player.id,elapsed))aiming=false;
  if(!isGuest()){
    const actors=[player,...bots],views=actors.map(actor=>{
      if(!actor.remoteId)return ordinaryActorView(actor);
      const input=netInputs.get(actor.remoteId)?.input;
      return ordinaryActorView(input?{...actor,yaw:input.yaw,pitch:input.pitch}:actor);
    });
    for(const effect of ordinarySkills.update(views,elapsed,match.round,{reachable:ordinaryReachable,groundHeight:ordinaryGroundHeight,cameraSweep:(a,b,r)=>cameraSweep(map.collision,activeArenaBounds(),a,b,r,map.traffic,elapsed)})){
      const target=actors.find(actor=>actor.id===effect.targetId),source=actors.find(actor=>actor.id===effect.sourceId);
      if(effect.type==='renko-push'&&target?.alive&&source?.alive&&target.team!==source.team){beginCarMotion(target,{id:effect.eventId,phase:4,endsAt:elapsed+RENKO_SKILLS.launchDuration,vx:effect.vx,vz:effect.vz});burst(new THREE.Vector3(target.x,(target.y||0)+1,target.z),'#a9e6ff',12);}
      if(effect.type==='damage'&&target&&source)damageEntity(target,effect.amount,source,{skill:source.kit?.character});
      if(effect.type==='heal'&&target?.alive&&source?.alive&&target.team===source.team){const before=target.hp;target.hp=Math.max(before,Math.min(100,target.hp+effect.amount));if(target.hp>before)skillImpact(target,source,'mend','heal');}
      if(target?.target&&(effect.type==='blind'||effect.type==='nearsight'&&!visibleBetween(target,target.target)))target.target=null;
      if(effect.type==='nearsight'&&target?.alive&&source?.alive)skillImpact(target,source,'urchin');
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
      if(!event.type.startsWith('renko-')&&triggered&&previous!==true&&elapsed-trigger<.18)sound({'onnara-jump':'updraft','onnara-tax':'onnara-tax','onnara-orb':'onnara-orb','onnara-hover':'onnara-hover','onnara-chain':'onnara-chain','nope-bottle':'bottle-pop','nope-flash':'flash','mend-seeds':'seed-bloom','mend-pollen':'pollen','mend-heal':'flower-heal','echo-tag':'echo-tag-set','echo-glint':'echo-glint','echo-kerning':'echo-kerning','veil-dust':'grass-dust','veil-roots':'grass-roots','veil-root-seed':'grass-roots','veil-turf':'grass-turf','ember-solder':'solder-pop','ember-shade':'shade-check','ember-service':'quick-solder','frost-stitch':'frost-stitch','frost-mist':'frost-mist','frost-unravel':'frost-unravel','duelist-comet':'duelist-comet','duelist-lift':'duelist-lift','duck-pad':'duck-pad','duck-seal':'duck-seal','duck-shield':'duck-shield','duck-hush':'duck-hush','duck-egg':'duck-egg','cat-bookmark':'cat-bookmark','cat-return':'cat-return','cat-pluck':'cat-pluck','cat-fetch':'cat-fetch','cat-clock':'cat-clock','urchin-lance':'urchin-lance','urchin-jam':'urchin-jam','urchin-disarm':'urchin-disarm','urchin-gloom':'urchin-pearl','urchin-pearl':'urchin-pearl','urchin-trident':'urchin-trident','cap-lock':'cap-lock','cap-clean':'cap-clean','cap-bank':'cap-bank','cap-magazine':'cap-magazine','japan-border':'japan-border','japan-levy':'japan-levy','japan-return':'japan-return','japan-muster':'japan-muster','nobi-bell':'nobi-tag','nobi-tag':'nobi-tag','nobi-whisker':'nobi-brake','nobi-brake':'nobi-brake','nobi-toolbox':'nobi-tool','nobi-tool':'nobi-tool','nobi-collar':'nobi-legend','nobi-legend':'nobi-legend','car-bumper':'car-bumper','car-wash':'car-wash','car-gyro':'car-gyro','car-pit':'car-pit'}[event.type]||'smoke',{entity:event,localOnly:true});
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
  capBankPreviewFX.update(getCapBankPreview());
  const live=match?.phase==='live',viewer=player.alive?player:spectatedBot;
  preparedSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{armedType:duckAim?preparedSkillType(player.kit?.character,duckAim):null,character:player.kit?.character,active:live&&mode==='play'&&player.alive&&!netHostPaused&&!interactionHeld&&!busSeat()&&!carMotionActive(player),round:match?.round??0,reducedMotion:reducedMotion.matches,visible:(p,e)=>e.sourceId===player.id||ordinarySkills.blindUntil((viewer||player).id,elapsed)<=elapsed&&visibleBetween(viewer||player,p)});
  flashStatusFX.update(live&&['play','pause'].includes(mode)?bots:[],elapsed,{blindUntil:(id,now)=>Math.max(ordinarySkills.blindUntil(id,now),ordinarySkills.nearsightUntil(id,now)),viewerId:(viewer||player).id,reducedMotion:reducedMotion.matches,visible:actor=>ordinarySkills.blindUntil((viewer||player).id,elapsed)<=elapsed&&visibleBetween(viewer||player,actor)});
  const spectacleEvents=live?[...ordinarySkills.events(elapsed),...teamAbilities.events(elapsed),...zoneAbilities.events(elapsed)]:[];
  skillFeedback.observe(spectacleEvents,elapsed,player.id);skillFeedback.render(elapsed,{active:live&&mode==='play'&&player.alive,reducedMotion:reducedMotion.matches});
  skillSpectacle.update(spectacleEvents,elapsed,{actors:[player,...bots],viewer:viewer||player,reducedMotion:reducedMotion.matches,visible:p=>ordinarySkills.blindUntil((viewer||player).id,elapsed)<=elapsed&&visibleBetween(viewer||player,p)});
  ordinaryFX.update(live?ordinarySkills.events(elapsed).filter(event=>event.type!=='nope-decoy'):[],elapsed,{viewer:viewer||player,showHand:live&&mode==='play'&&player.alive,reducedMotion:reducedMotion.matches});
  nopeDecoyFX.update(live?allNopeDecoys():[],elapsed,{viewer:viewer||player,reducedMotion:reducedMotion.matches});
  mendSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{viewer:viewer||player,showHand:live&&mode==='play'&&player.alive,reducedMotion:reducedMotion.matches});
  iagnuSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{viewer:viewer||player,actors:[player,...bots],showHand:live&&mode==='play'&&player.alive,reducedMotion:reducedMotion.matches});
  grassSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{viewer:viewer||player,actors:[player,...bots].map(ordinaryActorView),groundHeight:ordinaryGroundHeight,reachable:ordinaryReachable,terrainRevision:map.collision.revision,showHand:live&&mode==='play'&&player.alive,reducedMotion:reducedMotion.matches});
  emberSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{viewer:viewer||player,actors:[player,...bots].map(ordinaryActorView),showHand:live&&mode==='play'&&player.alive,reducedMotion:reducedMotion.matches});
  renkoSkillFX.update(live?ordinarySkills.events(elapsed).filter(e=>!(e.type==='renko-drive'&&e.sourceId===player.id&&renkoDriveStopping(player))):[],elapsed,{actors:[player,...bots],visible:(p,e)=>e.sourceId===player.id||ordinarySkills.blindUntil((viewer||player).id,elapsed)<=elapsed&&visibleBetween(viewer||player,p)});
  onnaraSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{actors:[player,...bots].filter(a=>a.team===player.team||ordinarySkills.blindUntil(player.id,elapsed)<=elapsed&&visibleBetween(player,a)),reducedMotion:reducedMotion.matches});
  urchinSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{externalProps:true,actors:[player,...bots].filter(a=>a.team===player.team||ordinarySkills.blindUntil(player.id,elapsed)<=elapsed&&visibleBetween(player,a))});
  capSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{actors:[player,...bots].filter(a=>a.team===player.team||ordinarySkills.blindUntil(player.id,elapsed)<=elapsed&&visibleBetween(player,a)),reducedMotion:reducedMotion.matches,hiddenActorId:viewer?.id});
  japanSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{actors:[player,...bots].filter(a=>a.team===player.team||ordinarySkills.blindUntil(player.id,elapsed)<=elapsed&&visibleBetween(player,a))});
  nobiSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{externalProps:true,showHand:false,reducedMotion:reducedMotion.matches,actors:[player,...bots].filter(a=>a.team===player.team||ordinarySkills.blindUntil(player.id,elapsed)<=elapsed&&visibleBetween(player,a))});
  carSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{actors:[player,...bots],preview:live&&mode==='play'&&player.alive&&player.kit.character==='car'&&duckAim?carSkillTarget(player,duckAim):null});
  catSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{actors:[player,...bots],preview:live&&mode==='play'&&player.alive&&player.kit.character==='cat'&&duckAim?{...(duckAim==='q'?catEnemyTarget(player):catDropTarget(player)),type:duckAim}:null});
  duckSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{actors:[player,...bots],preview:live&&mode==='play'&&player.alive&&player.kit.character==='duck'&&duckAim?{...getDuckTarget(player,duckAim==='c'?'duck-pad':'duck-shield'),type:duckAim}:null});
  frostSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{viewer:viewer||player,actors:[player,...bots].map(ordinaryActorView),groundHeight:ordinaryGroundHeight,reachable:ordinaryReachable,terrainRevision:map.collision.revision,showHand:live&&mode==='play'&&player.alive,reducedMotion:reducedMotion.matches});
  duelistSkillFX.update(live?ordinarySkills.events(elapsed):[],elapsed,{viewer:viewer||player,showHand:live&&mode==='play'&&player.alive,reducedMotion:reducedMotion.matches});
  const nearRemaining=live&&viewer?.alive?Math.max(0,ordinarySkills.nearsightUntil(viewer.id,elapsed)-elapsed):0,nearOverlay=$('skill-nearsight-overlay');
  if(nearOverlay){nearOverlay.hidden=!(nearRemaining>0&&mode==='play');nearOverlay.style.opacity=String(Math.min(1,nearRemaining/.25));}
  const remaining=live&&viewer?.alive?Math.max(0,ordinarySkills.blindUntil(viewer.id,elapsed)-elapsed):0,overlay=$('skill-blind-overlay');
  if(overlay){overlay.hidden=!(remaining>0&&mode==='play');overlay.style.opacity=String(clamp(remaining/.35,0,.94));}
  // Resolve the viewed equipment again after FX and asynchronous snapshots.
  updateFirstPersonEquipment(0);
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
  takeoverState={id:data.id,round:data.round,startedAt:data.startedAt,endsAt:data.endsAt};takeoverClock=elapsed;stationTakeover.start({...takeoverState,mapId:map.id});
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
  map.bomberCollapse?.start({x:data.x,z:data.z,time:data.startedAt,seed:data.seed});
  if(map.traversal)for(const actor of [player,...bots])actor.trcLadder=null;
  stationDetonation.start({x:data.x,z:data.z,time:data.startedAt,seed:data.seed,station:map.id==='hirakata'?{x:0,z:0,width:134}:map.id==='trc'?{x:0,z:-35,width:96}:undefined});
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
  renderOrdinarySkills();updateOnnaraReveal();
  if(takeoverState){if(mode==='result'&&!netHostPaused)takeoverClock+=dt;takeoverClock=Math.max(takeoverClock,elapsed);}
  stationTakeover.update(takeoverClock);
  if(match)characterFX.update(teamAbilities.events(elapsed),elapsed,{reducedMotion:reducedMotion.matches});
  if(match)zoneFX.update(zoneAbilities.events(elapsed),elapsed,{reducedMotion:reducedMotion.matches,preview:getZonePreview()});
  if(detonationState){
    if(mode==='result'&&!netHostPaused)detonationClock+=dt;
    detonationClock=Math.max(detonationClock,elapsed);
  }
  map.bomberCollapse?.update(detonationClock,{reducedMotion:reducedMotion.matches});
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
    // Last render gate also covers an asynchronous guest snapshot/equip and pause.
    const scopeActive=aiming&&!sniperCycleRemaining()&&player.alive&&weapon().scope&&!reloading&&!player.serviceReload&&!interactionHeld&&!busSeat()&&['play','pause'].includes(mode);
    if(scopeActive||victoryCamera.active)gun.visible=false;
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
let killSoundMatch=null,killSoundRound=null;const killSoundCounts=new Map();
const isKillSoundCue=type=>typeof type==='string'&&/^kill-[1-5]$/.test(type);
function resetKillSounds(){killSoundMatch=null;killSoundRound=null;killSoundCounts.clear();killBanner.reset();}
function killFeedback(source){
  if(isGuest()||!source)return;
  if(killSoundMatch!==match||killSoundRound!==match.round){resetKillSounds();killSoundMatch=match;killSoundRound=match.round;}
  const count=Math.min(5,(killSoundCounts.get(source.id)||0)+1);killSoundCounts.set(source.id,count);
  combatFeedback(source,'kill-'+count);
}
// A confirmation belongs to the shooter, after real host damage, never the
// predicted guest ray. Shotgun pellets already arrive as one victim total.
function firearmFeedback(source,killed){
  if(killed){killFeedback(source);return;}
  combatFeedback(source,'gun-hit');
}
function combatFeedback(source,type){
  if(isGuest()||!source)return;
  if(source===player){if(isKillSoundCue(type))killBanner.note(elapsed,match.round);sound(type,{localOnly:true});}
  else if(onlinePlaying&&online?.host&&source.remoteId){
    netCues.push({seq:++netCueSequence,round:match.round,type,weapon:source.netWeapon||'classic',id:source.id,x:source.x,y:source.y||0,z:source.z,time:elapsed});
    if(netCues.length>64)netCues.splice(0,netCues.length-64);
  }
}
function validBusBreakCue(cue,packet){
 return cue?.type==='bus-break'&&Number.isSafeInteger(cue.seq)&&cue.seq>0&&cue.round===packet.rules?.round&&packet.rules?.phase==='live'&&[cue.x,cue.y,cue.z,cue.time].every(Number.isFinite)&&Math.max(Math.abs(cue.x),Math.abs(cue.z))<=82&&cue.y>=0&&cue.y<=30&&packet.time>=cue.time&&packet.time-cue.time<=.65;
}
function applyNetCues(packet,fresh,ownId){
  const cues=Array.isArray(packet.cues)?packet.cues.slice(-64):[],previous=netSeenCueSequence,seen=new Set();
  for(const cue of cues){
    if(!Number.isSafeInteger(cue.seq)||cue.seq<=previous||seen.has(cue.seq))continue;seen.add(cue.seq);
    netSeenCueSequence=Math.max(netSeenCueSequence,cue.seq);
    if(fresh||cue.round!==packet.rules.round||packet.time-cue.time>1||packet.time<cue.time||![cue.x,cue.z].every(Number.isFinite))continue;
    if(cue.type==='gun-hit'||isKillSoundCue(cue.type)){
      // Keep the final elimination audible in its post-round snapshot too.
      // The shared sequence is consumed even while muted or still loading.
      if(cue.id===ownId&&['live','post'].includes(packet.rules.phase)&&packet.time-cue.time<=.65&&Number.isFinite(cue.time)&&Number.isFinite(cue.y)&&Object.hasOwn(WEAPONS,cue.weapon)&&(isKillSoundCue(cue.type)||['primary','secondary'].includes(WEAPONS[cue.weapon].slot))){if(isKillSoundCue(cue.type))killBanner.note(elapsed,match.round);sound(cue.type,{localOnly:true});}
      continue;
    }
    if(['skill-hit','skill-heal'].includes(cue.type)){if(!Object.hasOwn(SKILL_LOOKS,cue.weapon)||!Number.isFinite(cue.y)||Math.max(Math.abs(cue.x),Math.abs(cue.y),Math.abs(cue.z))>1000||packet.time-cue.time>.65||packet.rules.phase!=='live')continue;const kind=cue.type==='skill-heal'?'heal':'hit';skillSpectacle.impact(cue.weapon,cue,cue.time,{kind});if(cue.id===ownId)skillFeedback.note(kind,'receipt:'+cue.round+':'+cue.seq,cue.weapon,cue.time);continue;}
    if(cue.type==='bus-break'){if(validBusBreakCue(cue,packet))sound('bus-break',{entity:cue,localOnly:true});continue;}
    // Defusing is confirmed by the host; the initiating guest has no predicted cue.
    if(cue.type==='defuse-start'){if(['live','post'].includes(packet.rules.phase)&&packet.time-cue.time<=.65&&Number.isFinite(cue.time)&&Number.isFinite(cue.y)&&Math.max(Math.abs(cue.x),Math.abs(cue.y),Math.abs(cue.z))<=1000)sound('defuse-start',{entity:cue,localOnly:true});continue;}
    // Vehicle contact is host-confirmed even when this guest is the victim.
    if(cue.id===ownId&&cue.type!=='vehicle-hit'&&!String(cue.type).startsWith('door-')||!actionCueTypes.has(cue.type))continue;
    sound(cue.type,{weapon:cue.weapon,entity:cue,localOnly:cue.type==='vehicle-hit'});
  }
}
function updateAbilityFeedback(){
  if(signatureFeedbackMatch!==match){signatureFeedbackMatch=match;signatureReadyNotices.clear();Object.assign(dashFeedback,{round:null,state:null,expires:0,charge:null,signatureAt:0});}
  const kit=player.kit,state=kit.armExpiresAt===null?'idle':elapsed<kit.armReadyAt?'charging':'ready';
  if(dashFeedback.round===match.round&&player.alive&&match.phase==='live'){
    if(dashFeedback.state==='charging'&&state==='ready')sound('dash-ready');
    if(dashFeedback.state==='ready'&&state==='idle'&&elapsed>=dashFeedback.expires)sound('dash-expired');
    const cooldown=signatureCooldown(kit.character),signatureReady=cooldown>0?dashFeedback.signatureAt>0&&elapsed>=dashFeedback.signatureAt:kit.character==='duelist'||kit.character==='renko';
    const noticeKey=cooldown>0?`${match.round}:${kit.character}:${dashFeedback.signatureAt}`:null;
    if(dashFeedback.charge===0&&kit.dash===1&&signatureReady&&(!noticeKey||!signatureReadyNotices.has(noticeKey))){
      if(noticeKey){signatureReadyNotices.add(noticeKey);while(signatureReadyNotices.size>32)signatureReadyNotices.delete(signatureReadyNotices.values().next().value);}
      sound('dash-ready');const definition=getCharacterSkill(kit.character,'e');showMessage(`${definition.name} / 再使用可能`,kit.character==='renko'?'Eで再使用できます':cooldown>0?`${cooldown}秒経過 · Eで${definition.name}を使えます`:`${DUELIST.signatureKills}キル達成 · Eを再び準備できます`,1.8);
    }
  }
  Object.assign(dashFeedback,{round:match.round,state,expires:kit.armExpiresAt??dashFeedback.expires,charge:kit.dash,signatureAt:kit.nextSignatureAt||0});
}

const viewmodel=createViewmodel(THREE,camera);
const gun=viewmodel.group,flash=viewmodel.flash;
let equipmentActor=null;
function firstPersonActor(){
  if(victoryCamera.active)return null;
  if(!['play','pause','shop','map','score'].includes(mode)||isGuest()&&!netHasSnapshot)return null;
  if(player.alive)return player;
  return !deathView.holding&&spectatedBot?.alive&&spectatedBot.team===player.team?spectatedBot:null;
}
function firstPersonWeapon(actor){
  const id=actor===player?inventory.active:actor.netTarget?.weapon||(actor.remoteId?actor.netWeapon:actor.aiWeapon)||actor.record?.primary||actor.record?.secondary||'classic';
  return id==='spike'||Object.hasOwn(WEAPONS,id)?id:'classic';
}
function updateFirstPersonEquipment(dt){
  const actor=firstPersonActor();
  if(!actor){gun.visible=false;flash.visible=false;equipmentActor=null;return;}
  const local=actor===player,id=firstPersonWeapon(actor),spec=WEAPONS[id]||WEAPONS.knife,state=local?null:actor.netTarget,unarmed=!!renkoUnarmed(actor);
  const reload=local?reloading:state?.reloading??(actor.remoteId?actor.netReload:actor.aiReload)??0;
  const interacting=local?interactionHeld&&mode==='play':!!(actor.planting||actor.defusing||state?.planting||state?.defusing);
  const cycle=local?sniperCycleRemaining():0;
  const scoped=!!(local&&!unarmed&&aiming&&!cycle&&spec.scope&&!reload&&!actor.serviceReload&&!interactionHeld&&!busSeat(actor)&&['play','pause'].includes(mode));
  const throwing=local?(ordinaryFX.throwing(elapsed)||nobiSkillFX.throwing(elapsed)||mendSkillFX.throwing(elapsed)||iagnuSkillFX.throwing(elapsed)||grassSkillFX.throwing(elapsed)||emberSkillFX.throwing(elapsed)||frostSkillFX.throwing(elapsed)||duelistSkillFX.throwing(elapsed)):elapsed<(actor.skillThrowUntil||0);
  const holding=local&&mode==='play'&&match?.phase==='live'&&!netHostPaused&&!interactionHeld&&!!duckAim&&!!preparedSkillType(player.kit?.character,duckAim);
  gun.visible=(unarmed||id!=='spike')&&!busDriving(actor)&&!scoped&&!throwing&&!holding&&!(local&&preparedSkillFX.throwing(elapsed));
  viewmodel.setWeapon(id==='spike'?'knife':id,actor!==equipmentActor);equipmentActor=actor;
  viewmodel.update(dt,{character:actor.kit?.character||state?.kit?.character,scoped,unarmed,
    aiming:local&&aiming&&!cycle&&mode==='play'&&!netHostPaused,reloading:reload,
    cycleProgress:cycle?1-cycle/nobiShotInterval(spec,actor):undefined,
    reloadDuration:actor.serviceReload||state?.serviceReload?EMBER_SKILLS.serviceDuration:spec.reload,
    kick:local?kick:actor.flash>0?.035:0,moving:local?Math.hypot(actor.vx,actor.vz)>.5:!!actor.moving,
    time:elapsed,crouching:actor.crouch,interacting,ultimate:actor.kit?.knivesActive&&id==='knife',
    knives:actor.kit?.knives,shotSequence:local?shotSequence:actor.shotSequence||state?.shotSequence||0,spectating:!local});
  flash.visible=gun.visible&&!unarmed&&id!=='knife'&&!reload&&!interacting&&(local?elapsed-lastShot<.045:actor.flash>0);flash.rotation.z=elapsed*40;
}
const gunDark=new THREE.MeshStandardMaterial({color:'#26363d',roughness:.5,metalness:.5});

const buyBarrier=new THREE.Mesh(new THREE.CylinderGeometry(1,1,4,80,1,true),new THREE.MeshBasicMaterial({color:'#8ad8ed',transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false}));
buyBarrier.position.y=2;buyBarrier.visible=false;scene.add(buyBarrier);
function syncBuyBarrier(){
  const area=map.buyAreas?.[ownSide()];buyBarrier.visible=!exploring&&match?.phase==='buy'&&!!area;
  if(!area)return;
  const points=buyAreaOutline(area),key=JSON.stringify(points);
  if(buyBarrier.userData.outline!==key){
    const vertices=[];
    for(let i=0;i<points.length;i++){
      const [x,z]=points[i],[xx,zz]=points[(i+1)%points.length];
      vertices.push(x,0,z,xx,0,zz,xx,4,zz,x,0,z,xx,4,zz,x,4,z);
    }
    buyBarrier.geometry.dispose();buyBarrier.geometry=new THREE.BufferGeometry();
    buyBarrier.geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));buyBarrier.geometry.computeBoundingSphere();buyBarrier.userData.outline=key;
  }
  buyBarrier.position.set(0,0,0);buyBarrier.scale.set(1,1,1);
}
function placeStartingBomber(){
  const points=map.teamSpawns.attack,x=points.reduce((sum,p)=>sum+p.x,0)/points.length,z=Math.min(...points.map(p=>p.z))-4;
  const point=navigation.nearest(x,z);if(!point)return;
  match.dropSpike(match.spike.carrier,point.x,point.z);
}

const objectiveModel=createObjectiveModel(THREE),spikeModel=objectiveModel.group;scene.add(spikeModel);spikeModel.visible=false;
const droppedWeapons=[];
let dropSequence=0;
function removeDrop(drop){const index=droppedWeapons.indexOf(drop);if(index<0)return;drop.visual.dispose();droppedWeapons.splice(index,1);}
function clearDrops(){for(const drop of [...droppedWeapons])removeDrop(drop);}
function addDrop(data){
  const visual=createDroppedEquipment(THREE,{weapon:data.weapon,yaw:data.yaw}),mesh=visual.group;
  mesh.position.set(data.x,data.y||0,data.z);scene.add(mesh);const drop={...data,mesh,visual};droppedWeapons.push(drop);return drop;
}
function dropItem(weapon,entity){
  const spec=WEAPONS[weapon];if(!spec||weapon==='classic'||!['primary','secondary'].includes(spec.slot))return;
  const local=entity===player,active=local?inventory.active:entity.remoteId?entity.netWeapon:entity.aiWeapon;
  const saved=local?ammoStore[weapon]:entity.netStores?.[weapon];
  const ammo=active===weapon?(local?player.ammo:entity.remoteId?entity.netAmmo:entity.aiAmmo):saved?.ammo;
  const reserve=active===weapon?(local?player.reserve:entity.remoteId?entity.netReserve:entity.aiReserve??spec.reserve):saved?.reserve;
  const data={id:++dropSequence,weapon,x:entity.x,z:entity.z,...(map.id==='trc'?{y:getZoneFloor(entity.x,entity.z,(entity.y||0)+.05)}:{}),yaw:Math.random()*Math.PI*2,ammo:clamp(Math.floor(ammo??spec.mag),0,spec.mag),reserve:clamp(Math.floor(reserve??spec.reserve),0,spec.reserve)};
  while(droppedWeapons.length>=32)removeDrop(droppedWeapons[0]);return addDrop(data);
}
function serializeDrops(){return droppedWeapons.map(({id,weapon,x,z,y,yaw,ammo,reserve})=>({id,weapon,x,z,...(y?{y}:{}),yaw,ammo,reserve}));}
function syncDrops(values){
  const valid=new Map();
  for(const value of Array.isArray(values)?values.slice(0,32):[]){
    const spec=WEAPONS[value?.weapon];if(!spec||value.weapon==='classic'||!['primary','secondary'].includes(spec.slot)||!Number.isSafeInteger(value.id)||value.id<1||![value.x,value.z,value.yaw,value.ammo,value.reserve].every(Number.isFinite)||value.x<activeArenaBounds().minX||value.x>activeArenaBounds().maxX||value.z<activeArenaBounds().minZ||value.z>activeArenaBounds().maxZ)continue;
    valid.set(value.id,{id:value.id,weapon:value.weapon,x:value.x,z:value.z,...(map.id==='trc'?{y:Number.isFinite(value.y)?clamp(value.y,map.minY,12):0}:{}),yaw:value.yaw,ammo:clamp(Math.floor(value.ammo),0,spec.mag),reserve:clamp(Math.floor(value.reserve),0,spec.reserve)});
  }
  for(const drop of [...droppedWeapons])if(!valid.has(drop.id)||valid.get(drop.id).weapon!==drop.weapon)removeDrop(drop);
  for(const data of valid.values()){
    const old=droppedWeapons.find(d=>d.id===data.id);
    if(old){Object.assign(old,data);old.mesh.position.set(data.x,data.y||0,data.z);old.mesh.rotation.y=data.yaw;}
    else addDrop(data);
  }
}
function pickupDroppedWeapon(actor,dropId,{catFetch=false}={}){
  if(!actor.alive||renkoUnarmed(actor)||match?.phase!=='live')return false;
  const remoteFetch=catFetch&&actor.kit?.character==='cat'&&!isGuest();
  const drop=droppedWeapons.find(d=>d.id===dropId&&(remoteFetch?Math.hypot(d.x-actor.x,(actor.y||0)-(d.y||0),d.z-actor.z)<=CAT_SKILLS.fetchRange&&catDropVisible(actor,d):Math.hypot(d.x-actor.x,(actor.y||0)-(d.y||0),d.z-actor.z)<1.5));if(!drop)return false;
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
let sniperCycleAt=null;
function sniperCycleRemaining(){
  if(!weapon().scope||sniperCycleAt!==lastShot)return 0;
  // Share the shot gate, including a live fire-rate impairment and its epsilon.
  const remaining=nobiShotInterval(weapon(),player)-(elapsed-lastShot);
  return remaining>1e-8?remaining:0;
}
function equip(id,fresh=false){
  if((netHostPaused||renkoUnarmed(player))&&!fresh)return;
  if(isGuest()&&!fresh)queueNetAction('equip',{weapon:id});
  if(!id)return;if(!fresh)ammoStore[inventory.active]={ammo:player.ammo,reserve:player.reserve};
  duckAim=null;preparedSkillFX.reset();cancelServiceReload(player);inventory.active=id;const spec=WEAPONS[id]||WEAPONS.classic;const saved=ammoStore[id];
  player.ammo=saved?.ammo??spec.mag;player.reserve=saved?.reserve??spec.reserve;reloading=0;shotSequence=0;kick=0;firing=false;aiming=false;sniperCycleAt=null;
  refillRangeAmmo();
  gun.visible=player.alive&&id!=='spike';
  viewmodel.setWeapon(id==='spike'?'knife':id);
}
function equipAfterPlant(actor){
  if(!actor?.alive)return;
  const slots=actor===player?inventory:actor.record,id=slots?.primary||slots?.secondary||'knife';
  if(actor===player){interactionHeld=false;equip(id);}
  else if(actor.remoteId){actor.planting=false;applyRemoteAction(actor,{type:'equip',weapon:id});}
}
function cancelPlantAndEquip(actor){
  const s=match?.spike,wasPlanting=s?.plantActor===actor?.id||actor===player&&isGuest()&&actor.planting;
  if(!isGuest()&&actor)match?.cancelPlant(actor.id);
  if(!wasPlanting||!actor?.alive||match?.phase!=='live'||s.status!=='carried'||s.carrier!==actor.id)return;
  actor.planting=false;
  if((actor===player?inventory.active:actor.netWeapon)==='spike')equipAfterPlant(actor);
}
function releaseObjectiveInput(){interactionHeld=false;cancelPlantAndEquip(player);}
function openShop(){
  if(netHostPaused)return;
  if(!match||(!exploring&&match.phase!=='buy')||!player.alive){showMessage('ショップは購入フェーズのみ','装備は生き残れば次のラウンドへ持ち越します',2);return;}
  if(mode==='shop'){resumeGame();return;}
  mode='shop';keys.clear();firing=false;aiming=false;setVisible('shop-overlay',true);if(document.pointerLockElement)document.exitPointerLock();updateShop();
  if($('shop-status'))$('shop-status').textContent=exploring?'練習中は全武器を無料で選択できます。':'左クリックで購入・買い足し / 右クリックで売却';
}
// Only purchases made by this kit in this buy phase can be refunded. No wire
// fields are needed: the host keeps the ledger, guests send an ordinary action.
function tradeSkill(actor,id,selling=false){
  if(!actor?.alive||!match||match.phase!=='buy'||netHostPaused||exploring)return false;
  const key=['c','smoke'].includes(id)?'c':['q','updraft'].includes(id)?'q':null;if(!key)return false;
  const kit=actor.kit,definition=getCharacterSkill(kit.character,key),slot=key==='c'?'smoke':'updraft';
  let ledger=skillPurchaseLedger.get(kit);
  if(!ledger||ledger.round!==match.round||ledger.character!==kit.character){ledger={round:match.round,character:kit.character,c:[],q:[]};skillPurchaseLedger.set(kit,ledger);}
  const record=actor===player?match:actor.record;if(!record)return false;
  if(selling){
    if(!ledger[key].length||kit[slot]<1)return false;
    const price=ledger[key].pop();kit[slot]--;if(actor===player)match.addCredits(price);else record.credits=Math.min(9000,record.credits+price);return true;
  }
  const ok=kit.buy(key,price=>{if(record.credits<price)return false;if(actor===player)return match.purchase(price);record.credits-=price;return true;});
  if(ok)ledger[key].push(definition.price);return ok;
}
function clickSkillPurchase(key,selling=false){
  if(!['c','q'].includes(key)||!player.alive||match?.phase!=='buy'||netHostPaused||exploring)return false;
  const id=selling?'sell-'+key:key;
  if(isGuest()){if(netActions.some(a=>a.type==='buy'&&[key,key==='c'?'smoke':'updraft','sell-'+key].includes(a.id)))return false;const n=netActions.length;queueNetAction('buy',{id});return netActions.length>n;}
  const ok=tradeSkill(player,key,selling);
  if($('shop-status'))$('shop-status').textContent=ok?`${getCharacterSkill(player.kit.character,key).name} を${selling?'売却':'購入'}しました`:selling?'このラウンドに購入したスキルだけ売却できます':'所持数が最大か、しばくでコインが不足しています';
  if(ok)sound('buy');updateShop();updateHUD();return ok;
}
// The previous loadout stays in the host's ledger, never in a client price.
function tradeEquipment(actor,id,selling=false){
  if(!actor?.alive||match?.phase!=='buy'||netHostPaused||exploring)return false;
  const local=actor===player,record=local?match:actor.record,items=local?inventory:record;
  const armor=id==='light'||id==='heavy',spec=armor?{slot:'armor',price:id==='light'?400:1000}:WEAPONS[id];
  if(!record||!spec||!['primary','secondary','armor'].includes(spec.slot))return false;
  const ledger=local?roundPurchases:(record.netPurchases||={}),slot=spec.slot;
  const old=ledger[slot]?.round===match.round?ledger[slot]:null,owned=armor?actor.armor>=(id==='light'?25:50):items[slot]===id;
  if(selling){
    if(!owned||!old||old.id!==id)return false;
    if(local)match.addCredits(old.price);else record.credits=Math.min(9000,record.credits+old.price);
    delete ledger[slot];
    if(armor)actor.armor=old.previous;
    else{
      items[slot]=old.previous;
      const stores=local?ammoStore:(actor.netStores||={});delete stores[id];if(old.previous&&old.ammo)stores[old.previous]={...old.ammo};
      const active=local?inventory.active:actor.netWeapon;
      if(active===id){const next=old.previous||items.secondary||items.primary||'knife';if(local)equip(next,true);else{const w=WEAPONS[next],ammo=stores[next];actor.netWeapon=next;actor.netAmmo=ammo?.ammo??w.mag;actor.netReserve=ammo?.reserve??w.reserve;actor.netReload=0;}}
    }
    return true;
  }
  if(owned)return false;
  const replacing=old&&(armor||old.id===items[slot]),refund=replacing?old.price:0;
  if(record.credits+refund<spec.price)return false;
  const previous=replacing?old.previous:armor?actor.armor:items[slot];
  const active=local?inventory.active:actor.netWeapon,stores=local?ammoStore:(actor.netStores||={});
  const ammo=armor?null:replacing?old.ammo:previous?(active===previous?{ammo:local?player.ammo:actor.netAmmo,reserve:local?player.reserve:actor.netReserve}:stores[previous]||{ammo:WEAPONS[previous].mag,reserve:WEAPONS[previous].reserve}):null;
  record.credits=Math.min(9000,record.credits+refund)-spec.price;
  ledger[slot]={id,price:spec.price,round:match.round,previous,ammo};
  if(armor)actor.armor=id==='light'?25:50;
  else{items[slot]=id;delete stores[id];if(local)equip(id);else{actor.netWeapon=id;actor.netAmmo=spec.mag;actor.netReserve=spec.reserve;actor.netReload=0;stores[id]={ammo:spec.mag,reserve:spec.reserve};}}
  return true;
}
function sell(id){
  if(['c','q'].includes(id))return clickSkillPurchase(id,true);
  if(!player.alive||match?.phase!=='buy'||netHostPaused||exploring)return false;
  if(isGuest()){if(netActions.some(a=>a.type==='buy'))return false;const n=netActions.length;queueNetAction('buy',{id:'sell-'+id});return netActions.length>n;}
  const ok=tradeEquipment(player,id,true);
  if($('shop-status'))$('shop-status').textContent=ok?'売却してしばくでコインを返金しました':'このラウンドに購入し、所持している装備だけ売却できます';
  if(ok)sound('buy');updateShop();updateHUD();return ok;
}
function buy(id){
  if(netHostPaused)return false;
  if(exploring){const spec=WEAPONS[id];if(!spec||spec.slot==='melee')return false;inventory[spec.slot]=id;delete ammoStore[id];equip(id,true);updateShop();updateHUD();return true;}
  if(isGuest()){if(netActions.some(a=>a.type==='buy'&&a.id===id))return false;const n=netActions.length;queueNetAction('buy',{id});return netActions.length>n;}
  if(!match||match.phase!=='buy'||!player.alive)return false;
  if(['smoke','updraft','c','q'].includes(id)){const ok=tradeSkill(player,id);if(ok){sound('buy');updateShop();updateHUD();}return ok;}
  const armor=id==='light'||id==='heavy';const spec=armor?{price:id==='light'?400:1000,slot:'armor'}:WEAPONS[id];if(!spec)return false;
  if(!tradeEquipment(player,id)){if($('shop-status'))$('shop-status').textContent='すでに所持しているか、しばくでコインが不足しています';return false;}
  if($('shop-status'))$('shop-status').textContent=`${armor?(id==='heavy'?'ヘヴィーシールド':'ライトシールド'):spec.name} を購入しました`;
  sound('buy');updateShop();updateHUD();return true;
}
function updateShop(){
  if(!match)return;
  setVisible('start-round',!onlinePlaying&&!exploring);
  if($('shop-rule-summary'))$('shop-rule-summary').textContent=exploring?'マップ練習 / 全10銃を無料で選択':`ラウンド ${match.round} · 購入終了まで ${Math.ceil(match.phaseTime)}秒`;
  if($('shop-credits'))$('shop-credits').textContent=exploring?'練習 / FREE':match.credits.toLocaleString();
  document.querySelectorAll('[data-buy]').forEach(button=>{const id=button.dataset.buy;if(button.dataset.skillKey)return;
    const armor=id==='light'||id==='heavy',spec=armor?{price:id==='light'?400:1000,slot:'armor'}:WEAPONS[id];if(!spec)return;
    const owned=armor?player.armor>=(id==='light'?25:50):inventory[spec.slot]===id,purchase=roundPurchases[spec.slot];
    const current=purchase?.round===match.round,refundable=owned&&current&&purchase.id===id;
    const affordable=match.credits+(current?purchase.price:0)>=spec.price;
    button.disabled=exploring?armor:!player.alive||match.phase!=='buy'||netHostPaused;
    button.classList.toggle('owned',owned);button.classList.toggle('selected',inventory.active===id);button.classList.toggle('unaffordable',!owned&&!affordable&&!exploring);
    const status=exploring?'無料で装備':refundable?'所持 · 右クリックで売却':owned?'所持':affordable?'左クリックで購入':'コイン不足';
    button.dataset.state=status;button.setAttribute('aria-label',`${armor?(id==='light'?'ライトシールド':'ヘヴィーシールド'):spec.name} SC ${spec.price}、${status}`);
    const state=button.querySelector?.('.buy-state');if(state)state.textContent=status;
    const sellButton=document.querySelector?.(`[data-sell="${id}"]`);if(sellButton){sellButton.hidden=(!refundable&&!(owned&&isGuest()))||exploring;sellButton.disabled=button.disabled;}
  });
  const ledger=skillPurchaseLedger.get(player.kit),refunds=ledger?.round===match.round&&ledger.character===player.kit.character?{c:ledger.c.length,q:ledger.q.length}:{};
  skillUI.updateShop({kit:player.kit,credits:match.credits,phase:match.phase,alive:player.alive&&!netHostPaused&&!exploring,refunds,allowUnknownSales:isGuest()});
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
function catBotClockUseful(actor){
  const spike=match?.spike;
  if(!actor?.alive||match?.phase!=='live'||!spike)return false;
  // Freeze only the objective deadline our side is racing, never the one
  // already counting down to our victory. These are public objective clocks.
  if(actor.team===match.attackerTeam)return ['carried','dropped'].includes(spike.status)&&match.roundTime>0&&match.roundTime<20;
  return actor.team===match.defenderTeam&&spike.status==='planted'&&spike.timer>0&&spike.timer<=12;
}
function damageEntity(entity,amount,killer,{firearm=false,returned=false,chain=true,skill=null,vehicle=false}={}){
  if(isGuest())return;
  if(!entity.alive||match?.phase!=='live'||(killer&&entity.team===killer.team&&!vehicle))return;
  if(rangeSession&&entity.rangeTarget){
    const before=entity.hp;
    entity.hp=Math.max(0,entity.hp-amount);
    if(firearm&&entity.hp<before)firearmFeedback(killer,!entity.hp);
    if(!entity.hp){entity.alive=false;entity.death=.35;rangeRespawn=.18;totalKills++;if(!firearm)killFeedback(killer);}
    return;
  }
  const returnScale=!returned&&firearm&&killer?.alive?ordinarySkills.japanReturn(entity.id,elapsed):0,healthBefore=entity.hp,armorBefore=entity.armor;
  const result=applyArmorDamage(entity.hp,entity.armor,amount);entity.hp=result.hp;entity.armor=result.armor;if(entity.hp<=0&&ordinarySkills.guardLethal(entity.id,elapsed,match.round)){entity.hp=1;if(entity===player)showMessage('不屈の卵 / 殻が割れた','致死攻撃をHP1で耐えました',1.5);}
  roundDamage.record(match.round,entity.id,killer?.id,Math.max(0,healthBefore-entity.hp)+Math.max(0,armorBefore-entity.armor));
  if(firearm&&killer&&entity.team!==killer.team&&Math.max(0,healthBefore-entity.hp)+Math.max(0,armorBefore-entity.armor)>0)firearmFeedback(killer,entity.hp<=0);
  if(skill&&killer&&Math.max(0,healthBefore-entity.hp)+Math.max(0,armorBefore-entity.armor)>0)skillImpact(entity,killer,skill);
  if(entity===player)damageFlash=.45;
  if(returnScale){const actual=Math.max(0,healthBefore-entity.hp)+Math.max(0,armorBefore-entity.armor);if(actual>0)damageEntity(killer,actual*returnScale,entity,{returned:true,skill:'japan'});}
  if(firearm&&chain&&!returned&&killer?.alive&&ordinarySkills.onnaraEvent?.('onnara-chain',killer.id,elapsed)){const actual=Math.max(0,healthBefore-entity.hp)+Math.max(0,armorBefore-entity.armor);const next=actual>0?constellationTarget(entity,killer,[player,...bots],visibleBetween):null;if(next){const from=new THREE.Vector3(entity.x,(entity.y||0)+1.2,entity.z),to=new THREE.Vector3(next.x,(next.y||0)+1.2,next.z);ordinarySkills.recordConstellation(killer.id,from,to,elapsed);damageEntity(next,actual*ONNARA_SKILLS.chainScale,killer,{chain:false,skill:'onnara'});}}
  if(entity.hp>0)return;
  const creditedKiller=killer&&killer.team!==entity.team?killer:null;
  fullComboTracker.record(match.round,entity,creditedKiller);
  entity.alive=false;entity.renkoUltimate=null;if(entity.kit)entity.kit.renkoActive=false;entity.trcLadder=null;cancelServiceReload(entity);entity.kit?.awardPoint();const record=recordOf(entity);if(record)record.d++;
  match.dropSpike(entity.id,entity.x,entity.z,map.id==='trc'?getZoneFloor(entity.x,entity.z,entity.y+.05):0);match.cancelPlant(entity.id);match.cancelDefuse(entity.id);
  const item=entity===player?inventory.primary:record?.primary;dropItem(item,entity);
  if(creditedKiller){renkoUltimateActive(killer);const refilled=killer.kit?.awardKill();if(refilled&&killer===player)showMessage('リスタートラッシュ','撃破確定 · C・Q・E全回復',2);const k=recordOf(killer);if(k)k.k++;if(!firearm)killFeedback(killer);if(killer===player){totalKills++;match.awardKill();careerCoins.progress({kills:totalKills});}else if(k)k.credits=Math.min(9000,k.credits+200);feed(`${k?.name||CHARACTER_DEFS[killer.kit?.character||'duelist'].label}  ⌁  ${record?.name||(entity===player?'YOU':CHARACTER_DEFS[entity.kit?.character||'duelist'].label)}`);}
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
function soundDefuseStart(event){sound('defuse-start',{entity:{id:event.actorId,x:match.spike.x,y:0,z:match.spike.z}});}
function handleMatchEvents(){
  if(!match)return;
  for(const event of match.drainEvents()){
    if(event.type==='live'){if(!exploring)roundDamage.begin(match.round,roster);if(!exploring&&!rangeSession&&!objectivePractice)fullComboTracker.begin(match.round,[player,...bots]);buyBarrier.visible=false;if(mode==='shop')resumeGame();showMessage(sideNames[match.side],match.side==='attack'?'A/Bサイトで 4 を4秒長押しして設置':'設置を阻止 · 設置されたら 4 を7秒長押しで電源オフ',3);}
    if(event.type==='planted'){
      const planter=event.actorId===player.id?player:bots.find(b=>b.id===event.actorId);planter?.kit?.awardPoint();equipAfterPlant(planter);
      showMessage('BOMBER PLANTED',`${event.site}サイト · 起爆まで45秒`,3);sound('plant',{entity:match.spike});lastSpikeBeep=0;
      for(const r of roster)if(r.id!=='player'&&r.team===event.team)r.credits=Math.min(9000,r.credits+300);
    }
    if(event.type==='dropped')showMessage('BOMBER DROPPED','落ちたボンバーは攻撃側が接近すると回収',2);
    if(event.type==='defuse-start')soundDefuseStart(event);
    if(event.type==='defused'){sound('defuse',{entity:match.spike});const defuser=event.actorId==='player'?player:bots.find(b=>b.id===event.actorId);defuser?.kit?.awardPoint();}
    if(event.type==='detonated')startDetonation({id:`${match.round}:${elapsed.toFixed(6)}`,round:match.round,startedAt:elapsed,x:match.spike.x,z:match.spike.z,seed:(Math.imul(match.round,16807)+Math.floor(elapsed*1000))>>>0});
    if(event.type==='round-end'){
      roundDamage.finish(match.round);
      const comboId=fullComboTracker.winner(match.round,event.team),comboSeat=roster.findIndex(r=>r.id===comboId);
      if(match.lastRound&&comboSeat>=0)match.lastRound.fullCombo=comboSeat;
      clearCombatInput();reloading=0;
      resetZoneAbilities();
      showRoundResult(event.team,event.reason);
      const redWon=event.team==='red';
      const redBase=redWon?3000:1900+Math.min(redLossStreak,2)*500;
      redLossStreak=redWon?0:redLossStreak+1;
      for(const r of roster){if(r.id==='player')continue;const e=bots.find(b=>b.id===r.id);r.survived=!!e?.alive;r.armor=e?.armor||0;
        let reward=r.team==='red'?redBase:event.won?3000:1900+Math.min(Math.max(0,match.lossStreak-1),2)*500;
        const side=r.team===match.attackerTeam?'attack':'defend';
        if(r.team!==event.team&&r.survived&&((side==='attack'&&event.reason==='timeout')||(side==='defend'&&event.reason==='detonation')))reward=1000;
        r.credits=Math.min(9000,r.credits+reward);
      }
    }
    if(event.type==='round-start')spawnRound(event.reset);
    if(event.type==='match-end')finish(event.winner==='blue');
  }
}

let playerShotModel=null;
// The local player uses the same animated geometry as a remote/BOT avatar.
// Detached from the scene: this has no draw, audio, state or network authority.
function updatePlayerShotModel(dt=0){
  playerShotModel??=createAgentModel(THREE,{bot:player,team:player.team,character:player.kit.character});
  playerShotModel.group.position.set(player.x,player.y||0,player.z);
  playerShotModel.group.rotation.y=player.yaw+Math.PI;
  playerShotModel.update(dt,{...agentEquipment(player),weapon:inventory.active,time:elapsed,
    sliding:(frostSlideSpeed(player)>0||renkoSliding(player))&&Math.hypot(player.vx,player.vz)>1.2,
    moving:Math.hypot(player.vx,player.vz)>1.2,planting:!!player.planting,defusing:!!player.defusing,alive:true});
  playerShotModel.group.updateMatrixWorld(true);
}
function playerShotHit(ray){
  if(!player.alive)return null;
  updatePlayerShotModel();
  const surface=ray.intersectObject(playerShotModel.group,true)[0]||null;
  // Retain the previous forgiving torso/lower-leg volume, including its gaps.
  // It supplies no head sphere and cannot mask the actual visible head.
  const c=(player.crouch||0)*.55,point=ray.ray.intersectBox(new THREE.Box3(
    new THREE.Vector3(player.x-.28,(player.y||0)+.4,player.z-.28),
    new THREE.Vector3(player.x+.28,(player.y||0)+1.45-c,player.z+.28)),new THREE.Vector3());
  const distance=point?ray.ray.origin.distanceTo(point):Infinity;
  if(point&&distance>=ray.near&&distance<=ray.far&&(!surface||!(shotZone(surface)==='head')&&distance<surface.distance))
    return {point,distance,object:{userData:{bot:player,head:false}}};
  return surface;
}
function shotZone(hit,point=hit?.point,target=hit?.object.userData.bot){
  return hit?.hitZone||hit?.object.userData.hitZone||(hit?.object.userData.head?'head':point&&target&&point.y-(target.y||0)<.7?'leg':'body');
}
function makeBot(spawn,index,team='red',record=null) {
  const bot={id:record?.id||`${team}-${index}`,team,record,x:spawn.x,z:spawn.z,y:Number.isFinite(spawn.y)?spawn.y:0,vy:0,hp:100,armor:record?.armor||0,alive:true,phase:Math.random()*6.28,fire:.18,index,flash:0,spawnX:spawn.x,spawnZ:spawn.z,path:[],pathTime:0,target:null,lastSeen:null,reactionUntil:0,flankComplete:false,plantPositionId:null,planting:false,defusing:false};
  const savedKit=record?.kit;
  bot.kit=typeof savedKit?.restore==='function'?savedKit:new DuelistKit({character:savedKit?.character||characterIds[index%characterIds.length]});
  if(savedKit&&typeof savedKit.restore!=='function')bot.kit.restore(savedKit);
  if(record&&(!record.memberId||record.netFallback)&&record.id!=='range-target')record.name=CHARACTER_DEFS[bot.kit.character].label;
  const visual=createAgentModel(THREE,{bot,team,variant:index,character:bot.kit.character});
  Object.assign(bot,{visual,group:visual.group,meshes:visual.meshes,muzzle:visual.muzzle});
  const side=team===match?.attackerTeam?'attack':'defend';
  bot.group.rotation.y=(map.spawnYaw?.[side]??(side==='attack'?0:Math.PI))+Math.PI;
  bot.group.position.set(spawn.x,bot.y,spawn.z);botsGroup.add(bot.group);bots.push(bot);
  visual.update(0,{...agentEquipment(bot),time:elapsed,alive:bot.alive});
}
function clearBots() {
  playerShotModel?.dispose();playerShotModel=null;
  victoryCamera.reset();lastSpectatedId=null;
  spectatedBot=null;
  for(const bot of bots)bot.visual.dispose();
  bots.length=0;
}
function spawnRound(reset=false) {
  if(reset)redLossStreak=0;
  victoryCamera.reset();lastSpectatedId=null;
  player.trcStepClock=0;
  deathView.reset();syncDeathUI();
  // Half-time and overtime side switches reset the round's economy and fleet.
  resetTraffic(!reset);
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
  ammoStore={};roundPurchases={};skillPurchaseLedger=new WeakMap();bomberNoticeKey='';bomberNoticeUntil=0;player.alive=true;player.hp=100;reloading=0;round=match.round;timeLeft=match.phaseTime;
  const positions=match.side==='attack'?map.teamSpawns.attack:map.teamSpawns.defend;
  player.x=positions[0].x;player.z=positions[0].z;player.y=0;player.vy=0;player.vx=0;player.vz=0;player.crouch=0;
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
  if(!isGuest())placeStartingBomber();
  syncBuyBarrier();
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
function clearCombatInput(){clearVeilPlacement();duckAim=null;releaseRenkoJet();
  cancelPlantAndEquip(player);
  pointerLockRequest++;pointerLockInput='unlocked';
  keys.clear();firing=false;aiming=false;interactionHeld=false;touchMove={x:0,y:0};touchLook=null;movePointer=null;
  player.planting=false;player.defusing=false;
  const movePad=$('move-pad');if(movePad){movePad.style.setProperty('--stick-x','0px');movePad.style.setProperty('--stick-y','0px');}
  setVisible('interaction',false);setVisible('sniper-cycle',false);resetMouseLook();
}
function requestLock() {
  resetMouseLook();
  if(document.fullscreenElement&&!keyboardProtection.pending&&keyboardProtection.state!=='protected')void keyboardProtection.enable();
  if (navigator.maxTouchPoints>0 && matchMedia('(pointer:coarse)').matches) return;
  pointerRequested=true;
  const request=++pointerLockRequest;
  const current=()=>request===pointerLockRequest&&mode==='play'&&player.alive&&!netHostPaused;
  const failed=()=>{if(!current())return;pointerLockInput='unlocked';inputActive=true;showMessage('MOUSE LOOK','マウスを動かすだけで視点を操作できます',3);};
  const capture=raw=>{
    if(!current())return;
    pointerLockInput=raw?'requesting-raw':'requesting-adjusted';
    const rejected=error=>{
      if(!current())return;
      // Only an unsupported raw backend warrants a single adjusted retry.
      // Permission/activation failures must not cause repeated lock requests.
      if(raw&&error?.name==='NotSupportedError')capture(false);else failed();
    };
    try{
      // Raw input bypasses the OS-adjusted/recenter path. Do not trim real
      // flicks by guessing a maximum speed from mouse event timestamps.
      const result=raw?canvas.requestPointerLock({unadjustedMovement:true}):canvas.requestPointerLock();
      if(result?.then)result.then(()=>{if(current()&&document.pointerLockElement===canvas)pointerLockInput=raw?'raw':'adjusted';},rejected);
      else pointerLockInput='legacy-unconfirmed';
    }catch(error){rejected(error);}
  };
  capture(true);
}
function selectArena(id){
  id=normalizeMapId(id);if((map.id||'hashimoto')===id){updateMapLabels();return;}
  rangeControl.hide();resetDetonation();map.traffic?.reset();map.destruction?.reset();map.traversal?.reset();player.trcLadder=null;map.world?.removeFromParent();
  if(!arenaCache.has(id))arenaCache.set(id,createMap(THREE,environment,id));
  map=arenaCache.get(id);if(!map.bomberCollapse){map.bomberCollapse=createBuildingCollapse(THREE,map);scene.add(map.bomberCollapse.group);}environment.add(map.world);navigation=createNavigation({...map,bounds:map.combatBounds||map.bounds});updateBots.tactics=null;nopeDecoyTownCandidates=null;
  environment.traverse(object=>{for(const material of Array.isArray(object.material)?object.material:[object.material])if(material?.map)material.map.anisotropy=textureFiltering;});
  sun.intensity=map.indoor ? .45 : 3;sun.castShadow=!map.indoor;scene.background.set(map.indoor?'#35434a':'#8cbad7');scene.fog=new THREE.Fog(map.indoor?'#657875':'#b7d0dd',map.indoor?65:145,map.indoor?135:380);
  const shadowSize=map.id==='trc'?2048:4096;
  if(sun.shadow.mapSize.x!==shadowSize){sun.shadow.mapSize.set(shadowSize,shadowSize);sun.shadow.map?.dispose();sun.shadow.map=null;sun.shadow.needsUpdate=true;}
  map.world.updateMatrixWorld(true);updateMapLabels();
}
function activeArenaBounds(){return exploring&&!onlinePlaying?map.bounds:map.combatBounds||map.bounds;}
function updateMapLabels(){
  const name=map.name||'橋本駅',short=map.shortName||'HASHIMOTO',viewBounds=activeArenaBounds();
  const copies={'mission-map':name+' 爆破・電源オフ作戦','menu-map-name':name+'前','character-preview-map':name+'前','hud-map-name':short+' STATION','map-title':name+' / 戦術マップ','map-area-name':name+' · '+(viewBounds.maxX-viewBounds.minX)+'m × '+(viewBounds.maxZ-viewBounds.minZ)+'m','map-route-copy':map.id==='hirakata'?'屋内A / 屋内B / MID横挟みルート':'バス通り / 中央連絡路 / ミウィ通り'};
  if(map.id==='trc')Object.assign(copies,{'menu-map-name':name,'character-preview-map':name,'hud-map-name':'TRC / SOUND MARKET','map-route-copy':'屋外 A ロング / 正面ロビー・MID / 搬入 B メイン'});
  copies['map-site-a-name']=map.sites[0].name;copies['map-site-b-name']=map.sites[1].name;copies['map-detail']=map.id==='hirakata'?'対戦は従来の164m四方。マップ練習では周辺224m四方も探索できます。車道のしばくでバスに注意。':'橋本駅前の景観をもとに構成したオリジナルマップです。';
  copies['map-coordinate-copy']=copies['menu-coordinate-copy']=map.id==='hirakata'?'34.815°N / 135.649°E':'35°35′42″N / 139°20′42″E';copies['menu-map-note']=map.id==='hirakata'?'枚方市駅 / 南北広場・自由通路・駅周辺街区':'非公式ファンメイド / 橋本駅前をモチーフにしたオリジナルマップ';copies['radar-map-copy']=short+' / 2 SITES';
  if(map.id==='trc')Object.assign(copies,{'map-detail':'受付棟を左右に回ってA・Bメインへ。入口は天井までの壁の裏から横入り。MIDは中央への回り込みかS1/S2シャッターを選択。Aは7mダクト・ヘブン、Bは独立した地下搬入路。Fでドア・はしご、Vでダクト、Shiftで消音。','map-coordinate-copy':'TRC INSPIRED / OUTDOOR APPROACH','menu-coordinate-copy':'TRC INSPIRED / OUTDOOR APPROACH','menu-map-note':'同人音楽即売会 / オリジナル対戦レイアウト'});
  canvas.setAttribute('aria-label',name+'の3D競技マップ');$('large-minimap')?.setAttribute('aria-label',name+'の戦術マップ');
  for(const[id,text]of Object.entries(copies))if($(id))$(id).textContent=text;
  for(const id of ['map-select','online-map'])if($(id)&&(!online||id==='map-select'))$(id).value=map.id||'hashimoto';
  if($('start-subtitle'))$('start-subtitle').textContent=(['explore','range','plant','defuse'].includes($('match-format')?.value)?'PRACTICE IN ':'DEPLOY TO ')+short;
}
const busBreakAudioAt=new Map();
const busHorns=createBusHornScheduler(pose=>sound('bus-horn',{entity:{id:'bus-horn:'+pose.id,x:pose.x,y:0,z:pose.z},localOnly:true}));
function busSeat(actor=player){return map.traffic?.service.seat(actor.id)||null;}
function busDriving(actor=player){return busSeat(actor)?.driving===true;}
function busCanExit(p){return canStand(p.x,p.z,.34,0)&&getZoneFloor(p.x,p.z,.6)<.45;}
function busCanDrive(p,old,context){
 const bounds=activeArenaBounds(),destruction=map.destruction,smash=!isGuest()&&!!context?.owner&&Math.abs(context.speed)>=.5;
 for(const x of[-1.3,1.3])for(const z of[-5.35,5.35]){const point=busPoint(p,x,z);
  if(point.x<bounds.minX||point.x>bounds.maxX||point.z<bounds.minZ||point.z>bounds.maxZ)return false;
 }
 // Check the full body and arena limits before demolition. A moving owned
 // bus may remove catalogued walls/roofs; unknown solids still stop it safely.
 for(const c of map.collision.query(p.x,p.z,5.6))if(!(smash&&destruction?.damageable.has(c))&&busHitsBox(p,c))return false;
 if(smash){
  const hit=destruction?.breakAt(p,old,elapsed),id=context.busId||'local';
  if(hit?.length&&elapsed-(busBreakAudioAt.get(id)??-Infinity)>=.75){
   const point=destruction.impactPoints()[0];
   if(point){busBreakAudioAt.set(id,elapsed);sound('bus-break',{entity:{id:'bus-break:'+id,...point}});}
  }
 }
 return true;
}
function busControls(id){
 if(id===player.id)return mode==='play'?{throttle:(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)-touchMove.y,steer:(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+touchMove.x,brake:keys.has('Space')}:{};
 const actor=bots.find(a=>a.id===id),data=actor?.remoteId&&netInputs.get(actor.remoteId);return data&&data.round===match.round&&elapsed-data.received<.3?data.input?.bus||{}:{};
}
function busInteract(actor=player){
 if(!actor.alive||match?.phase!=='live'||carMotionActive(actor)||actor.trafficLaunch||actor.planting||actor.defusing)return false;
 const candidate=map.traffic?.service.candidate(actor,elapsed);if(!candidate)return false;
 if(candidate.kind==='board'){const p=map.traffic.poses(elapsed).find(p=>p.id===candidate.busId),door=busPoint(p,-1.8,3.8);if(!map.collision.rayClear(actor.x,(actor.y||0)+1.2,actor.z,door.x,1.2,door.z))return false;}
 if(actor===player&&isGuest()){queueNetAction('bus');interactionHeld=false;return true;}
 const ok=map.traffic.service.interact(actor,elapsed,busCanExit);
 if(ok){cancelServiceReload(actor);match.cancelPlant(actor.id);match.cancelDefuse(actor.id);actor.path=[];actor.dashTimer=0;actor.vx=actor.vz=0;
  if(actor===player){interactionHeld=false;firing=false;aiming=false;duckAim=null;reloading=0;const p=map.traffic.poses(elapsed).find(p=>p.id===busSeat(actor)?.busId);if(p)player.yaw=p.yaw+Math.PI;}
 }
 return true;
}
function busSurfaceVisible(hit){if(hit.object.userData.trcBroken||hit.object.userData.bomberHidden||hit.object.userData.bomberBrokenInstances?.has(hit.instanceId)||hit.object.userData.busGlass||hit.object.userData.busDebrisHidden||hit.object.userData.busBrokenInstances?.has(hit.instanceId))return false;return !hit.object.userData.busDriver||map.traffic?.poses(elapsed).some(p=>p.id===hit.object.userData.busDriver&&p.driverHP>0);}
function shootBusDriver(hit,actor,damage,{visualOnly=false}={}){
 const door=hit?.object.userData.trcDoor;if(door){if(!visualOnly&&!isGuest()){const cue=map.traversal?.damage(door,damage);if(cue)sound(cue,{entity:actor});}return true;}
 const id=hit?.object.userData.busDriver;if(!id)return false;
 if(!visualOnly){const service=map.traffic?.service,before=service?.poses(elapsed).find(p=>p.id===id)?.driverHP;
  if(service?.damageDriver(id,actor.id,damage,elapsed)){const after=service.poses(elapsed).find(p=>p.id===id)?.driverHP;
   if(before>0&&after===0)actor.kit?.awardPoint();
   if(actor===player){hitFlash=.14;sound('hit');}map.busModels?.update(elapsed);}
 }
 burst(hit.point,'#e9c586',3);return true;
}
function resetTraffic(preserveHijacked=false){busHorns.reset();busBreakAudioAt.clear();map.traversal?.reset();player.trcLadder=null;map.traffic?.reset(null,{preserveHijacked});map.busModels?.update(elapsed);map.destruction?.reset();for(const actor of [player,...bots]){actor.trafficLaunch=null;delete actor.busFrameYaw;}}
function updateTraffic(dt){
  if(!map.traffic){busHorns.reset();return;}
  const actors=[player,...bots];
  if(!isGuest())map.traffic.service.tick(dt,elapsed,actors,{enabled:match.phase==='live',controls:busControls,canDrive:busCanDrive,canExit:busCanExit});
  else for(const actor of actors)map.traffic.service.place(actor,elapsed);
  busHorns.update(elapsed,map.traffic.poses(elapsed),match.phase==='live'&&!netHostPaused&&!document.hidden);
  for(const actor of actors)if(busSeat(actor)&&actor.group)actor.group.position.set(actor.x,actor.y,actor.z);
  map.destruction?.update(elapsed);map.busModels?.update(elapsed);
  if(!isGuest()){
    for(const hit of map.traffic.impacts(actors,elapsed,{enabled:match.phase==='live'})){
      const actor=actors.find(a=>a.id===hit.actorId),stunUntil=carStunUntil(actor);
      actor.carMotion=stunUntil>elapsed?{...actor.carMotion,phase:3,endsAt:stunUntil,vx:0,vz:0,lastAt:elapsed}:null;actor.carImpulseUntil=stunUntil;actor.carFallUntil=0;actor.trafficLaunch={seq:hit.sequence,endsAt:hit.endsAt,vx:hit.vx,vz:hit.vz,vy:hit.vy};actor.vy=hit.vy;actor.dashTimer=0;actor.vx=0;actor.vz=0;actor.path=[];actor.planAt=0;
      sound('vehicle-hit',{entity:actor});
      cancelServiceReload(actor);match.cancelPlant(actor.id);match.cancelDefuse(actor.id);damageEntity(actor,hit.damage,actors.find(a=>a.id===hit.owner)||null,{vehicle:true});
      if(actor===player){damageFlash=.55;showMessage('しばくでバスと接触',`${hit.damage}ダメージ · 車道から離れてください`,3);}
    }
  }
  for(const actor of actors){const hit=actor.trafficLaunch;if(!hit)continue;
    // Remote victims follow the host snapshot; their client only predicts itself.
    if(isGuest()&&actor!==player)continue;
    if(match.phase!=='live'&&!(match.phase==='post'&&!actor.alive)){actor.trafficLaunch=null;continue;}
    if(elapsed<hit.endsAt)moveEntity(actor,hit.vx*dt,hit.vz*dt,actor===player?.34:.4);
    // Living vertical physics already ran once. Dead bodies still fly and land.
    if(!actor.alive||actor.remoteId&&!isGuest()&&actor.carMotion?.phase!==3)updateActorVertical(actor,dt,actor===player?.34:.4);
    if(elapsed>=hit.endsAt&&(actor.alive||actor.vy===0))actor.trafficLaunch=null;
    if(actor.group){actor.group.position.set(actor.x,actor.y,actor.z);if(!actor.alive){actor.death=Math.max(actor.death||0,hit.endsAt-elapsed+.2);actor.group.visible=true;}}
  }
}
function startGame() {
  clearMouseInputTrace();
  victoryCamera.reset();lastSpectatedId=null;
  resetKillSounds();
  roundDamage.reset();combatReportKey='';setVisible('combat-report',false);
  deathView.reset();
  victoryMusic.reset();victoryMusicUI?.close();
  player.kit=new DuelistKit({character:selectedCharacter()});netCharacterRequested=false;
  if(onlinePlaying&&mode!=='menu'){leaveOnline();return;}
  if(online&&!onlinePlaying){online.close(true);online=null;}
  selectArena(onlinePlaying?online.room.settings.mapId:$('map-select')?.value);resetTraffic();
  netHostPaused=false;syncSmokes([]);scene.fog.near=145;scene.fog.far=380;scene.fog.color.set('#b7d0dd');
  player.id='player';player.team='blue';
  audioInit();difficulty='hard';
  round=1;totalKills=0;shots=0;hits=0;elapsed=0;lastShot=-10;
  player.recoil=0;scanTime=0;kick=0;hitFlash=0;reloading=0;redLossStreak=0;
  const selectedFormat=$('match-format')?.value||'standard';
  rangeControl.hide();rangeSession=selectedFormat==='range'?new RangeSession({waiting:true}):null;rangeRespawn=0;
  objectivePractice=['plant','defuse'].includes(selectedFormat)?{kind:selectedFormat,site:'A',completed:false,elapsed:0,duration:0}:null;
  exploring=selectedFormat==='explore'||!!rangeSession||!!objectivePractice;
  careerCoins.begin({eligible:!exploring,guest:isGuest()});
  navigation=createNavigation({...map,bounds:activeArenaBounds()});updateBots.tactics=null;nopeDecoyTownCandidates=null;updateMapLabels();
  match=new MatchRules({format:exploring?'standard':selectedFormat,startingSide:objectivePractice?(selectedFormat==='plant'?'attack':'defend'):$('starting-side')?.value||'attack'});
  if($('economy-note'))$('economy-note').textContent=match.format==='swift'?'SWIFT · ROUND GRANTS SC 2,400 / 4,250  +  ELIMINATION SC 200':'WIN SC 3,000  +  ELIMINATION SC 200';
  inventory={primary:null,secondary:'classic',active:'classic'};player.armor=0;player.alive=true;
  roster=[{id:'player',team:'blue',name:'YOU',k:0,d:0,a:0,credits:800},...Array.from({length:9},(_,i)=>({id:i<4?`blue-${i+1}`:`red-${i-4}`,team:i<4?'blue':'red',name:'',k:0,d:0,a:0,credits:800,primary:null,secondary:'classic',armor:0,survived:false}))];
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
      relocate(map.rangeArea?.spawn||{x:-20.75,z:-25.5,yaw:0});prepareRangeStart();
      showMessage('射撃訓練','スタート看板を撃って開始 · 弾・C/Q/E/Xは無限 · Bで武器選択',5);
    }else showMessage((map.shortName||'HASHIMOTO')+' / マップ練習','時間制限なし · Mでルート確認・地点移動 · Bで武器選択',5);
  }
  updateTravelButtons();requestLock();updateHUD();
}
function pauseGame(showMap=false) {
  killBanner.reset();victoryMusic.stop();
  if(!['play','shop','map','score'].includes(mode)) return;
  flushMouseInputTrace();
  pausedFrom='play';mode=showMap?'map':'pause';clearCombatInput();
  if(document.pointerLockElement) document.exitPointerLock();
  setVisible('shop-overlay',false);setVisible('scoreboard',false);
  setVisible(showMap?'map-overlay':'pause-menu',true);
  if(showMap)drawMinimap($('large-minimap'),true);
}
function resumeGame() {
  if(!['pause','map','shop','score'].includes(mode))return;
  victoryMusicUI?.close();clearCombatInput();mode='play';for(const id of ['pause-menu','map-overlay','shop-overlay','scoreboard'])setVisible(id,false);audioInit();requestLock();
}
function backMenu({keepParty=false}={}) {
  careerCoins.stop();careerCoins.refresh();
  clearMouseInputTrace();
  victoryCamera.reset();lastSpectatedId=null;
  resetKillSounds();
  roundDamage.reset();combatReportKey='';setVisible('combat-report',false);
  fullComboTracker.reset();
  deathView.reset();syncDeathUI();
  resetTraffic();victoryMusic.reset();victoryMusicUI?.close();
  if(online&&!keepParty){leaveOnline();return;}
  netHostPaused=false;syncSmokes([]);scene.fog.near=145;scene.fog.far=380;scene.fog.color.set('#b7d0dd');
  updateFormatSummary();
  mode='menu';clearCombatInput();gun.visible=false;spikeModel.visible=false;setVisible('loading',false);clearDrops();resetDetonation();resetTakeover();resetTeamAbilities();
  rangeControl.hide();rangeSession=null;rangeRespawn=0;objectivePractice=null;exploring=false;
  navigation=createNavigation({...map,bounds:activeArenaBounds()});updateBots.tactics=null;updateMapLabels();
  clearBots();for(const id of ['hud','result','pause-menu','shop-overlay','scoreboard','map-overlay'])setVisible(id,false);setVisible('menu',true);buyBarrier.visible=false;
  if(document.pointerLockElement)document.exitPointerLock();
}
function syncResultActions(){
  const party=onlinePlaying&&!!online;
  $('play-again-label').textContent=party?'みんなで待機室へ':'もう一度プレイ';
  $('play-again-subtitle').textContent=party?'KEEP PARTY':'PLAY AGAIN';
  $('play-again').disabled=party&&!online.host;
  $('back-menu-label').textContent=party?'部屋を退出する':'メインメニューへ';
  $('party-result-note').hidden=!party;
  $('party-result-note').textContent=party?(online.host?'部屋とメンバーを保ったまま戻ります。次も同じ部屋から開始できます。':'接続は続いています。ホストが「みんなで待機室へ」を押すと全員で戻れます。'):'';
}
async function playAgain(){
  if(!onlinePlaying||!online){startGame();return;}
  const client=online;if(!client.host||mode!=='result'||match?.phase!=='match'||playAgain.pending)return;
  playAgain.pending=true;$('play-again').disabled=true;
  try{
    // Wait for current-match result receipts before clearing anyone's world.
    // A disconnected member does not hold the rest of the party indefinitely.
    const until=Date.now()+8000;
    while(client===online&&client.room.status==='playing'&&client.room.members.some(m=>m.id!==client.session.memberId&&m.connected&&netInputs.get(m.id)?.input?.matchFinished!==true)){
      if(Date.now()>=until)throw Error('結果の受信待ちです。少し待ってからもう一度押してください。');
      $('party-result-note').textContent='参加者へ試合結果を届けています…';await new Promise(resolve=>setTimeout(resolve,200));
    }
    if(client===online&&client.room.status==='playing')await client.rematch();
  }catch(error){if(client===online){$('party-result-note').hidden=false;$('party-result-note').textContent=error.message;}}
  finally{playAgain.pending=false;if(client===online)$('play-again').disabled=!client.host;}
}
function finish(won) {
  victoryCamera.reset();lastSpectatedId=null;
  deathView.reset();syncDeathUI();
  resetTeamAbilities();
  if(!match||mode==='result')return;mode='result';clearCombatInput();reloading=0;gun.visible=false;buyBarrier.visible=false;
  if(match.phase==='match'&&match.winner)careerCoins.progress({kills:totalKills,finished:true,won:match.winner===player.team});
  if(document.pointerLockElement)document.exitPointerLock();
  for(const id of ['hud','shop-overlay','scoreboard','map-overlay'])setVisible(id,false);setVisible('result',true);
  $('result-title').textContent=won?'開米':'閉米';
  $('result-title').classList.add('japanese-result');
  $('result-title').classList.toggle('defeat',!won);
  $('result-description').textContent=`${match.score.blue} — ${match.score.red} · ${match.format==='swift'?'スイフト':'スタンダード'} · ${map.name||'橋本駅'}の試合が終了しました。`;
  $('result-kills').textContent=totalKills;
  $('result-accuracy').textContent=`${shots?Math.round(hits/shots*100):0}%`;
  $('result-time').textContent=formatTime(elapsed);
  syncResultActions();
  sound(won?'match-win':'match-loss');
}
function prepareRangeStart(){
  clearBots();
  const yaw=player.yaw,x=player.x-Math.sin(yaw)*3.2,z=player.z-Math.cos(yaw)*3.2;
  rangeControl.show(environment,{x,y:player.y,z,yaw});
  refillMapPracticeSkills();refillRangeAmmo();
}
function startRangeDrill(){
  if(!rangeSession||!exploring||onlinePlaying||mode!=='play'||!player.alive||match?.phase!=='live'||!rangeSession.start())return false;
  resetKillSounds();rangeControl.hide();spawnRangeTarget();
  showMessage('START / 60秒','頭で撃破150点 / 胴で撃破100点 · 弾・スキル無限',2);return true;
}
function spawnRangeTarget(){
  if(!rangeSession?.started||rangeSession.complete)return;
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
  rangeControl.hide();resetTeamAbilities();
  const result=rangeSession.summary();let best=0;
  try{best=Math.max(0,Math.min(1000000,Number(localStorage.getItem('hashimoto-range-best'))||0));if(result.score>best)localStorage.setItem('hashimoto-range-best',String(result.score));}catch{}
  mode='result';keys.clear();firing=false;aiming=false;gun.visible=false;clearBots();syncResultActions();
  if(document.pointerLockElement)document.exitPointerLock();
  for(const id of ['hud','pause-menu','shop-overlay','scoreboard','map-overlay','interaction'])setVisible(id,false);
  setVisible('result',true);setVisible('range-result',true);
  $('result-title').classList.remove('japanese-result','defeat');$('result-title').textContent='DRILL COMPLETE';$('result-description').textContent=(map.name||'橋本駅')+' / 60秒の射撃訓練';
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
function showSkillMessage(character,key,effectType=''){const text=getSkillUseMessage(character,key,effectType);if(text)showMessage(text.title,text.description,2);}
function showSkillAim(character,key){const text=getSkillUseMessage(character,key);if(text)showMessage(text.title,'左クリックで確定／右で取消',30);}
function feed(text) {
  const item=document.createElement('div');item.className='feed-item';item.textContent=text;$('killfeed').prepend(item);
  while($('killfeed').children.length>4)$('killfeed').lastElementChild.remove();
  setTimeout(()=>item.remove(),5500);
}
function formatTime(t){return `${String(Math.floor(Math.max(0,t)/60)).padStart(2,'0')}:${String(Math.floor(Math.max(0,t)%60)).padStart(2,'0')}`;}
function relocate(point){
  const layered=Number.isFinite(point.y)&&point.y!==0,safe=layered&&canStand(point.x,point.z,.34,point.y)?point:layered?null:navigation.nearest(point.travelX??point.x,point.travelZ??point.z);if(!safe)return false;
  player.x=safe.x;player.z=safe.z;player.y=layered?point.y:0;player.vy=0;player.vx=0;player.vz=0;player.trafficLaunch=null;player.trcLadder=null;player.pitch=0;player.recoil=0;renderedRecoil=0;
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
  showMessage(`${siteId} / ${kind==='plant'?'設置練習':'電源オフ練習'}`,kind==='plant'?'止まって 4 を4秒長押し · MでA/Bを切替':'4 を7秒長押し · 3.5秒で進捗50%を保存 · 起爆なし',4);
  updateHUD();return true;
}
function updateObjectivePractice(dt){
  if(!objectivePractice)return;
  if(!objectivePractice.completed)objectivePractice.elapsed+=dt;
  const events=match.drainEvents();for(const event of events)if(event.type==='defuse-start')soundDefuseStart(event);
  const event=events.find(e=>e.type===(objectivePractice.kind==='plant'?'planted':'defused'));
  if(event&&!objectivePractice.completed){
    objectivePractice.completed=true;objectivePractice.duration=objectivePractice.elapsed;
    clearCombatInput();sound(objectivePractice.kind==='plant'?'plant':'defuse');
    if(event.type==='planted'&&event.actorId===player.id)equipAfterPlant(player);
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
  if(map.lightingStudy&&exploring&&!rangeSession&&!objectivePractice){
    const study=map.lightingStudy,button=document.createElement('button');button.type='button';
    const label=()=>{button.disabled=!study.ready;button.textContent=study.error?'TRC照明：読込失敗':!study.ready?'TRC照明：読込中':`TRC照明：${study.enabled?'ベイク → 従来':'従来 → ベイク'}`;};
    label();study.promise.then(label);
    button.title='現在位置のままTRC全体の照明を比較';
    button.addEventListener('click',()=>{if(!study.ready)return;study.setEnabled(!study.enabled);label();resumeGame();showMessage(study.enabled?'TRC / BAKED':'TRC / ORIGINAL','Mで同じ視点のまま照明を切り替え',2);});container.append(button);
  }
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
function trcInteract(actor=player,request=null){
  if(!map.traversal||!actor.alive||match?.phase!=='live'||carMotionActive(actor))return false;
  const n=request||map.traversal.nearby(actor);if(!n)return false;
  if(actor===player&&isGuest()){
    const queued=netActions.length;queueNetAction('trc-interact',{kind:n.kind,id:n.id});
    if(netActions.length===queued)return false;
    if(n.kind==='ladder')map.traversal.interact(actor,n,elapsed,[player,...bots]);
    return true;
  }
  const result=map.traversal.interact(actor,n,elapsed,[player,...bots]);
  if(result?.startsWith('door-'))sound(result,{entity:actor});
  return true;
}
function trcMotionSound(actor,dt,previous,quiet){
  if(!map.traversal)return;
  const metal=actor.trcLadder||map.ductAt(actor.x,actor.z,actor.y);
  const moved=Math.hypot(actor.x-previous.x,(actor.y||0)-(previous.y||0),actor.z-previous.z)>.002;
  actor.trcStepClock=metal&&moved&&!quiet&&!ordinarySkills.quiet(actor.id,elapsed)?(actor.trcStepClock||0)+dt:0;
  if(actor.trcStepClock>.36){actor.trcStepClock=0;sound('duct-step',{entity:actor});}
}
function trcBotGoal(bot,fallback,attacking,siteId,spike){
  const slot=Number(bot.id.split('-').pop());
  if(match.roundTime<30||['planted','dropped'].includes(spike.status)||attacking&&slot!==3||!attacking&&![1,3].includes(slot))return fallback;
  const key=attacking?'attack'+siteId:'defend'+(slot===1?'A':'B');
  if(!bot.trcRoute||bot.trcRoute.round!==match.round)bot.trcRoute={key,round:match.round,index:0};
  const plan=bot.trcRoute,points=map.traversal.routes[plan.key];
  while(plan.index<points.length-1&&Math.hypot(bot.x-points[plan.index].x,bot.z-points[plan.index].z,bot.y-points[plan.index].y)<.85)plan.index++;
  return points[plan.index];
}
function actorBodyHeight(actor){return 1.7-clamp(Number.isFinite(actor.crouch)?actor.crouch:0,0,1)*.55;}
function canStand(x,z,r=.34,feet=player.y,height=1.7) {
  const b=activeArenaBounds();
  if(x<b.minX+r||x>b.maxX-r||z<b.minZ+r||z>b.maxZ-r)return false;
  // Ground details under 2 cm are harmless; raised solids require feet above their real top.
  return !map.collision.blocked(x,z,r,feet,height);
}
function rampFloor(x,z,feet=Infinity) {
  let floor=null;
  for(const ramp of map.ramps||[]){
    // An upper staircase cannot stop movement on a separate floor underneath.
    if((ramp.base||0)>feet+.22)continue;
    if(x<ramp.minX||x>ramp.maxX||z<ramp.minZ||z>ramp.maxZ)continue;
    const along=ramp.axis==='x'?x:z,min=ramp.axis==='x'?ramp.minX:ramp.minZ,max=ramp.axis==='x'?ramp.maxX:ramp.maxZ;
    const fraction=clamp((along-min)/Math.max(.001,max-min),0,1);
    const f=ramp.direction===-1?1-fraction:fraction;
    const height=(ramp.base||0)+ramp.height*(ramp.steps?Math.min(ramp.steps,Math.ceil(Math.max(0,f-1e-7)*ramp.steps))/ramp.steps:f);
    floor=Math.max(floor??-Infinity,height);
  }
  return floor;
}
function moveEntity(entity,dx,dz,r=.34) {
  if(entity.trcLadder)return;
  // Substeps prevent sprint/dash from crossing thin cover at a low frame rate.
  const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.16));
  for(let i=0;i<n;i++){
    const area=(entity===player||entity.remoteId)&&!exploring&&match?.phase==='buy'?map.buyAreas?.[entity.team===match.attackerTeam?'attack':'defend']:null;
    const permitted=(x,z)=>buyAreaContains(area,x,z,r);
    function attempt(x,z){
      if(!permitted(x,z))return;
      const controlled=entity===player||!!entity.remoteId||!!map.traversal;
      let feet=entity.y||0;
      const ramp=controlled?rampFloor(x,z,feet):null;
      const followsFloor=entity===player||map.traversal?!entity.vy:!!entity.remoteId;
      // Grounded feet may step up; an airborne actor must clear the slope rather
      // than enter just below it and miss the downward landing intersection.
      if(ramp!==null&&ramp>feet+(followsFloor?.22:.00001))return;
      if(followsFloor){
        if(ramp!==null&&Math.abs(ramp-feet)<=.22)feet=ramp;
        // Only ankle-height ledges can be stepped onto; crates still require jumping.
        for(const c of map.collision.query(x,z,r))if(!c.disabled&&c.height>feet&&c.height<=entity.y+.22&&map.collision.overlaps(c,x,z,r))feet=c.height;
      }
      if(canStand(x,z,r,feet,actorBodyHeight(entity))&&grassHeadClear(entity,x,z,r,feet,actorBodyHeight(entity))){entity.x=x;entity.z=z;if(followsFloor)entity.y=feet;}
    }
    attempt(entity.x+dx/n,entity.z);
    attempt(entity.x,entity.z+dz/n);
  }
}
function visibleBetween(a,b) {
  if(a?.id&&Math.hypot(a.x-b.x,(a.y||0)-(b.y||0),a.z-b.z)>ordinarySkills.sightRange(a.id,elapsed))return false;
  const eye=entity=>(entity.y||0)+actorBodyHeight(entity)-.25;
  return !smokeBlocks(a,b)&&map.collision.rayClear(a.x,eye(a),a.z,b.x,eye(b),b.z)&&(!map.traffic||map.traffic.rayClear({x:a.x,y:eye(a),z:a.z},{x:b.x,y:eye(b),z:b.z},elapsed));
}
function safeDropPoint(entity=player){
  const forwardX=-Math.sin(entity.yaw||0),forwardZ=-Math.cos(entity.yaw||0),feet=map.id==='trc'?(entity.y||0):0;
  for(let distance=2;distance>=0;distance-=.2){
    const x=entity.x+forwardX*distance,z=entity.z+forwardZ*distance,y=getZoneFloor(x,z,feet+.05);
    if(navigation.isWalkable(x,z,y)&&map.collision.rayClear(entity.x,feet+.3,entity.z,x,y+.15,z))return {x,z,y};
  }
  const nearest=navigation.nearest(entity.x,entity.z,feet);
  return nearest&&Math.hypot(nearest.x-entity.x,nearest.z-entity.z)<3?nearest:{x:entity.x,z:entity.z,y:getZoneFloor(entity.x,entity.z,feet+.05)};
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
function shoot(shotTime=elapsed,alternate=false) {
  refillRangeAmmo();
  const spec=weapon();
  if(netHostPaused||mode!=='play'||!player.alive||renkoUnarmed(player)||busDriving()||carMotionActive(player)||match?.phase!=='live'||inventory.active==='spike'||interactionHeld||preparedSkillFX.throwing(elapsed)||ordinaryFX.throwing(elapsed)||nobiSkillFX.throwing(elapsed)||mendSkillFX.throwing(elapsed)||iagnuSkillFX.throwing(elapsed)||grassSkillFX.throwing(elapsed)||emberSkillFX.throwing(elapsed)||frostSkillFX.throwing(elapsed)||duelistSkillFX.throwing(elapsed)||player.serviceReload||reloading>0||shotTime-lastShot+1e-8<nobiShotInterval(spec,player))return;
  const ultimate=player.kit.knivesActive&&inventory.active==='knife',melee=inventory.active==='knife'&&!ultimate;
  if(alternate&&(!ultimate||isGuest()&&netActions.length>=64))return;
  const knifeCount=alternate?Math.min(DUELIST.knives,player.kit.knives):1;
  if(ultimate&&!player.kit.consumeKnife(knifeCount))return;
  if(!melee&&!ultimate&&player.ammo<=0){reload();return;}
  if(!melee&&!ultimate&&!rangeInfiniteResources()&&!ordinarySkills.capMagazine(player.id,elapsed))player.ammo--;if(!melee&&!ultimate)crownShot(player);shots++;rangeSession?.recordShot();lastShot=shotTime;kick=melee?.1:.035;shotSequence++;
  if(!ultimate)player.recoil=Math.min(.085,player.recoil+(spec.slot==='primary'?.012:.008));sound('shot');
  camera.position.set(player.x,1.7-player.crouch*.55+player.y,player.z);camera.rotation.set(player.pitch+renderedRecoil,player.yaw,0);
  camera.getWorldDirection(direction);
  if(alternate){
    if(isGuest())queueNetAction('fire',{yaw:player.yaw,pitch:player.pitch+renderedRecoil,ultimate:true,burst:true});
    fireKnifeBurst(player,camera.position,direction,knifeCount,{visualOnly:isGuest()});
    firing=false;aiming=false;updateHUD();return;
  }
  if(spec.arsenal){
    if(isGuest())queueNetAction('fire',{yaw:player.yaw,pitch:player.pitch+renderedRecoil,ultimate:false,ads:aiming===true});
    fireArsenal(player,camera.position,direction,spec,aiming,{visualOnly:isGuest()});
    if(spec.scope){sniperCycleAt=lastShot;setVisible('sniper-scope',false);}
    if(!spec.auto)firing=false;updateHUD();return;
  }
  const moving=Math.hypot(player.vx,player.vz)>1.2,steadyAir=steadyAirAim(player);
  const spread=ultimate||steadyAir?0:spec.spread*(aiming?.65:player.crouch>.5?.8:1)+carMovementSpread({airborne:!actorGrounded(player),moving,gyro:ordinarySkills.carGyro(player.id,elapsed)&&actorGrounded(player)})+Math.min(.04,Math.max(0,shotSequence-3)*.004);
  direction.x+=(Math.random()-.5)*spread;direction.y+=(Math.random()-.5)*spread;direction.normalize();
  if(!ultimate&&!steadyAir&&shotSequence>3)direction.x+=Math.sin(shotSequence*1.8)*.008;
  direction.normalize();if(!melee&&!ultimate)capDistortAim(player,direction);raycaster.set(camera.position,direction);raycaster.far=melee?2.2:120;
  if(isGuest())queueNetAction('fire',{yaw:player.yaw,pitch:player.pitch+renderedRecoil,ultimate});
  // A target can spawn between rendered frames, including while the trigger is held.
  botsGroup.updateMatrixWorld(true);
  const targets=raycaster.intersectObjects([environment,botsGroup],true).filter(h=>busSurfaceVisible(h)&&(!h.object.userData.bot||h.object.userData.bot.alive));
  const hit=targets[0],fake=!melee?raycastNopeDecoy(camera.position,direction,hit?.distance??120,player.team):null;
  const shield=!melee?ordinarySkills.interceptShield(camera.position,direction,fake?.distance??hit?.distance??120,spec.body||1,elapsed,match.round,{consume:!isGuest()}):null;
  const to=shield?new THREE.Vector3(shield.point.x,shield.point.y,shield.point.z):fake?.point||hit?.point||camera.position.clone().addScaledVector(direction,90);
  const muzzle=new THREE.Vector3();viewmodel.muzzle.getWorldPosition(muzzle);if(!melee)tracer(muzzle,to);
  if(shield){burst(to,'#f8dc72',4);}
  else if(fake){if(!isGuest())hitNopeDecoy(fake.event,player);}
  else if(hit){
    if(shootBusDriver(hit,player,shotZone(hit)==='head'?spec.head:spec.body,{visualOnly:isGuest()})){raycaster.far=190;updateHUD();return;}
    const bot=hit.object.userData.bot;
    if(bot&&bot.alive&&bot.team!==player.team&&!isGuest()){
      hits++;const head=shotZone(hit)==='head';let damage=nobiBulletDamage(player,bot,head?spec.head:shotZone(hit)==='leg'?spec.leg:spec.body,spec.head,!melee&&!ultimate);
      if(['phantom','spectre','ghost','classic'].includes(inventory.active)&&hit.distance>15)damage*=hit.distance>30?.8:.9;
      damageEntity(bot,damage,player,{firearm:!melee&&!ultimate,skill:ultimate?'duelist':null});hitFlash=.14;burst(hit.point,head?'#fff3c8':'#ff737e',5);if(melee||ultimate)sound('hit');
      if(rangeSession&&bot.rangeTarget)rangeSession.recordHit({head,eliminated:!bot.alive});
    }else if(hit.object.userData.rangeStart&&!melee){startRangeDrill();}
    else{burst(hit.point,'#f9ce9a',4);if(!melee&&!ultimate)capBounceShot(player,camera.position,direction,hit,spec);}
  }
  if(!melee&&!ultimate)urchinTridentShot(player,camera.position,direction,spec);
  if(!spec.auto)firing=false;
  raycaster.far=190;updateHUD();
}
// One alternate trigger spends a bounded stock once. Resolve all five rays before
// actor damage so a kill/refill cannot add knives to the same burst.
function fireKnifeBurst(actor,origin,aim,count,{visualOnly=false}={}){
  if(!Number.isSafeInteger(count)||count<1||count>DUELIST.knives)return;
  const forward=aim.clone().normalize(),right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
  const up=new THREE.Vector3().crossVectors(right,forward).normalize(),offsets=[[0,0],[-.045,0],[.045,0],[0,.045],[0,-.045]],totals=new Map();
  const muzzle=origin.clone();if(actor===player)viewmodel.muzzle.getWorldPosition(muzzle);
  let anyHit=false;botsGroup.updateMatrixWorld(true);
  for(const [x,y] of offsets.slice(0,count)){
    const dir=forward.clone().addScaledVector(right,x).addScaledVector(up,y).normalize(),ray=new THREE.Raycaster(origin,dir,0,120);
    let hit=ray.intersectObjects([environment,botsGroup],true).find(h=>busSurfaceVisible(h)&&h.object.userData.bot!==actor&&(!h.object.userData.bot||h.object.userData.bot.alive));
    let target=hit?.object.userData.bot,point=hit?.point,nearest=hit?.distance??120;
    if(actor!==player&&player.alive){const local=playerShotHit(ray);if(local&&local.distance<nearest){hit=local;target=player;point=local.point;nearest=local.distance;}}
    const fake=raycastNopeDecoy(origin,dir,nearest,actor.team),part=shotZone(hit);
    const shield=ordinarySkills.interceptShield(origin,dir,fake?.distance??nearest,BLADE.body,elapsed,match.round,{consume:!visualOnly});
    const end=shield?new THREE.Vector3(shield.point.x,shield.point.y,shield.point.z):fake?.point||point||origin.clone().addScaledVector(dir,90);
    tracer(muzzle,end,actor.team==='blue'?'#a5eee0':'#ff7b76',.07);
    if(shield){burst(end,'#f8dc72',2);continue;}
    if(fake){if(!visualOnly)hitNopeDecoy(fake.event,actor);continue;}
    if(shootBusDriver(hit,actor,part==='head'?BLADE.head:BLADE.body,{visualOnly}))continue;
    if(hit?.object.userData.rangeStart&&actor===player){if(!visualOnly)startRangeDrill();continue;}
    if(target?.alive&&target.team!==actor.team){
      const entry=totals.get(target)||{damage:0,head:false};entry.damage+=part==='head'?BLADE.head:part==='leg'?BLADE.leg:BLADE.body;entry.head||=part==='head';totals.set(target,entry);anyHit=true;
      burst(end,part==='head'?'#fff3c8':'#ff737e',2);
    }else if(hit)burst(end,'#f9ce9a',2);
  }
  if(!visualOnly)for(const [target,entry] of totals){damageEntity(target,entry.damage,actor,{firearm:false,skill:'duelist'});if(actor===player&&rangeSession&&target.rangeTarget)rangeSession.recordHit({head:entry.head,eliminated:!target.alive});}
  if(actor===player&&anyHit){hits++;hitFlash=.14;if(!visualOnly)sound('hit');}
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
  let anyHit=false,headHit=false,bounced=false,rangeStartHit=false;
  for(const offset of shotPattern(id,{ads,moving,airborne:!actorGrounded(actor),steadyAir:steadyAirAim(actor),sequence})){
    const dir=forward.clone().addScaledVector(right,offset.x).addScaledVector(up,offset.y).normalize();
    const ray=new THREE.Raycaster(origin,dir,0,120);
    let hit=ray.intersectObjects(targets,true).find(h=>busSurfaceVisible(h)&&h.object.userData.bot!==actor&&(!h.object.userData.bot||h.object.userData.bot.alive));
    let target=hit?.object.userData.bot,point=hit?.point,part=shotZone(hit),nearest=hit?.distance??120;
    if(actor!==player&&player.alive){const local=playerShotHit(ray);if(local&&local.distance<nearest){hit=local;target=player;point=local.point;part=shotZone(local);nearest=local.distance;}}
    const fake=raycastNopeDecoy(origin,dir,nearest,actor.team);
    const shield=ordinarySkills.interceptShield(origin,dir,fake?.distance??nearest,weaponDamage(id,'body',fake?.distance??nearest),elapsed,match.round,{consume:!visualOnly});
    const end=shield?new THREE.Vector3(shield.point.x,shield.point.y,shield.point.z):fake?.point||point||origin.clone().addScaledVector(dir,90);
    tracer(origin,end,actor.team==='blue'?'#a5eee0':'#ff7b76',.07);
    if(shield){burst(end,'#f8dc72',2);continue;}
    if(fake){if(!visualOnly)hitNopeDecoy(fake.event,actor);continue;}
    if(shootBusDriver(hit,actor,weaponDamage(id,shotZone(hit)==='head'?'head':'body',nearest),{visualOnly}))continue;
    if(hit?.object.userData.rangeStart&&actor===player&&!visualOnly){rangeStartHit=true;continue;}
    if(target?.alive&&target.team!==actor.team){
      const damage=nobiBulletDamage(actor,target,weaponDamage(id,part,nearest),weaponDamage(id,'head',nearest),true);
      totals.set(target,(totals.get(target)||0)+damage);anyHit=true;headHit||=part==='head';
      burst(end,part==='head'?'#fff3c8':'#ff737e',2);
    }else if(hit&&!visualOnly&&!bounced){capBounceShot(actor,origin,dir,hit,spec);bounced=true;}
  }
  // Apply one damage event per victim per cartridge, so kill awards, reflection
  // and chain reactions cannot multiply by pellet count.
  if(!visualOnly)for(const [target,damage] of totals){damageEntity(target,damage,actor,{firearm:true});if(actor===player&&rangeSession&&target.rangeTarget)rangeSession.recordHit({head:headHit,eliminated:!target.alive});}
  if(rangeStartHit)startRangeDrill();
  if(actor===player&&anyHit){hits++;hitFlash=.14;}
  if(!visualOnly)urchinTridentShot(actor,origin,forward,spec);
}
function reload(){
  if(rangeInfiniteResources()){refillRangeAmmo();return;}
  if(ordinarySkills.urchinJammed(player.id,elapsed))return;
  const spec=weapon();if(netHostPaused||mode!=='play'||!player.alive||renkoUnarmed(player)||busDriving()||carMotionActive(player)||interactionHeld||inventory.active==='spike'||!spec.mag||reloading||player.ammo===spec.mag||player.reserve<=0||player.serviceReload)return;
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
    const transparent=s.kind!=='veil';if(s.mesh.material.transparent!==transparent){s.mesh.material.transparent=transparent;s.mesh.material.needsUpdate=true;}s.mesh.material.opacity=transparent?.98:1;
  }
  if(!smokes.some(s=>s.kind==='smoke')&&smokeGeometry){smokeGeometry.dispose();smokeGeometry=null;}
  if(!smokes.some(s=>s.kind==='veil')&&veilGeometry){veilGeometry.dispose();veilGeometry=null;}
}
function updateSmokeAppearance(time){
  for(const s of smokes){s.mesh.rotation.y=time*.13;s.mesh.scale.setScalar(s.radius/3.6);const fade=clamp((s.expires-time)/.4,0,1);s.mesh.material.opacity=s.kind==='veil'?1:.98*fade;}
}
function activePollenFields(){return match?.phase==='live'?ordinarySkills.events(elapsed).filter(event=>event.type==='mend-pollen'&&elapsed>=event.triggerAt):[];}
function activeOrdinarySmokeFields(){return match?.phase==='live'?ordinarySkills.events(elapsed).filter(event=>['mend-pollen','veil-dust','frost-mist','duelist-comet'].includes(event.type)&&elapsed>=event.triggerAt):[];}
function smokeBlocks(a,b){const start=new THREE.Vector3(a.x,(a.y||0)+1.45,a.z),end=new THREE.Vector3(b.x,(b.y||0)+1.45,b.z),delta=end.clone().sub(start),length=delta.lengthSq();return [...smokes,...activeOrdinarySmokeFields()].some(s=>{const center=new THREE.Vector3(s.x,s.y,s.z),t=length?clamp(center.clone().sub(start).dot(delta)/length,0,1):0;return start.clone().addScaledVector(delta,t).distanceToSquared(center)<s.radius*s.radius;});}
function getZoneFloor(x,z,ceiling){
  let floor=map.floorBaseAt?.(x,z)??0;const ramp=rampFloor(x,z);if(ramp!==null&&ramp<=ceiling)floor=Math.max(floor,ramp);
  for(const collider of map.collision.query(x,z,0))if(!collider.disabled&&collider.height<=ceiling&&collider.height>floor&&map.collision.overlaps(collider,x,z,0))floor=collider.height;
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
function getZoneTarget(actor,point=null,aim=null,maxReach=20-1e-6){
  const input=netInputs.get(actor.remoteId)?.input;
  const yaw=aim?.yaw??(actor===player?player.yaw:Number.isFinite(input?.yaw)?input.yaw:actor.yaw||0);
  const pitch=aim?.pitch??(actor===player?player.pitch:clamp(Number(input?.pitch)||0,-1.35,1.35));
  const eye=(actor.y||0)+1.6,ground=getZoneFloor(actor.x,actor.z,eye);
  const reach=pitch<-.03?clamp((eye-ground)/-Math.tan(pitch),0,maxReach):maxReach;
  let dx=point&&Number.isFinite(point.x)?point.x-actor.x:-Math.sin(yaw)*reach;
  let dz=point&&Number.isFinite(point.z)?point.z-actor.z:-Math.cos(yaw)*reach;
  const length=Math.hypot(dx,dz);if(length>maxReach){dx*=maxReach/length;dz*=maxReach/length;}
  const steps=Math.max(1,Math.ceil(Math.min(length,maxReach)/.25));
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
  // Station ground is an implicit plane; TRC also has solid floors above its basement.
  if(dy<0)reach=Math.min(reach,Math.max(0,(origin.y-(map.minY??0)-.20)/-dy));
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
  let limit=type==='duck-pad'?DUCK_SKILLS.padRange:DUCK_SKILLS.shieldRange;if(dy<-.01)limit=Math.min(limit,Math.max(1,(origin.y-(actor.y||0))/-dy));
  for(let distance=limit;distance>=1;distance-=.4){
    const x=origin.x+dx*distance,z=origin.z+dz*distance,y=getZoneFloor(x,z,origin.y);
    if(Math.hypot(x-origin.x,y-origin.y,z-origin.z)>DUCK_SKILLS.shieldRange||ordinaryGroundHeight(x,z,y)===null||!map.collision.rayClear(origin.x,origin.y,origin.z,x,y+.15,z))continue;
    return type==='duck-pad'?{x,y,z}:{x,y,z,yaw:Math.atan2(-dx,-dz)};
  }return null;
}
function catEnemyTarget(actor,aim=null){
 if(ordinarySkills.blindUntil(actor.id,elapsed)>elapsed)return null;
 const input=netInputs.get(actor.remoteId)?.input,yaw=aim?.yaw??(actor===player?player.yaw:input?.yaw??actor.yaw??0),pitch=aim?.pitch??(actor===player?player.pitch:input?.pitch??0);
 if(!Number.isFinite(yaw)||!Number.isFinite(pitch))return null;
 const origin=new THREE.Vector3(actor.x,(actor.y||0)+1.7-(actor.crouch||0)*.55,actor.z),direction=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
 let best=null;for(const enemy of [player,...bots])if(enemy.alive&&enemy.team!==actor.team&&visibleBetween(actor,enemy)){
  const state=isGuest()?enemy.netTarget:null,w=state?.weapon||actorWeaponId(enemy),ammo=state?state.ammo:enemy===player?player.ammo:enemy.remoteId?enemy.netAmmo:enemy.aiAmmo;
  if(!WEAPONS[w]?.mag||!Number.isInteger(ammo)||ammo<=0||ammo>WEAPONS[w].mag||enemy===player&&reloading>0||(state?state.reloading:enemy.remoteId?enemy.netReload:enemy.aiReload)>0||(state?state.serviceReload:enemy.serviceReload))continue;
  const center=new THREE.Vector3(enemy.x,(enemy.y||0)+1.3-(enemy.crouch||0)*.55,enemy.z),offset=center.clone().sub(origin),along=offset.dot(direction);
  if(along<0||Math.hypot(enemy.x-actor.x,center.y-(actor.y||0),enemy.z-actor.z)>CAT_SKILLS.pluckRange||offset.addScaledVector(direction,-along).length()>.55)continue;
  if(!best||along<best.distance)best={enemy,weapon:w,ammo,distance:along,x:enemy.x,y:center.y,z:enemy.z,targetId:enemy.id};
 }return best;
}
function catDropVisible(actor,drop){return ordinarySkills.blindUntil(actor.id,elapsed)<=elapsed&&!smokeBlocks(actor,{x:drop.x,y:(drop.y||0)-1.25,z:drop.z})&&map.collision.rayClear(actor.x,(actor.y||0)+1.7-(actor.crouch||0)*.55,actor.z,drop.x,(drop.y||0)+.2,drop.z);}
function catDropTarget(actor,aim=null){
 if(ordinarySkills.blindUntil(actor.id,elapsed)>elapsed)return null;
 const input=netInputs.get(actor.remoteId)?.input,yaw=aim?.yaw??(actor===player?player.yaw:input?.yaw??actor.yaw??0),pitch=aim?.pitch??(actor===player?player.pitch:input?.pitch??0);
 if(!Number.isFinite(yaw)||!Number.isFinite(pitch))return null;
 const origin=new THREE.Vector3(actor.x,(actor.y||0)+1.7-(actor.crouch||0)*.55,actor.z),direction=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
 let best=null;for(const drop of droppedWeapons){const target=new THREE.Vector3(drop.x,(drop.y||0)+.2,drop.z),offset=target.clone().sub(origin),along=offset.dot(direction);if(along<0||Math.hypot(drop.x-actor.x,(actor.y||0)-(drop.y||0),drop.z-actor.z)>CAT_SKILLS.fetchRange||offset.addScaledVector(direction,-along).length()>.8||!catDropVisible(actor,drop))continue;if(!best||along<best.distance)best={drop,distance:along,x:drop.x,y:drop.y||0,z:drop.z};}return best;
}
function echoBotGlintPoint(bot,enemy,aim,actors){
 if(!enemy||!visibleBetween(bot,enemy))return null;
 const dist=Math.hypot(enemy.x-bot.x,enemy.z-bot.z);if(dist<1.5)return null;
 // Burst in front of the observed face, not directly below its eyes.
 const ratio=(dist-1.5)/dist,point=getSkillTarget(bot,'echo-glint',{x:bot.x+(enemy.x-bot.x)*ratio,z:bot.z+(enemy.z-bot.z)*ratio},aim);
 if(!point)return null;
 const event={type:'echo-glint',...point,radius:IAGNU_SKILLS.glintRadius},options={reachable:ordinaryReachable};
 if(!ordinarySkills.wouldBlind(ordinaryActorView(enemy),event,options))return null;
 // The caster will turn toward this enemy to shoot later in the same tick.
 if(ordinarySkills.wouldBlind({...ordinaryActorView(bot),yaw:aim.yaw,pitch:aim.pitch},event,options))return null;
 if(actors.some(ally=>ally!==bot&&ally.alive&&ally.team===bot.team&&ordinarySkills.wouldBlind(ordinaryActorView(ally),event,options)))return null;
 return point;
}
function nopeBotFlashPoint(bot,enemy,aim,actors){
 if(!enemy||!visibleBetween(bot,enemy))return null;
 const dist=Math.hypot(enemy.x-bot.x,enemy.z-bot.z);if(dist<1.5)return null;
 // Test the real lob in front of the visible face and the next firing view.
 const ratio=(dist-1.5)/dist,point=getSkillTarget(bot,'nope-flash',{x:bot.x+(enemy.x-bot.x)*ratio,z:bot.z+(enemy.z-bot.z)*ratio},aim);
 if(!point)return null;
 const event={type:'nope-flash',...point,radius:NOPE_SKILLS.flashRadius},options={reachable:ordinaryReachable};
 if(!ordinarySkills.wouldBlind(ordinaryActorView(enemy),event,options))return null;
 if(ordinarySkills.wouldBlind({...ordinaryActorView(bot),yaw:aim.yaw,pitch:aim.pitch},event,options))return null;
 if(actors.some(ally=>ally!==bot&&ally.alive&&ally.team===bot.team&&ordinarySkills.wouldBlind(ordinaryActorView(ally),event,options)))return null;
 return point;
}
function catBotFetchAim(bot){
 if(bot.aiReload>0||bot.serviceReload)return null;
 const active=WEAPONS[actorWeaponId(bot)];let best=null;
 for(const drop of droppedWeapons){
  const spec=WEAPONS[drop.weapon];if(!spec||drop.ammo<=0||!['primary','secondary'].includes(spec.slot)||active?.slot==='primary'&&spec.slot==='secondary')continue;
  const owned=bot.record?.[spec.slot],current=WEAPONS[owned];
  // Price is a conservative equipment-upgrade heuristic, not a combat score.
  // A same-gun swap must improve the loaded magazine without losing total ammo.
  if(current){
   if(owned===drop.weapon){const saved=actorWeaponId(bot)===owned?{ammo:bot.aiAmmo,reserve:bot.aiReserve}:bot.netStores?.[owned];if(!saved||!(drop.ammo>saved.ammo)||drop.ammo+drop.reserve<saved.ammo+saved.reserve)continue;}
   else if(spec.price<=current.price)continue;
  }
  const distance=Math.hypot(drop.x-bot.x,drop.z-bot.z),aim={yaw:Math.atan2(bot.x-drop.x,bot.z-drop.z),pitch:Math.atan2(.2-((bot.y||0)+1.7-(bot.crouch||0)*.55),distance)};
  // Use the real human target ray: a nearer drop can intercept this aim.
  if(catDropTarget(bot,aim)?.drop!==drop)continue;
  const score=spec.price+drop.ammo/spec.mag;
  if(!best||score>best.score||score===best.score&&(distance<best.distance||distance===best.distance&&drop.id<best.id))best={aim,score,distance,id:drop.id};
 }return best?.aim||null;
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
 if(ordinarySkills.blindUntil(actor.id,elapsed)>elapsed)return null;const d=carAim(actor,aim);if(!d)return null;
 const eye={x:actor.x,y:(actor.y||0)+1.7-(actor.crouch||0)*.55,z:actor.z},yaw=Math.atan2(-d.x,-d.z),pitch=Math.asin(d.y);
 // Same camera-local hand offset as the prepared gem, including vertical aim.
 const hand={x:eye.x+.24*Math.cos(yaw)-.17*Math.sin(yaw)*Math.sin(pitch)+.6*d.x,y:eye.y-.17*Math.cos(pitch)+.6*d.y,z:eye.z-.24*Math.sin(yaw)-.17*Math.cos(yaw)*Math.sin(pitch)+.6*d.z};
 const hit=cameraSweep(map.collision,activeArenaBounds(),eye,hand,ONNARA_SKILLS.orbRadius,map.traffic,elapsed),t=hit?Math.max(0,hit.fraction-.01):1;
 const x=eye.x+(hand.x-eye.x)*t,y=eye.y+(hand.y-eye.y)*t,z=eye.z+(hand.z-eye.z)*t;
 if(!map.collision.rayClear(x,y,z,x,y,z,ONNARA_SKILLS.orbRadius))return null;
 return{x,y,z,yaw,cameraVelocity:[d.x*ONNARA_SKILLS.orbSpeed,d.y*ONNARA_SKILLS.orbSpeed,d.z*ONNARA_SKILLS.orbSpeed]};
}
function activateOnnaraAbility(actor,key,{predict=false,aim=null}={}){
 if(netHostPaused||!actor?.alive||match?.phase!=='live'||actor.planting||actor.defusing||actor.serviceReload||!['c','q','e','x'].includes(key))return;
 const type={c:'onnara-jump',q:'onnara-orb',e:'onnara-hover',x:'onnara-chain'}[key];
 const target=key==='q'?onnaraOrbTarget(actor,aim):{x:actor.x,y:actor.y||0,z:actor.z};if(!target)return;
 if(key==='c'&&!actorGrounded(actor)||key==='e'&&actorGrounded(actor)||(key==='q'?ordinarySkills.events(elapsed).filter(e=>e.type===type&&e.sourceId===actor.id).length>=2:ordinarySkills.onnaraEvent(type,actor.id,elapsed)))return;
 if(key==='c'&&predict&&ordinarySkills.events(elapsed).length>=CHARACTER_SKILLS.maxEvents)return;
 const before=actor.kit.snapshot(),effect=actor.kit.activate(key,elapsed);if(!effect)return;
 if(!predict&&!ordinarySkills.cast(effect,ordinaryActorView(actor),target,elapsed,match.round)){actor.kit.restore(before);return;}
 if(key==='c'){actor.vy=ONNARA_SKILLS.jumpVelocity;actor.trcLadder=null;}
 if(actor===player)showSkillMessage('onnara',key,effect.type);return effect;
}
function confirmOnnaraSkill(key){
 if(netHostPaused||mode!=='play'||!player.alive||interactionHeld||objectivePractice)return;refillMapPracticeSkills();
 if(isGuest()&&netActions.length>=64)return;
 const aim={yaw:player.yaw,pitch:player.pitch},effect=activateAbility(player,key,{predict:isGuest(),aim});
 if(effect&&isGuest())queueNetAction('ability',{key,...aim});
 if(effect?.type==='onnara-jump'&&isGuest())player.onnaraJumpPending={round:match.round,team:player.team,seq:netActions.at(-1)?.seq};
 if(!effect)showMessage('発動できません','Cは地上／Eは空中で使用',2);
 refillMapPracticeSkills();updateHUD();
}
function starHoldClear(actor,event){return canStand(actor.x,actor.z,.34,event.y)&&getZoneFloor(actor.x,actor.z,event.y+.04)<event.y-.035;}
function onnaraAirAim(actor){
 const event=ordinarySkills.onnaraEvent?.('onnara-hover',actor?.id,elapsed);
 return !!(actor?.alive&&match?.phase==='live'&&event&&event.round===match.round&&event.team===actor.team&&!starHold.stopped(event.id)&&!actor.trcLadder&&!carMotionActive(actor)&&!busSeat(actor)&&Math.abs(actor.y-event.y)<1e-6&&Math.abs(actor.vy||0)<1e-6&&starHoldClear(actor,event));
}
function steadyAirAim(actor){return duckAirAim(actor)||onnaraAirAim(actor)||renkoSteadyAim(actor);}
function renkoSteadyAim(actor){return !!(actor?.alive&&actor.kit?.character==='renko'&&match?.phase==='live'&&!carMotionActive(actor)&&!busSeat(actor)&&renkoUltimateActive(actor));}
function applyStarHold(actor){
 const event=ordinarySkills.onnaraEvent?.('onnara-hover',actor.id,elapsed);if(!event||match?.phase!=='live')return false;
 const held=starHold.apply(actor,event,elapsed,starHoldClear);
 if(!held&&starHold.stopped(event.id))ordinarySkills.cancelOnnaraEvent(event.id,actor.id);return held;
}
function visibleOnnaraCameras(){
 if(match?.phase!=='live'||mode!=='play'||!player.alive||netHostPaused||document.hidden||ordinarySkills.blindUntil(player.id,elapsed)>elapsed||ordinarySkills.nearsightUntil(player.id,elapsed)>elapsed)return [];
 return ordinarySkills.events(elapsed).filter(e=>e.type==='onnara-orb'&&e.sourceId===player.id&&e.team===player.team&&e.endsAt>elapsed).slice(0,2).filter(e=>{const p=orbViewPose(e,elapsed);return ![...smokes,...activeOrdinarySmokeFields()].some(s=>(p.x-s.x)**2+(p.y-s.y)**2+(p.z-s.z)**2<s.radius*s.radius);});
}
function updateOnnaraReveal(){
 const cameras=visibleOnnaraCameras();onnaraReveal.update(bots.filter(a=>a.alive&&a.team!==player.team&&cameras.some(e=>orbSeesActor(e,a,elapsed,visibleBetween))));
}
function renderOnnaraOrb(){
 const cameras=visibleOnnaraCameras(),label=$('onnara-orb-label');
 if(label){label.hidden=!cameras.length;if(cameras.length)label.textContent=`星見の宝玉 · ${cameras.length}台 · ${Math.ceil(Math.max(...cameras.map(e=>e.endsAt))-elapsed)}秒 · 映る敵を透過表示`;}
 cameras.forEach((event,slot)=>onnaraOrbView.render(renderer,scene,event,{actors:bots,visible:visibleBetween,gun,hide:[onnaraSkillFX.group,preparedSkillFX.group,onnaraReveal.group],now:elapsed,slot}));
}
function urchinWeapon(actor){return actor===player?inventory.active:actor.remoteId?actor.netWeapon:actor.aiWeapon;}
function urchinCancelReload(actor){cancelServiceReload(actor);if(actor===player)reloading=0;else if(actor.remoteId)actor.netReload=0;else actor.aiReload=0;}
function urchinTarget(actor,key,aim=null){
 if(ordinarySkills.blindUntil(actor.id,elapsed)>elapsed)return null;
 const d=carAim(actor,aim);if(!d)return null;const range=key==='e'?URCHIN_SKILLS.gloomRange:key==='c'?URCHIN_SKILLS.lanceRange:URCHIN_SKILLS.disarmRange,origin={x:actor.x,y:(actor.y||0)+1.7-(actor.crouch||0)*.55,z:actor.z};
 if(key==='e')return {x:origin.x+d.x*range,y:origin.y+d.y*range,z:origin.z+d.z*range};
 if(key==='c'){const at=t=>({x:origin.x+d.x*t,y:origin.y+d.y*t,z:origin.z+d.z*t}),clear=t=>{const p=at(t);return map.collision.rayClear(origin.x,origin.y,origin.z,p.x,p.y,p.z);};let reach=range;
  if(!clear(reach)){let low=0,high=reach;for(let i=0;i<24;i++){const middle=(low+high)/2;if(clear(middle))low=middle;else high=middle;}reach=Math.max(0,low-.05);}
  return reach>=1?at(reach):null;
 }let best=null;
 for(const target of[player,...bots]){if(!target.alive||target===actor||target.team===actor.team||!visibleBetween(actor,target))continue;const v={x:target.x-origin.x,y:(target.y||0)+1.3-(target.crouch||0)*.55-origin.y,z:target.z-origin.z},along=v.x*d.x+v.y*d.y+v.z*d.z;if(along<0||Math.hypot(v.x,v.y,v.z)>range||Math.hypot(v.x-d.x*along,v.y-d.y*along,v.z-d.z*along)>.55)continue;if(!best||along<best.distance)best={x:target.x,y:target.y||0,z:target.z,targetId:target.id,actor:target,distance:along};}
 if(best&&key==='q'){const id=urchinWeapon(best.actor),r=best.actor===player?inventory:best.actor.record;if(WEAPONS[id]?.slot!=='primary'||!r||r[WEAPONS[id].slot]!==id||droppedWeapons.length>=32)return null;}
 return best;
}
function urchinGloomAllyInLane(actor,ally,aim){
 const d=carAim(actor,aim);if(!d)return true;const x=ally.x-actor.x,y=(ally.y||0)-(actor.y||0),z=ally.z-actor.z,along=x*d.x+y*d.y+z*d.z;
 return along>0&&along<URCHIN_SKILLS.gloomRange&&Math.hypot(x-d.x*along,y-d.y*along,z-d.z*along)<URCHIN_SKILLS.gloomRadius+.6;
}
function urchinDisarm(target){
 const id=urchinWeapon(target),slot=WEAPONS[id].slot,local=target===player,r=local?inventory:target.record;
 dropItem(id,target);urchinCancelReload(target);r[slot]=null;
 if(local){delete ammoStore[id];delete roundPurchases[slot];const next=inventory.secondary||inventory.primary||'knife';equip(next,true);}
 else{delete r.netPurchases?.[slot];if(target.netStores)delete target.netStores[id];const next=r.secondary||r.primary||'knife',spec=WEAPONS[next]||WEAPONS.knife,saved=target.netStores?.[next];target.netWeapon=target.aiWeapon=next;target.netAmmo=target.aiAmmo=saved?.ammo??spec.mag;target.netReserve=target.aiReserve=saved?.reserve??spec.reserve;target.netReload=target.aiReload=0;target.fire=.25;}
}
function activateUrchinAbility(actor,key,{predict=false,aim=null}={}){
 key=String(key).toLowerCase();if(netHostPaused||!actor?.alive||match?.phase!=='live'||actor.planting||actor.defusing||actor.serviceReload||!['c','q','e','x'].includes(key))return;
 const type={c:'urchin-lance',q:'urchin-disarm',e:'urchin-gloom',x:'urchin-trident'}[key];if(key==='x'&&ordinarySkills.urchinTrident(actor.id,elapsed))return;
 const target=['c','q','e'].includes(key)?urchinTarget(actor,key,aim):{x:actor.x,y:actor.y||0,z:actor.z};if(!target)return;
 const local=actor===player;
 const before=actor.kit.snapshot(),effect=actor.kit.activate(key,elapsed);if(!effect)return;
 if(!predict){const event=ordinarySkills.cast(effect,ordinaryActorView(actor),target,elapsed,match.round);if(!event){actor.kit.restore(before);return;}
  // C only commits a fixed telegraphed lane; its host tick resolves damage.
  if(key==='q')urchinDisarm(target.actor);
 }
 if(local)showSkillMessage('urchin',key,effect.type);return effect;
}
function confirmUrchinSkill(key){if(netHostPaused||mode!=='play'||!player.alive||interactionHeld||objectivePractice)return;refillMapPracticeSkills();const aim={yaw:player.yaw,pitch:player.pitch},effect=activateAbility(player,key,{predict:isGuest(),aim});if(effect&&isGuest())queueNetAction('ability',{key,...aim});if(!effect)showMessage('対象を確認','対象・視線・在庫を確認してください',2);refillMapPracticeSkills();updateHUD();}
function urchinTridentShot(actor,origin,incoming,spec){
 if(!ordinarySkills.urchinTrident?.(actor.id,elapsed)||!spec.mag)return [];
 botsGroup.updateMatrixWorld(true);const results=[];
 for(const side of[-1,1]){const aim=incoming.clone().normalize().applyAxisAngle(new THREE.Vector3(0,1,0),side*URCHIN_SKILLS.tridentAngle),from=origin.clone(),ray=new THREE.Raycaster(from,aim,0,URCHIN_SKILLS.tridentRange),all=ray.intersectObjects([environment,botsGroup],true).filter(h=>busSurfaceVisible(h)&&h.object.userData.bot!==actor&&(!h.object.userData.bot||h.object.userData.bot.alive));
  const hit=all[0];let resolvedHit=hit,target=hit?.object.userData.bot,point=hit?.point,head=shotZone(hit)==='head',nearest=hit?.distance??URCHIN_SKILLS.tridentRange;
  if(player!==actor&&player.alive){const local=playerShotHit(ray);if(local&&local.distance<nearest){target=player;point=local.point;head=shotZone(local)==='head';resolvedHit=local;nearest=local.distance;}}
  const fake=raycastNopeDecoy(from,aim,nearest,actor.team),shield=ordinarySkills.interceptShield(from,aim,fake?.distance??nearest,spec.body*URCHIN_SKILLS.tridentScale,elapsed,match.round,{consume:!isGuest()});
  if(shield){target=null;point=new THREE.Vector3(shield.point.x,shield.point.y,shield.point.z);}else if(fake){target=null;point=fake.point;if(!isGuest())hitNopeDecoy(fake.event,actor);}
  const end=point||from.clone().addScaledVector(aim,URCHIN_SKILLS.tridentRange);tracer(from,end,'#a9f1e4',.1);
  if(target?.alive&&target.team!==actor.team&&!isGuest()){let damage=nobiBulletDamage(actor,target,head?spec.head:shotZone(resolvedHit,point,target)==='leg'?spec.leg:spec.body,spec.head,true)*URCHIN_SKILLS.tridentScale;const id=urchinWeapon(actor);if(['phantom','spectre','ghost','classic'].includes(id)&&nearest>15)damage*=nearest>30?.8:.9;damageEntity(target,damage,actor,{firearm:true,chain:false,skill:'urchin'});burst(point,'#a9f1e4',3);}
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
 if(actor===player)showSkillMessage('cap',key,effect.type);return effect;
}
function confirmCapSkill(key){if(netHostPaused||mode!=='play'||!player.alive||interactionHeld||objectivePractice)return;refillMapPracticeSkills();const aim={yaw:player.yaw,pitch:player.pitch},effect=activateAbility(player,key,{predict:isGuest(),aim});if(effect&&isGuest())queueNetAction('ability',{key,...aim});if(!effect)showMessage('対象を確認','対象と妨害を確認してください',2);refillMapPracticeSkills();updateHUD();}
function capDistortAim(actor,aim){
 const sequence=actor===player?shotSequence:actor.shotSequence||1,offset=capShotOffset(sequence,ordinarySkills.capLocked(actor.id,elapsed));
 if(!offset.x&&!offset.y)return aim;
 const right=new THREE.Vector3().crossVectors(aim,new THREE.Vector3(0,1,0)).normalize(),up=new THREE.Vector3().crossVectors(right,aim).normalize();
 return aim.addScaledVector(right,offset.x).addScaledVector(up,offset.y).normalize();
}
function capBounceShot(actor,origin,incoming,hit,spec){
 if(!ordinarySkills.capBank(actor.id,elapsed)||!spec.mag)return null;
 let surface=hit,direction=incoming,remaining=CAP_SKILLS.bounceRange,result=null;
 botsGroup.updateMatrixWorld(true);
 for(let bounce=0;bounce<CAP_SKILLS.bounceCount;bounce++){
  const frame=capBounceFrame(THREE,direction,surface,remaining);if(!frame)break;
  const {aim,from}=frame;remaining=frame.remaining;
  const ray=new THREE.Raycaster(from,aim,.005,remaining),hits=ray.intersectObjects([environment,botsGroup],true).filter(h=>busSurfaceVisible(h)&&h.object.userData.bot!==actor&&(!h.object.userData.bot||h.object.userData.bot.alive));
  const next=hits[0];let resolvedHit=next,target=next?.object.userData.bot,point=next?.point,head=shotZone(next)==='head',nearest=next?.distance??remaining;
  if(player!==actor&&player.alive){const local=playerShotHit(ray);if(local&&local.distance<nearest){target=player;point=local.point;head=shotZone(local)==='head';resolvedHit=local;nearest=local.distance;}}
  const fake=raycastNopeDecoy(from,aim,nearest,actor.team),shield=ordinarySkills.interceptShield(from,aim,fake?.distance??nearest,spec.body*CAP_SKILLS.bounceScale,elapsed,match.round,{consume:!isGuest()});
  if(shield){target=null;point=new THREE.Vector3(shield.point.x,shield.point.y,shield.point.z);}else if(fake){target=null;point=fake.point;if(!isGuest())hitNopeDecoy(fake.event,actor);}
  const end=point||from.clone().addScaledVector(aim,remaining);tracer(surface.point,end,'#71e3ed',.12);
  result={targetId:target?.id||null,point:end,head,bounces:bounce+1};
  if(target?.alive&&target.team!==actor.team&&!isGuest()){let amount=nobiBulletDamage(actor,target,head?spec.head:shotZone(resolvedHit,point,target)==='leg'?spec.leg:spec.body,spec.head,true)*CAP_SKILLS.bounceScale;const weaponId=actor===player?inventory.active:actor.remoteId?actor.netWeapon:actor.aiWeapon;const distance=CAP_SKILLS.bounceRange-remaining+nearest;if(['phantom','spectre','ghost','classic'].includes(weaponId)&&distance>15)amount*=distance>30?.8:.9;damageEntity(target,amount,actor,{firearm:true,chain:false,skill:'cap'});burst(point,'#79e7ee',5);}
  if(shield||fake||target||!next)break;
  surface=next;direction=aim;
 }
 return result;
}

function getCapBankPreview(){
 if(mode!=='play'||match?.phase!=='live'||!player.alive||player.kit.character!=='cap'||!weapon().mag||netHostPaused||ordinarySkills.blindUntil(player.id,elapsed)>elapsed||!ordinarySkills.capBank(player.id,elapsed)){
  capPreviewUntil=-Infinity;capPreviewPath=null;return null;
 }
 if(elapsed<capPreviewUntil)return capPreviewPath;
 capPreviewUntil=elapsed+.05;
 const origin=new THREE.Vector3(player.x,(player.y||0)+1.7-player.crouch*.55,player.z),pitch=player.pitch+renderedRecoil;
 const aim=new THREE.Vector3(-Math.sin(player.yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(player.yaw)*Math.cos(pitch));
 const path=traceCapBankPreview(THREE,environment,origin,aim,{surfaceVisible:busSurfaceVisible}),eye=p=>({x:p.x,y:p.y-1.45,z:p.z});
 capPreviewPath=path&&!smokeBlocks(eye(origin),eye(path.start))&&path.segments.every(s=>!smokeBlocks(eye(s.start),eye(s.end)))?path:null;
 return capPreviewPath;
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
 Object.assign(actor,point,{hp:JAPAN_SKILLS.musterHP,armor:0,alive:true,vy:0,vx:0,vz:0,death:0,crouch:0,planting:false,defusing:false,dashTimer:0,dashVec:null,path:[],target:null,lastSeen:null,lastHeard:null,fire:.7});
 actor.kit.resetRound();actor.kit.smoke=0;actor.kit.updraft=0;actor.kit.dash=0;actor.kit.nextSignatureAt=actor.kit.character==='renko'?0:elapsed+signatureCooldown(actor.kit.character);actor.kit.armReadyAt=null;actor.kit.armExpiresAt=null;
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
  if(key==='q'){const amount=Math.min(JAPAN_SKILLS.levyAmount,target.enemy.armor,(JAPAN_SKILLS.armorCap-(actor.armor||0))/JAPAN_SKILLS.levyScale);target.enemy.armor-=amount;actor.armor=(actor.armor||0)+amount*JAPAN_SKILLS.levyScale;}
  if(key==='x')for(const entry of revive)japanRevive(entry.actor,entry.point);
 }
 if(actor===player)showSkillMessage('japan',key,effect.type);return effect;
}
function confirmJapanSkill(key){if(netHostPaused||mode!=='play'||!player.alive||interactionHeld||objectivePractice)return;refillMapPracticeSkills();const aim={yaw:player.yaw,pitch:player.pitch},effect=activateAbility(player,key,{predict:isGuest(),aim});if(effect&&isGuest())queueNetAction('ability',{key,...aim});if(!effect)showMessage('対象を確認','床や敵の装甲を確認してください',2);refillMapPracticeSkills();updateHUD();}

function activateNobiAbility(actor,key,{predict=false,aim=null,zonePoint=null}={}){
 key=String(key).toLowerCase();if(netHostPaused||!actor?.alive||match?.phase!=='live'||actor.planting||actor.defusing||actor.serviceReload||!['c','q','e','x'].includes(key))return;
 const definition=key==='x'?{type:'nobi-collar',name:CHARACTER_DEFS.nobi.ultName,description:CHARACTER_DEFS.nobi.description}:getCharacterSkill('nobi',key);const type=definition.type;if(ordinarySkills.events(elapsed).some(e=>e.sourceId===actor.id&&e.type===type&&['e','x'].includes(key)))return;
 const target=getSkillTarget(actor,type,zonePoint,aim);if(!target)return;
 const before=actor.kit.snapshot(),effect=actor.kit.activate(key,elapsed);if(!effect)return;
 if(!predict&&!ordinarySkills.cast(effect,ordinaryActorView(actor),target,elapsed,match.round)){actor.kit.restore(before);return;}
 actor.skillThrowUntil=elapsed+.32;if(actor===player){nobiSkillFX.playThrow(type,elapsed);firing=false;reloading=0;showSkillMessage('nobi',key,effect.type);}return effect;
}
function confirmNobiSkill(key){if(netHostPaused||mode!=='play'||!player.alive||interactionHeld||objectivePractice)return;refillMapPracticeSkills();const aim={yaw:player.yaw,pitch:player.pitch},effect=activateAbility(player,key,{predict:isGuest(),aim});if(effect&&isGuest())queueNetAction('ability',{key,...aim});if(!effect)showMessage('投げられません','着地点と在庫を確認してください',2);refillMapPracticeSkills();updateHUD();}
function nobiShotInterval(spec,actor){return spec.interval*(spec.mag>0?ordinarySkills.nobiInterval(actor.id,elapsed,actor,ordinaryReachable)*(ordinarySkills.urchinInterval?.(actor.id,elapsed)||1):1);}
function nobiBulletDamage(source,target,damage,headDamage,firearm=true){if(!firearm)return damage;return (ordinarySkills.nobiLegend(source.id,elapsed,source,ordinaryReachable)?Math.max(damage,headDamage):damage)*ordinarySkills.nobiVulnerability(target.id,elapsed,target,ordinaryReachable);}
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
  if(!actorGrounded(actor))continue;
  if(!best||along<best.distance)best={x:enemy.x,y:enemy.y||0,z:enemy.z,targetId:enemy.id,enemy,distance:along};
 }return best;
}
// Only the host starts collision/damage. Guests animate accepted markers, never hits.
function renkoEvent(actor,type){
 if(!actor?.alive||actor.kit?.character!=='renko'||match?.phase!=='live'||carMotionActive(actor)||busSeat(actor))return null;
 if(type==='renko-drive'&&renkoDriveStopping(actor))return null;
 const e=ordinarySkills.renkoEvent(type,actor.id,elapsed),p=actor.renkoPending;return e?.team===actor.team&&e.round===match.round?e:p?.event.type===type&&p.round===match.round&&p.team===actor.team&&p.event.endsAt>elapsed?p.event:null;
}
function renkoFlight(actor){if(actor===player&&actor.renkoJetHeld!==true)return null;return renkoEvent(actor,'renko-jet');}
// Both movement abilities stow equipment; derive from accepted/predicted events, never a client weapon flag.
function renkoUnarmed(actor){return !!(renkoFlight(actor)||renkoEvent(actor,'renko-drive'));}
function normalJumpVelocity(actor){return 6.552*(renkoEvent(actor,'renko-drive')?RENKO_SKILLS.driveJumpScale:1);}
function renkoSliding(actor){const s=actor?.renkoDrive;return !!(renkoEvent(actor,'renko-drive')&&s&&elapsed-s.slideAt>=0&&elapsed-s.slideAt<RENKO_SKILLS.slideDuration&&actorGrounded(actor));}
function renkoDartTarget(actor,aim){
 const d=carAim(actor,aim);if(!d)return null;const from={x:actor.x,y:(actor.y||0)+1.7-(actor.crouch||0)*.55,z:actor.z};
 // The world edge, rather than an ability range, ends an empty trajectory.
 const b=activeArenaBounds();let travel=Infinity;
 for(const[axis,min,max]of[['x',b.minX,b.maxX],['y',-1000,1000],['z',b.minZ,b.maxZ]]){
  if(Math.abs(d[axis])>1e-9)travel=Math.min(travel,((d[axis]>0?max:min)-from[axis])/d[axis]);
 }
 if(!Number.isFinite(travel)||travel<=1e-8)return null;
 return{x:Math.max(b.minX,Math.min(b.maxX,from.x+d.x*travel)),y:Math.max(-1000,Math.min(1000,from.y+d.y*travel)),z:Math.max(b.minZ,Math.min(b.maxZ,from.z+d.z*travel))};
}
function releaseRenkoJet(){player.renkoJetHeld=false;if(!isGuest())ordinarySkills.holdRenkoJet(player.id,elapsed,false);}
// Keep the predicted stop while older start snapshots arrive; the host ACK clears this action.
function renkoDriveStopping(actor){return actor===player&&isGuest()&&netActions.some(a=>a.round===match?.round&&a.type==='ability'&&a.key==='q'&&a.renkoStop===true);}
function stopRenkoDrive(actor,{predict=false}={}){
 if(!renkoEvent(actor,'renko-drive')||!predict&&!ordinarySkills.cancelRenkoDrive(actor.id,elapsed))return false;
 if(predict&&actor.renkoPending?.key==='q')actor.renkoPending=null;
 actor.renkoDrive=null;actor.vx=0;actor.vz=0;
 if(actor===player){firing=false;showMessage('オーバードライブ解除',renkoFlight(actor)?'飛行終了後に武器を持ち直します':'通常移動に戻りました',1.5);}return true;
}
function syncRenkoJets(){
 if(isGuest())return;
 for(const a of[player,...bots]){const data=netInputs.get(a.remoteId),held=a===player?a.renkoJetHeld===true:!!(data&&data.round===match.round&&elapsed-data.received<.8&&data.input.jet===true);
  const active=held&&a.alive&&a.kit?.character==='renko'&&match.phase==='live'&&!a.planting&&!a.defusing&&!carMotionActive(a)&&!busSeat(a);
  ordinarySkills.holdRenkoJet(a.id,elapsed,active);
 }
}
// The round/team binding is local context, never client input or extra wire data.
function renkoUltimateActive(actor){
 const scope=actor?.renkoUltimate,kit=actor?.kit;
 if(!kit?.renkoActive)return false;
 if(kit.character!=='renko'||!actor.alive||match?.phase!=='live'||scope?.round!==match.round||scope?.team!==actor.team){kit.renkoActive=false;actor.renkoUltimate=null;return false;}
 return true;
}
function bindRenkoUltimate(actor){
 if(actor?.kit?.renkoActive&&actor.alive&&match?.phase==='live')actor.renkoUltimate={round:match.round,team:actor.team};
 else{if(actor?.kit)actor.kit.renkoActive=false;if(actor)actor.renkoUltimate=null;}
}
function activateRenkoAbility(actor,key,{predict=false,aim=null}={}){
 key=String(key).toLowerCase();if(netHostPaused||!actor?.alive||match?.phase!=='live'||actor.planting||actor.defusing||actor.serviceReload||actor.trcLadder||actor.trafficLaunch||!['c','q','e','x'].includes(key))return;
 if(key==='x'){renkoUltimateActive(actor);const effect=actor.kit.activate(key,elapsed);if(effect){bindRenkoUltimate(actor);if(actor===player)showMessage('リスタートラッシュ','このラウンド、敵撃破ごとにC・Q・E全回復 · 死亡で終了',3);}return effect;}
 if(predict&&actor.renkoPending&&key!=='c')return;const type={c:'renko-dart',q:'renko-drive',e:'renko-jet'}[key];if(key!=='c'&&renkoEvent(actor,type)||key==='q'&&(!actorGrounded(actor)||renkoFlight(actor)))return;
 const target=key==='c'?renkoDartTarget(actor,aim):{x:actor.x,y:actor.y||0,z:actor.z};if(!target||ordinarySkills.events(elapsed).length>=CHARACTER_SKILLS.maxEvents)return;
 const before=actor.kit.snapshot(),effect=actor.kit.activate(key,elapsed);if(!effect)return;
 if(!predict&&!ordinarySkills.cast(effect,ordinaryActorView(actor),target,elapsed,match.round)){actor.kit.restore(before);return;}
 if(predict&&key!=='c')actor.renkoPending={key,round:match.round,team:actor.team,event:{id:'pending-renko-'+key,type,sourceId:actor.id,team:actor.team,x:actor.x,y:actor.y||0,z:actor.z,startedAt:elapsed,endsAt:elapsed+(key==='q'?RENKO_SKILLS.driveDuration:RENKO_SKILLS.flightDuration)}};
 if(key==='e'){actor.renkoJetHeld=true;actor.trcLadder=null;actor.vy=0;}if(key==='q'||key==='e'){actor.netReload=0;actor.aiReload=0;if(actor===player){aiming=false;reloading=0;kick=0;}}if(actor===player){if(key!=='c')firing=false;showSkillMessage('renko',key,effect.type);}return effect;
}
function confirmRenkoSkill(key){
 if(netHostPaused||mode!=='play'||!player.alive||interactionHeld||objectivePractice)return;
 if(key==='q'&&renkoDriveStopping(player))return;
 if(key==='q'&&renkoEvent(player,'renko-drive')){if(isGuest()&&netActions.length>=64)return;if(stopRenkoDrive(player,{predict:isGuest()})&&isGuest())queueNetAction('ability',{key:'q',renkoStop:true});updateHUD();return;}
 refillMapPracticeSkills();if(isGuest()&&netActions.length>=64)return;
 const aim={yaw:player.yaw,pitch:player.pitch},effect=activateAbility(player,key,{predict:isGuest(),aim});if(effect&&isGuest()){queueNetAction('ability',{key,...aim});if(player.renkoPending?.key===key)player.renkoPending.seq=netActions.at(-1)?.seq;}
 if(!effect)showMessage('発動できません',key==='x'?'7pt必要／発動中は撃破で補給':key==='c'?'在庫と封印を確認してください':'在庫と接地状態を確認してください',2);refillMapPracticeSkills();updateHUD();
}
function updateRenkoVertical(actor,dt,radius){
 const e=renkoFlight(actor);if(!e)return false;
 const velocity=renkoFlightVelocity(e,elapsed,{pitch:actor===player?player.pitch:actor.netPitch||0});
 const steps=Math.max(1,Math.ceil(dt*120)),step=dt/steps;actor.vy=velocity;
 for(let i=0;i<steps;i++){let next=actor.y+velocity*step;const height=actorBodyHeight(actor);let floor=map.floorBaseAt?.(actor.x,actor.z)??0,ceiling=Math.min(11,e.y+RENKO_SKILLS.flightHeight);const ramp=rampFloor(actor.x,actor.z,actor.y);if(ramp!==null&&ramp<=actor.y+.04)floor=ramp;
  for(const c of map.collision.query(actor.x,actor.z,radius)){if(c.disabled||!map.collision.overlaps(c,actor.x,actor.z,radius))continue;const underside=c.base||0;if(actor.y+height<=underside+.00001&&next+height>=underside)ceiling=Math.min(ceiling,underside-height);if(c.height<=actor.y+.00001)floor=Math.max(floor,c.height);}
  actor.y=Math.max(floor,Math.min(ceiling,next));if(actor.y!==next)actor.vy=0;
 }return true;
}
function carMotionActive(actor,now=elapsed){const m=actor?.carMotion,until=m?.endsAt+(m?.phase===2&&actor.alive?CAR_SKILLS.bumperStunTime-CAR_SKILLS.bumperLaunchTime:0);return !!(m&&m.round===match?.round&&m.team===actor.team&&now<until&&(match.phase==='live'&&(actor.alive||m.phase===2)||match.phase==='post'&&!actor.alive&&m.phase===2));}
function carStunUntil(actor){const m=actor?.carMotion;return carMotionActive(actor)&&m.phase!==1?(m.phase===2?m.endsAt+CAR_SKILLS.bumperStunTime-CAR_SKILLS.bumperLaunchTime:m.endsAt):0;}
function finishCarMotion(actor,m){
 // Contact starts the deadline: Tomika five seconds, Renko one second including the arc.
 const endsAt=m.phase===4?m.endsAt:m.endsAt+CAR_SKILLS.bumperStunTime-CAR_SKILLS.bumperLaunchTime;
 if([2,4].includes(m.phase)&&actor.alive&&m.round===match.round&&m.team===actor.team&&match.phase==='live'&&elapsed<endsAt){
  actor.carMotion={...m,phase:3,endsAt,vx:0,vz:0,lastAt:elapsed};actor.carImpulseUntil=endsAt;actor.vx=0;actor.vz=0;
 }else{actor.carMotion=null;actor.carImpulseUntil=0;}
}
function beginCarMotion(actor,m,targetId=null){
 actor.carMotion={...m,round:match.round,team:actor.team,targetId,lastAt:elapsed};actor.carImpulseUntil=m.endsAt;actor.carFallUntil=[2,4].includes(m.phase)?m.endsAt+1:0;actor.vx=0;actor.vz=0;actor.dashTimer=0;actor.vy=m.phase===4?RENKO_SKILLS.launchLift:m.phase===2?CAR_SKILLS.bumperLift:0;
 actor.path=[];actor.pathIndex=0;actor.planAt=0;cancelServiceReload(actor);actor.planting=false;actor.defusing=false;match.cancelPlant(actor.id);match.cancelDefuse(actor.id);
 if([2,4].includes(m.phase))actor.trcLadder=null;
 if(actor===player){clearCombatInput();interactionHeld=false;reloading=0;}
}
function carMotionMarker(value,now){
 if(Array.isArray(value)&&value.length===6&&value[1]===3&&/^skill-renko-dart-[1-9][0-9]{0,14}$/.test(value[0])){const[id,phase,endsAt,vx,vz,vy]=value;if(!value.slice(2).every(Number.isFinite)||endsAt<=now||endsAt>now+RENKO_SKILLS.launchDuration+.002||(vx!==0||vz!==0)||Math.abs(vy)>32)return null;return{id,phase,endsAt,vx,vz,vy,round:match.round};}
 if(Array.isArray(value)&&value.length===6&&value[1]===4){const[id,phase,endsAt,vx,vz,vy]=value;if(!/^skill-renko-dart-[1-9][0-9]{0,14}$/.test(id)||!value.slice(2).every(Number.isFinite)||endsAt<=now||endsAt>now+RENKO_SKILLS.launchDuration+.002||Math.abs(Math.hypot(vx,vz)-RENKO_SKILLS.launchSpeed)>.003||Math.abs(vy)>16)return null;return{id,phase,endsAt,vx,vz,vy,round:match.round};}
 if(!Array.isArray(value)||value.length!==6||!/^skill-car-bumper-[1-9][0-9]*$/.test(value[0])||![1,2,3].includes(value[1])||!value.slice(2).every(Number.isFinite))return null;
 if(value[1]===3){const[id,phase,endsAt,vx,vz,vy]=value;if(endsAt<=now||endsAt>now+CAR_SKILLS.bumperStunTime+.002||vx!==0||vz!==0||Math.abs(vy)>32)return null;return{id,phase,endsAt,vx,vz,vy,round:match.round};}
 const[id,phase,endsAt,vx,vz,vy]=value,speed=phase===1?CAR_SKILLS.bumperSpeed:CAR_SKILLS.bumperDistance/CAR_SKILLS.bumperLaunchTime;
 if(endsAt<=now||endsAt>now+(phase===1?CAR_SKILLS.bumperRange/CAR_SKILLS.bumperSpeed:CAR_SKILLS.bumperLaunchTime)+.002||Math.abs(Math.hypot(vx,vz)-speed)>.003||Math.abs(vy)>16)return null;
 return{id,phase,endsAt,vx,vz,vy,round:match.round};
}
function reconcileCarPose(self){
 const dx=self.x-player.x,dz=self.z-player.z,dy=self.y-player.y,scale=Math.min(.3,.6/Math.max(.001,Math.hypot(dx,dy,dz)));
 const y=player.y+dy*scale;
 if(canStand(player.x,player.z,.34,y)&&map.collision.rayClear(player.x,player.y+1,player.z,player.x,y+1,player.z))player.y=y;
 moveEntity(player,dx*scale,dz*scale);
 netPositionHistory.clear();netPositionCorrectionX=0;netPositionCorrectionZ=0;
}
function updateCarMotions(dt){
 for(const actor of[player,...bots]){
  const m=actor.carMotion;if(!m)continue;
  if(!carMotionActive(actor,Math.min(elapsed,m.lastAt??elapsed))){finishCarMotion(actor,m);continue;}
  if(isGuest()&&actor!==player)continue;
  if(m.phase===3){m.lastAt=elapsed;actor.vx=0;actor.vz=0;actor.moving=false;updateActorVertical(actor,dt,actor===player?.34:.4);actor.group?.position.set(actor.x,actor.y||0,actor.z);if(elapsed>=m.endsAt)finishCarMotion(actor,m);continue;}
  const duration=Math.max(0,Math.min(elapsed,m.endsAt)-(m.lastAt??elapsed-dt));m.lastAt=elapsed;const n=Math.max(1,Math.ceil(duration*60)),step=duration/n;
  for(let i=0;i<n;i++){
   const px=actor.x,pz=actor.z,py=actor.y||0,nx=px+m.vx*step,nz=pz+m.vz*step;
   if(m.phase===1){const floor=ordinaryGroundHeight(nx,nz,py);if(floor===null||Math.abs(floor-py)>.22){actor.carMotion=null;actor.carImpulseUntil=0;break;}actor.y=floor;}
   moveEntity(actor,m.vx*step,m.vz*step,actor===player?.34:.4);
   if([2,4].includes(m.phase))updateActorVertical(actor,step,actor===player?.34:.4);
   const blocked=Math.hypot(actor.x-nx,actor.z-nz)>.005;
   if(m.phase===1&&!isGuest()){
    const victim=[player,...bots].find(a=>a!==actor&&a.alive&&a.team!==actor.team&&Math.abs((a.y||0)-(actor.y||0))<1.8&&Math.hypot(a.x-actor.x,a.z-actor.z)<.9&&map.collision.rayClear(actor.x,(actor.y||0)+.8,actor.z,a.x,(a.y||0)+.8,a.z));
    if(victim){
     const speed=CAR_SKILLS.bumperDistance/CAR_SKILLS.bumperLaunchTime,scale=speed/CAR_SKILLS.bumperSpeed;
     actor.carMotion=null;actor.carImpulseUntil=0;
     beginCarMotion(victim,{id:m.id,phase:2,endsAt:elapsed+CAR_SKILLS.bumperLaunchTime,vx:m.vx*scale,vz:m.vz*scale});
     sound('vehicle-hit',{entity:victim});damageEntity(victim,CAR_SKILLS.bumperDamage,actor,{skill:'car'});burst(new THREE.Vector3(victim.x,(victim.y||0)+1,victim.z),'#ffe18c',18);break;
    }
   }
   if(blocked){finishCarMotion(actor,m);break;}
  }
  if(actor.carMotion===m&&elapsed>=m.endsAt)finishCarMotion(actor,m);
  actor.moving=actor.carMotion?.phase!==3;
  if(actor.group){actor.group.position.set(actor.x,actor.y||0,actor.z);if(!actor.alive){actor.group.visible=true;actor.death=Math.max(actor.death||0,m.endsAt-elapsed+.2);}}
 }
}
function carPitTargets(actor){return[player,...bots].filter(a=>a.alive&&a.team===actor.team&&a.kit&&Math.hypot(a.x-actor.x,(a.y||0)-(actor.y||0),a.z-actor.z)<=CAR_SKILLS.pitRange&&(a===actor||ordinarySkills.blindUntil(actor.id,elapsed)<=elapsed&&visibleBetween(actor,a))&&(a.kit.smoke<getCharacterSkill(a.kit.character,'c').max||a.kit.updraft<getCharacterSkill(a.kit.character,'q').max||a.kit.dash<1||a.kit.armExpiresAt!==null));}
function activateCarAbility(actor,key,{predict=false,aim=null}={}){
 key=String(key).toLowerCase();if(!['c','q','e','x'].includes(key)||netHostPaused||!actor?.alive||match?.phase!=='live'||actor.planting||actor.defusing||actor.serviceReload||actor.trafficLaunch||carMotionActive(actor))return;
 const targets=key==='x'?carPitTargets(actor):null;
 if(key==='x'&&!targets.length)return;
 if(key==='e'&&ordinarySkills.carGyro(actor.id,elapsed))return;
 const target=['c','q'].includes(key)?carSkillTarget(actor,key,aim):{x:actor.x,y:actor.y||0,z:actor.z};if(!target)return;
 const before=actor.kit.snapshot(),effect=actor.kit.activate(key,elapsed);if(!effect)return;
 const event=predict?null:ordinarySkills.cast(effect,ordinaryActorView(actor),target,elapsed,match.round);if(!predict&&!event){actor.kit.restore(before);return;}
 if(!predict&&key==='c'){
  const length=Math.hypot(target.x-actor.x,target.z-actor.z),speed=CAR_SKILLS.bumperSpeed;
  beginCarMotion(actor,{id:event.id,phase:1,endsAt:elapsed+length/speed,vx:(target.x-actor.x)/length*speed,vz:(target.z-actor.z)/length*speed},event.targetId);
 }
 if(!predict&&key==='q'){
  const field=target.field,removed=typeof field.id==='string'?ordinarySkills.disperseSmoke(event.id,field.id,elapsed,match.round):smokes.some(s=>s.id===field.id);
  if(!removed){ordinarySkills.cancelCarEvent(event.id);actor.kit.restore(before);return;}
  if(typeof field.id!=='string')syncSmokes(serializeSmokes().filter(s=>s.id!==field.id));
 }
 if(!predict&&key==='x')for(const ally of targets){ally.kit.smoke=getCharacterSkill(ally.kit.character,'c').max;ally.kit.updraft=getCharacterSkill(ally.kit.character,'q').max;ally.kit.dash=1;ally.kit.nextSignatureAt=0;ally.kit.dashKills=0;ally.kit.armReadyAt=null;ally.kit.armExpiresAt=null;}
 if(actor===player)showSkillMessage('car',key,effect.type);
 return effect;
}
function confirmCarSkill(key){
 if(netHostPaused||mode!=='play'||!player.alive||interactionHeld||objectivePractice)return;
 refillMapPracticeSkills();const aim={yaw:player.yaw,pitch:player.pitch},effect=activateAbility(player,key,{predict:isGuest(),aim});if(effect&&isGuest())queueNetAction('ability',{key,...aim});
 if(!effect)showMessage('発動できません',key==='c'?'地上の見える敵を狙ってください':'見える煙幕を狙ってください',2);
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
  if(actor===player)showSkillMessage('cat','c','cat-return');return{type:'cat-return'};
 }
 if(key==='c'){if(!actorGrounded(actor))return;target={x:actor.x,y:actor.y||0,z:actor.z};}
 if(key==='q'){target=catEnemyTarget(actor,aim);if(!target)return;}
 if(key==='e'){target=catDropTarget(actor,aim);if(!target)return;}
 if(key==='x')target={x:actor.x,y:actor.y||0,z:actor.z};
 const effect=actor.kit.activate(key,elapsed);if(!effect)return;
 const event=predict?null:ordinarySkills.cast(effect,view,target,elapsed,match.round);if(!predict&&!event){actor.kit.restore(before);return;}
 if(!predict&&key==='q'){
  const victim=target.enemy,removed=Math.min(target.ammo,CAT_SKILLS.pluckAmmo),remaining=target.ammo-removed;
  if(victim===player){player.ammo=remaining;ammoStore[inventory.active]={ammo:remaining,reserve:player.reserve};showMessage('ひげの弾裂き','装填弾が破裂しました · 予備弾は残っています',1.5);}
  else{if(victim.remoteId)victim.netAmmo=remaining;else victim.aiAmmo=remaining;if(victim.netStores?.[target.weapon])victim.netStores[target.weapon].ammo=remaining;}
  damageEntity(victim,removed*CAT_SKILLS.pluckDamagePerRound,actor,{skill:'cat'});
 }
 if(!predict&&key==='e'&&!pickupDroppedWeapon(actor,target.drop.id,{catFetch:true})){ordinarySkills.cancelCatEvent(event.id);actor.kit.restore(before);return;}
 if(actor===player)showSkillMessage('cat',key,effect.type);
 return effect;
}
function confirmCatSkill(key){
 if(netHostPaused||mode!=='play'||!player.alive||interactionHeld||objectivePractice)return;
 refillMapPracticeSkills();const aim={yaw:player.yaw,pitch:player.pitch},effect=activateAbility(player,key,{predict:isGuest(),aim});
 if(effect&&isGuest())queueNetAction('ability',{key,...aim});
 if(!effect)showMessage('発動できません',key==='q'?'装填した銃を持つ敵を狙ってください':'見える落ちた銃を狙ってください',2);
 refillMapPracticeSkills();updateHUD();
}

function activateDuckEgg(actor,{predict=false}={}){
  if(netHostPaused||!actor?.alive||match?.phase!=='live'||actor.planting||actor.defusing||actor.serviceReload)return;
  const before=actor.kit.snapshot(),effect=actor.kit.activate('x',elapsed);if(!effect)return;
  if(!predict&&!ordinarySkills.cast(effect,ordinaryActorView(actor),{x:actor.x,y:actor.y||0,z:actor.z},elapsed,match.round)){actor.kit.restore(before);return;}
  if(actor===player)showMessage('不屈の卵','8秒間、致死攻撃を2回までHP1で耐える',2);return effect;
}
// Only static, walkable floors are targetable. Never trust a guest-supplied height.
function veilSmokeFloor(point){
 if(!point||![point.x,point.y,point.z].every(Number.isFinite))return null;
 const floor=ordinaryGroundHeight(point.x,point.z,point.y);
 return floor!==null&&Math.abs(floor-point.y)<.01?floor:null;
}
function veilSmokeFloors(x,z){
 const candidates=[map.floorBaseAt?.(x,z)??0,rampFloor(x,z)];
 for(const c of map.collision.query(x,z,0))if(!c.disabled&&map.collision.overlaps(c,x,z,0))candidates.push(c.height);
 return [...new Set(candidates.filter(Number.isFinite))].filter(y=>veilSmokeFloor({x,y,z})!==null).sort((a,b)=>a-b);
}
function veilSmokeDefaultFloor(x,z,floors=veilSmokeFloors(x,z)){
 const base=map.floorBaseAt?.(x,z)??0,preferred=floors.filter(y=>y<=base+VEIL_SKILLS.mapFloorHeight);
 return preferred.length?preferred[preferred.length-1]:null;
}
function refreshVeilFloorOptions(){
 const point=veilPlacement?.point||veilPlacement?.candidate,select=$('veil-smoke-floor');select.replaceChildren();
 if(point)for(const y of veilSmokeFloors(point.x,point.z)){const option=document.createElement('option');option.value=String(y);option.textContent=`高さ ${y.toFixed(1)}m`;select.append(option);}
 select.value=veilPlacement?.point?String(veilPlacement.point.y):'';
}
function clearVeilPlacement(){veilPlacement=null;setVisible('veil-smoke-placement',false);$('map-overlay').classList.remove('smoke-placement-active');}
function veilPlacementCurrent(){return !!veilPlacement&&mode==='map'&&player.alive&&player.kit?.character==='veil'&&player.team===veilPlacement.team&&match?.round===veilPlacement.round&&match?.phase==='live'&&!netHostPaused;}
function openVeilPlacement(key){
 if(mode!=='play'||!player.alive||match?.phase!=='live'||netHostPaused||interactionHeld||objectivePractice||carMotionActive(player)||busSeat())return;
 refillMapPracticeSkills();pauseGame(true);
 veilPlacement={key,team:player.team,round:match.round,point:null,candidate:null,points:[]};
 $('map-overlay').classList.add('smoke-placement-active');
 setVisible('veil-smoke-placement',true);
 $('veil-smoke-title').textContent=key==='c'?'C 土煙 / 最大3地点同時・半径3.5m・7秒':'X ブラックアウトドーム / 半径9m・12秒';
 $('veil-smoke-help').textContent=key==='c'?'左クリックで最大3地点を追加 → 右クリックでまとめて設置':'左クリックで場所を選択 → 右クリックで設置';
 setVisible('veil-smoke-multi',key==='c');refreshVeilFloorOptions();
 refreshVeilPlacement();
}
function refreshVeilPlacement(message=null){
 if(!veilPlacement)return;
 const point=veilPlacement.point,points=veilPlacement.points,valid=points.length&&points.every(p=>veilSmokeFloor(p)!==null);
 $('veil-smoke-confirm').disabled=!valid;
 $('veil-smoke-floor').disabled=!point&&!veilPlacement.candidate;
 const select=$('veil-smoke-index');select.replaceChildren();for(let i=0;i<points.length;i++){const option=document.createElement('option');option.value=String(i);option.textContent=`${i+1}: 高さ ${points[i].y.toFixed(1)}m`;select.append(option);}select.value=String(points.indexOf(point));select.disabled=!points.length;$('veil-smoke-remove').disabled=!point;
 $('veil-smoke-confirm').textContent=veilPlacement.key==='c'?`${points.length}個まとめて設置`:'ここに設置';
 $('veil-smoke-status').textContent=message||(valid?`${points.length}地点を選択済み${point?` · X ${point.x.toFixed(1)} / Z ${point.z.toFixed(1)} / 高さ ${point.y.toFixed(1)}m`:''} → 右クリックで設置`:'マップを左クリックして設置する床を選択');
 drawMinimap($('large-minimap'),true);
}
function veilMapPointer(event){
 if(!veilPlacementCurrent())return;
 event.preventDefault();
 if(event.button===2){confirmVeilPlacement();return;}
 if(event.button!==0)return;
 const canvas=$('large-minimap'),rect=canvas.getBoundingClientRect();
 const ratio=Math.min(rect.width/canvas.width,rect.height/canvas.height);
 if(!(ratio>0))return;
 const u=(event.clientX-rect.left-(rect.width-canvas.width*ratio)/2)/ratio;
 const v=(event.clientY-rect.top-(rect.height-canvas.height*ratio)/2)/ratio;
 const b=activeArenaBounds(),scale=Math.min((canvas.width-80)/(b.maxX-b.minX),(canvas.height-80)/(b.maxZ-b.minZ));
 const x=b.minX+(u-(canvas.width-(b.maxX-b.minX)*scale)/2)/scale;
 const z=b.minZ+(v-(canvas.height-(b.maxZ-b.minZ)*scale)/2)/scale;
 const floors=veilSmokeFloors(x,z),existing=veilPlacement.points.find(p=>Math.hypot(p.x-x,p.z-z)<.25);
 if(existing){veilPlacement.point=existing;veilPlacement.candidate=null;refreshVeilFloorOptions();refreshVeilPlacement();return;}
 const limit=veilPlacement.key==='c'?Math.min(VEIL_SKILLS.dustMax,player.kit.smoke):1;
 if(veilPlacement.key==='c'&&veilPlacement.points.length>=limit){refreshVeilPlacement('所持数まで選択済みです · 地点を削除して選び直せます');return;}
 const y=veilSmokeDefaultFloor(x,z,floors);veilPlacement.point=null;veilPlacement.candidate=floors.length?{x,z}:null;if(veilPlacement.key==='x')veilPlacement.points=[];
 if(y!==null){const point={x,y,z};if(veilPlacement.key==='x')veilPlacement.points=[];veilPlacement.points.push(point);veilPlacement.point=point;veilPlacement.candidate=null;}
 refreshVeilFloorOptions();refreshVeilPlacement(!floors.length?'設置できる床がありません · 別の地点を選んでください':y===null?'屋根より下の床がありません · 別の地点か高さを選んでください':null);
}
function confirmVeilPlacement(){
 if(!veilPlacementCurrent()||!veilPlacement.points.length)return;
 if(isGuest()&&netActions.length>=64){refreshVeilPlacement('通信待ちです · 回数は消費していません');return;}
 const {key,points}=veilPlacement,point=points[0];
 if(points.some(p=>veilSmokeFloor(p)===null)){refreshVeilPlacement('設置する床が変わりました · 地点を選び直してください');return;}
 const effect=activateAbility(player,key,{predict:isGuest(),...(key==='c'?{zonePoints:points}:{zonePoint:point})});
 if(!effect){refreshVeilPlacement('発動できません · 床・在庫・接地・封印状態を確認してください');return;}
 if(isGuest())queueNetAction('ability',{key,...(key==='c'?{smokePoints:points.map(p=>[p.x,p.y,p.z])}:{smokePoint:[point.x,point.y,point.z]})});
 resumeGame();refillMapPracticeSkills();updateHUD();
}

function getSkillTarget(actor,type,point=null,aim=null){
  if(type.startsWith('duck-'))return getDuckTarget(actor,type,aim);
  if(type==='duelist-comet')return getCometTarget(actor,point,aim);
  if(type==='duelist-lift')return{x:actor.x,y:actor.y||0,z:actor.z};
  if(type==='frost-unravel')return actorGrounded(actor)?{x:actor.x,y:actor.y||0,z:actor.z}:null;
  if(type==='ember-shade'||type==='ember-service')return{x:actor.x,y:actor.y||0,z:actor.z,...(type==='ember-service'?{weaponId:actorWeaponId(actor)}:{})};
  if(type==='echo-kerning')return{x:actor.x,y:actor.y||0,z:actor.z};
  if(type.startsWith('veil-')&&type!=='veil-root-seed'){
    if(!actorGrounded(actor))return null;
    if(type==='veil-roots')return getRootsTarget(actor,point,aim);
    if(type==='veil-dust'&&point){const floor=veilSmokeFloor(point);return floor===null?null:{x:point.x,y:floor+VEIL_SKILLS.dustCenterOffset,z:point.z};}
    return{x:actor.x,y:actor.y+(type==='veil-dust'?VEIL_SKILLS.dustCenterOffset:0),z:actor.z};
  }
  const nobiRange={'nobi-bell':NOBI_SKILLS.tagRange,'nobi-whisker':NOBI_SKILLS.brakeRange,'nobi-toolbox':NOBI_SKILLS.toolRange,'nobi-collar':NOBI_SKILLS.legendRange}[type];
  const target=getZoneTarget(actor,point,aim,nobiRange|| (type==='nope-bottle'?NOPE_SKILLS.bottleRange:20-1e-6)),limit=nobiRange||(type==='nope-bottle'?NOPE_SKILLS.bottleRange:type==='nope-decoy'?6:type==='echo-tag'?IAGNU_SKILLS.tagRange:type==='ember-solder'?EMBER_SKILLS.solderRange:type==='frost-stitch'?FROST_SKILLS.stitchRange:type==='frost-mist'?FROST_SKILLS.mistRange:20);
  let dx=target.x-actor.x,dz=target.z-actor.z,length=Math.hypot(dx,dz);
  if(length>limit){dx*=limit/length;dz*=limit/length;length=limit;}
  const eye=(actor.y||0)+1.7-clamp(actor.crouch||0,0,1)*.55;
  const flight=type==='veil-root-seed'?VEIL_SKILLS.rootsThrowFlight:nobiRange?NOBI_SKILLS.throwFlight:type==='nope-bottle'?NOPE_SKILLS.bottleFlight:type==='mend-seeds'?MEND_SKILLS.seedsFlight:type==='nope-flash'?NOPE_SKILLS.flashFlight:type==='mend-pollen'?MEND_SKILLS.pollenFlight:type==='echo-tag'?IAGNU_SKILLS.tagFlight:type==='echo-glint'?IAGNU_SKILLS.glintFlight:type==='ember-solder'?EMBER_SKILLS.solderFlight:type==='frost-stitch'?FROST_SKILLS.stitchFlight:type==='frost-mist'?FROST_SKILLS.mistFlight:0;
  // Check the same arc that will be drawn, including ceilings and stair landings.
  for(let step=Math.max(1,Math.ceil(length/.4));step>=0;step--){
    const ratio=step/Math.max(1,Math.ceil(length/.4)),x=actor.x+dx*ratio,z=actor.z+dz*ratio;
    const floor=getZoneFloor(x,z,eye),y=floor+(type==='nope-flash'||type==='echo-glint'?1.6:type==='mend-pollen'?1.7:type==='frost-mist'?FROST_SKILLS.mistCenterOffset:type==='frost-stitch'?FROST_SKILLS.stitchGroundOffset:(nobiRange||['nope-bottle','mend-seeds','echo-tag','ember-solder','veil-root-seed'].includes(type))?.12:0);
    if(!canStand(x,z,.12,floor))continue;
    if(type.startsWith('frost-')&&(ordinaryGroundHeight(x,z,floor)===null||!map.collision.rayClear(actor.x,eye,actor.z,x,floor+.12,z)))continue;
    if(type==='nope-decoy'){
      if(map.collision.rayClear(actor.x,eye,actor.z,x,y+1.4,z))return{x,y,z,...decoyWalkPath({x,y,z},Math.atan2(dx,dz))};
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
function activateAbility(actor,key,options={}){
 const effect=applyAbility(actor,key,options);if(effect&&actor===player)preparedSkillFX.release(effect.type,elapsed,player.id,match.round);return effect;
}
function applyAbility(actor,key,{predict=false,zonePoint=null,zonePoints=null,aim=null}={}){
  if(zonePoints!==null&&!(actor?.kit?.character==='veil'&&key==='c'))return;
  if(carMotionActive(actor)||busSeat(actor))return;
  if(ordinarySkills.sealUntil(actor?.id,elapsed)>elapsed){if(actor===player)showMessage('羽根の封印', '封印中は新しい技を使えません',1);return;}
  if(actor?.kit?.character==='renko')return activateRenkoAbility(actor,key,{predict,aim});
  if(actor?.kit?.character==='onnara')return activateOnnaraAbility(actor,key,{predict,aim});
  if(actor?.kit?.character==='urchin')return activateUrchinAbility(actor,key,{predict,aim});
  if(actor?.kit?.character==='cap')return activateCapAbility(actor,key,{predict,aim});
 if(actor?.kit?.character==='japan')return activateJapanAbility(actor,key,{predict,aim});
  if(actor?.kit?.character==='nobi')return activateNobiAbility(actor,key,{predict,aim,zonePoint});
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
  const veilBatch=zonePoints!==null;
  if(veilBatch&&(!Array.isArray(zonePoints)||zonePoints.length<1||zonePoints.length>VEIL_SKILLS.dustMax||zonePoints.length>actor.kit.smoke||zonePoints.some(p=>veilSmokeFloor(p)===null)||new Set(zonePoints.map(p=>`${p.x}/${p.y}/${p.z}`)).size!==zonePoints.length))return;
  const targets=veilBatch?zonePoints.map(p=>getSkillTarget(actor,definition.type,p,aim)):null;
  if(veilBatch&&targets.some(p=>!p))return;
  const target=veilBatch?targets[0]:healing?{x:healTarget.x,y:healTarget.y||0,z:healTarget.z,targetId:healTarget.id}:ordinary?getSkillTarget(actor,definition.type,zonePoint,aim):null;
  if(ordinary&&!target){if(actor===player&&(definition.type.startsWith('veil-')||definition.type.startsWith('frost-')))showMessage(`${definition.name} / 床を確認`,definition.type==='veil-root-seed'?'見える床を狙ってください':definition.type==='veil-roots'?'根を伸ばせる床が必要です':definition.type==='frost-unravel'?'着地してから使ってください':definition.type.startsWith('frost-')?'見える床を狙ってください':'着地してから使ってください',1.5);return;}
  const veilDome=actor.kit.character==='veil'&&String(key).toLowerCase()==='x';
  const domeFloor=veilDome&&zonePoint?veilSmokeFloor(zonePoint):null;
  if(veilDome&&zonePoint&&domeFloor===null)return;
  const takeover=String(key).toLowerCase().replace(/^key/,'')==='x'&&actor.kit.character==='nope';
  const takeoverPoints=takeover&&!predict?chooseNopeDecoyPoints(actor):null;
  if(takeover&&!predict&&takeoverPoints.length!==30)return;
  const before=ordinary||takeover?actor.kit.snapshot():null;
  const effect=actor.kit.activate(key,elapsed);if(!effect)return;
  if(veilBatch)for(let i=1;i<targets.length;i++)if(!actor.kit.activate(key,elapsed)){actor.kit.restore(before);return;}
  const yaw=aim?.yaw??(actor===player?player.yaw:(netInputs.get(actor.remoteId)?.input?.yaw??actor.yaw??0)),pitch=aim?.pitch??(actor===player?player.pitch:(netInputs.get(actor.remoteId)?.input?.pitch??0));
  if(ordinary){
    const event=predict?null:veilBatch?ordinarySkills.castVeilDustBatch(ordinaryActorView(actor),targets,elapsed,match.round):ordinarySkills.cast(effect,ordinaryActorView(actor),target,elapsed,match.round);
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
  if(effect.type==='smoke'&&!predict){const origin=new THREE.Vector3(actor.x,(actor.y||0)+1.6,actor.z),aim=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));raycaster.set(origin,aim);raycaster.far=16;const hit=raycaster.intersectObject(environment,true)[0],end=origin.clone().addScaledVector(aim,hit?Math.max(.8,hit.distance-1):16);end.y=Math.max(getZoneFloor(end.x,end.z,origin.y)+1.7,end.y);syncSmokes([...serializeSmokes().slice(-19),{id:++smokeSequence,x:end.x,y:end.y,z:end.z,expires:elapsed+effect.duration,kind:'smoke',radius:3.6}]);raycaster.far=190;}
  if(effect.type==='veil'&&!predict)syncSmokes([...serializeSmokes().slice(-19),{id:++smokeSequence,x:zonePoint?.x??actor.x,y:(domeFloor??actor.y??0)+1.7,z:zonePoint?.z??actor.z,expires:elapsed+effect.duration,kind:'veil',radius:effect.radius}]);
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
  if(ordinary){if((!effect.type.startsWith('veil-')||effect.type==='veil-root-seed')&&!['mend-heal','nope-decoy','echo-kerning','ember-shade','ember-service','frost-unravel','duelist-lift','duck-hush'].includes(effect.type))sound('skill-throw',{entity:actor,localOnly:true});}
  else if(effect.type!=='nope')sound({mend:'heal',recon:'recon',veil:'veil',ember:'ember-warning'}[effect.type]||effect.type,{entity:actor});
  if(actor===player)showSkillMessage(actor.kit.character,key,effect.type);

  return effect;
}
function rangeInfiniteResources(){return !!rangeSession&&exploring&&!onlinePlaying&&player.alive;}
function refillRangeAmmo(){
  if(!rangeInfiniteResources())return;
  const spec=weapon();if(!spec.mag)return;
  player.ammo=spec.mag;player.reserve=spec.reserve;reloading=0;
}
function refillMapPracticeSkills(){
  if(!exploring||objectivePractice||onlinePlaying||!player.alive)return;
  const kit=player.kit;if(!kit)return;
  kit.smoke=getCharacterSkill(kit.character,'c').max;kit.updraft=getCharacterSkill(kit.character,'q').max;
  if(kit.armExpiresAt===null&&!(player.dashTimer>0)){kit.dash=1;kit.dashKills=0;kit.nextSignatureAt=0;}
  kit.ultPoints=DUELIST.ultimatePoints;if(kit.knivesActive)kit.knives=DUELIST.knives;
}
function confirmDuckSkill(key){
 if(player.kit?.character==='renko')return confirmRenkoSkill(key);
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
 if(!effect)showMessage('発動できません',key==='c'?'見える床を狙ってください':'床と在庫を確認してください',2);
 refillMapPracticeSkills();updateHUD();
}
function useAbility(key){if(busSeat())return;
 if(player.kit?.character==='veil'&&['c','x'].includes(key))return openVeilPlacement(key);
 if(player.kit?.character==='veil'&&key==='q'&&mode==='play'&&player.alive&&match?.phase==='live'&&!netHostPaused&&!interactionHeld&&!objectivePractice){duckAim=duckAim===key?null:key;firing=false;aiming=false;if(duckAim)showSkillAim(player.kit.character,key);return;}
 if(player.kit?.character==='renko')return confirmRenkoSkill(key);
 if(player.kit?.character==='onnara'&&key==='q'&&mode==='play'&&player.alive&&match?.phase==='live'&&!netHostPaused&&!interactionHeld&&!objectivePractice){duckAim=duckAim===key?null:key;firing=false;aiming=false;if(duckAim)showSkillAim(player.kit.character,key);return;}
 if(player.kit?.character==='onnara'&&key==='c')return confirmOnnaraSkill(key);
 if(player.kit?.character==='urchin'&&['c','q','e'].includes(key)&&mode==='play'&&player.alive&&match?.phase==='live'&&!netHostPaused&&!interactionHeld&&!objectivePractice){duckAim=duckAim===key?null:key;firing=false;aiming=false;if(duckAim)showSkillAim(player.kit.character,key);return;}
 if(player.kit?.character==='cap'&&['c','q'].includes(key)&&mode==='play'&&player.alive&&match?.phase==='live'&&!netHostPaused&&!interactionHeld&&!objectivePractice){duckAim=duckAim===key?null:key;firing=false;aiming=false;if(duckAim)showSkillAim(player.kit.character,key);return;}
 if(player.kit?.character==='japan'&&['c','q'].includes(key)&&mode==='play'&&player.alive&&match?.phase==='live'&&!netHostPaused&&!interactionHeld&&!objectivePractice){duckAim=duckAim===key?null:key;firing=false;aiming=false;if(duckAim)showSkillAim(player.kit.character,key);return;}
 if(player.kit?.character==='nobi'&&['c','q','e','x'].includes(key)&&mode==='play'&&player.alive&&match?.phase==='live'&&!netHostPaused&&!interactionHeld&&!objectivePractice){duckAim=duckAim===key?null:key;firing=false;aiming=false;if(duckAim)showSkillAim(player.kit.character,key);return;}
 if(player.kit?.character==='car'&&['c','q'].includes(key)&&mode==='play'&&player.alive&&match?.phase==='live'&&!netHostPaused&&!interactionHeld&&!objectivePractice){duckAim=duckAim===key?null:key;firing=false;aiming=false;if(duckAim)showSkillAim(player.kit.character,key);return;}
 if(player.kit?.character==='cat'&&['q','e'].includes(key)&&mode==='play'&&player.alive&&match?.phase==='live'&&!netHostPaused&&!interactionHeld&&!objectivePractice){duckAim=duckAim===key?null:key;firing=false;aiming=false;if(duckAim)showSkillAim(player.kit.character,key);return;}
 const catReturning=player.kit?.character==='cat'&&key==='c'&&!!ordinarySkills.catBookmark(player.id,elapsed);
 if(player.kit?.character==='duck'&&['c','q'].includes(key)&&mode==='play'&&player.alive&&match?.phase==='live'&&!netHostPaused&&!interactionHeld){
  duckAim=duckAim===key?null:key;firing=false;aiming=false;if(duckAim)showSkillAim(player.kit.character,key);return;
 }
 refillMapPracticeSkills();if(netHostPaused||mode!=='play'||!player.alive||interactionHeld||objectivePractice)return;const aim={yaw:player.yaw,pitch:player.pitch};const effect=activateAbility(player,key,{predict:isGuest(),aim});if(isGuest()){queueNetAction('ability',{key,...aim,...(catReturning?{catReturning:true}:{}),direction:effect?.type==='dash'?player.dashVec:null});if(effect?.type==='dash')player.netPredictDashUntil=elapsed+.6;}refillMapPracticeSkills();updateHUD();}
function dash(){useAbility('q');}
function scan(){useAbility('e');}
function duckFlight(actor){
  if(!actor?.alive||actor.kit?.character!=='duck'||match?.phase!=='live')return null;
  return ordinarySkills.events(elapsed).find(e=>e.type==='duck-hush'&&e.sourceId===actor.id&&e.team===actor.team&&elapsed<e.endsAt)||null;
}
// Only approved flight/pad physics grant this accuracy. Client fire packets
// cannot opt in, and a shared pad grants it to every actual rider.
function duckAirAim(actor){return match?.phase==='live'&&actor?.alive&&!actorGrounded(actor)&&!!(duckFlight(actor)||duckPadAirborne(actor));}
function duckFlap(actor){
  const event=duckFlight(actor);if(!event||actor.planting||actor.defusing||actor.trafficLaunch||actor.y>=Math.min(11,event.y+DUCK_SKILLS.flightHeight)-.02)return false;
  if(actor.duckFlapEvent===event.id&&elapsed<(actor.duckFlapAt||0)+DUCK_SKILLS.flapInterval)return false;
  actor.duckFlapEvent=event.id;actor.duckFlapAt=elapsed;actor.vy=DUCK_SKILLS.flapVelocity;sound('duck-flap',{entity:actor,localOnly:true});return true;
}
function jump(){if(carMotionActive(player)||busSeat()||renkoFlight(player))return;if(player.trcLadder){trcInteract(player,{kind:'ladder',id:player.trcLadder});return;}if(!netHostPaused&&mode==='play'&&player.alive&&!interactionHeld&&duckFlap(player))return;
if(!netHostPaused&&mode==='play'&&player.alive&&player.vy===0&&!ordinarySkills.onnaraEvent?.('onnara-hover',player.id,elapsed)&&!interactionHeld){player.vy=normalJumpVelocity(player);sound('jump',{localOnly:true});}}
function updateCombatReport(){
  const panel=$('combat-report'),report=match?.phase==='buy'&&!exploring?roundDamage.report(player.id,roster,match.round):null;
  setVisible('combat-report',!!report);if(!panel||!report)return;
  const key=JSON.stringify([player.id,report]);if(key===combatReportKey)return;combatReportKey=key;
  renderCombatReport(panel,report,{document});panel.open=true;
}
let hudRefresh=0;
function updateHUD(){
  hudRefresh=.05;
  if(!match)return;
  updateCombatReport();
  const armedWeapon=weapon(),ultimateKnives=player.kit.knivesActive&&inventory.active==='knife',firearm=inventory.active!=='spike'&&armedWeapon.mag>0;
  $('hud')?.classList.toggle('objective-practice',!!objectivePractice);
  $('health').textContent=Math.ceil(player.hp);$('ammo').textContent=firearm?(rangeInfiniteResources()?'∞':player.ammo):ultimateKnives?player.kit.knives:'—';$('reserve').textContent=firearm?(rangeInfiniteResources()?'∞':player.reserve):ultimateKnives?'∞':'—';
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
      if($('mobile-interact-label'))$('mobile-interact-label').textContent=practiceComplete?'完了':'4';
      if($('mobile-interact-hint'))$('mobile-interact-hint').textContent=practiceComplete?'Mで再挑戦':'長押し';
    }
  }
  const s=match.spike;
  const planted=match.phase==='live'&&s.status==='planted',notice=$('bomber-alert');
  if(notice){
    notice.hidden=!planted;
    if(planted){const key=`${match.round}:${s.site}`;if(bomberNoticeKey!==key){bomberNoticeKey=key;bomberNoticeUntil=elapsed+4.5;}
      notice.classList.toggle('announcing',elapsed<bomberNoticeUntil);notice.classList.toggle('urgent',!objectivePractice&&s.timer<=10);
      $('bomber-alert-title').textContent=`${s.site}サイト ボンバー設置`;
      $('bomber-alert-time').textContent=objectivePractice?'練習中 · 起爆なし':`起爆まで ${Math.max(0,Math.ceil(s.timer))}秒`;
    }else{bomberNoticeKey='';bomberNoticeUntil=0;}
  }
  $('phase-label').textContent=match.phase==='buy'?'BUY PHASE / 購入':match.phase==='post'?'ROUND OVER':s.status==='planted'?'BOMBER PLANTED':'ROUND LIVE';
  $('objective-label').textContent=match.phase==='buy'?(onlinePlaying?'Bで購入 · フェーズ終了で全員同時に開始':'Bで購入 · 購入終了ボタンで開始'):ownSide()==='attack'?(s.status==='planted'?'起爆までボンバーを守れ':'A / B サイトで 4 長押し → 4秒で設置'):(s.status==='planted'?'ボンバー付近で 4 長押し → 7秒で電源オフ':'敵の設置を阻止せよ');
  $('spike-state').textContent=s.status==='planted'?`${s.site} · 起爆まで ${Math.ceil(s.timer)}s`:s.status==='dropped'?'BOMBER DROPPED / 回収可能':s.status==='defused'?'BOMBER POWERED OFF':s.status==='detonated'?'BOMBER DETONATED':s.carrier===player.id?'BOMBER · YOU':`BOMBER · ${ownSide()==='attack'?'味方が所持':'敵が所持'}`;
  $('health').style.color=player.hp<35?'#ff5a67':'';
  $('ammo').style.color=firearm&&player.ammo<8?'#ff5a67':'';
  $('reload-state').textContent=player.serviceReload?'クイックソルダー…':reloading>0?'RELOADING…':firearm&&player.ammo===0?(player.reserve>0?'R  リロード':'弾薬切れ · 武器を持ち替え'):'';
  $('reload-state').hidden=!player.alive||!firearm||!(reloading>0||player.serviceReload||player.ammo===0);
  const cycle=sniperCycleRemaining(),cycleHUD=$('sniper-cycle');
  cycleHUD.hidden=!(cycle&&mode==='play'&&match.phase==='live'&&player.alive&&firearm&&player.ammo>0&&!reloading&&!player.serviceReload&&!interactionHeld&&!busSeat()&&!carMotionActive(player));
  if(!cycleHUD.hidden){
    const progress=clamp(1-cycle/nobiShotInterval(armedWeapon,player),0,1);
    $('sniper-cycle-label').textContent=`次の射撃まで ${Math.max(.1,Math.ceil(cycle*10)/10).toFixed(1)}秒`;
    cycleHUD.setAttribute('aria-valuenow',String(Math.floor(progress*100)));
    $('sniper-cycle-fill').style.transform=`scaleX(${progress})`;
  }
  const kit=player.kit,k=kit.snapshot();
  const character=CHARACTER_DEFS[normalizeCharacter(k.character)];
  if($('ability-x-glyph'))$('ability-x-glyph').setAttribute('d',character.ultIcon);
  if($('status-effects')){
    const scale=player.alive?actorSpeedScale(player):1,boosted=player.alive&&actorMovementScale(player)>1,slowed=scale<1,blind=player.alive&&ordinarySkills.blindUntil(player.id,elapsed)>elapsed;
    const statuses=[];
    const carGyro=ordinarySkills.carGyro(player.id,elapsed);
    const tax=ordinarySkills.onnaraTax?.(player.id,elapsed);if(tax)statuses.push(tax.power>0?`王冠の徴税 · 発砲ごとHP4 / 残り${Math.ceil(tax.power/ONNARA_SKILLS.taxPerShot)}回 · HP1で止まる`:'王冠の徴税 · 10発分の代償を払い終えました');
    const renkoJetStatus=renkoFlight(player),renkoDriveStatus=renkoEvent(player,'renko-drive');if(renkoUltimateActive(player))statuses.push('リスタートラッシュ · 敵撃破でC・Q・E全回復');if(renkoJetStatus)statuses.push(`ジェットパック ${Math.ceil(Math.max(0,renkoJetStatus.endsAt-elapsed))}秒 · E長押し · マウスの向きへ飛行 / 離すと停止`);if(renkoDriveStatus)statuses.push(`高速走行 ${Math.ceil(renkoDriveStatus.endsAt-elapsed)}秒 · 素手 / C発射可 · Vで滑走 / Qで解除`);
    if(ordinarySkills.onnaraEvent?.('onnara-hover',player.id,elapsed)&&!starHold.stopped(ordinarySkills.onnaraEvent('onnara-hover',player.id,elapsed).id))statuses.push('星留め · 空中静止');
    if(ordinarySkills.onnaraEvent?.('onnara-chain',player.id,elapsed))statuses.push('星座裁定 · 近くの敵へ70%連鎖');
    if(ordinarySkills.urchinJammed(player.id,elapsed))statuses.push('棘錠 · 装填不可');
    if(ordinarySkills.nearsightUntil(player.id,elapsed)>elapsed)statuses.push('深潮 · 8mより先が見えない');
    if(ordinarySkills.urchinTrident(player.id,elapsed))statuses.push('三叉潮 · 三方向射撃 · 連射1.5倍');
    if(ordinarySkills.capLocked(player.id,elapsed))statuses.push('レンズブレイク · 銃弾が拡散 / ADS不可');
    if(ordinarySkills.capBank(player.id,elapsed))statuses.push('バンクレンズ · 最大3回跳弾');
    if(ordinarySkills.capMagazine(player.id,elapsed))statuses.push('エンドレスマガジン · 銃弾消費なし');
    if(ordinarySkills.japanReturn(player.id,elapsed)>0)statuses.push('弾丸返送 · 被銃撃の650%を返す');
    if(ordinarySkills.nobiVulnerability(player.id,elapsed,player,ordinaryReachable)>1)statuses.push('鈴の弱点 · 被銃撃135%');
    if(ordinarySkills.nobiInterval(player.id,elapsed,player,ordinaryReachable)>1)statuses.push('ひげブレーキ · 銃の射撃間隔160%');
    if(ordinarySkills.nobiWork(player.id,elapsed,player,ordinaryReachable)>1)statuses.push('ポケット工具 · 設置・電源オフ150%');
    if(ordinarySkills.nobiLegend(player.id,elapsed,player,ordinaryReachable))statuses.push('逆転えり · 胴・脚も頭相当');
    const stunUntil=carStunUntil(player);if(stunUntil>elapsed)statuses.push(`STUN · 残り${Math.ceil(stunUntil-elapsed)}秒 / 移動・射撃・スキル・設置/解除不可`);
    const catBook=ordinarySkills.catBookmark(player.id,elapsed),catClock=ordinarySkills.clockFrozen(elapsed);
    const duckFlying=duckFlight(player);const duckSeal=ordinarySkills.sealUntil(player.id,elapsed)>elapsed,duckQuiet=ordinarySkills.quiet(player.id,elapsed),duckEgg=ordinarySkills.events(elapsed).find(e=>e.type==='duck-egg'&&e.sourceId===player.id);
    const personal=player.alive?ordinarySkills.events(elapsed).filter(event=>event.sourceId===player.id):[],shade=personal.some(event=>event.type==='ember-shade'),unravel=personal.some(event=>event.type==='frost-unravel')&&actorGrounded(player);
    $('status-effects').hidden=!statuses.length&&!carGyro&&!catBook&&!catClock&&!duckAim&&!duckSeal&&!duckQuiet&&!duckFlying&&!duckEgg&&!slowed&&!boosted&&!blind&&!shade&&!unravel;
    $('status-effects').textContent=[...statuses,carGyro?'タイヤジャイロ · 接地中の移動射撃安定':'',catBook?`白いしおり · Cで帰還 ${Math.max(0,Math.ceil(catBook.endsAt-elapsed))}秒`:'',catClock?'白紙の8秒 · 試合時計停止 / 行動は継続':'',duckAim?'狙って左クリックで確定 / 右クリックで取消':'',duckSeal?'羽根の封印 · 新規スキル使用不可':'',duckQuiet?'忍びガモ · 足音・着地音なし':'',duckFlying?`羽ばたき ${Math.ceil(duckFlying.endsAt-elapsed)}秒 · SPACE連打で飛ぶ`:'',duckEgg?`不屈の卵 · 残り${duckEgg.power}回`:'',slowed?`足止め中 · 移動速度 ${Math.round(scale*100)}%`:'',boosted?`${CHARACTER_DEFS[player.kit.character].label} / ${getCharacterSkill(player.kit.character,'e').name} · ${Math.round(scale*100)}%`:'',blind?'FLASH · 視界回復中':'',shade?`遮光チェック · 新しい閃光の時間${Math.round(EMBER_SKILLS.shadeFlashScale*100)}%`:'',unravel?`${getCharacterSkill('frost','e').name} · ${frostSlideSpeed(player)>0?'滑走中 / ':''}減速分を${Math.round((1-FROST_SKILLS.unravelSlowFraction)*100)}%軽減`:''].filter(Boolean).join(' / ');
  }
  if($('ability-x-name'))$('ability-x-name').textContent=character.ultShortName;
  if($('mobile-ult-name'))$('mobile-ult-name').textContent=character.ultShortName;
  $('mobile-ult')?.setAttribute('aria-label',`X ${character.ultName}`);
  skillUI.updateHUD(kit,elapsed,{alive:player.alive});
  if($('ability-x-count'))$('ability-x-count').textContent=k.renkoActive?'発動中':k.knivesActive?`${k.knives}本`:`${k.ultPoints}/7`;
  $('ability-x')?.classList.toggle('cooldown',!player.alive||k.renkoActive||!(k.ultPoints>=7||k.knivesActive));
  setVisible('online-session-status',onlinePlaying);if($('online-session-status')&&onlinePlaying)$('online-session-status').textContent=netHostPaused?'ホストが戻るまで試合を一時停止':`ONLINE · ${online.room.code}`;
  setVisible('restart',!onlinePlaying);if($('pause-note'))$('pause-note').textContent=onlinePlaying?'この画面を開いている間も試合は進みます。':'準備ができたら、作戦を再開しよう。';
  if($('health-bar'))$('health-bar').style.width=`${Math.min(100,player.hp)}%`;
  const zone=resolveMapCallout(map,!player.alive&&spectatedBot?spectatedBot:player);
  $('zone').textContent=zone?.name||'NORTH PLAZA / 北口広場';
  if(exploring){
    $('timer').textContent='∞';$('round-label').textContent=(map.shortName||'HASHIMOTO')+' / MAP PRACTICE';$('side-label').textContent='マップ練習';
    $('phase-label').textContent='2 SITES / 3 LANES';$('objective-label').textContent=!rangeSession&&!objectivePractice?'C/Q/E/X 無限 · M：ルート確認・地点移動 · B：武器選択':'M：ルート確認・地点移動 · WASD：移動 · B：武器選択';
    $('spike-state').textContent=map.id==='trc'?'屋外前庭 / A ロング / MID / 搬入 B メイン':map.id==='hirakata'?'南北自由通路 / バス車道に注意 / 接触150ダメージ':'バス通り / 中央連絡路 / ミウィ通り';$('zone').textContent=zone?.name||((map.name||'橋本駅')+'前');
  }
  if($('ally-label'))$('ally-label').textContent=rangeSession?'SCORE':'YOUR TEAM';
  if($('enemy-label'))$('enemy-label').textContent=rangeSession?'HEADSHOT':'ENEMY TEAM';
  setVisible('ally-status',!rangeSession&&!objectivePractice);setVisible('enemy-status',!rangeSession&&!objectivePractice);
  if(rangeSession){
    const result=rangeSession.summary();
    $('timer').textContent=formatTime(Math.ceil(rangeSession.remaining));$('round-label').textContent='60 SECOND AIM DRILL';
    $('phase-label').textContent=rangeSession.started?'SHOOTING RANGE / 射撃訓練':'スタート看板を撃って開始';$('side-label').textContent='射撃訓練';
    $('team-score').textContent=result.score;$('enemy-score').textContent=rangeSession.headKills;
    $('objective-label').textContent='弾・C/Q/E/X ∞ · 頭150点 / 胴100点 · Bで武器選択';
    $('spike-state').textContent=`${result.kills}撃破 · 命中 ${result.accuracy}% · ヘッド ${result.headRate}%`;
  }
  if(objectivePractice){
    const p=objectivePractice,plant=p.kind==='plant';
    $('timer').textContent='∞';$('round-label').textContent=`${p.site} SITE / OBJECTIVE PRACTICE`;
    $('side-label').textContent=plant?'設置練習':'電源オフ練習';$('phase-label').textContent=p.completed?'練習成功':plant?'4 長押し · 4秒で設置':'4 長押し · 7秒で電源オフ';
    $('objective-label').textContent=p.completed?'M → A/Bでやり直す · 設置した本体を近くで確認できます':plant?'設置区画内で 4 長押し · MでA/Bを切替':'4 長押し · 3.5秒で進捗50%を保存 · MでA/Bを切替';
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
  if(large&&veilPlacementCurrent())for(const [index,point] of veilPlacement.points.entries()){const radius=veilPlacement.key==='c'?VEIL_SKILLS.dustRadius:9;ctx.strokeStyle=point===veilPlacement.point?'#ffffff':'#c5d2ff';ctx.fillStyle='#a9b6ff55';ctx.lineWidth=2;ctx.beginPath();ctx.arc(px(point.x),pz(point.z),radius*scale,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.fillText(String(index+1),px(point.x)+5,pz(point.z)-5);}
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
function agentEquipment(bot){const weapon=bot.remoteId?bot.netWeapon:bot.netTarget?.weapon||bot.record?.primary||bot.record?.secondary||"classic";return {weapon,unarmed:!!renkoUnarmed(bot),character:bot.kit?.character||bot.netTarget?.kit?.character||'duelist',ultimate:bot.kit?.knivesActive&&weapon==="knife",knives:bot.kit?.knives||0,shotSequence:bot.netTarget?.shotSequence??bot.shotSequence??0,enemyRim:enemyRimFor(bot),crouch:bot.crouch||0,sliding:(frostSlideSpeed(bot)>0||renkoSliding(bot))&&!!bot.moving,...roundDanceState(match,bot),...(reducedMotion.matches?{danceTime:0}:{})};}
function updateBots(dt){
  const cfg=levels.hard;
  if(!isGuest())navigation.updateTraffic?.(elapsed);
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
        if(target&&target!==bot.target)bot.reactionUntil=elapsed+cfg.reaction;
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
    // Navigation, objectives and gun aim share one finite body turn per frame.
    const limit=Math.min(speed*dt,bot.turnBudget),step=clamp(delta,-limit,limit);
    bot.group.rotation.y+=step;bot.turnBudget=Math.max(0,bot.turnBudget-Math.abs(step));
    return Math.abs(delta-step)<.05;
  }
  function advance(bot,goal,intent='objective'){
    const safe=navigation.nearest(goal.x,goal.z,goal.y||0);if(!safe)return false;
    const dist=Math.hypot(bot.x-safe.x,bot.z-safe.z,map.traversal?(bot.y||0)-(safe.y||0):0);if(dist<(intent==='bus-escape'?.04:.32)){bot.path=[];return false;}
    bot.pathTime=(bot.pathTime||0)-dt;
    if(bot.pathTime<=0||!bot.path?.length||!bot.goal||distance(bot.goal,safe)>2||bot.pathIntent!==intent){
      bot.path=intent==='bus-escape'?[safe]:navigation.path(bot.x,bot.z,safe.x,safe.z,bot.y||0,safe.y||0);bot.pathTime=.8+Math.random()*.15;bot.goal=safe;bot.pathIntent=intent;
    }
    while(bot.path.length&&Math.hypot(bot.x-bot.path[0].x,bot.z-bot.path[0].z,map.traversal?(bot.y||0)-(bot.path[0].y||0):0)<(intent==='bus-escape'?.04:.22))bot.path.shift();
    const point=bot.path[0];if(!point)return false;
    if(map.traversal){
      if(point.ladder){const n=map.traversal.nearby(bot);if(n?.id===point.ladder){bot.trcClimbDirection=point.y>(bot.y||0)?1:-1;trcInteract(bot,n);return true;}}
      const n=map.traversal.nearby(bot);if(n?.kind==='door'&&!map.traversal.doors.find(d=>d.id===n.id).open)trcInteract(bot,n);
      const duck=!!map.ductAt(bot.x,bot.z,bot.y)||!!point.crouch;
      if(duck||canStand(bot.x,bot.z,.4,bot.y,1.7))bot.crouch=duck?1:0;
    }
    const dx=point.x-bot.x,dz=point.z-bot.z,length=Math.hypot(dx,dz)||1;
    const speed=(bot.kit?.character==='renko'&&renkoEvent(bot,'renko-drive')?RENKO_SKILLS.runSpeed:frostSlideSpeed(bot)||(3.35+cfg.speed*.25)*1.15)*actorSpeedScale(bot)*(map.ductAt?.(bot.x,bot.z,bot.y)?.28:1);
    const step=Math.min(length,speed*dt),oldX=bot.x,oldZ=bot.z;
    if(elapsed<(bot.trafficLaunch?.endsAt||0))return false;
    if(navigation.trafficStep&&!navigation.trafficStep(bot.x,bot.z,bot.x+dx/length*step,bot.z+dz/length*step)){bot.pathTime=0;return false;}
    moveEntity(bot,dx/length*step,dz/length*step,.4);
    // During a duel the gun-facing branch controls orientation, including
    // urgent movement. Moving toward a path must never snap the body around.
    if(!bot.target)face(bot,{x:bot.x+dx,z:bot.z+dz});
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
      if(!isGuest()&&!bot.carMotion&&bot.carFallUntil>elapsed&&!bot.trafficLaunch&&bot.vy)updateActorVertical(bot,dt,.4);
      if(isGuest()&&bot.netTarget){const t=1-Math.exp(-dt*15);bot.x=THREE.MathUtils.lerp(bot.x,bot.netTarget.x,t);bot.z=THREE.MathUtils.lerp(bot.z,bot.netTarget.z,t);bot.y=THREE.MathUtils.lerp(bot.y||0,bot.netTarget.y||0,t);bot.group.position.set(bot.x,bot.y,bot.z);}
      bot.visual.update(dt,{...agentEquipment(bot),time:elapsed,moving:false,planting:false,defusing:false,firing:false,alive:false});
      if(bot.death>0){bot.death-=dt;if(bot.death<=0)bot.group.visible=false;}
      continue;
    }
    if(bot.rangeTarget){
      bot.visual.update(dt,{...agentEquipment(bot),time:elapsed,moving:false,planting:false,defusing:false,firing:false,alive:true});
      continue;
    }
    if(bot.remoteId||isGuest()){
      if(!isGuest()&&duckPadAirborne(bot)&&!bot.carMotion&&!bot.trafficLaunch)updateActorVertical(bot,dt,.4);
      if(!isGuest())updateRemoteActor(bot,dt);
      else if(bot.netTarget){const t=1-Math.exp(-dt*15);bot.x=THREE.MathUtils.lerp(bot.x,bot.netTarget.x,t);bot.z=THREE.MathUtils.lerp(bot.z,bot.netTarget.z,t);bot.y=THREE.MathUtils.lerp(bot.y||0,bot.netTarget.y||0,t);bot.group.rotation.y=bot.netTarget.yaw+Math.PI;}
      bot.group.position.set(bot.x,bot.y||0,bot.z);
      bot.visual.update(dt,{...agentEquipment(bot),time:elapsed,moving:!!bot.moving,planting:!!bot.planting,defusing:!!bot.defusing,firing:bot.flash>0,alive:true});continue;
    }
    if(!match||match.phase!=='live'){
      bot.planting=false;bot.defusing=false;bot.moving=false;bot.muzzle.visible=false;
      bot.visual.update(dt,{...agentEquipment(bot),time:elapsed,moving:false,planting:false,defusing:false,firing:false,alive:true});continue;
    }
    bot.turnBudget=cfg.turnRate*dt;
    if(busSeat(bot)){bot.group.position.set(bot.x,bot.y||0,bot.z);continue;}
    if(carMotionActive(bot)){bot.group.position.set(bot.x,bot.y||0,bot.z);bot.visual.update(dt,{...agentEquipment(bot),time:elapsed,moving:bot.carMotion.phase!==3,alive:true});continue;}
    if(bot.trcLadder){const previous={x:bot.x,y:bot.y,z:bot.z};map.traversal.climb(bot,bot.trcClimbDirection||1,dt);trcMotionSound(bot,dt,previous,false);bot.group.position.set(bot.x,bot.y,bot.z);bot.moving=true;bot.visual.update(dt,{...agentEquipment(bot),time:elapsed,moving:true,alive:true});continue;}
    if(bot.vy||bot.y)updateActorVertical(bot,dt,.4);
    bot.fire=Math.max(0,(bot.fire||0)-dt);
    const weaponId=bot.record?.primary||bot.record?.secondary||'classic';
    const spec=WEAPONS[weaponId]||WEAPONS.classic;
    if(bot.aiWeapon!==weaponId){cancelServiceReload(bot);bot.aiWeapon=weaponId;bot.aiAmmo=spec.mag;bot.aiReserve=spec.reserve;bot.aiReload=0;bot.burst=0;}
    if(ordinarySkills.urchinJammed(bot.id,elapsed))urchinCancelReload(bot);
    if(!tickServiceReload(bot,dt)&&bot.aiReload>0){bot.aiReload-=dt;if(bot.aiReload<=0)bot.aiAmmo=spec.mag;}
    let enemy=bot.target;
    if(!enemy){bot.aimSample=null;bot.aimStillSince=elapsed;}
    let enemyDistance=enemy?distance(bot,enemy):Infinity;
    const role=plan?.roles.get(bot.id);
    bot.tacticRole=role?.role||'anchor';bot.tacticSite=role?.siteId||null;
    let goal=role?.goal||null,plantSite=null,shouldDefuse=false;
    const site=map.sites.find(s=>s.id===(role?.siteId||targetSite))||map.sites[0];
    const attacking=bot.team===match.attackerTeam;
    if(attacking){
      if(spike.status==='dropped'){
        if(plan?.recovererId===bot.id&&distance(bot,spike)<1.7)match.pickupSpike(bot.id,bot.team,bot.x,bot.z,bot.y||0);
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
    if(map.traversal&&!enemy&&!role?.urgent&&spike.carrier!==bot.id)goal=trcBotGoal(bot,goal,attacking,site.id,spike)||goal;
    const orbs=ordinarySkills.events(elapsed).filter(e=>e.type==='onnara-orb'&&e.sourceId===bot.id&&e.team===bot.team);
    if(orbs.length&&!enemy&&ordinarySkills.blindUntil(bot.id,elapsed)<=elapsed&&ordinarySkills.nearsightUntil(bot.id,elapsed)<=elapsed){
      const observed=[player,...bots].filter(a=>a.alive&&a.team!==bot.team&&orbs.some(orb=>orbSeesActor(orb,a,elapsed,visibleBetween))).sort((a,b)=>distance(bot,a)-distance(bot,b))[0];
      if(observed)bot.lastHeard={x:observed.x,y:observed.y||0,z:observed.z,at:elapsed};
    }
    const search=!enemy?tactics.investigation(bot,elapsed,role,spike):null;
    const heard=!enemy&&bot.lastHeard&&elapsed>=bot.lastHeard.at&&elapsed-bot.lastHeard.at<1.8&&!role?.urgent&&!['plant','defuse'].includes(role?.role)?bot.lastHeard:null;
    if(search||heard)goal=search||heard;
    // A tag is a short-lived, frozen contact. It can guide investigation, never
    // supply a live actor reference or bypass the BOT's visible-target checks.
    const tagContact=!enemy?ordinarySkills.markers(bot.team,elapsed).filter(point=>distance(bot,point)<24).sort((a,b)=>b.detectedAt-a.detectedAt||a.eventId.localeCompare(b.eventId))[0]:null;
    if(tagContact&&!role?.urgent&&ordinarySkills.blindUntil(bot.id,elapsed)<=elapsed)goal=tagContact;
    // Mistake a visible fake for a threat once per ID, including during a
    // distant duel. Never publish it as a real sighting or abandon urgent work.
    let decoyTarget=null;
    const decoys=allNopeDecoys(),activeDecoyIds=new Set(decoys.map(event=>event.id));
    bot.decoySeen||=new Map();for(const id of bot.decoySeen.keys())if(!activeDecoyIds.has(id))bot.decoySeen.delete(id);
    if(!role?.urgent&&(!enemy||enemyDistance>6)&&spec.mag>0&&ordinarySkills.blindUntil(bot.id,elapsed)<=elapsed){
      const candidates=decoys.filter(event=>event.team!==bot.team&&distance(bot,event)<Math.min(40,enemyDistance*1.25)&&inVisionCone(bot,event,{yaw:bot.group.rotation.y})&&visibleBetween(bot,event)).sort((a,b)=>distance(bot,a)-distance(bot,b));
      for(const decoy of candidates){
        if(!bot.decoySeen.has(decoy.id))bot.decoySeen.set(decoy.id,Math.random()<.4?elapsed+1.5:elapsed);
        if(elapsed>=bot.decoySeen.get(decoy.id))continue;
        goal=decoy;decoyTarget=decoy;enemy=null;break;
      }
    }
    // A close threat interrupts starting an interaction; an ongoing plant or urgent retake commits.
    const committedPlant=spike.plantActor===bot.id&&spike.plantProgress>0;
    const committedDefuse=spike.defuseActor===bot.id&&spike.defuseProgress>0;
    const trafficEscape=actorGrounded(bot)?navigation.trafficEscape?.(bot.x,bot.z):null;
    const interactPlant=!trafficEscape&&Math.abs(bot.y||0)<.05&&actorGrounded(bot)&&plantSite&&(enemyDistance>10||committedPlant||role?.urgent);
    const interactDefuse=!trafficEscape&&Math.abs(bot.y||0)<.05&&actorGrounded(bot)&&shouldDefuse&&(!spike.defuseActor||spike.defuseActor===bot.id)&&(enemyDistance>9||committedDefuse||role?.urgent);
    // Arm the work tool immediately before starting a real assigned task.
    // Approaching a site alone must not spend its six-second working window.
    bot.planting=false;bot.defusing=false;bot.moving=false;
    if(bot.kit?.character==='nobi'&&(interactPlant&&!committedPlant||interactDefuse&&!committedDefuse)&&elapsed>=(bot.nextNobiToolAt||0)){
      cancelServiceReload(bot);
      // Share a reachable toolbox only if it lasts through the whole task,
      // conservatively allowing its remaining flight before accelerated work.
      const workTime=(interactPlant?4:7)/NOBI_SKILLS.toolScale,pose=ordinaryActorView(bot);
      const sharedTool=ordinarySkills.events(elapsed).some(event=>event.type==='nobi-toolbox'&&event.endsAt-Math.max(elapsed,event.triggerAt)>=workTime&&ordinarySkills.wouldNobi(pose,event,{reachable:ordinaryReachable}));
      const tool=sharedTool?null:activateAbility(bot,'e',{zonePoint:{x:bot.x,y:bot.y||0,z:bot.z}});bot.nextNobiToolAt=elapsed+(tool?.type==='nobi-toolbox'?1:.5);
    }
    // A useful clock must be armed before work marks this actor busy. Keep
    // the assigned task running even if the event queue refuses the cast.
    if(bot.kit?.character==='cat'&&(interactPlant&&!committedPlant||interactDefuse&&!committedDefuse)&&bot.kit.ultPoints>=7&&catBotClockUseful(bot)&&!ordinarySkills.clockFrozen(elapsed)&&elapsed>=(bot.nextCatClockAt||0)){
      cancelServiceReload(bot);
      const clock=activateAbility(bot,'x');bot.nextCatClockAt=elapsed+(clock?1:.5);
    }
    // A planted bomber is public information. Spend mobility only for the
    // assigned retake, then free the hands before contact or objective work.
    if(bot.kit?.character==='renko'){
      const retake=!attacking&&spike.status==='planted'&&plan?.defuserId===bot.id&&role?.role==='defuse'&&goal&&distance(goal,spike)<2.05;
      const safeDrive=retake&&!enemy&&!decoyTarget&&!trafficEscape&&!interactPlant&&!interactDefuse&&!bot.serviceReload&&!(bot.aiReload>0)&&ordinarySkills.blindUntil(bot.id,elapsed)<=elapsed&&ordinarySkills.nearsightUntil(bot.id,elapsed)<=elapsed;
      if(renkoEvent(bot,'renko-drive')&&(!safeDrive||distance(bot,spike)<=7))stopRenkoDrive(bot);
      if(safeDrive&&distance(bot,spike)>14&&actorGrounded(bot)&&!bot.trcLadder&&!renkoFlight(bot)&&!renkoEvent(bot,'renko-drive')&&bot.kit.updraft>0&&elapsed>=(bot.nextRenkoDriveAt||0)){
        const drive=activateAbility(bot,'q');bot.nextRenkoDriveAt=elapsed+(drive?2.5:.5);
      }
    }
    bot.planting=!!interactPlant;bot.defusing=!!interactDefuse;
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
        if(dist>0&&dist<=NOPE_SKILLS.bottleRange&&bot.kit.smoke>0){
          // Use the actual lob and splash test; the longer throw is wasted
          // when a wall, ceiling or another floor keeps the burst out of reach.
          const spot={x:known.x,y:known.y??bot.y??0,z:known.z};
          const landing=getSkillTarget(bot,'nope-bottle',spot,aim);
          if(landing&&distance(landing,spot)<NOPE_SKILLS.bottleRadius&&
            Math.abs(spot.y-landing.y)<=CHARACTER_SKILLS.heightTolerance&&
            ordinaryReachable({type:'nope-bottle',...landing},spot))cast=activateAbility(bot,'c',{zonePoint:spot,aim});
        }
        if(!cast&&enemy&&dist>10&&dist<18&&bot.kit.updraft>0){
          const point=nopeBotFlashPoint(bot,enemy,aim,actors);
          if(point)cast=activateAbility(bot,'q',{zonePoint:point,aim});
        }
        if(!cast&&bot.kit.dash>0&&(bot.hp<65||!enemy))cast=activateAbility(bot,'e',{aim});
      }
      bot.nextSkillAt=elapsed+(cast?2.5:.5);
    }
    if(bot.kit?.character==='mend'&&!interactPlant&&!interactDefuse&&ordinarySkills.blindUntil(bot.id,elapsed)<=elapsed){
      let cast=null;
      // A recent seed/pollen throw must not postpone a ready emergency heal.
      // Rejected or unnecessary healing still waits half a second before retry.
      if(elapsed>=(bot.nextMendHealAt||0)){
        const injured=selectMendTarget(bot,actors,mendReachable);
        if(injured&&injured.hp<=70&&bot.kit.dash>0)cast=activateAbility(bot,'e');
        bot.nextMendHealAt=elapsed+(cast?2.5:.5);
      }
      const ordinaryReady=elapsed>=(bot.nextSkillAt||0),known=enemy||(bot.lastSeen&&elapsed-bot.lastSeen.seenAt<1.5?bot.lastSeen:null);
      if(!cast&&ordinaryReady&&known){
        const dist=distance(bot,known),aim={yaw:Math.atan2(bot.x-known.x,bot.z-known.z),pitch:0};
        if(dist>0&&dist<=CHARACTER_SKILLS.castDistance+MEND_SKILLS.seedsRadius&&bot.kit.smoke>0){
          const point={x:known.x,y:known.y??bot.y??0,z:known.z},landing=getSkillTarget(bot,'mend-seeds',point,aim);
          // Lost sight supplies a fixed location, never the hidden actor's pose.
          const pose=enemy?ordinaryActorView(enemy):{...point,id:known.id||'remembered-enemy',team:bot.team==='blue'?'red':'blue',alive:true,hp:100};
          const seeds=landing&&{type:'mend-seeds',team:bot.team,...landing,radius:MEND_SKILLS.seedsRadius},queries={reachable:ordinaryReachable};
          if(seeds&&ordinarySkills.wouldSeed(pose,seeds,queries)&&!ordinarySkills.events(elapsed).some(event=>event.team===bot.team&&ordinarySkills.wouldSeed(pose,event,queries)))cast=activateAbility(bot,'c',{zonePoint:point,aim});
        }
        if(!cast&&dist>8&&dist<20&&bot.kit.updraft>0&&(bot.hp<65||role?.urgent)&&!activePollenFields().some(event=>event.team===bot.team&&distance(event,bot)<8))cast=activateAbility(bot,'q',{zonePoint:{x:bot.x+(known.x-bot.x)*.6,z:bot.z+(known.z-bot.z)*.6},aim});
      }
      if(cast||ordinaryReady)bot.nextSkillAt=elapsed+(cast?2.5:.5);
    }
    if(bot.kit?.character==='echo'&&!interactPlant&&!interactDefuse&&ordinarySkills.blindUntil(bot.id,elapsed)<=elapsed&&elapsed>=(bot.nextSkillAt||0)){
      const known=enemy||(bot.lastSeen&&elapsed-bot.lastSeen.seenAt<1.5?bot.lastSeen:null),watch=known||role?.watch||goal;
      let cast=null;
      if(watch){
        const dist=distance(bot,watch),aim={yaw:Math.atan2(bot.x-watch.x,bot.z-watch.z),pitch:0};
        if(dist>0&&dist<=IAGNU_SKILLS.tagRange+IAGNU_SKILLS.tagRadius&&bot.kit.smoke>0){
          const point={x:watch.x,y:watch.y??bot.y??0,z:watch.z},landing=getSkillTarget(bot,'echo-tag',point,aim);
          // An empty watch point is a possible future contact, not a hidden actor.
          const pose=enemy?ordinaryActorView(enemy):{...point,id:watch.id||'watched-location',team:bot.team==='blue'?'red':'blue',alive:true,hp:100};
          const tag=landing&&{type:'echo-tag',team:bot.team,...landing,radius:IAGNU_SKILLS.tagRadius},queries={reachable:ordinaryReachable};
          if(tag&&ordinarySkills.wouldTag(pose,tag,queries)&&!ordinarySkills.events(elapsed).some(event=>event.team===bot.team&&ordinarySkills.wouldTag(pose,event,queries)))cast=activateAbility(bot,'c',{zonePoint:point,aim});
        }
        if(!cast&&enemy&&bot.kit.updraft>0){const point=echoBotGlintPoint(bot,enemy,aim,actors);if(point)cast=activateAbility(bot,'q',{zonePoint:point,aim});}
      }
      if(!cast&&!enemy&&goal&&distance(bot,goal)>9&&bot.kit.dash>0)cast=activateAbility(bot,'e');
      bot.nextSkillAt=elapsed+(cast?2.5:.5);
    }
    if(bot.kit?.character==='veil'&&!interactPlant&&!interactDefuse&&actorGrounded(bot)&&ordinarySkills.blindUntil(bot.id,elapsed)<=elapsed&&elapsed>=(bot.nextSkillAt||0)){
      const known=enemy||(bot.lastSeen&&elapsed-bot.lastSeen.seenAt<1.5?bot.lastSeen:null);let cast=null;
      if(known){
        const dist=distance(bot,known),aim={yaw:Math.atan2(bot.x-known.x,bot.z-known.z),pitch:0};
        if(dist>3&&dist<18&&bot.kit.smoke>0&&(bot.hp<65||role?.urgent)&&!activeOrdinarySmokeFields().some(event=>event.team===bot.team&&distance(event,bot)<event.radius))cast=activateAbility(bot,'c',{aim});
        else if(dist>=VEIL_SKILLS.rootsMinRange&&dist<=VEIL_SKILLS.rootsThrowRange&&bot.kit.updraft>0){
          const point={x:known.x,y:known.y??bot.y??0,z:known.z},target=getSkillTarget(bot,'veil-root-seed',point,aim);
          // A visible pose may be airborne; lost sight uses only its fixed
          // remembered location, conservatively assuming our current floor.
          const pose=enemy?ordinaryActorView(enemy):{...point,id:known.id,team:known.team,alive:true,hp:100,grounded:true};
          const roots=target&&{type:'veil-root-seed',team:bot.team,fromX:bot.x,fromY:bot.y+1.7,fromZ:bot.z,...target,radius:VEIL_SKILLS.rootsThrowWidth/2};
          const queries={reachable:ordinaryReachable,groundHeight:ordinaryGroundHeight};
          if(roots&&ordinarySkills.wouldRoot(pose,roots,queries)&&!ordinarySkills.events(elapsed).some(event=>event.team===bot.team&&ordinarySkills.wouldRoot(pose,event,queries)))cast=activateAbility(bot,'q',{zonePoint:point,aim});
        }
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
        if(!cast&&dist>0&&dist<=EMBER_SKILLS.solderRange&&bot.kit.smoke>0){
          // Judge the real clipped arc, not just the enemy's distance. A wall
          // or another floor can leave the molten burst unable to reach them.
          const spot={x:known.x,y:known.y??bot.y??0,z:known.z};
          const landing=getSkillTarget(bot,'ember-solder',spot,aim);
          if(landing&&distance(landing,spot)<EMBER_SKILLS.solderRadius&&
            Math.abs(spot.y-(landing.y-EMBER_SKILLS.solderGroundOffset))<=CHARACTER_SKILLS.heightTolerance&&
            ordinaryReachable({type:'ember-solder',...landing},spot))cast=activateAbility(bot,'c',{zonePoint:spot,aim});
        }
      }
      bot.nextSkillAt=elapsed+(cast?2:.4);
    }
    if(bot.kit?.character==='onnara'&&!interactPlant&&!interactDefuse&&elapsed>=(bot.nextSkillAt||0)){
      if(enemy&&visibleBetween(bot,enemy)){const aim={yaw:Math.atan2(bot.x-enemy.x,bot.z-enemy.z),pitch:Math.atan2((enemy.y||0)+1.3-((bot.y||0)+1.7),Math.max(.001,enemyDistance))};
        if(actorGrounded(bot)&&(bot.hp<70||(enemy.y||0)>(bot.y||0)+1)&&map.collision.rayClear(bot.x,(bot.y||0)+1.7,bot.z,bot.x,(bot.y||0)+4.8,bot.z))activateAbility(bot,'c');
        if(!ordinarySkills.onnaraEvent('onnara-orb',bot.id,elapsed))activateAbility(bot,'q',{aim});
        if(bot.aiAmmo>0&&constellationTarget(enemy,bot,[player,...bots],visibleBetween)&&bot.kit.ultPoints>=7)activateAbility(bot,'x');
        if(!actorGrounded(bot)&&bot.vy<=0)activateAbility(bot,'e');
      }bot.nextSkillAt=elapsed+1.2;
    }
    if(bot.kit?.character==='urchin'&&!interactPlant&&!interactDefuse&&ordinarySkills.blindUntil(bot.id,elapsed)<=elapsed&&elapsed>=(bot.nextSkillAt||0)){
      if(enemy&&visibleBetween(bot,enemy)){const aim={yaw:Math.atan2(bot.x-enemy.x,bot.z-enemy.z),pitch:Math.atan2((enemy.y||0)+1.3-((bot.y||0)+1.7),Math.max(.001,enemyDistance))};if(enemyDistance>8&&enemyDistance<URCHIN_SKILLS.gloomRange&&!ordinarySkills.nearsightUntil(enemy.id,elapsed)&&!ordinarySkills.events(elapsed).some(e=>e.type==='urchin-gloom'&&e.sourceId===bot.id)&&!actors.some(a=>a!==bot&&a.alive&&a.team===bot.team&&urchinGloomAllyInLane(bot,a,aim)))activateAbility(bot,'e',{aim});if(enemyDistance<URCHIN_SKILLS.lanceRange&&!ordinarySkills.events(elapsed).some(e=>e.type==='urchin-lance'&&e.sourceId===bot.id&&elapsed<e.triggerAt))activateAbility(bot,'c',{aim});if(enemyDistance<URCHIN_SKILLS.disarmRange)activateAbility(bot,'q',{aim});if(bot.aiAmmo>0&&enemyDistance<30&&bot.kit.ultPoints>=7)activateAbility(bot,'x');}
      bot.nextSkillAt=elapsed+.7;
    }
    if(bot.kit?.character==='cap'&&!interactPlant&&!interactDefuse&&elapsed>=(bot.nextSkillAt||0)){
      const friend=[bot,...bots.filter(b=>b.team===bot.team),...(player.team===bot.team?[player]:[])].find(a=>a.alive&&ordinarySkills.hasImpairment(a.id,a.team,elapsed)&&distance(bot,a)<=CAP_SKILLS.cleanRange&&(a===bot||visibleBetween(bot,a)));
      if(friend)activateAbility(bot,'q',{aim:{yaw:Math.atan2(bot.x-friend.x,bot.z-friend.z),pitch:Math.atan2((friend.y||0)+1.3-((bot.y||0)+1.7),Math.max(.001,distance(bot,friend)))}});
      if(enemy&&enemyDistance<CAP_SKILLS.lockRange&&visibleBetween(bot,enemy)){const enemyWeapon=enemy===player?inventory.active:enemy.remoteId?enemy.netWeapon:enemy.aiWeapon;if(WEAPONS[enemyWeapon]?.mag>0&&!ordinarySkills.capLocked(enemy.id,elapsed))activateAbility(bot,'c',{aim:{yaw:Math.atan2(bot.x-enemy.x,bot.z-enemy.z),pitch:Math.atan2((enemy.y||0)+1.3-((bot.y||0)+1.7),Math.max(.001,enemyDistance))}});if(enemyDistance<35){activateAbility(bot,'e');if(bot.aiAmmo>0&&bot.kit.ultPoints>=7)activateAbility(bot,'x');}}
      bot.nextSkillAt=elapsed+1;
    }
    if(bot.kit?.character==='japan'&&!interactPlant&&!interactDefuse&&elapsed>=(bot.nextSkillAt||0)){
      let cast=activateJapanAbility(bot,'x');if(!cast&&enemy&&visibleBetween(bot,enemy)){const aim={yaw:Math.atan2(bot.x-enemy.x,bot.z-enemy.z),pitch:Math.atan2((enemy.y||0)+1.3-((bot.y||0)+1.7),Math.hypot(enemy.x-bot.x,enemy.z-bot.z))};if(bot.armor<JAPAN_SKILLS.armorCap&&enemy.armor>0)cast=activateJapanAbility(bot,'q',{aim});if(!cast)cast=activateJapanAbility(bot,'e');if(!cast)cast=activateJapanAbility(bot,'c',{aim:{...aim,pitch:-.12}});}if(cast)bot.nextSkillAt=elapsed+1;
    }
    if(bot.kit?.character==='nobi'&&!interactPlant&&!interactDefuse&&elapsed>=(bot.nextSkillAt||0)){
      let cast=null;
      if(enemy&&visibleBetween(bot,enemy)){
        const aim={yaw:Math.atan2(bot.x-enemy.x,bot.z-enemy.z),pitch:Math.atan2((enemy.y||0)+1.3-((bot.y||0)+1.7),Math.hypot(enemy.x-bot.x,enemy.z-bot.z))};
        if(bot.kit.ultPoints>=7){
          const point=getSkillTarget(bot,'nobi-collar',{x:bot.x,y:bot.y||0,z:bot.z}),queries={reachable:ordinaryReachable};
          // Conserve X only while every current recipient can share an allied
          // collar through the next decision plus our own throw, including flight.
          const collars=ordinarySkills.events(elapsed).filter(event=>event.type==='nobi-collar'&&event.team===bot.team&&event.endsAt>=elapsed+1+NOBI_SKILLS.throwFlight);
          const recipients=point?[player,...bots].map(ordinaryActorView).filter(actor=>ordinarySkills.wouldNobi(actor,{type:'nobi-collar',team:bot.team,...point,radius:NOBI_SKILLS.areaRadius},queries)):[];
          const shared=recipients.length>0&&recipients.every(actor=>collars.some(event=>ordinarySkills.wouldNobi(actor,event,queries)));
          if(!shared)cast=activateAbility(bot,'x',{zonePoint:{x:bot.x,y:bot.y||0,z:bot.z}});
        }
        const options=[['c','nobi-bell',bot.kit.smoke,ordinarySkills.nobiVulnerability(enemy.id,elapsed,enemy,ordinaryReachable)],['q','nobi-whisker',bot.kit.updraft,ordinarySkills.nobiInterval(enemy.id,elapsed,enemy,ordinaryReachable)]];
        for(const[key,type,stock,active]of options)if(!cast&&stock>0&&active===1){
          // Share the real field test: clipped throws need not reach a visible enemy.
          const point=getSkillTarget(bot,type,{x:enemy.x,y:enemy.y||0,z:enemy.z},aim);
          // Include allied fields still in flight, but only where their real effect reaches.
          const pose=ordinaryActorView(enemy),queries={reachable:ordinaryReachable};
          if(point&&ordinarySkills.wouldNobi(pose,{type,team:bot.team,...point,radius:NOBI_SKILLS.areaRadius},queries)&&!ordinarySkills.events(elapsed).some(event=>event.type===type&&event.team===bot.team&&ordinarySkills.wouldNobi(pose,event,queries)))cast=activateAbility(bot,key,{aim,zonePoint:point});
        }
      }
      bot.nextSkillAt=elapsed+(cast?1:.5);
    }
    if(bot.kit?.character==='car'&&!interactPlant&&!interactDefuse&&elapsed>=(bot.nextSkillAt||0)){
      let cast=null;
      if(bot.kit.ultPoints>=7&&carPitTargets(bot).length>=2)cast=activateAbility(bot,'x');
      if(!cast&&enemy&&visibleBetween(bot,enemy)){const aim={yaw:Math.atan2(bot.x-enemy.x,bot.z-enemy.z),pitch:Math.atan2((enemy.y||0)+1.3-((bot.y||0)+1.7),Math.hypot(enemy.x-bot.x,enemy.z-bot.z))};cast=activateAbility(bot,'c',{aim});}
      if(!cast){const goal=bot.lastSeen||bot.goal;if(goal){const aim={yaw:Math.atan2(bot.x-goal.x,bot.z-goal.z),pitch:0};cast=activateAbility(bot,'q',{aim});}}
      bot.nextSkillAt=elapsed+(cast?1.2:.5);
      if(carMotionActive(bot)){bot.group.position.set(bot.x,bot.y||0,bot.z);bot.visual.update(dt,{...agentEquipment(bot),time:elapsed,moving:true,alive:true});continue;}
    }
    if(bot.kit?.character==='cat'&&!interactPlant&&!interactDefuse&&elapsed>=(bot.nextSkillAt||0)){
      let cast=null;const bookmark=ordinarySkills.catBookmark(bot.id,elapsed);
      if(bot.kit.ultPoints>=7&&catBotClockUseful(bot)&&!ordinarySkills.clockFrozen(elapsed))cast=activateAbility(bot,'x');
      if(!cast&&bookmark&&bot.hp<45)cast=activateAbility(bot,'c');
      if(!cast&&enemy&&visibleBetween(bot,enemy)){const aim={yaw:Math.atan2(-(enemy.x-bot.x),-(enemy.z-bot.z)),pitch:Math.atan2((enemy.y||0)+1.3-((bot.y||0)+1.7),Math.hypot(enemy.x-bot.x,enemy.z-bot.z))};cast=activateAbility(bot,'q',{aim});if(!cast&&!bookmark&&bot.hp>60)cast=activateAbility(bot,'c');}
      if(!cast&&!enemy){const aim=catBotFetchAim(bot);if(aim)cast=activateAbility(bot,'e',{aim});}
      bot.nextSkillAt=elapsed+(cast?1:.5);
    }
    if(bot.kit?.character==='duck'&&!interactPlant&&!interactDefuse&&elapsed>=(bot.nextSkillAt||0)){
      let cast=null;
      if(enemy&&visibleBetween(bot,enemy)){
        const aim={yaw:Math.atan2(-(enemy.x-bot.x),-(enemy.z-bot.z)),pitch:Math.atan2((enemy.y||0)+1.3-((bot.y||0)+1.7),Math.hypot(enemy.x-bot.x,enemy.z-bot.z))};
        if(bot.kit.ultPoints>=7)cast=activateAbility(bot,'x');
        if(!cast&&actorGrounded(bot)&&!ordinarySkills.events(elapsed).some(e=>e.type==='duck-pad'&&e.sourceId===bot.id))cast=activateAbility(bot,'c',{aim:{...aim,pitch:-1.2}});
        if(!cast&&bot.hp<70)cast=activateAbility(bot,'q',{aim:{...aim,pitch:-.5}});
      }
      if(cast)bot.nextSkillAt=elapsed+1;
    }
    if(bot.kit?.character==='duck'&&!interactPlant&&!interactDefuse&&enemy&&visibleBetween(bot,enemy)&&ordinarySkills.blindUntil(bot.id,elapsed)<=elapsed&&!(bot.aiReload>0)&&bot.vy<=0)duckFlap(bot);
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
        const ring={x:watch.x+Math.cos(aim.yaw)*2,y:watch.y??bot.y??0,z:watch.z-Math.sin(aim.yaw)*2};
        if(dist>0&&dist<=FROST_SKILLS.stitchRange+FROST_SKILLS.stitchRadius){
          const landing=getSkillTarget(bot,'frost-stitch',ring,aim);
          const pose=enemy?ordinaryActorView(enemy):{x:watch.x,y:watch.y??bot.y??0,z:watch.z,grounded:true,id:watch.id||'watched-location',team:bot.team==='blue'?'red':'blue',alive:true,hp:100};
          const stitch=landing&&{type:'frost-stitch',team:bot.team,...landing,radius:FROST_SKILLS.stitchRadius};
          const queries={reachable:ordinaryReachable,groundHeight:ordinaryGroundHeight};
          if(stitch&&ordinarySkills.wouldStitch(pose,stitch,queries)&&!ordinarySkills.events(elapsed).some(event=>event.team===bot.team&&ordinarySkills.wouldStitch(pose,event,queries)))cast=activateAbility(bot,'c',{zonePoint:ring,aim});
        }
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
    if(trafficEscape){
      bot.moving=advance(bot,trafficEscape,'bus-escape');
    }else if(interactPlant){
      match.interactPlant(dt*(ordinarySkills.nobiWork?.(bot.id,elapsed,bot,ordinaryReachable)||1),{actorId:bot.id,team:bot.team,site:plantSite.id,x:bot.x,z:bot.z,stationary:true});
      face(bot,site);
    }else if(interactDefuse){
      match.interactDefuse(dt*(ordinarySkills.nobiWork?.(bot.id,elapsed,bot,ordinaryReachable)||1),{actorId:bot.id,team:bot.team,near:true,stationary:true});
      face(bot,spike);
    }else if(enemy){
      // A deadline cannot be solved by standing still in an endless duel.
      if(goal&&role?.urgent&&distance(bot,goal)>1.7)bot.moving=advance(bot,goal,'urgent');
      else if(bot.aiReload>0&&bot.reloadGoal)bot.moving=advance(bot,bot.reloadGoal,'reload');
      else if(goal&&enemyDistance>25&&distance(bot,goal)>5)bot.moving=advance(bot,goal,'advance-contact');
      const aligned=face(bot,enemy,8);bot.pathTime=Math.min(bot.pathTime||0,.15);
      // Arm the round-long refill before an eligible gun fight, independently
      // of C's cooldown. Only the current visible target can justify spending X.
      if(bot.kit?.character==='renko'&&bot.kit.ultPoints>=7&&!renkoUltimateActive(bot)&&aligned&&elapsed>=bot.reactionUntil&&bot.aiAmmo>0&&spec.mag>0&&!bot.serviceReload&&!(bot.aiReload>0)&&elapsed>=(bot.nextRenkoUltAt||0)&&visibleBetween(bot,enemy)){
        const restart=activateAbility(bot,'x');bot.nextRenkoUltAt=elapsed+(restart?1:.5);
      }
      // Renko uses the same finite body turn and reaction as a gun shot.
      // C needs a currently visible body; a frozen lastSeen is not a target.
      if(bot.kit?.character==='renko'&&aligned&&elapsed>=bot.reactionUntil&&!bot.serviceReload&&!(bot.aiReload>0)&&elapsed>=(bot.nextSkillAt||0)){
        let cast=null;
        if(enemy.alive&&!carMotionActive(enemy)&&visibleBetween(bot,enemy)){
          const aim={yaw:Math.atan2(bot.x-enemy.x,bot.z-enemy.z),pitch:Math.atan2((enemy.y||0)+1-(enemy.crouch||0)*.4-((bot.y||0)+1.7-(bot.crouch||0)*.55),distance(bot,enemy))};
          cast=activateAbility(bot,'c',{aim});
        }
        bot.nextSkillAt=elapsed+(cast?2:.5);
      }
      // Only consecutive visible samples establish a stationary target.
      // Never use a hidden actor's velocity or a stale pre-occlusion sample.
      const sample=bot.aimSample,sampleDt=sample?elapsed-sample.at:0;
      const targetSpeed=sample?.id===enemy.id&&sampleDt>0&&sampleDt<=.2?Math.hypot(enemy.x-sample.x,(enemy.y||0)-sample.y,enemy.z-sample.z)/sampleDt:Infinity;
      bot.aimSample={id:enemy.id,x:enemy.x,y:enemy.y||0,z:enemy.z,at:elapsed};
      if(!aligned||targetSpeed>.65)bot.aimStillSince=elapsed;
      const settled=aligned&&elapsed-(bot.aimStillSince??elapsed)>=.2;
      if(!renkoUnarmed(bot)&&aligned&&elapsed>=bot.reactionUntil&&elapsed>=(bot.skillThrowUntil||0)&&bot.fire<=0&&!(bot.aiReload>0)){
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
          if(spec.mag>0)bot.fire*=(ordinarySkills.nobiInterval?.(bot.id,elapsed,bot,ordinaryReachable)||1)*(ordinarySkills.urchinInterval?.(bot.id,elapsed)||1);
          let chance=cfg.aim*(settled?1:.76)*Math.max(.6,1-enemyDistance/160);
          // Faster visible motion is continuously harder to track, including
          // vertical flight. Unknown/reacquired motion never grants still aim.
          const trackingScale=Number.isFinite(targetSpeed)?1/(1+Math.max(0,targetSpeed-.65)/4):.25;
          chance*=trackingScale;
          if(bot.moving&&!steadyAirAim(bot)&&!(ordinarySkills.carGyro(bot.id,elapsed)&&actorGrounded(bot)))chance*=.72;
          if(spec.mag>0&&!spec.arsenal&&ordinarySkills.capLocked?.(bot.id,elapsed))chance*=CAP_SKILLS.lockAimScale;
          const hit=Math.random()<chance,head=hit&&Math.random()<(settled?.34:.13);
          const from=new THREE.Vector3(bot.x,(bot.y||0)+1.2,bot.z);
          const to=new THREE.Vector3(enemy.x,(enemy.y||0)+(head?1.62:1.15)-(enemy.crouch||0)*.55,enemy.z);
          if(!hit){to.x+=(Math.random()-.5)*1.8;to.y+=(Math.random()-.5)*.8;}
          if(spec.arsenal){fireArsenal(bot,from,to.clone().sub(from).normalize(),spec,!bot.moving);sound('enemy',{weapon:weaponId,entity:bot});}
          else{
          const clearShot=map.collision.rayClear(from.x,from.y,from.z,to.x,to.y,to.z)&&(!map.traffic||map.traffic.rayClear(from,to,elapsed));let bounceSurface=null;
          if(!clearShot){
            direction.subVectors(to,from).normalize();raycaster.set(from,direction);raycaster.far=from.distanceTo(to);
            const surface=raycaster.intersectObject(environment,true).find(busSurfaceVisible);
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
    }else if(decoyTarget&&!bot.serviceReload&&elapsed>=(bot.skillThrowUntil||0)&&visibleBetween(bot,decoyTarget)){
      bot.goal={x:decoyTarget.x,z:decoyTarget.z};bot.pathTime=0;
      const aligned=face(bot,decoyTarget,8);
      if(!renkoUnarmed(bot)&&aligned&&elapsed>=bot.decoySeen.get(decoyTarget.id)-1.05&&bot.fire<=0&&!(bot.aiReload>0)){
        if(bot.aiAmmo<=0){if(ordinarySkills.urchinJammed(bot.id,elapsed))bot.fire=.2;else{bot.aiReload=spec.reload||1.7;bot.fire=bot.aiReload;}}
        else{
          const from=new THREE.Vector3(bot.x,(bot.y||0)+1.7,bot.z),to=new THREE.Vector3(decoyTarget.x,decoyTarget.y+1.55,decoyTarget.z),aim=to.clone().sub(from).normalize();
          botsGroup.updateMatrixWorld(true);const ray=new THREE.Raycaster(from,aim,0,from.distanceTo(to)+1);
          const blocking=ray.intersectObjects([environment,botsGroup],true).find(hit=>hit.object.userData.bot!==bot&&(!hit.object.userData.bot||hit.object.userData.bot.alive));
          const fake=raycastNopeDecoy(from,aim,blocking?.distance??from.distanceTo(to)+1,bot.team);
          if(!ordinarySkills.capMagazine(bot.id,elapsed))bot.aiAmmo--;crownShot(bot);bot.fire=Math.max(spec.interval,.4)*(spec.mag>0?(ordinarySkills.nobiInterval?.(bot.id,elapsed,bot,ordinaryReachable)||1)*(ordinarySkills.urchinInterval?.(bot.id,elapsed)||1):1);bot.flash=.065;bot.shotSequence=(bot.shotSequence||0)+1;bot.muzzle.visible=true;
          const shield=ordinarySkills.interceptShield(from,aim,fake?.distance??blocking?.distance??from.distanceTo(to)+1,spec.body||1,elapsed,match.round);
          urchinTridentShot(bot,from,aim,spec);
          tracer(from,shield?new THREE.Vector3(shield.point.x,shield.point.y,shield.point.z):fake?.point||blocking?.point||to,bot.team==='blue'?'#a5eee0':'#ff7b76',.09);sound('enemy',{weapon:weaponId,entity:bot});
          if(fake&&!shield)hitNopeDecoy(fake.event,bot);
        }
      }
    }else if(bot.aiReload>0&&bot.reloadGoal&&!role?.urgent)bot.moving=advance(bot,bot.reloadGoal,'reload');
    else if(goal)bot.moving=advance(bot,goal,search?'search':heard?'heard':role?.role||'objective');
    // Spend hush on the final approach after this frame really advanced,
    // not at every spawn or from the cleared animation flag above. The
    // known objective/investigation goal never supplies a hidden actor.
    if(bot.kit?.character==='duck'&&!enemy&&!decoyTarget&&goal&&distance(bot,goal)>2&&distance(bot,goal)<=18&&bot.moving&&actorGrounded(bot)&&!interactPlant&&!interactDefuse&&!(bot.aiReload>0)&&ordinarySkills.blindUntil(bot.id,elapsed)<=elapsed&&bot.kit.dash>0&&!duckFlight(bot)&&elapsed>=(bot.nextHushAt||0)){
      const hush=activateAbility(bot,'e');bot.nextHushAt=elapsed+(hush?1:.5);
    }
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
    if(bot.stepClock>.41){bot.stepClock=0;if(!ordinarySkills.quiet(bot.id,elapsed)){if(distance(bot,player)<19)sound('step',{entity:bot});else botHearing.emit(bot,map.ductAt?.(bot.x,bot.z,bot.y)?'duct-step':'step',elapsed);}}
  }
  separateBots(dt);
}
function separateBots(dt){
  if(match?.phase!=='live')return;
  const actors=[...(player.alive&&player.y<1?[player]:[]),...bots.filter(bot=>bot.alive)];
  const movable=actor=>actor!==player&&!actor.planting&&!actor.defusing;
  // Resolve crowded escorts without moving the player or interrupting a committed plant.
  for(let pass=0;pass<2;pass++)for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++){
    const a=actors[i],b=actors[j];if(carMotionActive(a)||carMotionActive(b)||a.trcLadder||b.trcLadder||Math.abs((a.y||0)-(b.y||0))>.7)continue;let dx=b.x-a.x,dz=b.z-a.z,dist=Math.hypot(dx,dz);
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
    if(actor.trcLadder&&actor.alive)return;
    if(updateRenkoVertical(actor,dt,radius))return;
    if(applyStarHold(actor))return;
    // A support can walk upstairs before a later actor's vertical turn. Keep
    // its former resting contact until the single carry pass resolves it.
    if(grassFrame?.riders.some(r=>r.actor===actor)&&Math.abs(actor.vy||0)<1e-5){
      const rider=grassFrame.riders.find(r=>r.actor===actor),p=grassFrame.shapes.get(rider.owner);
      if(grassUsable(actor)&&grassPlatforms().some(q=>q.id===p.id)&&Math.abs(actor.y-p.top)<=.035&&grassOverlaps(p,actor.x,actor.z,radius))return;
    }
    const flight=duckFlight(actor);
    const heads=grassPlatforms().filter(p=>p.id!==actor.id);
    const verticalSteps=Math.max(1,Math.ceil(dt*120)),verticalDt=dt/verticalSteps;
    for(let i=0;i<verticalSteps;i++){
      const height=actorBodyHeight(actor),previousFeet=actor.y,nextFeet=previousFeet+actor.vy*verticalDt-7.5*verticalDt*verticalDt;
      actor.vy-=15*verticalDt;let support=map.floorBaseAt?.(actor.x,actor.z)??0,ceiling=flight?Math.min(11,flight.y+DUCK_SKILLS.flightHeight):Infinity;
      if(nextFeet>previousFeet){
        for(const p of heads)if(previousFeet+height<=p.base+.00001&&nextFeet+height>=p.base&&grassOverlaps(p,actor.x,actor.z,radius))ceiling=Math.min(ceiling,p.base-height);
        for(const c of map.collision.query(actor.x,actor.z,radius)){
          if(c.disabled)continue;
          const underside=c.base||0;
          if(previousFeet+height>underside+.00001||nextFeet+height<underside)continue;
          if(map.collision.overlaps(c,actor.x,actor.z,radius))ceiling=Math.min(ceiling,underside-height);
        }
      }
      if(actor.vy<=0){
        for(const p of heads)if(previousFeet>=p.top-.00001&&nextFeet<=p.top&&grassOverlaps(p,actor.x,actor.z,radius))support=Math.max(support,p.top);
        const ramp=rampFloor(actor.x,actor.z);
        if(ramp!==null&&previousFeet>=ramp-.00001&&nextFeet<=ramp)support=ramp;
        for(const c of map.collision.query(actor.x,actor.z,radius)){
          if(c.disabled)continue;
          if(c.height<=support||previousFeet<c.height-.00001||nextFeet>c.height)continue;
          if(map.collision.overlaps(c,actor.x,actor.z,radius))support=c.height;
        }
      }
      actor.y=nextFeet;
      if(actor.y>=ceiling){actor.y=ceiling;actor.vy=0;}
      if(actor.vy<=0&&actor.y<=support){actor.y=support;actor.vy=0;actor.duckPadUntil=0;}
    }
}
function tickDuckPads(){
  if(match?.phase!=='live')return;
  const actors=[player,...bots],pads=ordinarySkills.events(elapsed);
  for(const actor of isGuest()?[player]:actors){
    if(!actor.alive||actor.planting||actor.defusing||actor.trafficLaunch||carMotionActive(actor)||busSeat(actor)||!actorGrounded(actor))continue;
    const e=ordinarySkills.duckPad(ordinaryActorView(actor),elapsed,{groundHeight:ordinaryGroundHeight});
    if(!e||!actors.some(a=>a.id===e.sourceId&&a.alive&&a.team===e.team)||actor.duckPadAt===elapsed)continue;
    actor.duckPadAt=elapsed;actor.duckPadUntil=elapsed+4;actor.duckPadRound=match.round;actor.duckPadTeam=actor.team;actor.vy=DUCK_SKILLS.padVelocity;sound('duck-launch',{entity:actor,localOnly:true});
    if(actor===player)skillFeedback.note('cast','pad:'+e.id+':'+elapsed,'duck',elapsed,'羽根の跳び床');
  }
}
function duckPadAirborne(actor){return actor?.alive&&actor.duckPadUntil>elapsed&&actor.duckPadRound===match?.round&&actor.duckPadTeam===actor.team;}
function updatePlay(dt){
  if(!match)return;elapsed+=dt;syncRenkoJets();map.traversal?.update(dt);
  if(isGuest()&&!netHasSnapshot)return;
  beginGrassFrame();
  const objectiveWork=mode==='play'&&interactionHeld?objectiveActionFor(player):null;
  player.planting=objectiveWork?.kind==='plant';player.defusing=objectiveWork?.kind==='defuse';
  if(objectiveWork){player.vx=0;player.vz=0;}
  refillMapPracticeSkills();refillRangeAmmo();tickDuckPads();player.kit.tick(elapsed);for(const bot of bots)bot.kit?.tick(elapsed);updateAbilityFeedback();
  syncSmokes(serializeSmokes().filter(s=>s.expires>elapsed));updateSmokeAppearance(elapsed);
  if(rangeSession){
    if(rangeSession.tick(dt)){finishRange();return;}
    if(rangeRespawn>0){rangeRespawn-=dt;if(rangeRespawn<=0)spawnRangeTarget();}
  }
  if(spectatedBot){spectatedBot.group.visible=spectatedBot.alive||spectatedBot.death>0;spectatedBot=null;}
  const controlled=mode==='play'&&player.alive&&!carMotionActive(player)&&!busSeat();
  const yaw=player.yaw;
  const forward=controlled&&!objectiveWork?((keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)-touchMove.y):0;
  const side=controlled&&!objectiveWork?((keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+touchMove.x):0;
  const moveX=-Math.sin(yaw)*forward+Math.cos(yaw)*side,moveZ=-Math.cos(yaw)*forward-Math.sin(yaw)*side;
  const len=Math.hypot(moveX,moveZ);
  const slideSpeed=frostSlideSpeed(player),crouching=controlled&&(slideSpeed>0||keys.has('KeyV')||keys.has('ControlLeft')||keys.has('ControlRight')||keys.has('TouchCrouch'));
  const nextCrouch=THREE.MathUtils.lerp(player.crouch,crouching?1:0,1-Math.exp(-dt*16));
  if(nextCrouch>=player.crouch||canStand(player.x,player.z,.34,player.y,1.7-nextCrouch*.55)&&grassHeadClear(player,player.x,player.z,.34,player.y,1.7-nextCrouch*.55))player.crouch=nextCrouch;
  const walking=keys.has('ShiftLeft')||keys.has('ShiftRight');
  const slow=actorSpeedScale(player)*(map.ductAt?.(player.x,player.z,player.y)?.6:1),speed=(slideSpeed|| (crouching||player.crouch>.5?1.8:(walking?2.8:inventory.active==='knife'?6.3:5.4)*1.15))*(aiming?.78:1)*slow;
  let desiredX=moveX/Math.max(1,len)*speed,desiredZ=moveZ/Math.max(1,len)*speed;
  const jet=controlled?renkoFlight(player):null,drive=controlled?renkoDriveMotion(player,jet?null:renkoEvent(player,'renko-drive'),elapsed,dt,{x:moveX,z:moveZ,crouch:crouching,grounded:actorGrounded(player)}):null;
  if(drive){desiredX=drive.x*(walking?2.8/RENKO_SKILLS.runSpeed:1)*(aiming?.78:1)*slow;desiredZ=drive.z*(walking?2.8/RENKO_SKILLS.runSpeed:1)*(aiming?.78:1)*slow;}
  if(jet){const horizontal=Math.cos(player.pitch)*RENKO_SKILLS.flightSpeed*slow;desiredX=-Math.sin(yaw)*horizontal;desiredZ=-Math.cos(yaw)*horizontal;}
  if(drive||jet){player.vx=desiredX;player.vz=desiredZ;}else if(controlled&&!slideSpeed){
    // Adapted from collaborator PR44: vector acceleration, release inertia,
    // and faster opposite-key braking. Short steps split braking through zero.
    const steps=Math.max(1,Math.ceil(dt*240)),step=dt/steps;
    for(let i=0;i<steps;i++){
      const current=Math.hypot(player.vx,player.vz);
      if(!len){
        const scale=current?Math.max(0,current-22*step)/current:0;
        player.vx*=scale;player.vz*=scale;
      }else{
        const reverse=player.vx*desiredX+player.vz*desiredZ<0;
        const dx=desiredX-player.vx,dz=desiredZ-player.vz,distance=Math.hypot(dx,dz);
        const scale=distance?Math.min(1,(reverse?85:32)*step/distance):0;
        player.vx+=dx*scale;player.vz+=dz*scale;
      }
    }
  }else{
    // Preserve skill-driven slide acceleration and non-controlled cleanup.
    const rate=(len?45:75)*dt;
    player.vx+=clamp(desiredX-player.vx,-rate,rate);player.vz+=clamp(desiredZ-player.vz,-rate,rate);
  }
  const velocity=Math.hypot(player.vx,player.vz);if(!drive&&!jet&&(slow<1||player.turfMovementEnded)&&velocity>speed){player.vx*=speed/velocity;player.vz*=speed/velocity;}player.turfMovementEnded=false;
  const previousY=player.y,previousVy=player.vy,previousX=player.x,previousZ=player.z;
  if(player.alive&&!player.carMotion&&!busSeat()){
    if(player.trcLadder)map.traversal.climb(player,controlled?forward:0,dt,walking);
    if(map.ductAt?.(player.x,player.z,player.y))player.dashTimer=0;
    if(player.dashTimer>0){const step=Math.min(dt,player.dashTimer);moveEntity(player,player.dashVec.x*(12/.18)*step,player.dashVec.z*(12/.18)*step);player.dashTimer-=step;player.vx=0;player.vz=0;}else moveEntity(player,player.vx*dt,player.vz*dt);
    updateActorVertical(player,dt);
    const running=controlled&&(slideSpeed>0||!walking&&!crouching&&player.crouch<.5)&&player.vy===0&&Math.hypot(player.x-previousX,player.z-previousZ)>dt*2;
    stepClock=running?stepClock+dt:0;
    if(stepClock>.35){stepClock=0;sound('step');}
    trcMotionSound(player,dt,{x:previousX,y:previousY,z:previousZ},walking);
    if(previousVy<-.8&&player.vy===0&&previousY>player.y+.005)sound('land');
  }
  if(!player.alive&&!isGuest()&&!player.carMotion&&player.carFallUntil>elapsed&&!player.trafficLaunch&&player.vy)updateActorVertical(player,dt);
  player.moving=controlled&&Math.hypot(player.x-previousX,player.z-previousZ)>dt*.5;
  scanTime=Math.max(0,scanTime-dt);
  player.recoil=Math.max(0,player.recoil-dt*.065);kick=Math.max(0,kick-dt*.4);
  renderedRecoil=THREE.MathUtils.lerp(renderedRecoil,player.recoil,1-Math.exp(-dt*22));
  if(elapsed-lastShot>.3)shotSequence=0;
  if(map.traffic||map.traversal||!exploring||objectivePractice&&!objectivePractice.completed)updateInteraction(dt,controlled&&Math.hypot(player.x-previousX,player.z-previousZ)<dt*.25&&player.vy===0);
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
    if(watched){spectatedBot=watched;if(match.phase==='live')lastSpectatedId=watched.id;watched.group.visible=victoryCamera.active&&victoryCamera.subject!==watched;camera.position.set(watched.x,1.65+(watched.y||0)-(watched.crouch||0)*.55,watched.z);camera.rotation.set(0,watched.group.rotation.y+Math.PI,0);$('spectator-hint').textContent=`${watched.record.name} を観戦中 · クリックで切り替え`;}
    else $('spectator-hint').textContent='倒されました · 次のラウンドで復帰します';
    setVisible('spectator-hint',true);
  }
  const withinSmoke=smokes.find(s=>camera.position.distanceToSquared(s.mesh.position)<s.radius*s.radius),withinField=activeOrdinarySmokeFields().find(s=>(camera.position.x-s.x)**2+(camera.position.y-s.y)**2+(camera.position.z-s.z)**2<s.radius*s.radius),obscured=withinSmoke||withinField;scene.fog.near=obscured?.1:145;scene.fog.far=obscured?2.5:380;scene.fog.color.set(withinSmoke?.kind==='veil'?'#77718f':withinField?.type==='veil-dust'?'#8d7659':withinField?.type==='frost-mist'?'#c3bfdb':withinField?.type==='duelist-comet'?'#abcddd':withinField?'#b6bb72':withinSmoke?'#a9c6d2':'#b7d0dd');
  const sightViewer=!player.alive&&spectatedBot?spectatedBot:player;
  if(ordinarySkills.nearsightUntil(sightViewer.id,elapsed)>elapsed&&!obscured){scene.fog.near=URCHIN_SKILLS.gloomSight*.45;scene.fog.far=URCHIN_SKILLS.gloomSight;scene.fog.color.set('#071d29');}
  const cycle=sniperCycleRemaining();
  const scoped=!!(!renkoUnarmed(player)&&aiming&&!cycle&&controlled&&weapon().scope&&!reloading&&!player.serviceReload&&!interactionHeld);
  setVisible('sniper-scope',scoped);gun.visible=player.alive&&inventory.active!=='spike'&&!scoped;
  camera.fov=THREE.MathUtils.lerp(camera.fov,scoped?weapon().scope:!renkoUnarmed(player)&&aiming&&!cycle&&controlled?62:76,Math.min(1,dt*12));camera.updateProjectionMatrix();
  if(firing&&mode==='play'&&player.alive&&!busDriving()){
    for(let count=0;count<12&&firing&&elapsed-lastShot+1e-8>=nobiShotInterval(weapon(),player);count++){
      const previousShot=lastShot;
      shoot(Math.max(lastShot+nobiShotInterval(weapon(),player),elapsed-dt));
      if(lastShot===previousShot)break;
    }
  }
  updateTeamAbilities();
  if(!isGuest()&&player.alive&&!rangeSession)updatePlayerShotModel(dt);
  updateBots(dt);
  if(map.bomberCollapse?.active&&!isGuest()&&match.phase==='post')for(const bot of bots){
    if(!bot.alive||busSeat(bot)||bot.carMotion||bot.trafficLaunch||bot.remoteId&&duckPadAirborne(bot))continue;
    updateActorVertical(bot,dt,.4);bot.group.position.set(bot.x,bot.y||0,bot.z);
  }
  updateTraffic(dt);
  updateCarMotions(dt);
  carryGrassRiders();
  if(player.alive&&busSeat()){map.traffic.service.place(player,elapsed);const p=map.traffic.poses(elapsed).find(p=>p.id===busSeat().busId);if(busDriving())player.yaw=p.yaw+Math.PI;camera.rotation.set(player.pitch,player.yaw,0);gun.visible=!busDriving();}
  if(player.alive&&(carMotionActive(player)||busSeat()))camera.position.set(player.x,1.7-player.crouch*.55+player.y,player.z);
  botThinkTick-=dt;
  if(botThinkTick<=0){botThinkTick=.25;const front=new THREE.Vector3();camera.getWorldDirection(front);for(const bot of bots){if(bot.team===player.team||!bot.alive)continue;const offset=new THREE.Vector3(bot.x-player.x,0,bot.z-player.z);if(player.alive&&offset.length()<42&&offset.normalize().dot(front)>.55&&visibleBetween(player,bot))bot.spottedUntil=elapsed+.6;}}
  if(!exploring&&!isGuest()){match.tick(dt,{clockPaused:match.phase==='live'&&ordinarySkills.clockFrozen(elapsed),blueAlive:aliveCount('blue'),redAlive:aliveCount('red'),playerAlive:player.alive});handleMatchEvents();}
  timeLeft=match.phase==='buy'||match.phase==='post'?match.phaseTime:match.spike.status==='planted'?match.spike.timer:match.roundTime;
  updateFirstPersonEquipment(dt);
  const s=match.spike;spikeModel.position.set(s.x,s.y||0,s.z);objectiveModel.update({time:elapsed,...s,practice:!!objectivePractice});
  if(s.status==='planted'&&!objectivePractice){
    const interval=s.timer<5?.15:s.timer<10?.3:s.timer<20?.6:1;
    if(elapsed-lastSpikeBeep>=interval){lastSpikeBeep=elapsed;sound('spike',{entity:s});}
  }
  damageFlash=Math.max(0,damageFlash-dt);hitFlash=Math.max(0,hitFlash-dt);
  $('damage').style.opacity=damageFlash*1.4;$('hitmarker').style.opacity=hitFlash>0?'1':'0';
  $('crosshair').classList.toggle('aiming',aiming);$('crosshair').classList.toggle('moving',len>0&&!aiming);
  // Shots, abilities and actions still refresh immediately at their call sites.
  // The timer/status DOM need not be rebuilt at mouse/display polling speed.
  if((hudRefresh-=dt)<=0)updateHUD();
  if(mode==='shop')updateShop();if(mode==='score')updateScoreboard();
}
function objectiveActionFor(actor){
  if(!actor.alive||actor.trcLadder||match?.phase!=='live'||busSeat(actor)||carMotionActive(actor)||actor.dashTimer>0||frostSlideSpeed(actor)>0||renkoFlight(actor)||renkoSliding(actor)||actor.trafficLaunch?.endsAt>elapsed||actor.carImpulseUntil>elapsed||Math.abs(actor.y||0)>.05||(actor.vy||0)!==0||objectivePractice?.completed)return null;
  const s=match.spike;
  if(actor.team===match.attackerTeam&&s.status==='carried'&&s.carrier===actor.id){
    const site=map.sites.find(p=>isInsideSite(p,actor.x,actor.z));if(site)return{kind:'plant',site};
  }
  if(actor.team===match.defenderTeam&&s.status==='planted'&&Math.hypot(actor.x-s.x,actor.z-s.z)<2.3&&(!s.defuseActor||s.defuseActor===actor.id))return{kind:'defuse'};
  return null;
}
function useNearbyObject(){
  if(trcInteract()||busInteract())return true;
  const drop=droppedWeapons.find(d=>Math.hypot(d.x-player.x,player.y-(d.y||0),d.z-player.z)<1.5);
  if(!drop)return false;
  if(isGuest())queueNetAction('pickup',{dropId:drop.id});
  else if(pickupDroppedWeapon(player,drop.id))showMessage('WEAPON PICKED UP',weapon().name,1);
  return true;
}
function updateInteraction(dt,stationary){
  const trc=(exploring&&!objectivePractice||!objectiveActionFor(player))&&match.phase==='live'&&map.traversal?.nearby(player);
  if(trc){cancelPlantAndEquip(player);if(!isGuest())match.cancelDefuse(player.id);setVisible('interaction',true);$('interaction-key').textContent='F';$('interaction-title').textContent=trc.label;$('interaction-progress').style.width='0%';if($('mobile-interact-label'))$('mobile-interact-label').textContent='F';return;}

  if(exploring&&!objectivePractice){setVisible('interaction',false);return;}
  const grounded=Math.abs(player.y)<=.05&&player.vy===0;
  stationary=stationary&&grounded;
  const s=match.spike,live=match.phase==='live'&&player.alive;
  if(player.alive&&!isGuest()&&actorGrounded(player)&&!busSeat())match.pickupSpike(player.id,player.team,player.x,player.z,player.y);
  const site=map.sites.find(p=>isInsideSite(p,player.x,player.z));
  const plant=live&&ownSide()==='attack'&&s.status==='carried'&&s.carrier===player.id&&site;
  const defuse=live&&ownSide()==='defend'&&s.status==='planted'&&Math.hypot(player.x-s.x,player.z-s.z)<2.3;
  const nearbyDrop=live&&!plant&&!defuse?droppedWeapons.find(d=>Math.hypot(d.x-player.x,player.y-(d.y||0),d.z-player.z)<1.5):null;
  const bus=live&&!plant&&!defuse?map.traffic?.service.candidate(player,elapsed):null;
  if(bus){cancelPlantAndEquip(player);if(!isGuest())match.cancelDefuse(player.id);setVisible('interaction',bus.available);$('interaction-key').textContent='F';$('interaction-title').textContent=bus.available?(bus.kind==='board'?'乗車':bus.kind==='drive'?'運転席':'降車'):' ';$('interaction-progress').style.width='0%';$('mobile-interact-label').textContent='F';$('mobile-interact-hint').textContent='タップ';return;}
  const held=interactionHeld&&mode==='play',work=held?objectiveActionFor(player):null;
  $('interaction-key').textContent=(plant||defuse)?'4':'F';
  if(work&&stationary){
    cancelServiceReload(player);reloading=0;firing=false;
    if(!isGuest()){
      if(plant)match.interactPlant(dt*(ordinarySkills.nobiWork?.(player.id,elapsed,player,ordinaryReachable)||1),{actorId:player.id,team:player.team,site:site.id,x:player.x,z:player.z,stationary:true});
      else match.interactDefuse(dt*(ordinarySkills.nobiWork?.(player.id,elapsed,player,ordinaryReachable)||1),{actorId:player.id,team:player.team,near:true,stationary:true});
    }
  }else{cancelPlantAndEquip(player);if(!isGuest())match.cancelDefuse(player.id);}
  const progress=plant?s.plantProgress/4:s.defuseProgress/7;
  const remaining=Math.max(0,(plant?4:7)-(held?(plant?s.plantProgress:s.defuseProgress):defuse?s.checkpoint:0))/(ordinarySkills.nobiWork(player.id,elapsed,player,ordinaryReachable)||1);
  const teammateDefusing=defuse&&s.defuseActor&&s.defuseActor!==player.id;
  const instruction=!grounded?'地面に降りて':held&&!stationary?'静止して':teammateDefusing?'味方が電源オフ中':'';
  setVisible('interaction',!!(plant||defuse||nearbyDrop));
  if($('mobile-interact-label'))$('mobile-interact-label').textContent=plant?'設置':defuse?'電源オフ':nearbyDrop?'拾う':'4';
  if($('mobile-interact-hint'))$('mobile-interact-hint').textContent=(plant||defuse)?instruction?(instruction==='静止して'?'止まって':instruction):held?`${remaining.toFixed(1)}秒`:`${defuse&&s.checkpoint?'残り':''}${Number(remaining.toFixed(1))}秒長押し`:nearbyDrop?'タップ':'長押し';
  if(plant||defuse){$('interaction-title').textContent=`${instruction?`${instruction} · `:held?'':'4 長押し · '}BOMBER ${plant?'設置':'電源オフ'} 残り${remaining.toFixed(1)}秒${defuse&&s.checkpoint?' · 半分まで保存済み':''}`;$('interaction-progress').style.width=`${progress*100}%`;}
  else if(nearbyDrop){$('interaction-title').textContent=`F · ${WEAPONS[nearbyDrop.weapon].name} を拾う · ${nearbyDrop.ammo} / ${nearbyDrop.reserve}`;$('interaction-progress').style.width='0%';}

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
  client?.close(notify);resetTraffic();netActions=[];netInputs.clear();netApplied.clear();netParticipants.clear();player.id='player';player.team='blue';
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
  $('online-start').hidden=!online.host;$('online-start').disabled=!!saving||room.status!=='lobby';
  $('online-ready').disabled=room.status!=='lobby';
  $('online-format').disabled=locked;$('online-map').disabled=locked;
  if(!saving||room.status==='playing'){
    $('online-map').value=normalizeMapId(room.settings.mapId);$('online-format').value=room.settings.format;
  }
  const roomMap=room.settings.mapId==='trc'?'TRC 同人音楽即売会':room.settings.mapId==='hirakata'?'枚方市駅 / 南北ロータリー':'橋本駅';
  $('online-intro').textContent=saving?'マップと試合形式を保存しています…':`${roomMap} · ${room.settings.format==='standard'?'STANDARD / 13ラウンド先取':'SWIFT / 5ラウンド先取'}。最大10人、空き枠にはBOTが参加します。`;
  if(room.status==='lobby'&&onlinePlaying){
    onlinePlaying=false;netHasSnapshot=false;netHostPaused=false;netActions=[];netInputs.clear();netApplied.clear();netParticipants.clear();netPositionHistory.clear();
    player.id='player';player.team='blue';backMenu({keepParty:true});
    setVisible('online-entry',false);setVisible('online-lobby',true);setVisible('online-overlay',true);$('online-error').textContent='';
  }
  if(room.status==='playing'&&!onlinePlaying){
    onlinePlaying=true;netSequence=0;netLastSnapshot=0;netActionSequence=0;netActions=[];netApplied.clear();netInputs.clear();netRound=0;netClock=0;netSeenCueSequence=0;netCues.length=0;
    $('match-format').value=room.settings.format;setVisible('online-overlay',false);startGame();
    showMessage('ONLINE MATCH',`${room.members.length} PLAYERS + BOTS · ${room.code}`,4);
  }
  if(onlinePlaying&&online.host)for(const [memberId,entityId] of netParticipants){
    if(memberId===room.hostId)continue;
    const member=room.members.find(m=>m.id===memberId),actor=bots.find(b=>b.id===entityId);
    if(!member){if(actor){match.cancelPlant(actor.id);match.cancelDefuse(actor.id);actor.planting=false;actor.defusing=false;transferEmberControl(actor,false);map.traffic?.service.exit(actor,elapsed,busCanExit);actor.remoteId=null;actor.record.memberId=null;actor.record.netFallback=false;actor.record.name=CHARACTER_DEFS[actor.kit.character].label;}netParticipants.delete(memberId);}
    else if(actor){
      const fallback=member.connected===false&&Date.now()-(netInputs.get(memberId)?.receivedAt||0)>=20000;
      actor.record.netFallback=fallback;
      actor.record.name=fallback?CHARACTER_DEFS[actor.kit.character].label:member.name;
      if(fallback){if(actor.remoteId){match.cancelPlant(actor.id);match.cancelDefuse(actor.id);transferEmberControl(actor,false);map.traffic?.service.exit(actor,elapsed,busCanExit);actor.remoteId=null;actor.planting=false;actor.defusing=false;}}
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
    if(packet.input?.ride!==undefined&&!validGrassRide(packet.input.ride))return;
    if(packet.input?.jet!==undefined&&(typeof packet.input.jet!=='boolean'||packet.input.jet&&(!Number.isFinite(packet.input.yaw)||!Number.isFinite(packet.input.pitch))))return;
    if(packet.input?.crouch!==undefined&&(!Number.isFinite(packet.input.crouch)||packet.input.crouch<0||packet.input.crouch>1))return;
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
    ...(actor.trcLadder?{trcLadder:actor.trcLadder}:{}),hp:actor.hp,armor:actor.armor,alive:actor.alive,...(Number.isFinite(actor.crouch)&&actor.crouch>.0005?{crouch:Math.round(Math.min(1,actor.crouch)*1000)/1000}:{}),moving:local?Math.hypot(player.vx,player.vz)>.5:!!actor.moving,
    weapon:local?inventory.active:actor.netWeapon||record?.primary||record?.secondary||'classic',primary:local?inventory.primary:record?.primary,secondary:local?inventory.secondary:record?.secondary,
    ammo:local?player.ammo:actor.remoteId?actor.netAmmo:actor.aiAmmo,reserve:local?player.reserve:actor.remoteId?actor.netReserve:actor.aiReserve,reloading:local?reloading:actor.remoteId?actor.netReload||0:actor.aiReload||0,credits:local?match.credits:record?.credits||0,
    ...(carMotionActive(actor)?{carMove:[actor.carMotion.id,actor.carMotion.phase,actor.carMotion.endsAt,...[actor.carMotion.vx,actor.carMotion.vz,actor.vy||0].map(n=>Math.round(n*1000)/1000)]}:{}),...(actor.trafficLaunch?{trafficHit:[actor.trafficLaunch.seq,actor.trafficLaunch.endsAt,actor.trafficLaunch.vx,actor.trafficLaunch.vz,actor.vy||0]}:{}),
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
  const selling=action.id.startsWith('sell-'),id=selling?action.id.slice(5):action.id;
  const label=id==='light'?'ライトシールド':id==='heavy'?'ヘヴィーシールド':
    ['c','smoke'].includes(id)?getCharacterSkill(player.kit.character,'c')?.name:
    ['q','updraft'].includes(id)?getCharacterSkill(player.kit.character,'q')?.name:WEAPONS[id]?.name;
  // Cosmetic ledger only. Money, equipment and stock still come from self.
  const key=['c','smoke'].includes(id)?'c':['q','updraft'].includes(id)?'q':null;
  if(key){let ledger=skillPurchaseLedger.get(player.kit);if(!ledger||ledger.round!==match.round||ledger.character!==player.kit.character){ledger={round:match.round,character:player.kit.character,c:[],q:[]};skillPurchaseLedger.set(player.kit,ledger);}if(selling)ledger[key].pop();else ledger[key].push(getCharacterSkill(player.kit.character,key).price);}
  else{const slot=id==='light'||id==='heavy'?'armor':WEAPONS[id]?.slot;if(slot){if(selling)delete roundPurchases[slot];else roundPurchases[slot]={id,price:slot==='armor'?(id==='light'?400:1000):WEAPONS[id].price,round:match.round};}}
  if(mode==='shop'&&$('shop-status'))$('shop-status').textContent=`${label||'装備'} を${selling?'売却':'購入'}しました`;
}
function applyNetSnapshot(packet){
  if((packet.mapId||'hashimoto')!==(map.id||'hashimoto'))return;
  if(!packet.rules||!Array.isArray(packet.actors)||packet.actors.length>10||!Array.isArray(packet.roster)||!Number.isFinite(packet.time))return;
  if(packet.actors.some(a=>!a||a.crouch!==undefined&&(!Number.isFinite(a.crouch)||a.crouch<0||a.crouch>1)))return;
  const ownId=netParticipants.get(online.session.memberId),self=packet.actors.find(a=>a.id===ownId);if(!self)return;
  if(map.traversal&&(!map.traversal.valid(packet.trcDoors)||packet.actors.some(a=>a.trcLadder!==undefined&&!map.traversal.ladders.some(l=>l.id===a.trcLadder))))return;
  if(packet.damageReport!==undefined&&(packet.rules.phase!=='buy'||!roundDamage.restore(packet.damageReport,packet.roster,packet.rules.round,self.team,true)))return;
  if(map.destruction&&!map.destruction.valid(packet.busDamage??''))return;
  if(map.traffic&&!map.traffic.service.restore(packet.busTransit||[],packet.actors.map(a=>a.id),packet.time))return;
  if(map.traversal)map.traversal.restore(packet.trcDoors);
  const fresh=netRound!==packet.rules.round||!netHasSnapshot,previousPhase=match.phase,previousSpikeStatus=match.spike.status,previousSpikeCarrier=match.spike.carrier,wasAlive=player.alive,wasPaused=netHostPaused;
  // A same-round reconnect resets rendering, but must not revive a grounded
  // effect already stopped by this player's movement before its host ACK.
  const retainedFrostStops=fresh&&netRound===packet.rules.round&&player.id===ownId&&player.team===self.team
    ?[...stoppedFrostEvents].filter(([,endsAt])=>endsAt>packet.time):[];
  const ack=packet.acks?.[online.session.memberId]||0;applyNetPurchaseFeedback(packet,self,fresh,ack);netActions=netActions.filter(a=>a.seq>ack);
  netActionSequence=Math.max(netActionSequence,ack,...netActions.map(a=>a.seq));
  applyNetCues(packet,fresh,ownId);
  Object.assign(match,packet.rules);match.events=[];match.credits=self.credits;elapsed=packet.time;roster=packet.roster;
  if(fresh)busHorns.reset();
  map.busModels?.update(elapsed);
  if(match.phase==='buy'){if(packet.damageReport!==undefined)roundDamage.restore(packet.damageReport,roster,match.round,self.team);else roundDamage.reset();}
if(map.destruction){if(fresh||!packet.busDamage)map.destruction.reset();map.destruction.restore(packet.busDamage??'',elapsed,{effects:!fresh&&match.phase==='live',impacts:map.traffic?.poses(elapsed)||[],contacts:Array.isArray(packet.cues)?packet.cues.filter(c=>validBusBreakCue(c,packet)):[]});map.destruction.update(elapsed);}
  const stopped=fresh||wasAlive&&!self.alive||previousPhase!==match.phase&&['post','match'].includes(match.phase);
  if(stopped||wasPaused!==Boolean(packet.paused))clearCombatInput();
  if(mode==='shop'&&match.phase!=='buy')resumeGame();
  if(fresh){victoryMusic.reset();lastRoundAudio='';Object.assign(dashFeedback,{round:null,state:null,expires:0,charge:null,signatureAt:0});clearBots();clearDrops();resetDetonation();resetTakeover();resetTeamAbilities();netPositionHistory.clear();netPositionAck=0;netPositionCorrectionX=0;netPositionCorrectionZ=0;player.x=self.x;player.z=self.z;player.y=self.y;player.vy=0;player.yaw=self.yaw;player.pitch=0;player.recoil=0;renderedRecoil=0;player.vx=0;player.vz=0;player.crouch=self.crouch||0;player.dashTimer=0;player.dashVec=null;player.netPredictDashUntil=0;netRound=match.round;setVisible('round-banner',false);for(const [id,endsAt]of retainedFrostStops)stoppedFrostEvents.set(id,endsAt);}
  else if(!wasAlive&&self.alive){player.x=self.x;player.y=self.y;player.z=self.z;player.vy=0;player.vx=0;player.vz=0;player.crouch=self.crouch||0;player.dashTimer=0;netPositionHistory.clear();netPositionAck=packet.positionAcks?.[online.session.memberId]?.seq||0;netPositionCorrectionX=0;netPositionCorrectionZ=0;clearCombatInput();showMessage('総動員','開始地点へ復帰しました',3);}
  else if(!(player.netPredictDashUntil>elapsed)&&!carMotionMarker(self.carMove,packet.time)&&!carMotionActive(player)&&!(player.carRecoveryUntil>elapsed)){
    const positionAck=packet.positionAcks?.[online.session.memberId],sent=positionAck&&netPositionHistory.get(positionAck.seq);
    if(sent&&positionAck.seq>netPositionAck&&positionAck.round===match.round&&positionAck.connection===(online.connectionId||'legacy')&&[positionAck.x,positionAck.z].every(Number.isFinite)){
      // Compare the host with that input's position, not with the player's newer
      // prediction. Retain movement since sending and subtract corrections that
      // have already been applied while this acknowledgement was in flight.
      let dx=positionAck.x-sent.x-(netPositionCorrectionX-sent.correctionX),dz=positionAck.z-sent.z-(netPositionCorrectionZ-sent.correctionZ);
      if(Math.hypot(dx,dz)>1e-5){
        const x=player.x+dx,z=player.z+dz;
        if(Math.hypot(positionAck.x-sent.x,positionAck.z-sent.z)>2||!canStand(x,z,.34,player.y,actorBodyHeight(player))||!map.collision.segmentClear(player.x,player.z,x,z,.34,player.y,actorBodyHeight(player))){dx=self.x-player.x;dz=self.z-player.z;player.y=self.y;}
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
  if(player.renkoPending&&(fresh||ack>=player.renkoPending.seq||!self.alive||self.team!==player.renkoPending.team||match.phase!=='live')){const pending=player.renkoPending,accepted=ordinarySkills.renkoEvent(pending.event.type,ownId,elapsed);if(!accepted&&!fresh){player.x=self.x;player.y=self.y;player.z=self.z;player.vy=0;player.vx=0;player.vz=0;}if(accepted&&player.renkoDrive?.id===pending.event.id)player.renkoDrive.id=accepted.id;else if(!accepted)player.renkoDrive=null;player.renkoPending=null;}
  if(player.onnaraJumpPending&&ack>=player.onnaraJumpPending.seq){
    const accepted=ordinarySkills.onnaraEvent('onnara-jump',ownId,elapsed);
    if(!accepted&&!fresh&&player.onnaraJumpPending.round===match.round&&self.alive&&!carMotionActive(player)&&!player.trafficLaunch){player.y=self.y;player.vy=0;}
    player.onnaraJumpPending=null;
  }
  const carMove=carMotionMarker(self.carMove,packet.time);
  if(carMove){
   const first=player.carMotion?.id!==carMove.id||player.carMotion?.phase!==carMove.phase;
   player.carRecoveryUntil=elapsed+1.5;player.carMotion={...carMove,team:self.team,lastAt:elapsed};player.carImpulseUntil=carMove.endsAt;player.vy=carMove.vy;player.dashTimer=0;player.vx=0;player.vz=0;
   if(!fresh)reconcileCarPose(self);
   netPositionHistory.clear();netPositionCorrectionX=0;netPositionCorrectionZ=0;
   if(first)clearCombatInput();
  }else{if(player.carRecoveryUntil>elapsed&&!fresh)reconcileCarPose(self);player.carMotion=null;player.carImpulseUntil=0;}
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
    if(match.spike.status==='planted'){if(previousSpikeCarrier===ownId)interactionHeld=false;sound('plant',{entity:match.spike,localOnly:true});lastSpikeBeep=0;}
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
      else if(action.type==='ability'&&!(player.kit.character==='cat'&&action.key==='c'&&action.catReturning===true)&&!(player.kit.character==='renko'&&action.key==='q'&&action.renkoStop===true)){
        const batch=action.smokePoints,count=batch===undefined?1:player.kit.character==='veil'&&action.key==='c'&&Array.isArray(batch)&&batch.length>=1&&batch.length<=VEIL_SKILLS.dustMax&&batch.every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite))?batch.length:0;
        if(batch!==undefined&&player.kit.smoke<count)continue;
        for(let i=0;i<count;i++){const effect=player.kit.activate(action.key,action.at);if(effect?.type==='knives')predictedKnives=true;}
      }
      else if(action.type==='fire'&&action.ultimate)player.kit.consumeKnife(action.burst===true?Math.min(DUELIST.knives,player.kit.knives):1);
    }
    player.kit.tick(elapsed);bindRenkoUltimate(player);
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
  careerCoins.progress({kills:totalKills,finished:match.phase==='match',won:match.winner===player.team});
  for(const state of packet.actors){
    if(state.id===ownId)continue;let actor=bots.find(b=>b.id===state.id);
    if(!actor){makeBot(state,Number(state.id.split('-')[1])||0,state.team,roster.find(r=>r.id===state.id));actor=bots[bots.length-1];actor.id=state.id;actor.x=state.x;actor.z=state.z;actor.y=state.y;}
    if(actor.alive&&!state.alive)actor.death=.85;
    if(!actor.alive&&state.alive){actor.death=0;actor.group.visible=true;actor.x=state.x;actor.y=state.y;actor.z=state.z;}
    actor.crouch=state.crouch||0;actor.hp=state.hp;actor.armor=state.armor;actor.alive=state.alive;actor.moving=state.moving;actor.netTarget=state;actor.carMotion=carMotionMarker(state.carMove,packet.time);if(actor.carMotion)actor.carMotion.team=state.team;actor.planting=state.planting;actor.defusing=state.defusing;actor.flash=state.flash?.07:0;actor.shotSequence=state.shotSequence||0;
    if(state.kit&&actor.kit){actor.kit.restore(state.kit);bindRenkoUltimate(actor);}
  }
  if(busSeat()){map.traffic.service.place(player,elapsed);player.vx=player.vz=player.vy=0;}
  if(map.traversal){const pending=netActions.some(a=>a.type==='trc-interact'&&a.kind==='ladder');if(!pending){
    // Ordinary stairs/jumps are predicted against the same solid map. A delayed
    // host height is not a rejected input and must not rewind newer XYZ or vy.
    // Explicit ladder state still belongs to the host.
    const wasClimbing=!!player.trcLadder;player.trcLadder=self.trcLadder||null;
    if(player.trcLadder||wasClimbing){player.x=self.x;player.z=self.z;player.y=self.y;player.vy=0;}
  }}
  netHasSnapshot=true;setVisible('loading',false);setVisible('hud',true);setVisible('spectator-hint',!player.alive&&!deathView.holding);syncDeathUI();syncBuyBarrier();
  if(!netHostPaused&&!netCharacterRequested&&match.phase==='buy'&&match.round===1){netCharacterRequested=true;queueNetAction('character',{character:selectedCharacter()});player.kit.character=selectedCharacter();}
  if(match.phase==='match'&&mode!=='result')finish(match.winner===player.team);
  updateHUD();
}
function updateRemoteActor(actor,dt){
  const data=netInputs.get(actor.remoteId);if(!data){cancelPlantAndEquip(actor);actor.planting=false;actor.defusing=false;match.cancelDefuse(actor.id);return;}
  const input=grassRemoteInput(actor,data.input),active=elapsed-data.received<.8&&actor.alive&&data.round===match.round,objectiveWork=active&&input.interact===true?objectiveActionFor(actor):null,previousX=actor.x,previousY=actor.y||0,previousZ=actor.z,wasDashing=actor.dashTimer>0;
  if(actor.kit?.character==='renko'){ordinarySkills.holdRenkoJet(actor.id,elapsed,active&&input.jet===true&&!objectiveWork&&!carMotionActive(actor)&&!busSeat(actor));if(active){actor.netYaw=Number.isFinite(input.yaw)?input.yaw:0;actor.netPitch=clamp(Number(input.pitch)||0,-1.35,1.35);}}
  if(active&&duckPadAirborne(actor)&&actorGrounded(actor)&&Number.isFinite(input.y)&&Math.abs(input.y-actor.y)<.08)actor.duckPadUntil=0;
  const wasClimbing=!!actor.trcLadder&&!carMotionActive(actor);if(wasClimbing){const previous={x:actor.x,y:actor.y,z:actor.z};map.traversal.climb(actor,active&&[-1,0,1].includes(input.climb)?input.climb:0,dt,input.quiet===true);trcMotionSound(actor,dt,previous,input.quiet===true);}
  if(active&&!wasClimbing&&!busSeat(actor)&&Number.isFinite(input.x)&&Number.isFinite(input.z)){
    // An accepted airborne pose ends turf before applying this input's speed cap.
    const inputFeet=Number.isFinite(input.y)?clamp(input.y,map.minY??0,11):actor.y;
    const inputGrounded=actorGrounded({...actor,x:input.x,z:input.z,y:inputFeet,vy:0});
    let dx=input.x-actor.x,dz=input.z-actor.z;const renkoJet=renkoFlight(actor),renkoDrive=renkoDriveMotion(actor,renkoJet?null:renkoEvent(actor,'renko-drive'),elapsed,dt,{x:dx/Math.max(.001,dt*RENKO_SKILLS.runSpeed),z:dz/Math.max(.001,dt*RENKO_SKILLS.runSpeed),crouch:input.crouch>.5,grounded:actorGrounded(actor)});
    if(actor.dashTimer>0&&actor.dashVec){const step=Math.min(dt,actor.dashTimer)*12/.18;dx=actor.dashVec.x*step;dz=actor.dashVec.z*step;}
    else if(actor.netDashInputSequence===data.seq||carMotionActive(actor)||elapsed<Math.max(actor.carImpulseUntil||0,actor.trafficLaunch?.endsAt||0)){dx=0;dz=0;}
    if(renkoJet){const horizontal=Math.cos(actor.netPitch)*RENKO_SKILLS.flightSpeed*actorSpeedScale(actor);dx=-Math.sin(actor.netYaw)*horizontal*dt;dz=-Math.cos(actor.netYaw)*horizontal*dt;}
    if(objectiveWork){dx=0;dz=0;actor.vx=0;actor.vz=0;}
    const distance=Math.hypot(dx,dz),limit=(map.ductAt?.(actor.x,actor.z,actor.y)?1.15:actor.dashTimer>0?12/.18:(renkoJet?RENKO_SKILLS.flightSpeed:renkoDrive?(input.quiet===true?2.8:renkoDrive.sliding?RENKO_SKILLS.slideStart:input.crouch>.5?1.8:RENKO_SKILLS.runSpeed):frostSlideSpeed(actor,inputGrounded)||(input.quiet===true?2.8:7)*1.15)*actorSpeedScale(actor,inputGrounded))*dt;
    if(distance>limit){dx*=limit/distance;dz*=limit/distance;}
    const requestedCrouch=frostSlideSpeed(actor)>0?1:Number.isFinite(input.crouch)?clamp(input.crouch,0,1):0;
    if(requestedCrouch>=(actor.crouch||0)||canStand(actor.x,actor.z,.34,actor.y||0,1.7-requestedCrouch*.55)&&grassHeadClear(actor,actor.x,actor.z,.34,actor.y||0,1.7-requestedCrouch*.55))actor.crouch=requestedCrouch;
    if(renkoDrive){const oldX=actor.x,oldZ=actor.z;actor.vx=dx/Math.max(dt,.001);actor.vz=dz/Math.max(dt,.001);if(renkoDrive.sliding){dx=renkoDrive.x*dt*actorSpeedScale(actor);dz=renkoDrive.z*dt*actorSpeedScale(actor);}moveEntity(actor,dx,dz);actor.vx=(actor.x-oldX)/Math.max(dt,.001);actor.vz=(actor.z-oldZ)/Math.max(dt,.001);}else moveEntity(actor,dx,dz);
    if(renkoJet)updateActorVertical(actor,dt);
    const blocked=Math.hypot(actor.x-previousX-dx,actor.z-previousZ-dz)>1e-5;
    // A delayed jump can meet a stair riser before its feet have risen to the
    // client's sampled height. Give that motion a bounded chance to finish;
    // a persistently blocked request still receives an authoritative rejection.
    let waitForStep=false;
    if(map.traversal&&!renkoJet&&!duckPadAirborne(actor)&&!duckFlight(actor)&&!ordinarySkills.onnaraEvent?.('onnara-hover',actor.id,elapsed)){
      const blockedKey=data.connection+':'+data.round;
      if(!blocked||actor.netTrcBlockedKey!==blockedKey)actor.netTrcBlockedAt=null;
      actor.netTrcBlockedKey=blockedKey;
      if(blocked&&actor.netTrcBlockedAt==null)actor.netTrcBlockedAt=elapsed;
      waitForStep=blocked&&(!!actor.vy||!inputGrounded)&&elapsed-actor.netTrcBlockedAt<.35;
    }
    if(!wasDashing&&actor.netDashInputSequence!==data.seq&&(objectiveWork||Math.hypot(input.x-actor.x,input.z-actor.z)<1e-5||blocked&&!waitForStep||distance>2||renkoJet&&Math.hypot(input.x-actor.x,input.z-actor.z)>2))actor.netPositionAck={seq:data.seq,connection:data.connection,round:data.round,x:actor.x,z:actor.z};
    if(!objectiveWork&&!renkoJet&&Number.isFinite(input.y)&&!duckPadAirborne(actor)&&!carMotionActive(actor)&&elapsed>=Math.max(actor.carImpulseUntil||0,actor.trafficLaunch?.endsAt||0)){
      const head=grassSupport(actor),grassAuthority=grassNearby(actor);
      const floor=head?.top??(inputGrounded?getZoneFloor(actor.x,actor.z,Math.max(actor.y,inputFeet)+.22):null);
      // A capped stair input follows support at the accepted XZ, not the feet
      // height of a point the host has not reached yet.
      let acceptedY=floor!==null&&Math.abs(floor-inputFeet)<=.45&&canStand(actor.x,actor.z,.34,floor,actorBodyHeight(actor))?floor:inputFeet;
      const flight=duckFlight(actor);
      if(flight){
        acceptedY=Math.min(acceptedY,flight.y+DUCK_SKILLS.flightHeight,previousY+DUCK_SKILLS.flapVelocity*dt);
        if(acceptedY>previousY)for(const c of map.collision.query(actor.x,actor.z,.34)){
          if(c.disabled)continue;
          const underside=c.base||0,height=actorBodyHeight(actor);if(previousY+height<=underside+.00001&&acceptedY+height>=underside&&map.collision.overlaps(c,actor.x,actor.z,.34))acceptedY=Math.min(acceptedY,underside-height);
        }
      }
      const starJump=ordinarySkills.onnaraEvent?.('onnara-jump',actor.id,elapsed);
      if((map.traversal||starJump||grassAuthority||actor.kit?.character==='renko')&&!flight&&!ordinarySkills.onnaraEvent?.('onnara-hover',actor.id,elapsed)){
        // One airborne input stream can request one normal jump. Reusing its
        // last height after landing must not repeatedly launch the remote.
        const jumpKey=data.connection+':'+data.round;
        if(actor.netTrcJumpKey!==jumpKey){actor.netTrcJumpKey=jumpKey;actor.netTrcJumpActive=false;}
        if(inputGrounded)actor.netTrcJumpActive=false;
        else if(!starJump&&!actor.netTrcJumpActive&&inputFeet>actor.y+.1&&actorGrounded(actor)){actor.vy=normalJumpVelocity(actor);actor.netTrcJumpActive=true;}
        updateActorVertical(actor,dt);acceptedY=actor.y;
      }
      actor.y=acceptedY;
      // Remote motion is consumed from its accepted pose; a prior lift impulse
      // must not leave a landed actor permanently classified as airborne.
      if((!map.traversal&&!starJump&&!grassAuthority&&actor.kit?.character!=='renko')||flight||ordinarySkills.onnaraEvent?.('onnara-hover',actor.id,elapsed))actor.vy=inputGrounded?0:(actor.y-previousY)/Math.max(dt,1e-6);
    }
    applyStarHold(actor);
    actorMovementScale(actor);
    actor.netYaw=Number.isFinite(input.yaw)?input.yaw:0;actor.netPitch=clamp(Number(input.pitch)||0,-1.35,1.35);actor.group.rotation.y=actor.netYaw+Math.PI;
  }
  if(active&&busSeat(actor)){actor.netYaw=Number.isFinite(input.yaw)?input.yaw:actor.netYaw||0;actor.netPitch=clamp(Number(input.pitch)||0,-1.35,1.35);}
  const remoteRunning=active&&match.phase==='live'&&(frostSlideSpeed(actor)>0||input.quiet!==true&&actor.crouch<.5)&&!wasDashing&&actorGrounded(actor)&&Math.hypot(actor.x-previousX,actor.z-previousZ)>dt*2;
  if(!wasClimbing)trcMotionSound(actor,dt,{x:previousX,y:previousY,z:previousZ},input.quiet===true);
  actor.netStepClock=remoteRunning?(actor.netStepClock||0)+dt:0;if(actor.netStepClock>.35){actor.netStepClock=0;sound('step',{entity:actor});}
  actor.kit?.tick(elapsed);actor.dashTimer=Math.max(0,(actor.dashTimer||0)-dt);actor.moving=Math.hypot(actor.x-previousX,actor.z-previousZ)>dt*.5;
  const stationary=Math.hypot(actor.x-previousX,actor.z-previousZ)<dt*.25&&Math.abs(actor.y||0)<=.05,held=active&&!busSeat(actor)&&!carMotionActive(actor)&&input.interact===true&&match.phase==='live';
  if(active&&!busSeat(actor)&&actorGrounded(actor))match.pickupSpike(actor.id,actor.team,actor.x,actor.z,actor.y);
  const work=held&&stationary?objectiveActionFor(actor):null,site=work?.site;
  actor.planting=work?.kind==='plant';actor.defusing=work?.kind==='defuse';
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
  if(actor.planting)match.interactPlant(dt*(ordinarySkills.nobiWork?.(actor.id,elapsed,actor,ordinaryReachable)||1),{actorId:actor.id,team:actor.team,site:site.id,x:actor.x,z:actor.z});else cancelPlantAndEquip(actor);
  if(actor.defusing)match.interactDefuse(dt*(ordinarySkills.nobiWork?.(actor.id,elapsed,actor,ordinaryReachable)||1),{actorId:actor.id,team:actor.team});else match.cancelDefuse(actor.id);
}
function applyRemoteAction(actor,action,actionTime=elapsed){
  if(!actor.alive)return;const r=actor.record;
  if(action.type==='trc-interact'){if(match.phase==='live')trcInteract(actor,{kind:action.kind,id:action.id});return;}
  if(action.type==='bus'){busInteract(actor);return;}
  if(busDriving(actor)||busSeat(actor)&&['ability','drop','pickup'].includes(action.type))return;
  if((actor.planting||actor.defusing)&&['fire','reload','equip','ability','drop'].includes(action.type))return;
  if(action.type==='character'){if(match.phase==='buy'&&match.round===1&&characterIds.includes(action.character))actor.kit.character=action.character;return;}
  if(action.type==='buy'&&match.phase==='buy'){
    if(['smoke','updraft','c','q','sell-c','sell-q'].includes(action.id)){const selling=action.id.startsWith('sell-'),id=selling?action.id.slice(-1):action.id;if(tradeSkill(actor,id,selling))actor.netPurchaseAck=[action.seq,match.round,action.id];return;}
    if(typeof action.id!=='string')return;const selling=action.id.startsWith('sell-'),id=selling?action.id.slice(5):action.id;
    if(tradeEquipment(actor,id,selling))actor.netPurchaseAck=[action.seq,match.round,action.id];return;
  }
  if(action.type==='ability'){
    // An explicit stop must never become a new cast after expiry or an X refill.
    if(action.renkoStop!==undefined){if(action.renkoStop===true&&action.key==='q'&&actor.kit?.character==='renko')stopRenkoDrive(actor);return;}
    if(actor.kit?.character==='renko'&&action.key==='e'&&netInputs.get(actor.remoteId)?.input.jet!==true)return;
    if(['c','q','e','x'].includes(action.key)){
      let aim=null;
      if(action.yaw!==undefined||action.pitch!==undefined){
        if(!Number.isFinite(action.yaw)||!Number.isFinite(action.pitch))return;
        aim={yaw:action.yaw%(Math.PI*2),pitch:clamp(action.pitch,-1.35,1.35)};
      }
      let zonePoint=null,zonePoints=null;
      if(actor.kit?.character==='veil'&&['c','x'].includes(action.key)){
        if(action.smokePoints!==undefined){
          if(action.key!=='c'||action.smokePoint!==undefined||!Array.isArray(action.smokePoints)||action.smokePoints.length<1||action.smokePoints.length>VEIL_SKILLS.dustMax||!action.smokePoints.every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)))return;
          zonePoints=action.smokePoints.map(p=>({x:p[0],y:p[1],z:p[2]}));
          if(zonePoints.some(p=>veilSmokeFloor(p)===null))return;
        }else{
          if(!Array.isArray(action.smokePoint)||action.smokePoint.length!==3||!action.smokePoint.every(Number.isFinite))return;
          zonePoint={x:action.smokePoint[0],y:action.smokePoint[1],z:action.smokePoint[2]};
          if(veilSmokeFloor(zonePoint)===null)return;
        }
      }else if(action.smokePoint!==undefined||action.smokePoints!==undefined)return;
      const effect=activateAbility(actor,action.key,{aim,zonePoint,zonePoints});
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
    if(renkoUnarmed(actor))return;
    if(![r.primary,r.secondary,'knife','spike'].includes(action.weapon)||action.weapon==='spike'&&match.spike.carrier!==actor.id)return;
    cancelServiceReload(actor);actor.netStores||={};actor.netStores[actor.netWeapon]={ammo:actor.netAmmo,reserve:actor.netReserve};actor.netWeapon=action.weapon;const spec=WEAPONS[action.weapon]||WEAPONS.knife;
    const saved=actor.netStores[action.weapon];actor.netAmmo=saved?.ammo??spec.mag;actor.netReserve=saved?.reserve??spec.reserve;actor.netReload=0;return;
  }
  const knives=actor.kit?.knivesActive===true&&actor.netWeapon==='knife',spec=knives?BLADE:WEAPONS[actor.netWeapon]||WEAPONS.classic;
  if(action.type==='reload'&&!renkoUnarmed(actor)&&!carMotionActive(actor)&&!ordinarySkills.urchinJammed(actor.id,elapsed)&&actor.netAmmo<spec.mag&&actor.netReserve>0&&!actor.netReload&&!actor.serviceReload){actor.netReload=spec.reload;return;}
  if(action.type==='pickup'){if(match.phase==='live')pickupDroppedWeapon(actor,action.dropId);return;}
  if(action.type==='drop'){
    if(renkoUnarmed(actor))return;
    cancelServiceReload(actor);
    if(actor.netWeapon==='spike'&&match.spike.carrier===actor.id){const point=safeDropPoint({...actor,yaw:actor.netYaw});match.dropSpike(actor.id,point.x,point.z,point.y||0);actor.netWeapon=r.primary||r.secondary||'classic';}
    else if(actor.netWeapon===r.primary){dropItem(r.primary,actor);r.primary=null;delete r.netPurchases?.primary;actor.netWeapon=r.secondary||'classic';}
    else return;
    const next=WEAPONS[actor.netWeapon]||WEAPONS.classic,saved=actor.netStores?.[actor.netWeapon];actor.netAmmo=saved?.ammo??next.mag;actor.netReserve=saved?.reserve??next.reserve;actor.netReload=0;return;
  }
  if(action.type!=='fire'||renkoUnarmed(actor)||carMotionActive(actor)||match.phase!=='live'||actor.netWeapon==='spike'||actor.netReload>0||actor.serviceReload||actor.planting||actor.defusing||elapsed<(actor.skillThrowUntil||0)||actionTime-(actor.lastNetShot??-10)+1e-8<nobiShotInterval(spec,actor))return;
  const yaw=Number(action.yaw),pitch=Number(action.pitch);if(!Number.isFinite(yaw)||!Number.isFinite(pitch))return;
  if(action.burst!==undefined&&typeof action.burst!=='boolean'||action.burst===true&&!knives)return;
  const knifeCount=action.burst===true?Math.min(DUELIST.knives,actor.kit.knives):1;
  const melee=!knives&&actor.netWeapon==='knife';if(knives){if(!actor.kit.consumeKnife(knifeCount))return;}else{if(!melee&&!(actor.netAmmo>0))return;if(!melee&&!ordinarySkills.capMagazine(actor.id,elapsed))actor.netAmmo--;}
  if(!melee&&!knives)crownShot(actor);
  if(spec.arsenal&&actionTime-(actor.lastNetShot??-10)>.3)actor.shotSequence=0;
  actor.lastNetShot=actionTime;actor.flash=.07;actor.shotSequence=(actor.shotSequence||0)+1;
  const origin=new THREE.Vector3(actor.x,1.7+(actor.y||0)-(actor.crouch||0)*.55,actor.z),aim=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
  if(knives&&action.burst===true){sound('shot',{weapon:actor.netWeapon,entity:actor});fireKnifeBurst(actor,origin,aim,knifeCount);return;}
  if(spec.arsenal){sound('shot',{weapon:actor.netWeapon,entity:actor});fireArsenal(actor,origin,aim,spec,action.ads===true);return;}
  if(!melee&&!knives)capDistortAim(actor,aim);
  botsGroup.updateMatrixWorld(true);const ray=new THREE.Raycaster(origin,aim,0,melee?2.2:120);
  const all=ray.intersectObjects([environment,botsGroup],true).filter(h=>busSurfaceVisible(h)&&h.object.userData.bot!==actor&&(!h.object.userData.bot||h.object.userData.bot.alive));
  let hit=all[0];let resolvedHit=hit,target=hit?.object.userData.bot,point=hit?.point,head=shotZone(hit)==='head',nearest=hit?.distance??120;
  if(player.alive){const local=playerShotHit(ray);if(local&&local.distance<nearest){hit=local;target=player;point=local.point;head=shotZone(local)==='head';resolvedHit=local;nearest=local.distance;}}
  const fake=!melee?raycastNopeDecoy(origin,aim,nearest,actor.team):null;
  const shield=!melee?ordinarySkills.interceptShield(origin,aim,fake?.distance??nearest,spec.body||1,elapsed,match.round):null;
  if(shield){target=null;point=new THREE.Vector3(shield.point.x,shield.point.y,shield.point.z);nearest=shield.distance;}
  if(fake&&!shield){target=null;point=fake.point;nearest=fake.distance;hitNopeDecoy(fake.event,actor);}
  if(melee&&nearest>2.2)target=null;const end=point||origin.clone().addScaledVector(aim,90);if(!melee)tracer(origin,end);sound('shot',{weapon:actor.netWeapon,entity:actor});
  if(!target&&!fake&&!shield&&!melee&&!knives&&hit)capBounceShot(actor,origin,aim,hit,spec);
  if(!melee&&!knives)urchinTridentShot(actor,origin,aim,spec);
  if(!fake&&!shield&&shootBusDriver(hit,actor,head?spec.head:spec.body))return;
  if(target&&target.team!==actor.team){let damage=nobiBulletDamage(actor,target,head?spec.head:shotZone(resolvedHit,point,target)==='leg'?spec.leg:spec.body,spec.head,!melee&&!knives);if(!knives&&['phantom','spectre','ghost','classic'].includes(actor.netWeapon)&&nearest>15)damage*=nearest>30?.8:.9;damageEntity(target,damage,actor,{firearm:!melee&&!knives,skill:knives?'duelist':null});burst(point,head?'#fff3c8':'#ff737e',5);}
}
function tickOnline(dt){
  if(!onlinePlaying||!online||!match)return;netClock+=dt;if(netClock<.065)return;netClock=0;
  if(online.host){
    const rules={format:match.format,startingSide:match.startingSide,round:match.round,score:{...match.score},phase:match.phase,phaseTime:match.phaseTime,roundTime:match.roundTime,winner:match.winner,lastRound:match.lastRound?{...match.lastRound}:null,spike:{...match.spike}};
    if(rules.lastRound&&match.phase!=='post')delete rules.lastRound.fullCombo;
    const teamState=teamAbilities.snapshot(),packet={type:'snapshot',mapId:map.id||'hashimoto',seq:++netSequence,time:elapsed,paused:netHostPaused,...(map.traversal?{trcDoors:map.traversal.snapshot()}:{}),cues:serializeNetCues(),smokes:serializeSmokes(),drops:serializeDrops(),detonation:detonationState?{...detonationState}:null,takeover:takeoverState?{...takeoverState}:null,zoneAbilities:zoneAbilities.snapshot(),...(map.traffic?{busTransit:map.traffic.service.snapshot([player,...bots].map(a=>a.id)),...(map.destruction?.snapshot()?{busDamage:map.destruction.snapshot()}:{})}:{}),rules,roster:roster.map(r=>({...r,kit:r.kit?.snapshot()})),actors:[player,...bots].map(captureNetActor),acks:Object.fromEntries(netApplied),positionAcks:Object.fromEntries(bots.filter(b=>b.remoteId&&b.netPositionAck).map(b=>[b.remoteId,{...b.netPositionAck}]))};
    for(const team of ['blue','red']){let state={...packet,teamAbilities:{...teamState,pings:teamState.pings.filter(ping=>ping.observerTeam===team)},ordinarySkills:ordinarySkills.snapshot(team),nopeDecoys:nopeDecoys.snapshot(),nopePops:serializeNopePops()};if(match.phase==='buy'){const report=roundDamage.snapshot(team,match.round);if(report)state.damageReport=report;}if(state.damageReport||state.nopeDecoys||state.ordinarySkills.events.some(e=>['nope-decoy','urchin-gloom'].includes(e.type))||state.ordinarySkills.blinds.some(b=>b.eventId.startsWith('skill-urchin-gloom-'))||map.traffic||map.traversal||packet.actors.some(a=>a.crouch>0||a.kit?.renkoActive)||[player,...bots].some(carMotionActive)||match.phase==='post'||state.cues.some(c=>(['skill-hit','skill-heal','gun-hit'].includes(c.type)||isKillSoundCue(c.type))))state=fitTrafficSnapshot(state);if(state)online.send(state,{team});}
  }else if(netHasSnapshot){
    const ride=grassRideInput(player),seq=++netSequence,input={...(ride?{ride}:{}),...(match.phase==='match'?{matchFinished:true}:{}),...(map.traversal?{climb:mode==='play'?Math.sign((keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)-touchMove.y):0}:{}),...(player.kit?.character==='renko'&&player.renkoJetHeld===true&&mode==='play'?{jet:true}:{}),x:player.x,z:player.z,y:player.y,yaw:player.yaw,pitch:player.pitch,crouch:player.crouch,quiet:keys.has('ShiftLeft')||keys.has('ShiftRight'),interact:mode==='play'&&interactionHeld,...(busDriving()?{bus:busControls(player.id)}:{})};
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
function clearMouseInputTrace(){
  if(!mouseInputTrace)return;
  mouseInputTrace.rows.fill(null);mouseInputTrace.next=0;mouseInputTrace.size=0;
  const output=$('mouse-input-diagnostics');if(output)output.textContent='';
}
function flushMouseInputTrace(){
  if(!mouseInputTrace)return;
  const rows=[];
  for(let i=0;i<mouseInputTrace.size;i++)rows.push(mouseInputTrace.rows[(mouseInputTrace.next-mouseInputTrace.size+i+2048)%2048]);
  const output=$('mouse-input-diagnostics');
  if(output)output.textContent=JSON.stringify({version:1,mode,phase:match?.phase,sensitivity,pointerLockInput,columns:['time','clientX','clientY','movementX','movementY','locked','yawBefore','pitchBefore','yawAfter','pitchAfter','cameraX','cameraY','width','height','anchorX','anchorY','matchesX','matchesY'],rows});
}
function observeMouseLook(event){
  if(!mouseInputTrace||mode!=='play'||!player.alive||event.sourceCapabilities?.firesTouchEvents){mouseLook(event);return;}
  const yaw=player.yaw,pitch=player.pitch,anchor=mouseAnchor;
  mouseLook(event);
  const finite=n=>Number.isFinite(n)?n:null;
  mouseInputTrace.rows[mouseInputTrace.next]=[event.timeStamp,event.clientX,event.clientY,event.movementX,event.movementY,document.pointerLockElement===canvas?1:0,yaw,pitch,player.yaw,player.pitch,camera.rotation.x,camera.rotation.y,innerWidth,innerHeight,anchor?.x,anchor?.y,anchor?.relativeMatchesX,anchor?.relativeMatchesY].map(finite);
  mouseInputTrace.next=(mouseInputTrace.next+1)%2048;mouseInputTrace.size=Math.min(2048,mouseInputTrace.size+1);
}
function look(dx,dy){
  if(netHostPaused||mode!=='play'||!player.alive||!Number.isFinite(dx)||!Number.isFinite(dy)||Math.abs(dx)>500||Math.abs(dy)>500)return;
  player.yaw-=dx*.002*sensitivity;player.pitch=clamp(player.pitch-dy*.002*sensitivity,-1.35,1.35);
  // Input owns the view angle; physics/recoil still advance on the normal frame.
  // Keep victory/vehicle cameras under their own controller.
  if(!victoryCamera.active&&!busDriving())camera.rotation.set(player.pitch+renderedRecoil,player.yaw,0);
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
  if(!previous||previous.locked||previous.width!==next.width||previous.height!==next.height||time<previous.time)return;
  if(time-previous.time>250){
    // Reseed stale positions, but an idle mouse has not changed the browser's
    // relative input channel. Its first return/recenter must stay protected.
    next.relativeMatchesX=previous.relativeMatchesX;
    next.relativeMatchesY=previous.relativeMatchesY;
    next.rebased=true;return;
  }
  // Validate axes independently: ordinary horizontal movement must not hide a
  // vertical recenter. Keep coordinate gain, including fractional-pixel motion.
  const axisDelta=(delta,relative,field)=>{
    // A stationary axis supplies no moving samples. Evidence from the other
    // axis still establishes the same browser's relative coordinate stream.
    const otherField=field==='relativeMatchesX'?'relativeMatchesY':'relativeMatchesX';
    const matches=previous[field]||Math.min(1,previous[otherField]||0);
    const offsetField=field==='relativeMatchesX'?'relativeOffsetX':'relativeOffsetY';
    const offset=previous[offsetField]||0;
    if(Number.isFinite(relative)){
      // Half-pixel rounding and duplicate stationary samples are normal browser
      // input. Neither should erase an already established reliable stream.
      if(Math.abs(delta-relative)<=.500001){
        next[field]=delta===0&&relative===0?matches:Math.min(2,matches+1);
        next[offsetField]=offset;
      }else if(matches>=1&&offset*(delta-relative)<0&&Math.abs(offset+delta-relative)<=1.000001){
        // The return from a small warp may be below the detection threshold.
        // Preserve real motion if the return and a flick arrive in one sample.
        next[field]=matches;return relative;
      }else if(matches>=1&&Math.abs(delta)>=4&&Math.abs(relative)<=Math.abs(delta)*.25){
        // One agreeing physical sample is enough. Waiting for a second lets a
        // recenter immediately after entry, a pause or a viewport reset turn us.
        // Seed from the new position even when rejecting a warp, so both its
        // outward and return samples are harmless without delaying real motion.
        next[field]=matches;next[offsetField]=previous.rebased?0:offset+delta-relative;return 0;
      }else if(matches>=1&&Math.abs(delta-relative)<4&&Math.abs(relative)<=500){
        // Fractional scaling/rounded or coalesced samples may disagree by a
        // pixel or two. Do not forget a proven channel immediately before a warp.
        next[field]=matches;next[offsetField]=offset;
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
document.addEventListener('pointerlockerror',()=>{if(document.pointerLockElement===canvas||pointerLockInput.startsWith('requesting-'))return;resetMouseLook();pointerLockInput='unlocked';inputActive=true;if(mode==='play')showMessage('MOUSE LOOK','マウスを動かすだけで視点を操作できます',3);});
document.addEventListener('mousemove',observeMouseLook);
canvas.addEventListener('mouseenter',resetMouseLook);canvas.addEventListener('mouseleave',resetMouseLook);
canvas.addEventListener('mousedown',e=>{if(duckAim){e.preventDefault();if(e.button===2){duckAim=null;showMessage('スキルを取り消しました','回数は消費していません',1);return;}if(e.button===0){const key=duckAim;duckAim=null;confirmDuckSkill(key);return;}}if(netHostPaused||mode!=='play')return;if(!player.alive){if(e.button===0&&!deathView.holding)spectateIndex++;return;}if(e.button===0){firing=true;shoot();}if(e.button===2){if(player.kit.knivesActive&&inventory.active==='knife'){e.preventDefault();firing=false;shoot(elapsed,true);}else aiming=!renkoUnarmed(player)&&weapon().slot==='primary'&&!ordinarySkills.capLocked(player.id,elapsed);}});
document.addEventListener('mouseup',e=>{if(e.button===0)firing=false;if(e.button===2)aiming=false;});
window.addEventListener('contextmenu',e=>{if(mode==='play'||mode==='map'&&veilPlacement)e.preventDefault();});
$('large-minimap').addEventListener('mousedown',veilMapPointer);
$('veil-smoke-confirm').addEventListener('click',confirmVeilPlacement);
$('veil-smoke-cancel').addEventListener('click',resumeGame);
$('veil-smoke-floor').addEventListener('change',()=>{
 if(!veilPlacementCurrent())return;const current=veilPlacement.point||veilPlacement.candidate;if(!current)return;
 const point={x:current.x,y:Number($('veil-smoke-floor').value),z:current.z};if(veilSmokeFloor(point)===null)return;
 if(veilPlacement.point)veilPlacement.point.y=point.y;
 else{const limit=veilPlacement.key==='c'?Math.min(VEIL_SKILLS.dustMax,player.kit.smoke):1;if(veilPlacement.points.length>=limit)return;veilPlacement.points.push(point);veilPlacement.point=point;veilPlacement.candidate=null;}
 refreshVeilPlacement();
});
$('veil-smoke-index').addEventListener('change',()=>{if(!veilPlacementCurrent())return;const point=veilPlacement.points[Number($('veil-smoke-index').value)];if(!point)return;veilPlacement.point=point;veilPlacement.candidate=null;refreshVeilFloorOptions();refreshVeilPlacement();});
$('veil-smoke-remove').addEventListener('click',()=>{if(!veilPlacementCurrent()||!veilPlacement.point)return;veilPlacement.points=veilPlacement.points.filter(p=>p!==veilPlacement.point);veilPlacement.point=veilPlacement.points.at(-1)||null;veilPlacement.candidate=null;refreshVeilFloorOptions();refreshVeilPlacement();});
document.addEventListener('keydown',e=>{
  if(victoryMusicUI?.isOpen())return;
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
  if(mode==='map'&&veilPlacement&&['KeyC','KeyX'].includes(e.code)){const key=e.code==='KeyC'?'c':'x';if(veilPlacement.key===key)resumeGame();else{resumeGame();openVeilPlacement(key);}return;}
  if(e.code==='KeyB'&&['play','shop'].includes(mode)){openShop();return;}
  if(e.code==='Tab'&&['play','score'].includes(mode)){if(mode==='play')showScoreboard();return;}
  if(netHostPaused||mode!=='play')return;
  keys.add(e.code);
  if(e.code==='KeyF'&&player.alive&&match?.phase==='live'&&!objectivePractice?.completed)useNearbyObject();
  if(e.code==='Digit4'&&player.alive&&match?.phase==='live'&&!objectivePractice?.completed)interactionHeld=true;
  if(player.alive){
    if(e.code==='Digit1'&&inventory.primary)equip(inventory.primary);
    if(e.code==='Digit2')equip(inventory.secondary);
    if(e.code==='Digit3')equip('knife');
    if(e.code==='Digit4'&&match.spike.carrier===player.id)equip('spike');
    if(e.code==='KeyG'&&!objectivePractice&&!renkoUnarmed(player)){
      if(isGuest()){queueNetAction('drop');return;}
      if(inventory.active==='spike'){const point=safeDropPoint();match.dropSpike(player.id,point.x,point.z,point.y||0);equip(inventory.primary||inventory.secondary);}
      else if(inventory.active===inventory.primary){dropItem(inventory.primary,player);inventory.primary=null;delete roundPurchases.primary;equip(inventory.secondary);}
    }
  }
  if(e.code==='KeyR')reload();if(e.code==='KeyC')useAbility('c');if(e.code==='KeyQ')dash();if(e.code==='KeyE')scan();if(e.code==='KeyX')useAbility('x');if(e.code==='Space')jump();
},{capture:true});
document.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='KeyE')releaseRenkoJet();if(e.code==='Digit4')releaseObjectiveInput();if(e.code==='Tab'&&mode==='score')resumeGame();});
function suspendSession(){
  victoryMusic.stop();
  keyboardProtection.release();
  clearCombatInput();
  if(['play','map','shop','score'].includes(mode)){setVisible('map-overlay',false);pauseGame();}
}
window.addEventListener('blur',suspendSession);
document.addEventListener('visibilitychange',()=>{if(document.hidden)suspendSession();else resetMouseLook();if(onlinePlaying&&online?.host){if(!document.hidden)online.cancelPausedRelay();netHostPaused=document.hidden;tickOnline(.1);updateHUD();}});
$('start').addEventListener('click',startGame);$('resume').addEventListener('click',resumeGame);
$('explore-start')?.addEventListener('click',()=>{$('match-format').value='explore';updateFormatSummary();startGame();});
$('range-start')?.addEventListener('click',()=>{$('match-format').value='range';updateFormatSummary();startGame();});
$('restart').addEventListener('click',startGame);$('play-again').addEventListener('click',playAgain);$('back-menu').addEventListener('click',backMenu);
$('pause-back-menu')?.addEventListener('click',backMenu);
$('pause').addEventListener('click',()=>pauseGame());$('map-toggle').addEventListener('click',()=>pauseGame(true));$('close-map').addEventListener('click',resumeGame);
$('close-shop')?.addEventListener('click',resumeGame);$('start-round')?.addEventListener('click',startRound);$('scoreboard-close')?.addEventListener('click',resumeGame);
createArsenalShop(document);
document.querySelectorAll('[data-buy]').forEach(button=>{
  const id=()=>button.dataset.skillKey||button.dataset.buy;
  button.addEventListener('click',()=>button.dataset.skillKey?clickSkillPurchase(id()):buy(id()));
  button.addEventListener('contextmenu',e=>{e.preventDefault();sell(id());});
  button.addEventListener('keydown',e=>{if(e.code==='Delete'&&!e.repeat){e.preventDefault();sell(id());}});
});
for(const key of ['c','q'])$(`shop-skill-${key}-sell`)?.addEventListener('click',()=>sell(key));
document.querySelectorAll('[data-sell]').forEach(button=>button.addEventListener('click',()=>sell(button.dataset.sell)));
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
  small.textContent=format==='plant'?'4キーを4秒 · A/Bで反復':format==='defuse'?'4キーを7秒 · 進捗50%を保存':format==='range'?'命中・ヘッド率 · 自己ベスト':format==='explore'?'時間制限なし · ルートと射撃を確認':format==='swift'?'4Rで攻守交代':'12Rで攻守交代';summary.append(strong,small);
}
$('match-format')?.addEventListener('change',updateFormatSummary);updateFormatSummary();
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement){keyboardProtection.release();await document.exitFullscreen();}else{const state=await keyboardProtection.enable();if(state==='unavailable')showMessage('全画面のキー保護を使えません','しゃがみは V 長押しで操作できます',3);}}catch{showMessage('FULLSCREEN','このブラウザでは全画面に切り替えられません',2);}});
$('keyboard-protect')?.addEventListener('click',()=>keyboardProtection.enable());
function saveSettings(){try{localStorage.setItem('hashimoto-settings',JSON.stringify({mapId:map.id||'hashimoto',sensitivity,volume,victoryMusicEnabled,victoryMusicVolume,victoryMusicTrack:victoryMusic.trackId(),lookVersion:2,character:selectedCharacter()}));}catch{}}
for(const id of ['agent-select','online-agent'])if($(id)){$(id).value=normalizeCharacter(settings.character);$(id).addEventListener('change',e=>{const value=normalizeCharacter(e.target.value);for(const other of ['agent-select','online-agent'])if($(other))$(other).value=value;updateCharacterDescription();saveSettings();});}
updateCharacterDescription();
function updateSensitivityLabel(){if($('sensitivity-value'))$('sensitivity-value').textContent=sensitivity.toFixed(2);}
if($('map-select'))$('map-select').addEventListener('change',e=>{if(mode!=='menu'||onlinePlaying)return;selectArena(e.target.value);saveSettings();});
selectArena(settings.mapId);
if($('sensitivity')){$('sensitivity').value=sensitivity;$('sensitivity').addEventListener('input',e=>{const value=Number(e.target.value);if(Number.isFinite(value))sensitivity=clamp(value,.05,1.5);updateSensitivityLabel();saveSettings();});updateSensitivityLabel();}
if($('volume')){$('volume').value=volume;$('volume').addEventListener('input',e=>{volume=Number(e.target.value);syncVictoryMusic();saveSettings();});}

victoryMusicUI=bindVictoryMusicSettings({document,music:victoryMusic,preferences:{enabled:victoryMusicEnabled,volume:victoryMusicVolume},onChange:next=>{if(next.enabled!==undefined)victoryMusicEnabled=next.enabled;if(next.volume!==undefined)victoryMusicVolume=next.volume;syncVictoryMusic();saveSettings();}});
window.addEventListener('pagehide',event=>{victoryClub.reset();if(event.persisted)victoryMusic.stop();else {victoryMusic.dispose();victoryClub.dispose();victoryCamera.dispose();fullscreenNotice.dispose();}});

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
for(const [id,action] of [['mobile-jump',jump],['mobile-reload',reload],['mobile-dash',dash],['mobile-scan',scan],['mobile-smoke',()=>useAbility('c')],['mobile-ult',()=>useAbility('x')]]){$(id)?.addEventListener('pointerdown',e=>{e.preventDefault();if(id==='mobile-scan')$(id).setPointerCapture(e.pointerId);action();});}
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('mobile-scan')?.addEventListener(type,releaseRenkoJet);
$('mobile-weapon')?.addEventListener('click',()=>{
  if(netHostPaused||mode!=='play'||!player.alive||interactionHeld)return;
  const items=[inventory.primary,inventory.secondary,'knife'].filter(Boolean);
  equip(items[(items.indexOf(inventory.active)+1)%items.length]);updateHUD();
});
$('mobile-ads')?.addEventListener('click',()=>{
  if(netHostPaused||mode!=='play'||!player.alive||interactionHeld||weapon().slot!=='primary')return;
  aiming=!renkoUnarmed(player)&&!aiming&&!ordinarySkills.capLocked(player.id,elapsed);updateHUD();
});
$('mobile-crouch')?.addEventListener('click',()=>{
  if(netHostPaused||mode!=='play'||!player.alive||interactionHeld)return;
  if(keys.has('TouchCrouch'))keys.delete('TouchCrouch');else keys.add('TouchCrouch');updateHUD();
});
$('mobile-fire')?.addEventListener('pointerdown',e=>{e.preventDefault();if(duckAim){const key=duckAim;duckAim=null;confirmDuckSkill(key);return;}if(netHostPaused||mode!=='play'||!player.alive||match?.phase!=='live')return;firing=true;shoot();$( 'mobile-fire').setPointerCapture(e.pointerId);});
for(const type of ['pointerup','pointercancel'])$('mobile-fire')?.addEventListener(type,()=>firing=false);
$('mobile-shop')?.addEventListener('click',openShop);
$('mobile-interact')?.addEventListener('pointerdown',e=>{e.preventDefault();if(netHostPaused||mode!=='play'||!player.alive||match?.phase!=='live'||objectivePractice?.completed)return;if(!objectiveActionFor(player)&&useNearbyObject())return;interactionHeld=true;if(match.spike.carrier===player.id)equip('spike');$('mobile-interact').setPointerCapture(e.pointerId);});
for(const type of ['pointerup','pointercancel'])$('mobile-interact')?.addEventListener(type,releaseObjectiveInput);
canvas.addEventListener('pointercancel',e=>{if(touchLook?.id===e.pointerId)touchLook=null;});

let previous=performance.now(),miniTick=0;
const frameDiagnostics=mouseInputTrace?{rows:[],next:0,count:0}:null;
function frame(now){
  const frameStart=frameDiagnostics?performance.now():0;
  const frameInterval=frameDiagnostics?Math.max(0,now-previous):0;
  requestAnimationFrame(frame);const dt=Math.min(Math.max(0,(now-previous)/1000),.25);previous=now;
  if(mode==='menu'){
    menuT+=dt;const overview=map.menuCamera||{position:[-15,9,-86],target:[30,8,-20]};camera.position.set(overview.position[0]+Math.sin(menuT*.09)*1.2,overview.position[1],overview.position[2]);camera.lookAt(...overview.target);
  }else if(!netHostPaused&&(['play','shop','map','score'].includes(mode)||onlinePlaying&&mode==='pause')){
    let remaining=dt;
    while(remaining>1e-8&&(['play','shop','map','score'].includes(mode)||onlinePlaying&&mode==='pause')){const step=Math.min(remaining,.05);updatePlay(step);remaining-=step;}
  }
  tickOnline(dt);
  if(veilPlacement&&!veilPlacementCurrent()){clearVeilPlacement();if(mode==='map')resumeGame();}
  updateVictoryCamera(dt);
  updateVictoryClub();
  killBanner.render(elapsed,{active:!document.hidden&&!netHostPaused&&mode==='play'&&['live','post'].includes(match?.phase),currentRound:match?.round,reducedMotion:reducedMotion.matches});
  for(let i=effects.length-1;i>=0;i--){const effect=effects[i];if(['play','shop','map','score'].includes(mode)){effect.life-=dt;if(effect.velocity){effect.velocity.y-=6*dt;effect.object.position.addScaledVector(effect.velocity,dt);}}
    if(effect.life<=0){effectsGroup.remove(effect.object);effect.object.geometry.dispose();effect.object.material.dispose();effects.splice(i,1);}else effect.object.material.opacity=Math.min(1,effect.life/effect.max);
  }
  miniTick+=dt;if(miniTick>.1&&['play','shop','map','score'].includes(mode)){drawMinimap($('minimap'));if(mode==='map')drawMinimap($('large-minimap'),true);miniTick=0;}
  syncDeathUI();const renderStart=frameDiagnostics?performance.now():0;renderWithDetonation(dt);
  if(frameDiagnostics){const f=frameDiagnostics;f.rows[f.next]=[frameInterval,renderStart-frameStart,performance.now()-renderStart];f.next=(f.next+1)%180;
    if(++f.count%60===0){const percentile=(k,p)=>{const a=f.rows.map(r=>r[k]).sort((a,b)=>a-b);return +a[Math.floor((a.length-1)*p)].toFixed(2);};
      const output=$('frame-diagnostics');if(output)output.textContent=JSON.stringify({map:map.id,mode,samples:f.rows.length,intervalMedianMs:percentile(0,.5),intervalP95Ms:percentile(0,.95),updateP95Ms:percentile(1,.95),renderSubmissionP95Ms:percentile(2,.95),shadowSize:sun.shadow.mapSize.x,bake:!!map.lightingStudy?.enabled});
    }
  }
}
$('loading-text').textContent='HASHIMOTO / 駅前アリーナ、ロード完了';
setVisible('loading',false);requestAnimationFrame(frame);

// A read-only snapshot allows reproducible smoke checks without exposing mutation hooks.
window.hashimotoGame={snapshot:()=>({mode,exploring,round:match?.round||1,phase:match?.phase,side:match?.side,score:match?{...match.score}:null,credits:match?.credits,hp:player.hp,armor:player.armor,alive:player.alive,weapon:inventory.active,ammo:player.ammo,reserve:player.reserve,kills:totalKills,remaining:aliveCount('red'),allies:aliveCount('blue'),spike:match?{...match.spike}:null,player:{x:player.x,y:player.y,z:player.z},mapId:map.id||'hashimoto',buses:map.traffic?.poses(elapsed)||[],time:timeLeft,colliders:map.colliders.length,city:map.stats,renderCalls:renderer.info.render.calls,webgl:!!renderer.getContext()})};

