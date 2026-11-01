const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const fixturePath = path.join(__dirname, 'tests-character-skills.cjs');
const fixture = fs.readFileSync(fixturePath, 'utf8');
const engine = fs.readFileSync(path.join(__dirname, 'public/character-skills.js'), 'utf8');
const throws = fs.readFileSync(path.join(__dirname, 'public/skill-throw.js'), 'utf8');
const sourceImport = "await import(pathToFileURL(path.join(__dirname, 'public/character-skills.js')).href)";
assert.ok(fixture.includes(sourceImport));
const dataURL = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
function replaceOnce(source, before, after) {
  assert.equal(source.split(before).length - 1, 1, 'Fault must change exactly one actual expression');
  return source.replace(before, after);
}
function inject(source, before, after) {
  return Array.isArray(before) ? before.reduce((text, old, n) => replaceOnce(text, old, after[n]), source) : replaceOnce(source, before, after);
}
const faults = [
  ['tags detect before arming', 'engine', 'if (!event || now + 1e-8 < event.triggerAt) continue;', "if (!event || event.type !== 'echo-tag' && now + 1e-8 < event.triggerAt) continue;"],
  // The candidate loop and read-only predicate independently reject teammates.
  ['tags detect teammates', 'engine',
    ["return living(actor)&&event?.type==='echo-tag'&&actor.team!==event.team", 'if (!living(actor) || actor.team === event.team || seen.has(actor.id)) continue; seen.add(actor.id);'],
    ["return living(actor)&&event?.type==='echo-tag'", 'if (!living(actor) || seen.has(actor.id)) continue; seen.add(actor.id);']],
  ['tags ignore cover', 'engine', '&&canReach(reachable,event,actor);\n  }\n  function wouldSeed', ';\n  }\n  function wouldSeed'],
  ['tag markers move away from the sampled point', 'engine', 'x: target.x, y: target.y || 0, z: target.z, detectedAt: now', 'x: target.x + 1, y: target.y || 0, z: target.z, detectedAt: now'],
  ['restored guests acquire tag ownership', 'engine', 'for (const [id, event] of nextEvents) if (event.endsAt > currentTime) active.set(id, event);', "for (const [id, event] of nextEvents) if (event.endsAt > currentTime) { active.set(id, event); if(event.type==='echo-tag') owned.add(id); }"],
  ['glint blindness duration changes', 'engine', 'IAGNU_SKILLS.glintDuration : 0;', 'IAGNU_SKILLS.glintDuration + 1 : 0;'],
  ['tags use the old fixed activation time', 'throw', "return e.type==='nope-flash'?", "return e.type==='echo-tag'?1.05:e.type==='nope-flash'?"],
  ['tag waiting lifetime shortens', 'engine', 'tail: IAGNU_SKILLS.tagDuration', 'tail: IAGNU_SKILLS.tagDuration - 1'],
];
for (const [name, layer, before, after] of faults) {
  const throwURL = dataURL(layer === 'throw' ? inject(throws, before, after) : throws);
  const mutated = (layer === 'engine' ? inject(engine, before, after) : engine)
    .replace(/from '(\.\/[a-z-]+\.js)'/g, (_, file) => `from ${JSON.stringify(file === './skill-throw.js' ? throwURL : pathToFileURL(path.join(__dirname, 'public', file)).href)}`);
  const scoped = fixture.replace(sourceImport, `await import(${JSON.stringify(dataURL(mutated))})`);
  const child = `const Module=require('node:module');process.argv.push('--through-iagnu');const m=new Module(${JSON.stringify(fixturePath)});m.filename=${JSON.stringify(fixturePath)};m.paths=Module._nodeModulePaths(${JSON.stringify(__dirname)});m._compile(${JSON.stringify(scoped)},m.filename);`;
  const result = spawnSync(process.execPath, ['-'], { input: child, encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 512 * 1024 });
  assert.equal(result.error?.code, undefined, `Fault subprocess failed: ${name}`);
  assert.equal(result.status, 1, `The real IAGNU assertions must reject: ${name}`);
  assert.match(result.stderr, /AssertionError/, `An import or infrastructure error is not detection: ${name}`);
  assert.doesNotMatch(result.stderr, /SyntaxError|ERR_MODULE_NOT_FOUND|TypeError/);
  assert.doesNotMatch(result.stdout, /Character contract prefix passed/);
  console.log(`PASS detects ${name} (memory only)`);
}
console.log('IAGNU negative contract tests passed: 8 faults; product files never written.');
