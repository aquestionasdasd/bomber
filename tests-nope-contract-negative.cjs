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
const faults = [
  ['bottle detonates before a long flight lands', 'throw', 'Math.max(baseDelay,e.flight)', 'baseDelay'],
  ['flash reverts to the old .45 second fuse', 'throw', "e.type==='nope-flash'?NOPE_FLASH_THROW.fuse:", "e.type==='nope-flash'?.45:"],
  ['flash loses its stronger gravity', 'throw', "type==='nope-flash'?NOPE_FLASH_THROW.gravity:SKILL_THROW.gravity", 'SKILL_THROW.gravity'],
  ['bottle starts damaging teammates', 'engine', 'if (actor.team === event.team || distance >= event.radius', 'if (distance >= event.radius'],
  ['restored guests acquire damage ownership', 'engine',
    'for (const [id, event] of nextEvents) if (event.endsAt > currentTime) active.set(id, event);',
    'for (const [id, event] of nextEvents) if (event.endsAt > currentTime) { active.set(id, event); owned.add(id); }'],
  ['forged visual expiry becomes valid', 'engine', ' && close(value.endsAt, value.triggerAt + spec.tail)', ''],
];

for (const [name, layer, before, after] of faults) {
  const throwURL = dataURL(layer === 'throw' ? replaceOnce(throws, before, after) : throws);
  const mutated = (layer === 'engine' ? replaceOnce(engine, before, after) : engine)
    .replace(/from '(\.\/[a-z-]+\.js)'/g, (_, file) => `from ${JSON.stringify(file === './skill-throw.js'
      ? throwURL : pathToFileURL(path.join(__dirname, 'public', file)).href)}`);
  const scoped = fixture.replace(sourceImport, `await import(${JSON.stringify(dataURL(mutated))})`);
  const child = `const Module=require('node:module');process.argv.push('--nope');const m=new Module(${JSON.stringify(fixturePath)});m.filename=${JSON.stringify(fixturePath)};m.paths=Module._nodeModulePaths(${JSON.stringify(__dirname)});m._compile(${JSON.stringify(scoped)},m.filename);`;
  const result = spawnSync(process.execPath, ['-'], { input: child, encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 512 * 1024 });
  assert.equal(result.error?.code, undefined, `Fault subprocess failed: ${name}`);
  assert.equal(result.status, 1, `The real NOPE assertions must reject: ${name}`);
  assert.match(result.stderr, /AssertionError/, `An import or infrastructure error is not detection: ${name}`);
  assert.doesNotMatch(result.stderr, /SyntaxError|ERR_MODULE_NOT_FOUND|TypeError/);
  assert.doesNotMatch(result.stdout, /NOPE character contract tests passed/);
  console.log(`PASS detects ${name} (memory only)`);
}
console.log('NOPE negative contract tests passed: 6 faults; product files never written.');
