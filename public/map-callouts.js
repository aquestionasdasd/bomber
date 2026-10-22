// Display metadata only: these helpers never change navigation or reveal actors.
const EPSILON = 1e-7;
const finite = Number.isFinite;

function validPolygon(points) {
  return Array.isArray(points) && points.length >= 3 && points.every(point => Array.isArray(point) && finite(point[0]) && finite(point[1]));
}

function polygonArea(points) {
  let twiceArea = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) twiceArea += points[j][0] * points[i][1] - points[i][0] * points[j][1];
  return Math.abs(twiceArea) / 2;
}

function containsPolygon(points, x, z) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, az] = points[j], [bx, bz] = points[i];
    const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz);
    if (length > EPSILON && Math.abs((x - ax) * dz - (z - az) * dx) <= EPSILON * Math.max(1, length) && (x - ax) * (x - bx) + (z - az) * (z - bz) <= EPSILON) return true;
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}

function containsHeight(area, y) {
  return (!finite(area.minY) || y >= area.minY - EPSILON) && (!finite(area.maxY) || y <= area.maxY + EPSILON);
}

export function resolveMapCallout(map, position) {
  if (!map || !position || !finite(position.x) || !finite(position.z) || position.y !== undefined && !finite(position.y)) return null;
  const y = position.y ?? 0, areas = [...(map.callouts || []), ...(map.zones || [])];
  let best = null, smallest = Infinity;
  for (const area of areas) {
    if (!area?.name || !containsHeight(area, y) || !validPolygon(area.polygon)) continue;
    const size = polygonArea(area.polygon);
    if (size > EPSILON && size < smallest && containsPolygon(area.polygon, position.x, position.z)) { best = area; smallest = size; }
  }
  if (best) return best;
  // Old circular regions remain a fallback outside the named tactical pockets.
  return areas.find(area => area?.name && !('polygon' in area) && containsHeight(area, y) && finite(area.x) && finite(area.z) && finite(area.radius) && area.radius > 0 && Math.hypot(position.x - area.x, position.z - area.z) <= area.radius + EPSILON) || null;
}

export function getMapCalloutLabels(map) {
  const labels = (map?.callouts || []).filter(area => area?.name && finite(area.label?.x) && finite(area.label?.z)).map(area => ({name: area.label.text || area.name, x: area.label.x, z: area.label.z, align: ['left', 'right', 'center'].includes(area.label.align) ? area.label.align : 'center'}));
  return labels.length ? labels : (map?.landmarks || []).filter(area => area?.name && finite(area.x) && finite(area.z)).map(area => ({name: area.name, x: area.x, z: area.z, align: 'left'}));
}

export function drawMapShapes(ctx, shapes, {bounds, px, pz, scale, large = false}) {
  const overhead = [];
  function draw(shape, outline) {
    let points = shape.polygon || shape.points;
    const polygon = !!shape.polygon || !points;
    if (!points && finite(shape.x) && finite(shape.z) && finite(shape.w) && finite(shape.d) && shape.w > 0 && shape.d > 0) points = [[shape.x - shape.w / 2, shape.z - shape.d / 2], [shape.x + shape.w / 2, shape.z - shape.d / 2], [shape.x + shape.w / 2, shape.z + shape.d / 2], [shape.x - shape.w / 2, shape.z + shape.d / 2]];
    if (!Array.isArray(points) || points.length < (polygon ? 3 : 2) || !points.every(point => Array.isArray(point) && finite(point[0]) && finite(point[1]))) return;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of points) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
    if (maxX < bounds.minX || minX > bounds.maxX || maxZ < bounds.minZ || minZ > bounds.maxZ) return;
    ctx.save();
    ctx.fillStyle = shape.color || '#536e78';
    ctx.strokeStyle = outline ? '#8faab4' : shape.color || '#536e78';
    ctx.lineWidth = outline ? large ? 1.4 : 1 : Math.max(large ? .7 : 1, (shape.width || 2) * scale);
    if (outline) ctx.setLineDash(large ? [5, 4] : [3, 2]);
    ctx.beginPath();ctx.moveTo(px(points[0][0]), pz(points[0][1]));
    for (const [x, z] of points.slice(1)) ctx.lineTo(px(x), pz(z));
    if (polygon) ctx.closePath();
    if (polygon && !outline) ctx.fill(); else ctx.stroke();
    ctx.restore();
  }
  for (const shape of shapes || []) {
    if (!shape) continue;
    if (shape.kind === 'overhead') overhead.push(shape); else draw(shape, false);
  }
  // Outline roofs last so a usable passage remains visibly open beneath them.
  for (const shape of overhead) draw(shape, true);
}
