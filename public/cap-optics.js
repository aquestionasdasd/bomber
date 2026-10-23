import { CAP_SKILLS } from './abilities.js';

// A deterministic cone, resolved from the accepted trigger sequence. Guests
// send their unmodified aim; the host applies this once, never a client ray.
export function capShotOffset(sequence, locked = false) {
  if (!locked) return { x: 0, y: 0 };
  const index = Number.isSafeInteger(sequence) && sequence > 0 ? sequence : 1;
  const angle = (index % 1048576) * 2.399963229728653;
  const radius = CAP_SKILLS.lockSpread * .5;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}
