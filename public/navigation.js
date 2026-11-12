import { createCollisionIndex } from './collision.js';
import { createTrafficNavigation } from './traffic-navigation.js';
import { createTrcNavigation } from './trc-navigation.js';
import { createHirakataNavigation } from './hirakata-navigation.js';

// One-metre cells preserve narrow footways. Cells and safe edges are evaluated only when used.
function createGridNavigation(map, CELL = 1) {
  const CLEARANCE = .42, EPS = 1e-6, SQRT2 = Math.SQRT2;
  const bounds = map.bounds, collision = map.collision || createCollisionIndex(map.colliders);
  const left = bounds.minX + CELL / 2, top = bounds.minZ + CELL / 2;
  const width = Math.max(1, Math.floor((bounds.maxX - bounds.minX) / CELL));
  const depth = Math.max(1, Math.floor((bounds.maxZ - bounds.minZ) / CELL)), count = width * depth;
  // An optional moving-obstacle overlay (Hirakata buses) is checked live on top
  // of the static grid. A detour grid may share the static grid's cell/edge
  // arrays, so a bus moving every quarter second no longer discards them.
  const overlay = map.navigationOverlay || null;
  const shared = map.sharedGrid && map.sharedGrid.width === width && map.sharedGrid.depth === depth ? map.sharedGrid : null;
  const occupied = shared ? shared.occupied : new Uint8Array(count), edgeKnown = shared ? shared.edgeKnown : new Uint8Array(count), edgeFlags = shared ? shared.edgeFlags : new Uint8Array(count);
  const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]];
  const nx = id => left + (id % width) * CELL, nz = id => top + Math.floor(id / width) * CELL;
  const cache = new Map(), heap = [];
  let revision = collision.revision, overlayRevision = overlay ? overlay.revision : 0, stamp = 0, g, visited, closed, parent;
  function refresh() {
    if (shared) shared.refresh();
    if (collision.revision !== revision) {
      revision = collision.revision; cache.clear();
      fields.clear(); demand.clear();
      if (!shared) { occupied.fill(0); edgeKnown.fill(0); edgeFlags.fill(0); }
    }
    if (overlay && overlay.revision !== overlayRevision) { overlayRevision = overlay.revision; cache.clear(); }
  }
  function staticWalkable(x, z) {
    return Number.isFinite(x) && Number.isFinite(z) && x >= bounds.minX + CLEARANCE && x <= bounds.maxX - CLEARANCE &&
      z >= bounds.minZ + CLEARANCE && z <= bounds.maxZ - CLEARANCE && !collision.blocked(x, z, CLEARANCE, 0);
  }
  function isWalkable(x, z) {
    return staticWalkable(x, z) && (!overlay || !overlay.blocked(x, z, CLEARANCE, 0));
  }
  function staticCell(id) {
    if (!occupied[id]) occupied[id] = staticWalkable(nx(id), nz(id)) ? 1 : 2;
    return occupied[id] === 1;
  }
  function walkableCell(id) {
    return staticCell(id) && (!overlay || !overlay.blocked(nx(id), nz(id), CLEARANCE, 0));
  }
  function clearSegment(ax, az, bx, bz) {
    return isWalkable(ax, az) && isWalkable(bx, bz) && collision.segmentClear(ax, az, bx, bz, CLEARANCE, 0) &&
      (!overlay || overlay.segmentClear(ax, az, bx, bz, CLEARANCE, 0));
  }
  function staticEdges(id) {
    if (edgeKnown[id]) return edgeFlags[id];
    edgeKnown[id] = 1;
    if (!staticCell(id)) return 0;
    const cx = id % width, cz = Math.floor(id / width);
    for (let k = 0; k < dirs.length; k++) {
      const [dx, dz] = dirs[k], x = cx + dx, z = cz + dz;
      if (x < 0 || z < 0 || x >= width || z >= depth) continue;
      const next = z * width + x;
      if (!staticCell(next)) continue;
      if (dx && dz && (!staticCell(cz * width + x) || !staticCell(z * width + cx))) continue;
      if (collision.segmentClear(nx(id), nz(id), nx(next), nz(next), CLEARANCE, 0)) edgeFlags[id] |= 1 << k;
    }
    return edgeFlags[id];
  }
  function edges(id) {
    const flags = staticEdges(id);
    if (!overlay || !flags) return flags;
    if (overlay.blocked(nx(id), nz(id), CLEARANCE, 0)) return 0;
    let live = flags;
    for (let k = 0; k < dirs.length; k++) {
      if (!(flags & (1 << k))) continue;
      const next = id + dirs[k][0] + dirs[k][1] * width;
      if (!overlay.segmentClear(nx(id), nz(id), nx(next), nz(next), CLEARANCE, 0)) live &= ~(1 << k);
    }
    return live;
  }
  // Resolve every cell and undirected edge in one pass. Each pair is still
  // checked with the exact swept footprint, once, and both directions share it.
  // Hirakata calls this while loading so CPU routes do not pay it mid-round.
  function warm() {
    refresh();
    for (let id = 0; id < count; id++) staticCell(id);
    for (let id = 0; id < count; id++) {
      if (edgeKnown[id]) continue;
      edgeKnown[id] = 1;
      if (occupied[id] !== 1) continue;
      const cx = id % width, cz = Math.floor(id / width);
      for (let k = 0; k < dirs.length; k++) {
        const [dx, dz] = dirs[k], x = cx + dx, z = cz + dz;
        if (x < 0 || z < 0 || x >= width || z >= depth) continue;
        const next = z * width + x, back = (k < 4 ? (k + 2) % 4 : 4 + (k - 2) % 4);
        if (occupied[next] !== 1) continue;
        if (dx && dz && (occupied[cz * width + x] !== 1 || occupied[z * width + cx] !== 1)) continue;
        if (edgeKnown[next]) { if (edgeFlags[next] & (1 << back)) edgeFlags[id] |= 1 << k; continue; }
        if (collision.segmentClear(nx(id), nz(id), nx(next), nz(next), CLEARANCE, 0)) edgeFlags[id] |= 1 << k;
      }
    }
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
    // A connector more than a few cells away is not a usable straight first step;
    // scanning 64 rings of long swept tests cost ~0.25 s per failed request.
    const limit = connector ? Math.min(6, Math.max(width, depth)) : Math.max(width, depth);
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
  // Destinations such as stair feet and plant points are requested again and
  // again from slightly different CPU positions. After a destination repeats,
  // one exact Dijkstra field from it answers every later start by following
  // parents (O(route length) instead of a new A* each time). Static grid only:
  // the moving bus overlay keeps ordinary A*.
  // Opt-in: only a grid whose walls stay fixed between rounds benefits (a grid
  // over moving traffic would discard every field a quarter second later).
  const useFields = !!map.navigationFields && !overlay;
  const fields = new Map(), demand = new Map(), FIELD_LIMIT = 24;
  function field(root) {
    if (fields.has(root)) { const f = fields.get(root); fields.delete(root); fields.set(root, f); return f; }
    const dist = new Float32Array(count).fill(Infinity), from = new Int32Array(count).fill(-1);
    const heapIds = new Int32Array(count * 4), heapCost = new Float32Array(count * 4); let size = 0;
    const up = (i) => { const id = heapIds[i], c = heapCost[i]; while (i) { const p = (i - 1) >> 1; if (heapCost[p] <= c) break; heapIds[i] = heapIds[p]; heapCost[i] = heapCost[p]; i = p; } heapIds[i] = id; heapCost[i] = c; };
    const take = () => {
      const id = heapIds[0], lastId = heapIds[--size], lastCost = heapCost[size]; let i = 0;
      while (i * 2 + 1 < size) { let c = i * 2 + 1; if (c + 1 < size && heapCost[c + 1] < heapCost[c]) c++; if (heapCost[c] >= lastCost) break; heapIds[i] = heapIds[c]; heapCost[i] = heapCost[c]; i = c; }
      heapIds[i] = lastId; heapCost[i] = lastCost; return id;
    };
    dist[root] = 0; heapIds[0] = root; heapCost[0] = 0; size = 1;
    while (size) {
      const cost = heapCost[0], at = take();
      if (cost > dist[at]) continue;
      const flags = staticEdges(at);
      for (let k = 0; k < dirs.length; k++) {
        if (!(flags & (1 << k))) continue;
        const next = at + dirs[k][0] + dirs[k][1] * width, value = cost + (k < 4 ? CELL : SQRT2 * CELL);
        if (value + EPS < dist[next]) { dist[next] = value; from[next] = at; if (size < heapIds.length) { heapIds[size] = next; heapCost[size] = value; up(size++); } }
      }
    }
    const result = { dist, from };
    fields.set(root, result); if (fields.size > FIELD_LIMIT) fields.delete(fields.keys().next().value);
    return result;
  }
  function route(start, finish) {
    if (useFields) {
      // route(destination, actor): every edge is symmetric, so the field rooted
      // at the destination holds the actor's parent chain back to it.
      const seen = (demand.get(start) || 0) + 1; demand.set(start, seen);
      if (demand.size > 4096) demand.delete(demand.keys().next().value);
      if (seen >= 2 || fields.has(start)) {
        const f = field(start);
        if (!Number.isFinite(f.dist[finish])) return [];
        const chain = []; for (let node = finish; node >= 0; node = f.from[node]) chain.push(node);
        return chain.reverse();
      }
    }
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
    let start = nearestNode(from.x, from.z, true), origin = from;
    const finish = nearestNode(to.x, to.z, true);
    // blocked() lets a body stand on a stair foot (its tread top there is ~0),
    // while segmentClear treats every tread as a solid box. An actor who just
    // walked off a staircase can therefore stand where no straight segment
    // leaves. Start from the adjacent free cell instead of failing the whole
    // route; movement and the layered navigator still validate that step.
    // Flat maps have no layered revalidation, so they must retain the strict
    // connector check instead of returning an unvalidated first segment.
    if (start < 0 && map.layeredNavigation === true) {
      const loose = nearestNode(from.x, from.z);
      if (loose >= 0 && (nx(loose) - from.x) ** 2 + (nz(loose) - from.z) ** 2 <= 1) { start = loose; origin = { x: nx(loose), z: nz(loose) }; }
    }
    if (start < 0 || finish < 0) return [];
    // Search out from the destination: an enclosed courtyard then fails within its small pocket,
    // rather than flooding the whole accessible city when an actor is sent to an unreachable POI.
    const nodes = route(finish, start).slice().reverse();
    if (!nodes.length) return [];
    const points = nodes.map(id => ({ x: nx(id), z: nz(id) })); points.push(to);
    const result = origin === from ? [] : [{ x: origin.x, z: origin.z }]; let anchor = origin, index = 0;
    while (index < points.length) {
      // Long routes used to repeat a visibility test for every remaining node,
      // even when the A* node route was cached. Probe outward exponentially;
      // every selected shortcut still checks the complete collision footprint.
      let end = index, stride = 1, blocked = points.length;
      if (!clearSegment(anchor.x, anchor.z, points[end].x, points[end].z)) return [];
      while (end < points.length - 1) {
        const next = Math.min(points.length - 1, index + stride);
        if (!clearSegment(anchor.x, anchor.z, points[next].x, points[next].z)) { blocked = next; break; }
        end = next; stride *= 2;
      }
      let low = end + 1, high = blocked - 1;
      while (low <= high) {
        const mid = (low + high) >> 1;
        if (clearSegment(anchor.x, anchor.z, points[mid].x, points[mid].z)) { end = mid; low = mid + 1; }
        else high = mid - 1;
      }
      const point = points[end];
      if ((point.x - anchor.x) ** 2 + (point.z - anchor.z) ** 2 > EPS) result.push({ x: point.x, z: point.z });
      anchor = point; index = end + 1;
    }
    return result;
  }
  return { path, isWalkable, nearest, clearSegment, warm, shared: { occupied, edgeKnown, edgeFlags, width, depth, refresh } };
}

export function createNavigation(map) {
  if(map.id==='trc')return createTrcNavigation(map);
  if(map.layeredNavigation)return createHirakataNavigation(map,createGridNavigation);
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
