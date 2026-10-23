import { createCollisionIndex } from './collision.js';
import { busPoint } from './bus-service.js';

// A navigation-only overlay. Real bus hits, seats, walls and sight rays stay
// with the host's existing traffic/physics systems. No actor receives immunity.
export function createTrafficNavigation(map) {
  const solid = map.collision || createCollisionIndex(map.colliders), radius = .42;
  const halfWidth = 1.65, halfLength = 6;
  let index = createCollisionIndex([]), bodies = [], sampledAt = -Infinity;
  let fingerprint = '', revision = 0, solidRevision = solid.revision;
  function updateTraffic(now) {
    if (!Number.isFinite(now) || now >= sampledAt && now - sampledAt < .25) return;
    sampledAt = now;
    const seen = new Set(), poses = [], current = new Map(map.traffic.poses(now).map(p => [p.id, p]));
    for (let ahead = 0; ahead <= .65001; ahead += .13) {
      for (const pose of map.traffic.poses(now + ahead)) {
        // Custom/queued poses have no future simulation. Extend their current
        // velocity for the same short horizon used by the former traffic gate.
        const at = current.get(pose.id), frozenClock = at && pose.x === at.x && pose.z === at.z && pose.yaw === at.yaw;
        const p = pose.diverted || frozenClock ? { ...pose, x: pose.x + Math.sin(pose.yaw) * pose.speed * ahead,
          z: pose.z + Math.cos(pose.yaw) * pose.speed * ahead } : pose;
        const key = [p.x, p.z, p.yaw].map(n => n.toFixed(3)).join(',');
        if (!seen.has(key)) { seen.add(key); poses.push(p); }
      }
    }
    const next = [...seen].join(';');
    if (next === fingerprint) return;
    fingerprint = next; bodies = poses;
    const colliders = poses.map(p => {
      const polygon = [[-halfWidth, -halfLength], [halfWidth, -halfLength], [halfWidth, halfLength], [-halfWidth, halfLength]]
        .map(([x, z]) => { const point = busPoint(p, x, z); return [point.x, point.z]; });
      return { polygon, minX: Math.min(...polygon.map(p => p[0])), maxX: Math.max(...polygon.map(p => p[0])),
        minZ: Math.min(...polygon.map(p => p[1])), maxZ: Math.max(...polygon.map(p => p[1])), height: 3.25 };
    });
    index = createCollisionIndex(colliders); revision++;
  }
  const depth = (p, x, z) => {
    const dx = x - p.x, dz = z - p.z;
    return Math.max(0, Math.min(halfWidth + radius - Math.abs(dx * Math.cos(p.yaw) - dz * Math.sin(p.yaw)),
      halfLength + radius - Math.abs(dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw))));
  };
  function trafficStep(ax, az, bx, bz) {
    if (index.segmentClear(ax, az, bx, bz, radius, 0)) return true;
    if (!index.blocked(ax, az, radius, 0)) return false;
    // A bus can move its safety margin over a stationary BOT. Allow a normal
    // outward step, never a new entry or movement deeper through the vehicle.
    let before = 0, after = 0;
    for (const body of bodies) {
      const a = depth(body, ax, az), b = depth(body, bx, bz);
      if (a <= 1e-6 && b > 1e-6) return false;
      before += a; after += b;
    }
    return after < before - 1e-6;
  }
  function trafficEscape(x, z) {
    if (!index.blocked(x, z, radius, 0)) return null;
    const candidates = [];
    for (const p of bodies) {
      if (!depth(p, x, z)) continue;
      const dx = x - p.x, dz = z - p.z, side = dx * Math.cos(p.yaw) - dz * Math.sin(p.yaw), along = dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw);
      const w = halfWidth + radius + .25, l = halfLength + radius + .25;
      for (const [sx, sz] of [[-w, along], [w, along], [side, -l], [side, l], [-w, -l], [w, -l], [w, l], [-w, l]]) candidates.push(busPoint(p, sx, sz));
    }
    // A second queued bus or roadside wall can invalidate the nearest edge.
    for (const r of [2, 4, 8, 12, 16]) for (let i = 0; i < 16; i++) candidates.push({ x: x + Math.cos(i * Math.PI / 8) * r, z: z + Math.sin(i * Math.PI / 8) * r });
    candidates.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    for (const p of candidates) {
      const d = Math.hypot(p.x - x, p.z - z), step = Math.min(d, .1);
      if (p.x < map.bounds.minX + radius || p.x > map.bounds.maxX - radius || p.z < map.bounds.minZ + radius || p.z > map.bounds.maxZ - radius) continue;
      if (!index.blocked(p.x, p.z, radius, 0) && solid.segmentClear(x, z, p.x, p.z, radius, 0) && trafficStep(x, z, x + (p.x - x) / d * step, z + (p.z - z) / d * step)) return { x: p.x, z: p.z };
    }
    return null;
  }
  const collision = {
    blocked: (x, z, r, feet) => solid.blocked(x, z, r, feet) || index.blocked(x, z, r, feet),
    segmentClear: (ax, az, bx, bz, r, feet) => solid.segmentClear(ax, az, bx, bz, r, feet) && index.segmentClear(ax, az, bx, bz, r, feet),
    get revision() { if (solid.revision !== solidRevision) { solidRevision = solid.revision; revision++; } return revision; },
  };
  return { collision, updateTraffic, trafficStep, trafficEscape };
}
