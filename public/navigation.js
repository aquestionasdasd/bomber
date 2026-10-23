import { createCollisionIndex } from './collision.js';
import { createTrafficNavigation } from './traffic-navigation.js';
import { createTrcNavigation } from './trc-navigation.js';

// One-metre cells preserve narrow footways. Cells and safe edges are evaluated only when used.
function createGridNavigation(map, CELL = 1) {
  const CLEARANCE = .42, EPS = 1e-6, SQRT2 = Math.SQRT2;
  const bounds = map.bounds, collision = map.collision || createCollisionIndex(map.colliders);
  const left = bounds.minX + CELL / 2, top = bounds.minZ + CELL / 2;
  const width = Math.max(1, Math.floor((bounds.maxX - bounds.minX) / CELL));
  const depth = Math.max(1, Math.floor((bounds.maxZ - bounds.minZ) / CELL)), count = width * depth;
  const occupied = new Uint8Array(count), edgeKnown = new Uint8Array(count), edgeFlags = new Uint8Array(count);
  const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]];
  const nx = id => left + (id % width) * CELL, nz = id => top + Math.floor(id / width) * CELL;
  const cache = new Map(), heap = [];
  let revision = collision.revision, stamp = 0, g, visited, closed, parent;
  function refresh() {
    if (collision.revision === revision) return;
    revision = collision.revision; occupied.fill(0); edgeKnown.fill(0); edgeFlags.fill(0); cache.clear();
  }
  function isWalkable(x, z) {
    return Number.isFinite(x) && Number.isFinite(z) && x >= bounds.minX + CLEARANCE && x <= bounds.maxX - CLEARANCE &&
      z >= bounds.minZ + CLEARANCE && z <= bounds.maxZ - CLEARANCE && !collision.blocked(x, z, CLEARANCE, 0);
  }
  function walkableCell(id) {
    if (!occupied[id]) occupied[id] = isWalkable(nx(id), nz(id)) ? 1 : 2;
    return occupied[id] === 1;
  }
  function clearSegment(ax, az, bx, bz) {
    return isWalkable(ax, az) && isWalkable(bx, bz) && collision.segmentClear(ax, az, bx, bz, CLEARANCE, 0);
  }
  function edges(id) {
    if (edgeKnown[id]) return edgeFlags[id];
    edgeKnown[id] = 1;
    if (!walkableCell(id)) return 0;
    const cx = id % width, cz = Math.floor(id / width);
    for (let k = 0; k < dirs.length; k++) {
      const [dx, dz] = dirs[k], x = cx + dx, z = cz + dz;
      if (x < 0 || z < 0 || x >= width || z >= depth) continue;
      const next = z * width + x;
      if (!walkableCell(next)) continue;
      if (dx && dz && (!walkableCell(cz * width + x) || !walkableCell(z * width + cx))) continue;
      if (collision.segmentClear(nx(id), nz(id), nx(next), nz(next), CLEARANCE, 0)) edgeFlags[id] |= 1 << k;
    }
    return edgeFlags[id];
  }
  function nearestNode(x, z, connector = false) {
    const cx = Math.max(0, Math.min(width - 1, Math.round((x - left) / CELL)));
    const cz = Math.max(0, Math.min(depth - 1, Math.round((z - top) / CELL)));
    let best = -1, bestDistance = Infinity;
    function consider(gx, gz) {
      if (gx < 0 || gz < 0 || gx >= width || gz >= depth) return;
      const id = gz * width + gx;
      if (!walkableCell(id)) return;
      const distance = (nx(id) - x) ** 2 + (nz(id) - z) ** 2;
      if (distance < bestDistance && (!connector || collision.segmentClear(x, z, nx(id), nz(id), CLEARANCE, 0))) {
        best = id; bestDistance = distance;
      }
    }
    // A free actor normally connects within one cell. Bound searches for isolated sub-cell pockets.
    const limit = connector ? Math.min(64, Math.max(width, depth)) : Math.max(width, depth);
    for (let radius = 0; radius <= limit; radius++) {
      if (!radius) consider(cx, cz);
      else {
        for (let ox = -radius; ox <= radius; ox++) { consider(cx + ox, cz - radius); consider(cx + ox, cz + radius); }
        for (let oz = -radius + 1; oz < radius; oz++) { consider(cx - radius, cz + oz); consider(cx + radius, cz + oz); }
      }
      if (best >= 0 && (radius - 1) * CELL > Math.sqrt(bestDistance)) break;
    }
    return best;
  }
  function nearest(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    refresh(); x = Math.max(bounds.minX + CLEARANCE, Math.min(bounds.maxX - CLEARANCE, x));
    z = Math.max(bounds.minZ + CLEARANCE, Math.min(bounds.maxZ - CLEARANCE, z));
    if (isWalkable(x, z)) return { x, z };
    const id = nearestNode(x, z);
    return id < 0 ? null : { x: nx(id), z: nz(id) };
  }
  function push(id, f, h) {
    const item = { id, f, h }; let index = heap.length; heap.push(item);
    while (index) {
      const p = (index - 1) >> 1, other = heap[p];
      if (other.f < f || (other.f === f && other.h <= h)) break;
      heap[index] = other; index = p;
    }
    heap[index] = item;
  }
  function pop() {
    const first = heap[0], end = heap.pop();
    if (heap.length) {
      let index = 0;
      while (index * 2 + 1 < heap.length) {
        let child = index * 2 + 1, right = child + 1;
        if (right < heap.length && (heap[right].f < heap[child].f || (heap[right].f === heap[child].f && heap[right].h < heap[child].h))) child = right;
        if (end.f < heap[child].f || (end.f === heap[child].f && end.h <= heap[child].h)) break;
        heap[index] = heap[child]; index = child;
      }
      heap[index] = end;
    }
    return first.id;
  }
  function route(start, finish) {
    const key = start * count + finish;
    if (cache.has(key)) { const result = cache.get(key); cache.delete(key); cache.set(key, result); return result; }
    if (!g) { g = new Float64Array(count); visited = new Uint32Array(count); closed = new Uint32Array(count); parent = new Int32Array(count); }
    if (++stamp === 0xffffffff) { visited.fill(0); closed.fill(0); stamp = 1; }
    heap.length = 0;
    const tx = finish % width, tz = Math.floor(finish / width);
    function heuristic(id) {
      const dx = Math.abs(id % width - tx), dz = Math.abs(Math.floor(id / width) - tz);
      return (Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz)) * CELL;
    }
    g[start] = 0; visited[start] = stamp; parent[start] = -1;
    push(start, heuristic(start), heuristic(start));
    let result = [];
    while (heap.length) {
      const at = pop();
      if (closed[at] === stamp) continue;
      if (at === finish) { for (let node = finish; node >= 0; node = parent[node]) result.push(node); result.reverse(); break; }
      closed[at] = stamp;
      const flags = edges(at);
      for (let k = 0; k < dirs.length; k++) {
        if (!(flags & (1 << k))) continue;
        const next = at + dirs[k][0] + dirs[k][1] * width;
        if (closed[next] === stamp) continue;
        const cost = g[at] + (k < 4 ? CELL : SQRT2 * CELL);
        if (visited[next] !== stamp || cost + EPS < g[next]) {
          visited[next] = stamp; g[next] = cost; parent[next] = at;
          const h = heuristic(next); push(next, cost + h, h);
        }
      }
    }
    cache.set(key, result);
    if (cache.size > 256) cache.delete(cache.keys().next().value);
    return result;
  }
  function path(fromX, fromZ, toX, toZ) {
    refresh();
    const from = nearest(fromX, fromZ), to = nearest(toX, toZ);
    if (!from || !to) return [];
    if (clearSegment(from.x, from.z, to.x, to.z)) return [{ x: to.x, z: to.z }];
    const start = nearestNode(from.x, from.z, true), finish = nearestNode(to.x, to.z, true);
    if (start < 0 || finish < 0) return [];
    // Search out from the destination: an enclosed courtyard then fails within its small pocket,
    // rather than flooding the whole accessible city when an actor is sent to an unreachable POI.
    const nodes = route(finish, start).slice().reverse();
    if (!nodes.length) return [];
    const points = nodes.map(id => ({ x: nx(id), z: nz(id) })); points.push(to);
    const result = []; let anchor = from, index = 0;
    while (index < points.length) {
      let end = points.length - 1;
      while (end > index && !clearSegment(anchor.x, anchor.z, points[end].x, points[end].z)) end--;
      const point = points[end];
      if ((point.x - anchor.x) ** 2 + (point.z - anchor.z) ** 2 > EPS) result.push({ x: point.x, z: point.z });
      anchor = point; index = end + 1;
    }
    return result;
  }
  return { path, isWalkable, nearest, clearSegment };
}

export function createNavigation(map) {
  if(map.id==='trc')return createTrcNavigation(map);
  const traffic = map.traffic?.poses ? createTrafficNavigation(map) : null;
  if (traffic) map = { ...map, collision: traffic.collision };
  const fine = createGridNavigation(map), area = (map.bounds.maxX - map.bounds.minX) * (map.bounds.maxZ - map.bounds.minZ);
  let roads;
  return { ...fine, ...(traffic ? { updateTraffic: traffic.updateTraffic, trafficStep: traffic.trafficStep, trafficEscape: traffic.trafficEscape } : {}), path(fromX, fromZ, toX, toZ) {
    // Long trips first try a sparse road-scale grid; every edge still checks the exact footprint.
    // Narrow footways retain the one-metre fallback rather than being erased by a coarse raster.
    if (area > 120000 && Math.hypot(toX - fromX, toZ - fromZ) > 70) {
      roads ||= createGridNavigation(map, 4);
      const route = roads.path(fromX, fromZ, toX, toZ);
      if (route.length) return route;
    }
    return fine.path(fromX, fromZ, toX, toZ);
  } };
}
