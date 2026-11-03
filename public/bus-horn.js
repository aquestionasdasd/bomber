// Local audio clock derived only from confirmed bus poses. No network events,
// simulation changes or catch-up bursts after a pause/missing snapshot.
export const BUS_HORN_INTERVAL = 1.5;
export function createBusHornScheduler(play) {
  const clocks = new Map();
  function reset() { clocks.clear(); }
  function update(time, poses, enabled = true) {
    if (!enabled || !Number.isFinite(time)) { reset(); return; }
    // Guest elapsed is corrected to snapshot time and can step backwards.
    // Keep the deadline: a clock correction must never restart the horn.
    // A new round/reconnect explicitly resets us at the snapshot boundary.
    const active = new Set();
    for (const pose of (poses || []).slice(0, 4)) {
      if (!pose || typeof pose.id !== 'string' || !pose.owner ||
          !Number.isFinite(pose.x) || !Number.isFinite(pose.z) || active.has(pose.id)) continue;
      active.add(pose.id);
      const clock = clocks.get(pose.id);
      if (!clock || clock.owner !== pose.owner || time + 1e-8 >= clock.next) {
        clocks.set(pose.id, { owner: pose.owner, next: time + BUS_HORN_INTERVAL });
        play(pose);
      }
    }
    for (const id of clocks.keys()) if (!active.has(id)) clocks.delete(id);
  }
  return { update, reset };
}
