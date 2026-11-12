const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
// Reuse the saved game's complete mouse regression block without running the
// unrelated legacy full-main fixtures. Rendering, audio and timers stay inert.
const base=fs.readFileSync(path.join(__dirname,'tests.cjs'),'utf8');
const head=base.slice(0,base.indexOf('  const mapScene ='));
const start=base.indexOf('  // Gameplay is exercised in a controlled scene');
const end=base.indexOf("  run('pauseGame()');",base.indexOf('const beforeLockedFlick'));
if(start<0||end<start)throw Error('Mouse saved-game fixture boundary missing');
const suite=String.raw`
  console.log('PASS: existing unlocked/locked, fractional, warp-return, fast flick, resize, focus and gain regressions');
  let groups=1;
  for(const phase of ['buy','live'])for(const fractional of [false,true]){
    resetMouseProbe();run('match.phase='+JSON.stringify(phase));
    mouseMove(400,300,0,0,5000);
    const pixel=fractional?.5:1;
    mouseMove(400+pixel,300+pixel,1,1,5008);
    const before=mouseAim();
    mouseMove(400+2*pixel,340+pixel,1,1,5016);
    assertNear(run('player.pitch'),before[1],phase+' first agreeing sample must already protect a vertical recenter');
    assertNear(run('player.yaw'),before[0]-pixel*.002*.35,'Healthy horizontal motion survives early vertical recenter');
    mouseMove(400+3*pixel,301+pixel,1,1,5024);
    assertNear(run('player.pitch'),before[1]-.002*.35,'Early return retains physical motion without an opposite jump');
    run('updatePlay(1/60)');
    assertNear(run('camera.rotation.x'),run('player.pitch'),'Rendered buy/live camera retains the corrected pitch');
    mouseMove(400+4*pixel,302+pixel,1,1,5032);
    assertNear(run('player.pitch'),before[1]-2*.002*.35,'Next genuine pixel remains immediate');
    groups++;console.log('PASS: '+phase+' early recenter/return '+(fractional?'fractional':'integer')+' and actual rendered pitch');
  }
  resetMouseProbe();mouseMove(400,300,0,0,6000);mouseMove(401,301,1,1,6008);
  mouseMove(501,351,100,50,6016);
  assertNear(run('player.yaw'),-101*.002*.35,'Early real horizontal flick retains complete gain');
  assertNear(run('player.pitch'),-51*.002*.35,'Early real vertical flick retains complete gain');
  groups++;console.log('PASS: early matching fast flick keeps both axes and sensitivity');
  console.log(JSON.stringify({groups,wallMs:performance.now()-testStarted,cpuMs:process.cpuUsage(cpuStarted).user/1000}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
`;
const compiled=head+base.slice(start,end)+suite;
const mod=new Module(path.join(__dirname,'mouse-look-savedgame.cjs'),module);mod.filename=path.join(__dirname,'mouse-look-savedgame.cjs');mod.paths=Module._nodeModulePaths(__dirname);mod._compile(compiled,mod.filename);
