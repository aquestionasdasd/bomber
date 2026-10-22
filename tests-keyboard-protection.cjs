const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function main() {
  const { createKeyboardProtection } = await import(pathToFileURL(path.join(__dirname, 'public/keyboard-protection.js')).href);
  const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
  };
  const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  let groups = 0;
  function fixture({ fullscreen = false, missingLock = false, missingFullscreen = false, fullscreenEnabled = true, fullscreenRequest, lockRequest, unlockRequest, onStatus } = {}) {
    const calls = { fullscreen: [], lock: [], unlock: 0, status: [] };
    const element = {};
    const document = { fullscreenElement: fullscreen ? element : null, documentElement: element, fullscreenEnabled };
    if (!missingFullscreen) element.requestFullscreen = function (options) {
      assert.equal(this, element, 'Fullscreen keeps its native receiver');
      calls.fullscreen.push(options);
      if (fullscreenRequest) return fullscreenRequest(document, element, options, calls);
      document.fullscreenElement = element;
      return Promise.resolve();
    };
    const keyboard = {
      unlock() {
        assert.equal(this, keyboard, 'Unlock keeps its native receiver');
        calls.unlock++;
        return unlockRequest?.();
      },
    };
    if (!missingLock) keyboard.lock = function (keys) {
      assert.equal(this, keyboard, 'Lock keeps its native receiver');
      assert.ok(document.fullscreenElement, 'Classic keyboard locking is never requested outside fullscreen');
      calls.lock.push(keys);
      return lockRequest ? lockRequest(keys, calls) : Promise.resolve();
    };
    const controller = createKeyboardProtection({ document, navigator: { keyboard }, onStatus(value) { calls.status.push(value); onStatus?.(value); } });
    return { controller, document, element, keyboard, calls };
  }

  {
    const f = fixture();
    assert.equal(f.controller.state, 'idle');
    assert.equal(await f.controller.enable(), 'protected');
    assert.deepEqual(f.calls.fullscreen, [{ keyboardLock: 'browser' }]);
    assert.deepEqual(f.calls.status, ['enabling', 'protected']);
    const keys = f.calls.lock[0];
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyQ', 'KeyE', 'KeyC', 'KeyX', 'KeyF', 'KeyG', 'KeyV', 'KeyB', 'KeyM', 'Tab', 'Space', 'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'KeyL', 'KeyT', 'KeyN', 'KeyP', 'KeyO', 'KeyH', 'KeyJ', 'KeyU', 'Minus', 'Equal', 'F1', 'F3', 'F5', 'F6', 'F7', 'Backspace', 'ArrowLeft', 'ArrowRight', ...Array.from({ length: 10 }, (_, i) => `Digit${i}`)]) assert.ok(keys.includes(code), `${code} is explicitly protected`);
    assert.equal(new Set(keys).size, keys.length);
    assert.ok(!keys.includes('Escape'), 'Escape remains a browser escape route');
    assert.equal(keys.length, 48, 'The bounded explicit list covers game and common browser shortcut keys');
    assert.equal(await f.controller.enable(), 'protected');
    assert.equal(f.calls.lock.length, 1, 'A successful unchanged request is idempotent');
    assert.equal(f.controller.release(), 'idle');
    assert.equal(f.calls.unlock, 1);
    assert.equal(f.document.fullscreenElement, f.element, 'Releasing keyboard capture does not exit a user fullscreen session');
    groups++;
  }
  {
    const f = fixture({ fullscreen: true, missingFullscreen: true });
    assert.equal(await f.controller.enable(), 'protected');
    assert.equal(f.calls.fullscreen.length, 0, 'An existing fullscreen session is neither exited nor restarted');
    assert.equal(f.calls.lock.length, 1);
    groups++;
  }
  {
    const f = fixture({ missingLock: true });
    assert.equal(await f.controller.enable(), 'fullscreen');
    assert.ok(!f.calls.status.includes('protected'), 'Silently ignored modern fullscreen options cannot prove protection');
    assert.equal(f.calls.lock.length, 0);
    groups++;
  }
  {
    for (const failure of [() => Promise.reject(new Error('denied')), () => { throw new Error('denied'); }]) {
      const f = fixture({ lockRequest: failure });
      assert.equal(await f.controller.enable(), 'fullscreen');
      assert.ok(!f.calls.status.includes('protected'));
    }
    groups++;
  }
  {
    for (const name of ['NotAllowedError', 'TypeError']) {
      const f = fixture({ fullscreenRequest() { return Promise.reject(Object.assign(new Error('denied'), { name })); } });
      assert.equal(await f.controller.enable(), 'unavailable');
      assert.equal(f.calls.lock.length, 0);
      assert.equal(f.calls.fullscreen.length, 1, 'Permission/activation rejection is not retried');
    }
    for (const options of [{ missingFullscreen: true }, { fullscreenEnabled: false }]) {
      const f = fixture(options);
      assert.equal(await f.controller.enable(), 'unavailable');
      assert.equal(f.calls.lock.length + f.calls.fullscreen.length, 0);
    }
    groups++;
  }
  {
    const f = fixture({ fullscreenRequest(document, element, options) {
      if (options) return Promise.reject(Object.assign(new Error('old fullscreen options'), { name: 'NotSupportedError' }));
      document.fullscreenElement = element;
      return Promise.resolve();
    } });
    assert.equal(await f.controller.enable(), 'protected');
    assert.deepEqual(f.calls.fullscreen, [{ keyboardLock: 'browser' }, undefined]);
    assert.equal(f.calls.lock.length, 1);
    groups++;
  }
  {
    const f = fixture();
    await f.controller.enable();
    assert.equal(f.controller.synchronize(), 'protected');
    f.document.fullscreenElement = null;
    assert.equal(f.controller.synchronize(), 'idle');
    assert.equal(f.calls.unlock, 1);
    assert.equal(f.controller.pending, false);
    groups++;
  }
  {
    const full = deferred();
    const f = fixture({ fullscreenRequest: () => full.promise });
    const pending = f.controller.enable();
    assert.equal(f.controller.pending, true);
    f.controller.release();
    assert.equal(f.controller.pending, false);
    f.document.fullscreenElement = f.element;
    full.resolve();
    assert.equal(await pending, 'idle');
    assert.equal(f.calls.lock.length, 0, 'A fullscreen resolution after returning to the menu cannot start keyboard capture');
    assert.ok(!f.calls.status.includes('protected'));
    assert.equal(f.calls.unlock, 2, 'A late fullscreen entry also receives best-effort cleanup');
    groups++;
  }
  {
    const lock = deferred();
    const f = fixture({ fullscreen: true, lockRequest: () => lock.promise });
    const pending = f.controller.enable();
    await settle();
    assert.equal(f.calls.lock.length, 1);
    f.controller.release();
    lock.resolve();
    assert.equal(await pending, 'idle');
    assert.equal(f.calls.unlock, 2, 'An in-flight native lock is unlocked again if it resolves after release');
    assert.ok(!f.calls.status.includes('protected'));
    groups++;
  }
  {
    const oldLock = deferred(), newLock = deferred();
    const f = fixture({ fullscreen: true, lockRequest: (_keys, calls) => calls.lock.length === 1 ? oldLock.promise : newLock.promise });
    const oldEnable = f.controller.enable();
    await settle();
    f.controller.release();
    const newEnable = f.controller.enable();
    await settle();
    assert.equal(f.calls.lock.length, 1, 'A newer attempt waits until stale native acquisition has settled');
    oldLock.resolve();
    await settle();
    assert.equal(f.calls.lock.length, 2);
    assert.equal(f.calls.unlock, 2, 'Stale cleanup runs before the newer lock request');
    assert.equal(f.controller.state, 'enabling');
    newLock.resolve();
    assert.equal(await newEnable, 'protected');
    await oldEnable;
    assert.equal(f.controller.state, 'protected');
    assert.equal(f.calls.unlock, 2, 'Old completions cannot unlock the newer successful capture');
    assert.equal(f.calls.status.filter(value => value === 'protected').length, 1);
    groups++;
  }
  {
    const full = deferred();
    const f = fixture({ fullscreenRequest: () => full.promise });
    const first = f.controller.enable(), second = f.controller.enable();
    assert.equal(first, second, 'Repeated clicks share one pending enable rather than creating competing native requests');
    assert.equal(f.calls.fullscreen.length, 1);
    f.document.fullscreenElement = f.element;
    full.resolve();
    assert.equal(await first, 'protected');
    assert.equal(f.calls.lock.length, 1);
    groups++;
  }
  {
    const lock = deferred();
    const f = fixture({ fullscreen: true, lockRequest: () => lock.promise });
    const pending = f.controller.enable();
    await settle();
    f.document.fullscreenElement = null;
    f.controller.synchronize();
    lock.resolve();
    assert.equal(await pending, 'idle');
    assert.ok(!f.calls.status.includes('protected'), 'Fullscreen exit during permission acquisition never publishes protected');
    assert.equal(f.calls.unlock, 2);
    groups++;
  }
  {
    const f = fixture({ fullscreenRequest: () => Promise.resolve() });
    assert.equal(await f.controller.enable(), 'unavailable', 'A fulfilled fullscreen promise alone is insufficient without an actual fullscreen element');
    assert.equal(f.calls.lock.length, 0);
    groups++;
  }
  {
    for (const failOld of [false, true]) {
      const oldFull = deferred(), newFull = deferred();
      const f = fixture({ fullscreenRequest: (_document, _element, _options, calls) => calls.fullscreen.length === 1 ? oldFull.promise : newFull.promise });
      const oldEnable = f.controller.enable();
      f.controller.release();
      const newEnable = f.controller.enable();
      assert.equal(f.calls.fullscreen.length, 2);
      f.document.fullscreenElement = f.element;
      newFull.resolve();
      assert.equal(await newEnable, 'protected');
      if (failOld) oldFull.reject(new Error('older fullscreen denied'));
      else oldFull.resolve();
      await oldEnable;
      assert.equal(f.controller.state, 'protected', 'A stale fullscreen success or failure cannot replace a newer protection status');
      assert.equal(f.calls.unlock, 1, 'Stale fullscreen completion cannot unlock the newer capture');
      assert.equal(f.calls.lock.length, 1, 'The stale fullscreen attempt never makes a second classic lock request');
    }
    groups++;
  }
  {
    const f = fixture({ fullscreen: true, lockRequest(keys) { keys.length = 0; return Promise.resolve(); } });
    await f.controller.enable();
    f.controller.release();
    f.keyboard.lock = keys => {
      f.calls.lock.push(keys);
      assert.equal(keys.length, 48, 'A mutated native argument cannot corrupt later explicit key requests');
      assert.ok(!keys.includes('Escape'));
      return Promise.resolve();
    };
    assert.equal(await f.controller.enable(), 'protected');
    groups++;
  }
  {
    const f = fixture({ onStatus() { throw new Error('removed UI'); }, unlockRequest() { throw new Error('closed context'); } });
    assert.equal(await f.controller.enable(), 'protected');
    assert.doesNotThrow(() => f.controller.release());
    assert.equal(f.controller.state, 'idle');
    const absent = createKeyboardProtection({ document: null, navigator: null });
    assert.equal(await absent.enable(), 'unavailable');
    assert.equal(absent.release(), 'idle');
    groups++;
  }
  console.log(`PASS: keyboard protection ${groups} lifecycle groups; explicit 48-key list excludes Escape, fullscreen/legacy fallbacks and stale native requests are isolated`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
