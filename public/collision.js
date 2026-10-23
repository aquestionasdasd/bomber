// Shared horizontal collision for real building footprints and simple arena cover.
const EPS = 1e-5;
function pointSegmentDistanceSquared(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, length = dx * dx + dz * dz;
  const t = length ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / length)) : 0;
  const x = px - ax - t * dx, z = pz - az - t * dz;
  return x * x + z * z;
}
function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function segmentIntersectsBox(ax, az, bx, bz, minX, minZ, maxX, maxZ) {
  let low = 0, high = 1;
  for (const [origin, delta, min, max] of [[ax, bx - ax, minX, maxX], [az, bz - az, minZ, maxZ]]) {
    if (Math.abs(delta) < 1e-12) { if (origin < min || origin > max) return false; }
    else {
      const a = (min - origin) / delta, b = (max - origin) / delta;
      low = Math.max(low, Math.min(a, b)); high = Math.min(high, Math.max(a, b));
      if (low > high) return false;
    }
  }
  return true;
}
function segmentsDistanceSquared(ax, az, bx, bz, cx, cz, dx, dz) {
  const ux = bx - ax, uz = bz - az, vx = dx - cx, vz = dz - cz, cross = ux * vz - uz * vx;
  if (Math.abs(cross) > 1e-12) {
    const wx = cx - ax, wz = cz - az;
    const t = (wx * vz - wz * vx) / cross, u = (wx * uz - wz * ux) / cross;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0;
  }
  return Math.min(pointSegmentDistanceSquared(ax, az, cx, cz, dx, dz), pointSegmentDistanceSquared(bx, bz, cx, cz, dx, dz),
    pointSegmentDistanceSquared(cx, cz, ax, az, bx, bz), pointSegmentDistanceSquared(dx, dz, ax, az, bx, bz));
}
export function createCollisionIndex(colliders, cellSize = 20) {
  cellSize = Number.isFinite(cellSize) && cellSize > 0 ? cellSize : 20;
  const buckets = new Map(), geometry = new WeakMap();
  let indexedLength = -1, indexedTail, revision = 0;
  const bucketKey = (x, z) => `${x},${z}`;
  function refresh() {
    if (indexedLength === colliders.length && indexedTail === colliders.at(-1)) return;
    buckets.clear(); indexedLength = colliders.length; indexedTail = colliders.at(-1); revision++;
    for (const c of colliders) {
      for (let z = Math.floor(c.minZ / cellSize); z <= Math.floor(c.maxZ / cellSize); z++) {
        for (let x = Math.floor(c.minX / cellSize); x <= Math.floor(c.maxX / cellSize); x++) {
          const key = bucketKey(x, z);
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push(c);
        }
      }
    }
  }
  function rings(c) {
    if (!geometry.has(c)) geometry.set(c, c.polygon?.length >= 3 ? [c.polygon, ...(c.holes || [])] : [[
      [c.minX, c.minZ], [c.maxX, c.minZ], [c.maxX, c.maxZ], [c.minX, c.maxZ],
    ]]);
    return geometry.get(c);
  }
  function overlaps(c, x, z, r = 0) {
    if (x + r < c.minX || x - r > c.maxX || z + r < c.minZ || z - r > c.maxZ) return false;
    if (!c.polygon?.length) {
      const dx = x - Math.max(c.minX, Math.min(c.maxX, x)), dz = z - Math.max(c.minZ, Math.min(c.maxZ, z));
      return dx * dx + dz * dz <= r * r + 1e-12;
    }
    const boundaries = rings(c);
    if (pointInRing(x, z, boundaries[0]) && !boundaries.slice(1).some(hole => pointInRing(x, z, hole))) return true;
    for (const ring of boundaries) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      if (pointSegmentDistanceSquared(x, z, ...ring[j], ...ring[i]) <= r * r + 1e-12) return true;
    }
    return false;
  }
  function query(x, z, r = 0) {
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(r) || r < 0) return [];
    refresh(); const result = new Set();
    for (let gz = Math.floor((z - r) / cellSize); gz <= Math.floor((z + r) / cellSize); gz++) {
      for (let gx = Math.floor((x - r) / cellSize); gx <= Math.floor((x + r) / cellSize); gx++) {
        for (const c of buckets.get(bucketKey(gx, gz)) || []) {
          if (x + r >= c.minX && x - r <= c.maxX && z + r >= c.minZ && z - r <= c.maxZ) result.add(c);
        }
      }
    }
    return [...result];
  }
  const blocksAtHeight = (c, feet, height = 1.7) => c.height > feet + EPS && (c.base || 0) < feet + height - EPS;
  function blocked(x, z, r = .34, feet = 0, height = 1.7) {
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(r) || !Number.isFinite(feet) || !Number.isFinite(height) || height <= 0 || r < 0) return true;
    return query(x, z, r).some(c => blocksAtHeight(c, feet, height) && overlaps(c, x, z, r));
  }
  function segmentCandidates(ax, az, bx, bz, r) {
    if (Math.abs(bx - ax) < cellSize && Math.abs(bz - az) < cellSize) {
      return query((ax + bx) / 2, (az + bz) / 2, r + Math.max(Math.abs(bx - ax), Math.abs(bz - az)) / 2);
    }
    refresh(); const result = new Set(), seen = new Set(), pad = Math.ceil(r / cellSize);
    let gx = Math.floor(ax / cellSize), gz = Math.floor(az / cellSize);
    const endX = Math.floor(bx / cellSize), endZ = Math.floor(bz / cellSize), dx = bx - ax, dz = bz - az;
    const stepX = Math.sign(dx), stepZ = Math.sign(dz);
    const tDeltaX = dx ? cellSize / Math.abs(dx) : Infinity, tDeltaZ = dz ? cellSize / Math.abs(dz) : Infinity;
    let tMaxX = dx ? ((gx + (stepX > 0 ? 1 : 0)) * cellSize - ax) / dx : Infinity;
    let tMaxZ = dz ? ((gz + (stepZ > 0 ? 1 : 0)) * cellSize - az) / dz : Infinity;
    while (true) {
      for (let oz = -pad; oz <= pad; oz++) for (let ox = -pad; ox <= pad; ox++) {
        const key = bucketKey(gx + ox, gz + oz);
        if (seen.has(key)) continue; seen.add(key);
        for (const c of buckets.get(key) || []) result.add(c);
      }
      if (gx === endX && gz === endZ) break;
      // An endpoint exactly on a negative grid boundary must not step past its final cell.
      if (gz === endZ || gx !== endX && tMaxX < tMaxZ) { gx += stepX; tMaxX += tDeltaX; }
      else { gz += stepZ; tMaxZ += tDeltaZ; }
    }
    return result;
  }
  function segmentClear(ax, az, bx, bz, r = .42, feet = 0, height = 1.7) {
    if (![ax, az, bx, bz, r, feet, height].every(Number.isFinite) || height <= 0 || r < 0) return false;
    for (const c of segmentCandidates(ax, az, bx, bz, r)) {
      if (!blocksAtHeight(c, feet, height) || !segmentIntersectsBox(ax, az, bx, bz, c.minX - r, c.minZ - r, c.maxX + r, c.maxZ + r)) continue;
      if (overlaps(c, ax, az, r) || overlaps(c, bx, bz, r)) return false;
      for (const ring of rings(c)) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        if (segmentsDistanceSquared(ax, az, bx, bz, ...ring[j], ...ring[i]) <= r * r + 1e-12) return false;
      }
    }
    return true;
  }
  // A sight ray has no actor height. Clip it to each solid's vertical span before
  // testing the footprint so an overhead deck cannot hide a ground-level enemy.
  function rayClear(ax, ay, az, bx, by, bz) {
    if (![ax, ay, az, bx, by, bz].every(Number.isFinite)) return false;
    const dx=bx-ax,dy=by-ay,dz=bz-az;
    for(const c of segmentCandidates(ax,az,bx,bz,0)){
      let low=0,high=1;
      for(const [start,delta,min,max] of [[ax,dx,c.minX,c.maxX],[ay,dy,c.base||0,c.height],[az,dz,c.minZ,c.maxZ]]){
        if(Math.abs(delta)<1e-12){if(start<min||start>max){low=1;high=0;break;}}
        else{const a=(min-start)/delta,b=(max-start)/delta;low=Math.max(low,Math.min(a,b));high=Math.min(high,Math.max(a,b));if(low>high)break;}
      }
      if(low>high)continue;
      const sx=ax+dx*low,sz=az+dz*low,ex=ax+dx*high,ez=az+dz*high;
      if(overlaps(c,sx,sz)||overlaps(c,ex,ez))return false;
      for(const ring of rings(c))for(let i=0,j=ring.length-1;i<ring.length;j=i++)if(segmentsDistanceSquared(sx,sz,ex,ez,...ring[j],...ring[i])<1e-12)return false;
    }
    return true;
  }
  refresh();
  return { query, blocked, segmentClear, rayClear, overlaps, get revision() { refresh(); return revision; } };
}
