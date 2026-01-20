import { useEffect, useRef, useMemo } from 'react';
import { Point, AppMode, ViewTransform, DxfComponent, AiFeatureGroup, DxfEntity } from '../types';
import { checkEntityHit } from '../utils/geometry';

interface UseHoverDetectionProps {
  mouseNormPos: Point | null;
  mode: AppMode;
  viewTransform: ViewTransform | null;
  dState: any;
  aState: any;
}

export function useHoverDetection({
  mouseNormPos,
  mode,
  viewTransform,
  dState,
  aState
}: UseHoverDetectionProps) {
  // --- OPTIMIZATION: Indexing for sub-millisecond lookups ---
  const dxfLookup = useMemo(() => {
    return new Map<string, DxfComponent>(dState.dxfComponents.map((c: DxfComponent) => [c.id, c]));
  }, [dState.dxfComponents]);

  const entityLookup = useMemo(() => {
    return new Map<string, DxfEntity>(dState.dxfEntities.map((e: DxfEntity) => [e.id, e]));
  }, [dState.dxfEntities]);

  const selectedFamilyIds = useMemo(() => {
    const ids = new Set<string>();
    if (aState.selectedComponentId) {
        const selComp = dxfLookup.get(aState.selectedComponentId);
        const rootId = selComp?.parentGroupId || aState.selectedComponentId;
        ids.add(rootId);
        dState.dxfComponents.forEach((c: DxfComponent) => {
            if (c.parentGroupId === rootId) ids.add(c.id);
        });
    }
    return ids;
  }, [aState.selectedComponentId, dxfLookup, dState.dxfComponents]);

  const lastHoveredCompId = useRef<string | null>(null);
  const lastHoveredFeatId = useRef<string | null>(null);

  useEffect(() => {
    const isDxfMode = mode === 'dxf_analysis' || mode === 'box_group';
    const isAiMode = mode === 'feature_analysis' || mode === 'feature';
    
    if (!mouseNormPos || !dState.imgDimensions || (!isDxfMode && !isAiMode)) {
        if (lastHoveredCompId.current !== null) {
            lastHoveredCompId.current = null;
            aState.setHoveredComponentId(null);
        }
        if (lastHoveredFeatId.current !== null) {
            lastHoveredFeatId.current = null;
            aState.setHoveredFeatureId(null);
        }
        return;
    }

    try {
        if (isDxfMode && dState.rawDxfData) {
          // UNIFIED: Use transformer to get Absolute CAD coordinate for hit-testing
          const absCAD = dState.transformer.toAbsoluteCAD(mouseNormPos);
          if (!absCAD) return;
          
          const cadX = absCAD.x;
          const cadY = absCAD.y;
          const hitThreshold = (10 / (viewTransform?.scale || 1)) * (dState.rawDxfData.totalW / 1000); 

          let bestCompId: string | null = null;
          let minCompScore = Infinity; 

          dState.dxfComponents.forEach((c: DxfComponent) => {
            if (!c.isVisible) return;
            let isHit = false;

            if (c.parentGroupId && c.rotation !== undefined) {
                const seed = dxfLookup.get(c.parentGroupId);
                if (seed) {
                    const dx = cadX - c.centroid.x;
                    const dy = cadY - c.centroid.y;
                    const angle = -c.rotation;
                    const lx = dx * Math.cos(angle) - dy * Math.sin(angle);
                    const ly = dx * Math.sin(angle) + dy * Math.cos(angle);
                    const hw = (seed.bounds.maxX - seed.bounds.minX) / 2 + hitThreshold;
                    const hh = (seed.bounds.maxY - seed.bounds.minY) / 2 + hitThreshold;
                    if (Math.abs(lx) <= hw && Math.abs(ly) <= hh) isHit = true;
                }
            } 
            
            if (!isHit && cadX >= c.bounds.minX - hitThreshold && cadX <= c.bounds.maxX + hitThreshold &&
                cadY >= c.bounds.minY - hitThreshold && cadY <= c.bounds.maxY + hitThreshold) {
                if (c.entityIds.length > 1 || (c.childGroupIds?.length || 0) > 0) {
                    isHit = true;
                } else {
                    for (const eid of c.entityIds) {
                        const ent = entityLookup.get(eid);
                        if (ent && checkEntityHit(cadX, cadY, ent, hitThreshold)) {
                            isHit = true;
                            break;
                        }
                    }
                }
            }

            if (isHit) {
                const area = (c.bounds.maxX - c.bounds.minX) * (c.bounds.maxY - c.bounds.minY);
                const dist = Math.sqrt(Math.pow(cadX - c.centroid.x, 2) + Math.pow(cadY - c.centroid.y, 2));
                let score = area * 1000 + dist;
                if (selectedFamilyIds.has(c.id)) score -= 1e12; 
                if (score < minCompScore) { minCompScore = score; bestCompId = c.id; }
            }
          });

          if (lastHoveredCompId.current !== bestCompId) {
              lastHoveredCompId.current = bestCompId;
              aState.setHoveredComponentId(bestCompId);
          }
        } else if (isAiMode) {
          const hitThresholdNorm = 0.01 / (viewTransform?.scale || 1);
          let bestFeatureId: string | null = null;
          let minScore = Infinity;

          dState.aiFeatureGroups.forEach((g: AiFeatureGroup) => {
            if (!g.isVisible) return;
            g.features.forEach(f => {
                if (mouseNormPos.x >= f.minX - hitThresholdNorm && mouseNormPos.x <= f.maxX + hitThresholdNorm &&
                    mouseNormPos.y >= f.minY - hitThresholdNorm && mouseNormPos.y <= f.maxY + hitThresholdNorm) {
                    const area = (f.maxX - f.minX) * (f.maxY - f.minY);
                    const dist = Math.sqrt(Math.pow(mouseNormPos.x - (f.minX+f.maxX)/2, 2) + Math.pow(mouseNormPos.y - (f.minY+f.maxY)/2, 2));
                    let score = area * 1000 + dist;
                    if (score < minScore) { minScore = score; bestFeatureId = f.id; }
                }
            });
          });

          if (lastHoveredFeatId.current !== bestFeatureId) {
              lastHoveredFeatId.current = bestFeatureId;
              aState.setHoveredFeatureId(bestFeatureId);
          }
        }
    } catch (err) {
        console.error("Hover check failed (suppressed to prevent crash):", err);
    }
  }, [mouseNormPos, dState.dxfComponents, dState.aiFeatureGroups, dState.rawDxfData, mode, viewTransform?.scale, aState.selectedComponentId, aState.selectedAiGroupId, dxfLookup, entityLookup, selectedFamilyIds, dState.imgDimensions, dState.transformer]);
}