// All combat/economy/AI tuning for Ember's eight formations. Shared by host,
// presentation and tests. The old ordinary Ember events remain read-compatible.
export const ROBOT_RULES=Object.freeze({ownerLimit:32,teamLimit:64,worldLimit:96,attackers:3,think:.125,memory:1.2,fov:Math.PI*1.5,pathInterval:.75,wreckLife:5,wreckLimit:96,signatureCooldown:24,commandRange:40,repairRange:5,materialRange:14,armorBonus:40,wireLength:6,wireSlow:.7,wireDuration:1,wireCooldown:2,captureScale:.6,captureDuration:2,groupDamageCap:70,encircleScale:1.5,encircleDuration:2,killBoost:1.2,killBoostDuration:2});
export const ROBOT_TYPES=Object.freeze({
 bomb:{hp:30,speed:5,detect:12,life:8,radius:.3,height:.45,range:1.5,damage:35,blast:1.8,warning:.35},
 crab:{hp:30,speed:4,detect:10,life:7,radius:.32,height:.4,range:.85},
 flyer:{hp:25,speed:4,detect:15,life:7,radius:.3,height:.4,altitude:2.5,range:15,damage:6,burst:3,sets:2,interval:1.4,warning:.25},
 shield:{hp:200,speed:1.5,detect:0,life:8,radius:.5,height:1.65},
 repair:{hp:35,speed:4,detect:0,life:10,radius:.25,height:.4,altitude:1.5,repair:20},
 turret:{hp:70,speed:2,detect:18,life:8,radius:.4,height:1,range:18,damage:7,burst:3,interval:1.8,warning:.5},
 wire:{hp:30,speed:2,detect:0,life:8,radius:.25,height:.3},
 supervisor:{hp:140,speed:4,detect:18,life:10,radius:.45,height:1.7,range:18,damage:8,burst:3,interval:1.6,warning:.3},
 guard:{hp:35,speed:4,detect:15,life:10,radius:.25,height:.4,altitude:2,range:15,damage:5,burst:1,interval:1.7,warning:.2},
 dismantler:{hp:120,speed:4.5,detect:14,life:10,radius:.45,height:.7,range:1.1,damage:30,interval:1.4,climber:true},
 cutter:{hp:30,speed:4.5,detect:12,life:10,radius:.25,height:.35,range:.85,damage:12,interval:1.4},
 fragment:{hp:10,speed:4.5,detect:0,life:2,radius:.2,height:.25,range:.75,damage:8,interval:1.4},
 assault:{hp:300,speed:1.5,detect:0,life:12,radius:.85,height:1.7,factory:true},
 production:{hp:350,speed:0,detect:0,life:15,radius:.85,height:1.9,factory:true},
});
export const ROBOT_NAMES=Object.freeze({bomb:'自爆ロボ',crab:'捕獲カニ',flyer:'飛行ロボ',shield:'盾ブルドーザー',repair:'修理ドローン',turret:'砲台ロボ',wire:'電線ロボ',supervisor:'監督ロボ',guard:'護衛ドローン',dismantler:'解体ロボ',cutter:'切断ドローン',fragment:'分裂ロボ',assault:'突撃工場',production:'生産工場'});
export const ROBOT_SKILLS=Object.freeze({
 c:{name:'ロボ投下',range:18,price:100,max:2,modes:['自爆ロボ','捕獲ロボ'],rosters:[['bomb','bomb','bomb','bomb'],['crab','crab','flyer','flyer']]},
 q:{name:'ロボ設置',range:12,price:100,max:1,modes:['盾ロボ','砲台ロボ'],rosters:[['shield','shield','repair'],['turret','turret','wire','wire']]},
 e:{name:'主力ロボ',range:12,price:0,max:1,modes:['監督ロボ','解体ロボ'],rosters:[['supervisor','guard','guard'],['dismantler','cutter','cutter']]},
 x:{name:'ロボ工場',range:12,price:0,max:7,modes:['突撃工場','生産工場'],rosters:[['assault','bomb','bomb','bomb','bomb','flyer','flyer','cutter','cutter','shield','shield','repair','turret'],['production','turret','turret','shield','shield','repair','repair']]},
});
export const ROBOT_COMMANDS=Object.freeze({laserWarning:.6,laserDuration:1.2,laserDamage:60,laserRange:14,dashWarning:.45,dashRange:9,dashDamage:45,dashSpeed:18,linkDistance:4,focusRadius:3,fuseDistance:2,fuseRate:1.5,productionInterval:2,resupplyInterval:1,resupplyLimit:4,factoryActive:12,productionTotal:18,emergencyCount:4,emergencyTime:3});
