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
  ['seeds slow before landing', 'engine', 'if (actor.team === event.team || currentTime < event.triggerAt) continue;', 'if (actor.team === event.team) continue;'],
  // Both independent team guards must be removed to make friendly slow possible.
  ['seeds slow teammates', 'engine',
    ["return living(actor)&&event?.type==='mend-seeds'&&actor.team!==event.team", 'if (actor.team === event.team || currentTime < event.triggerAt) continue;'],
    ["return living(actor)&&event?.type==='mend-seeds'", "if ((actor.team === event.team && event.type !== 'mend-seeds') || currentTime < event.triggerAt) continue;"]],
  ['seeds ignore cover', 'engine', '&&canReach(reachable,event,actor);\n  }\n  // Read-only annulus', ';\n  }\n  // Read-only annulus'],
  ['healing amount changes', 'engine', 'amount: MEND_SKILLS.healAmount', 'amount: MEND_SKILLS.healAmount + 1'],
  ['restored guests acquire healing ownership', 'engine',
    'for (const [id, event] of nextEvents) if (event.endsAt > currentTime) active.set(id, event);',
    "for (const [id, event] of nextEvents) if (event.endsAt > currentTime) { active.set(id, event); if(event.type==='mend-heal') owned.add(id); }"],
  ['seeds use the old constant activation time', 'throw', "return e.type==='nope-flash'?", "return e.type==='mend-seeds'?.65:e.type==='nope-flash'?"],
  ['seed lifetime shortens', 'engine', 'tail: MEND_SKILLS.seedsDuration', 'tail: MEND_SKILLS.seedsDuration - 1'],
];
for (const [name, layer, before, after] of faults) {
  const throwURL = dataURL(layer === 'throw' ? inject(throws, before, after) : throws);
  const mutated = (layer === 'engine' ? inject(engine, before, after) : engine)
    .replace(/from '(\.\/[a-z-]+\.js)'/g, (_, file) => `from ${JSON.stringify(file === './skill-throw.js'
      ? throwURL : pathToFileURL(path.join(__dirname, 'public', file)).href)}`);
  const scoped = fixture.replace(sourceImport, `await import(${JSON.stringify(dataURL(mutated))})`);
  const child = `const Module=require('node:module');process.argv.push('--through-mend');const m=new Module(${JSON.stringify(fixturePath)});m.filename=${JSON.stringify(fixturePath)};m.paths=Module._nodeModulePaths(${JSON.stringify(__dirname)});m._compile(${JSON.stringify(scoped)},m.filename);`;
  const result = spawnSync(process.execPath, ['-'], { input: child, encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 512 * 1024 });
  assert.equal(result.error?.code, undefined, `Fault subprocess failed: ${name}`);
  assert.equal(result.status, 1, `The real MEND assertions must reject: ${name}`);
  assert.match(result.stderr, /AssertionError/, `An import or infrastructure error is not detection: ${name}`);
  assert.doesNotMatch(result.stderr, /SyntaxError|ERR_MODULE_NOT_FOUND|TypeError/);
  assert.doesNotMatch(result.stdout, /Character contract prefix passed/);
  console.log(`PASS detects ${name} (memory only)`);
}
console.log('MEND negative contract tests passed: 7 faults; product files never written.');
