// Escape stays under browser control. Locking a physical key also covers its
// modifier combinations; the game decides which received shortcuts to cancel.
const GAME_KEY_CODES = Object.freeze([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyQ', 'KeyE', 'KeyC',
  'KeyX', 'KeyF', 'KeyG', 'KeyV', 'KeyB', 'KeyM',
  'KeyL', 'KeyT', 'KeyN', 'KeyP', 'KeyO', 'KeyH', 'KeyJ', 'KeyU',
  'Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4',
  'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9',
  'Tab', 'Space', 'Minus', 'Equal', 'Backspace', 'ArrowLeft', 'ArrowRight',
  'F1', 'F3', 'F5', 'F6', 'F7',
  'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight',
]);

/**
 * Call enable directly from a user gesture, synchronize on fullscreenchange,
 * and release when leaving the game. This controller owns no DOM listeners.
 * Only a fulfilled classic Keyboard.lock request is reported as protected:
 * browsers may silently ignore the newer fullscreen keyboardLock option.
 */
export function createKeyboardProtection({
  document = globalThis.document,
  navigator = globalThis.navigator,
  onStatus,
} = {}) {
  let state = 'idle';
  let generation = 0;
  let wanted = false;
  let pending = null;
  // A late lock resolution must be cleaned up before another lock can begin.
  // In particular, stale cleanup must never unlock a newer successful request.
  let lockQueue = Promise.resolve();

  const isFullscreen = () => Boolean(document?.fullscreenElement);
  const current = token => wanted && generation === token;
  const publish = value => {
    if (state !== value) {
      state = value;
      try { onStatus?.(value); } catch { /* A status view cannot own the lock. */ }
    }
    return state;
  };
  const unlock = () => {
    try {
      // Keyboard.unlock is synchronous in browsers; tolerate promise mocks too.
      const result = navigator?.keyboard?.unlock?.();
      result?.catch?.(() => {});
    } catch { /* Unlock remains best effort on unsupported/closed contexts. */ }
  };
  const release = () => {
    generation++;
    wanted = false;
    unlock();
    return publish('idle');
  };
  const synchronize = () => {
    if (!isFullscreen()) return release();
    return state;
  };

  async function acquire(token) {
    if (!current(token)) return state;
    if (!isFullscreen()) {
      const element = document?.documentElement;
      if (document?.fullscreenEnabled === false || typeof element?.requestFullscreen !== 'function') {
        if (current(token)) publish('unavailable');
        return state;
      }
      try {
        try {
          await element.requestFullscreen({ keyboardLock: 'browser' });
        } catch (error) {
          // A browser can support fullscreen/classic lock but reject this new
          // dictionary value. Do not retry permission or activation failures.
          if (error?.name !== 'NotSupportedError' || !current(token) || isFullscreen()) throw error;
          await element.requestFullscreen();
        }
      } catch {
        if (current(token)) publish(isFullscreen() ? 'fullscreen' : 'unavailable');
        return state;
      }
    }
    if (!current(token)) {
      if (!wanted) unlock();
      return state;
    }
    if (!isFullscreen()) return publish('unavailable');

    const keyboard = navigator?.keyboard;
    if (typeof keyboard?.lock !== 'function') return publish('fullscreen');

    const request = lockQueue.then(async () => {
      if (!current(token)) return state;
      if (!isFullscreen()) return publish('unavailable');
      let succeeded = false;
      try {
        // Keep the explicit list private even if a host API mutates its input.
        await keyboard.lock([...GAME_KEY_CODES]);
        succeeded = true;
      } catch {
        if (current(token)) publish(isFullscreen() ? 'fullscreen' : 'unavailable');
        return state;
      }
      if (!current(token) || !isFullscreen()) {
        if (succeeded) unlock();
        if (current(token)) publish('unavailable');
        return state;
      }
      return publish('protected');
    });
    // Keep the serialization barrier fulfilled even if a host getter throws.
    lockQueue = request.catch(() => {});
    return request;
  }

  function enable() {
    if (wanted && state === 'protected' && isFullscreen()) return Promise.resolve(state);
    if (pending && current(pending.token)) return pending.promise;
    const token = ++generation;
    wanted = true;
    publish('enabling');
    const promise = acquire(token).finally(() => {
      if (pending?.token === token) pending = null;
    });
    pending = { token, promise };
    return promise;
  }

  return {
    enable,
    release,
    synchronize,
    get state() { return state; },
    get pending() { return Boolean(pending && current(pending.token)); },
  };
}
