import { DxfEntity, DxfComponent, DxfMatchSettings } from '../types';
import { generateId } from '../utils';

export interface MatchResult {
  id: string;
  name: string;
  entityIds: string[];
  centroid: { x: number; y: number };
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  rotation: number;
  rotationDeg: number;
}

/**
 * Pure geometric engine to find clusters of entities that match a seed pattern.
 */
export const matchSimilarComponents = (
  seedEntities: DxfEntity[],
  allEntities: DxfEntity[],
  seedGroup: DxfComponent,
  existingMatches: DxfComponent[],
  settings: DxfMatchSettings
): MatchResult[] => {
  const { geometryTolerance, positionFuzziness, angleTolerance, minMatchDistance } = settings;
  
  const seedEntityIds = new Set(seedEntities.map(e => e.id));
  const alreadyMatchedEntityIds = new Set<string>();
  existingMatches.forEach(m => m.entityIds.forEach(eid => alreadyMatchedEntityIds.add(eid)));

  const getCenter = (e: DxfEntity) => e.rawEntity.center 
    ? { x: e.rawEntity.center.x, y: e.rawEntity.center.y } 
    : { x: (e.minX + e.maxX) / 2, y: (e.minY + e.maxY) / 2 };

  const propsMatch = (e1: DxfEntity, e2: DxfEntity) => {
    if (e1.type !== e2.type) return false;
    const T = geometryTolerance;
    if (e1.type === 'CIRCLE') return Math.abs(e1.rawEntity.radius - e2.rawEntity.radius) < T;
    if (e1.type === 'ARC') {
      if (Math.abs(e1.rawEntity.radius - e2.rawEntity.radius) > T) return false;
      let a1 = e1.rawEntity.endAngle - e1.rawEntity.startAngle; if (a1 < 0) a1 += Math.PI * 2;
      let a2 = e2.rawEntity.endAngle - e2.rawEntity.startAngle; if (a2 < 0) a2 += Math.PI * 2;
      return Math.abs(a1 - a2) < 0.02;
    }
    const l1 = Math.sqrt(Math.pow(e1.maxX - e1.minX, 2) + Math.pow(e1.maxY - e1.minY, 2));
    const l2 = Math.sqrt(Math.pow(e2.maxX - e2.minX, 2) + Math.pow(e2.maxY - e2.minY, 2));
    return Math.abs(l1 - l2) < T;
  };

  // Find the most significant entity in seed to use as an anchor
  let bestAnchorIdx = 0; let maxSigValue = -1;
  seedEntities.forEach((e, idx) => {
    let sig = e.type === 'CIRCLE' ? e.rawEntity.radius * 2 : Math.sqrt(Math.pow(e.maxX - e.minX, 2) + Math.pow(e.maxY - e.minY, 2));
    if (sig > maxSigValue) { maxSigValue = sig; bestAnchorIdx = idx; }
  });

  const s0 = seedEntities[bestAnchorIdx]; const c0 = getCenter(s0);
  const groupW = seedGroup.bounds.maxX - seedGroup.bounds.minX; 
  const groupH = seedGroup.bounds.maxY - seedGroup.bounds.minY;
  const DYNAMIC_TOLERANCE = Math.max(groupW, groupH, 1.0) * 0.02 * positionFuzziness;

  // Build Spatial Grid for O(1) nearby search
  const GRID_SIZE = Math.max(DYNAMIC_TOLERANCE * 20, 100); 
  const spatialGrid = new Map<string, DxfEntity[]>();
  allEntities.forEach(e => {
    if (seedEntityIds.has(e.id) || alreadyMatchedEntityIds.has(e.id)) return;
    const center = getCenter(e);
    const gx = Math.floor(center.x / GRID_SIZE);
    const gy = Math.floor(center.y / GRID_SIZE);
    const key = `${gx},${gy}`;
    if (!spatialGrid.get(key)) spatialGrid.set(key, []);
    spatialGrid.get(key)!.push(e);
  });

  // Second anchor for orientation
  let s1 = seedEntities[(bestAnchorIdx + 1) % seedEntities.length]; let maxDistSq = -1;
  seedEntities.forEach(e => {
    const c = getCenter(e); const dSq = Math.pow(c.x - c0.x, 2) + Math.pow(c.y - c0.y, 2);
    if (dSq > maxDistSq) { maxDistSq = dSq; s1 = e; }
  });
  const c1 = getCenter(s1); const refDist = Math.sqrt(Math.pow(c1.x - c0.x, 2) + Math.pow(c1.y - c0.y, 2)); const refAngle = Math.atan2(c1.y - c0.y, c1.x - c0.x);

  const potentialAnchors = allEntities.filter(e => !seedEntityIds.has(e.id) && !alreadyMatchedEntityIds.has(e.id) && e.type === s0.type);
  const newMatchResults: MatchResult[] = []; const usedInThisRun = new Set<string>();
  const rotate = (dx: number, dy: number, angle: number) => ({ 
    x: dx * Math.cos(angle) - dy * Math.sin(angle), 
    y: dx * Math.sin(angle) + dy * Math.cos(angle) 
  });

  potentialAnchors.forEach(candA => {
    if (usedInThisRun.has(candA.id)) return; 
    const ca = getCenter(candA); if (!propsMatch(candA, s0)) return;
    
    let possibleAngles = [0]; 
    if (seedEntities.length > 1) {
      possibleAngles = [];
      const gx = Math.floor(ca.x / GRID_SIZE), gy = Math.floor(ca.y / GRID_SIZE);
      const searchRadius = Math.ceil((refDist + DYNAMIC_TOLERANCE * 5) / GRID_SIZE);
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        for (let dy = -searchRadius; dy <= searchRadius; dy++) {
          const cell = spatialGrid.get(`${gx + dx},${gy + dy}`);
          if (!cell) continue;
          cell.forEach(candR => {
            if (usedInThisRun.has(candR.id) || !propsMatch(candR, s1)) return;
            const cr = getCenter(candR); const d = Math.sqrt(Math.pow(cr.x - ca.x, 2) + Math.pow(cr.y - ca.y, 2));
            if (Math.abs(d - refDist) < DYNAMIC_TOLERANCE * 4) {
              const candAngle = Math.atan2(cr.y - ca.y, cr.x - ca.x);
              possibleAngles.push(candAngle - refAngle);
            }
          });
        }
      }
    }
    
    for (let deltaTheta of possibleAngles) {
      const cluster: string[] = [candA.id]; const tempConsumed = new Set<string>([candA.id]); let allMatched = true;
      let minX = candA.minX, minY = candA.minY, maxX = candA.maxX, maxY = candA.maxY;
      
      for (let i = 0; i < seedEntities.length; i++) {
        if (i === bestAnchorIdx) continue;
        const s = seedEntities[i]; const cs = getCenter(s); 
        const rotatedOffset = rotate(cs.x - c0.x, cs.y - c0.y, deltaTheta);
        const tx = ca.x + rotatedOffset.x, ty = ca.y + rotatedOffset.y;
        
        const gx = Math.floor(tx / GRID_SIZE), gy = Math.floor(ty / GRID_SIZE);
        let found: DxfEntity | undefined;
        for (let dx = -1; dx <= 1 && !found; dx++) {
          for (let dy = -1; dy <= 1 && !found; dy++) {
            const cell = spatialGrid.get(`${gx + dx},${gy + dy}`);
            if (cell) found = cell.find(e => !tempConsumed.has(e.id) && !usedInThisRun.has(e.id) && propsMatch(e, s) && Math.abs(getCenter(e).x - tx) < DYNAMIC_TOLERANCE && Math.abs(getCenter(e).y - ty) < DYNAMIC_TOLERANCE);
          }
        }
        if (found) { 
          cluster.push(found.id); tempConsumed.add(found.id); 
          minX = Math.min(minX, found.minX); minY = Math.min(minY, found.minY); maxX = Math.max(maxX, found.maxX); maxY = Math.max(maxY, found.maxY); 
        } else { allMatched = false; break; }
      }

      if (allMatched && cluster.length === seedEntities.length) {
        // Geometric Center: Center of the bounding box union of all cluster items
        const candidateCentroid = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
        
        if (minMatchDistance > 0) {
          const distToSeed = Math.sqrt(Math.pow(candidateCentroid.x - seedGroup.centroid.x, 2) + Math.pow(candidateCentroid.y - seedGroup.centroid.y, 2));
          if (distToSeed < minMatchDistance) { allMatched = false; break; }
          if (existingMatches.some(m => Math.sqrt(Math.pow(candidateCentroid.x - m.centroid.x, 2) + Math.pow(candidateCentroid.y - m.centroid.y, 2)) < minMatchDistance)) { allMatched = false; break; }
          if (newMatchResults.some(m => Math.sqrt(Math.pow(candidateCentroid.x - m.centroid.x, 2) + Math.pow(candidateCentroid.y - m.centroid.y, 2)) < minMatchDistance)) { allMatched = false; break; }
        }

        const normalizedTheta = ((deltaTheta % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
        const normalizedDeg = ((deltaTheta * 180 / Math.PI) % 360 + 360) % 360;

        newMatchResults.push({ 
          id: generateId(), 
          name: `${seedGroup.name} Match ${existingMatches.length + newMatchResults.length + 1}`, 
          entityIds: cluster, 
          centroid: candidateCentroid, 
          bounds: { minX, minY, maxX, maxY }, 
          rotation: normalizedTheta,
          rotationDeg: normalizedDeg
        });
        cluster.forEach(id => usedInThisRun.add(id)); break; 
      }
    }
  });

  return newMatchResults;
};
