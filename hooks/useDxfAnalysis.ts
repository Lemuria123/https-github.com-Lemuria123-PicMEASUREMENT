
import { useMemo, useCallback } from 'react';
import { DxfEntity, DxfComponent, DxfEntityType } from '../types';
import { generateId, getRandomColor } from '../utils';

interface DxfAnalysisProps {
  dState: any;
  aState: any;
  setIsProcessing: (val: boolean) => void;
  setMode: (mode: any) => void;
  setPromptState: (state: any) => void;
}

export function useDxfAnalysis({ dState, aState, setIsProcessing, setMode, setPromptState }: DxfAnalysisProps) {
  
  // --- 计算属性 ---

  const { entitySizeGroups, entityTypeKeyMap } = useMemo(() => {
    const groups: Map<string, { label: string, count: number, key: string }> = new Map();
    const typeKeyMap: Map<string, string[]> = new Map();
    const TOLERANCE = 0.1;

    dState.dxfEntities.forEach((e: DxfEntity) => {
      let key = "", label = "";
      if (e.type === 'CIRCLE') { 
          const diam = e.rawEntity.radius * 2; 
          key = `CIRCLE_${(Math.round(diam / TOLERANCE) * TOLERANCE).toFixed(2)}`; 
          label = `Circle Ø${diam.toFixed(2)}`;
      } else if (e.type === 'LINE') { 
          const dx = e.rawEntity.vertices[1].x - e.rawEntity.vertices[0].x; 
          const dy = e.rawEntity.vertices[1].y - e.rawEntity.vertices[0].y; 
          const len = Math.sqrt(dx*dx + dy*dy);
          key = `LINE_${(Math.round(len / TOLERANCE) * TOLERANCE).toFixed(2)}`; 
          label = `Line L${len.toFixed(2)}`;
      } else {
          key = e.type;
          label = e.type;
      }
      const existing = groups.get(key);
      if (existing) existing.count++; else groups.set(key, { label, count: 1, key });
      if (!typeKeyMap.has(key)) typeKeyMap.set(key, []);
      typeKeyMap.get(key)!.push(e.id);
    });

    return {
      entitySizeGroups: Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label)),
      entityTypeKeyMap: typeKeyMap
    };
  }, [dState.dxfEntities]);

  const topLevelComponents = useMemo(() => {
    return dState.dxfComponents.filter((c: DxfComponent) => !c.parentGroupId);
  }, [dState.dxfComponents]);

  const currentInspectedEntities = useMemo(() => {
    if (!aState.inspectComponentId) return [];
    const comp = dState.dxfComponents.find((c: DxfComponent) => c.id === aState.inspectComponentId);
    if (!comp) return [];
    return comp.entityIds.map((id: string) => dState.dxfEntities.find((e: DxfEntity) => e.id === id)).filter(Boolean) as DxfEntity[];
  }, [aState.inspectComponentId, dState.dxfComponents, dState.dxfEntities]);

  const currentInspectedChildGroups = useMemo(() => {
    if (!aState.inspectComponentId) return [];
    const comp = dState.dxfComponents.find((c: DxfComponent) => c.id === aState.inspectComponentId);
    if (!comp || !comp.childGroupIds) return [];
    return comp.childGroupIds.map((id: string) => dState.dxfComponents.find((c: DxfComponent) => c.id === id)).filter(Boolean) as DxfComponent[];
  }, [aState.inspectComponentId, dState.dxfComponents]);

  const currentMatchedGroups = useMemo(() => {
    if (!aState.inspectMatchesParentId) return [];
    return dState.dxfComponents.filter((c: DxfComponent) => c.parentGroupId === aState.inspectMatchesParentId);
  }, [aState.inspectMatchesParentId, dState.dxfComponents]);

  // --- 业务方法 ---

  const getSeedEntitiesRecursive = useCallback((compId: string): DxfEntity[] => {
    const comp = dState.dxfComponents.find((c: DxfComponent) => c.id === compId);
    if (!comp) return [];
    
    const collectedEntityIds = new Set<string>();
    const visited = new Set<string>();
    const recurse = (c: DxfComponent) => {
        if (visited.has(c.id)) return;
        visited.add(c.id);
        c.entityIds.forEach(eid => collectedEntityIds.add(eid));
        (c.childGroupIds || []).forEach(cid => {
            const child = dState.dxfComponents.find((comp: DxfComponent) => comp.id === cid);
            if (child) recurse(child);
        });
    };
    recurse(comp);
    
    return Array.from(collectedEntityIds)
        .map(id => dState.dxfEntities.find((e: DxfEntity) => e.id === id))
        .filter(Boolean) as DxfEntity[];
  }, [dState.dxfComponents, dState.dxfEntities]);

  const createAutoGroup = useCallback((groupKey: string, type: 'weld' | 'mark') => {
    if (!dState.rawDxfData) return;
    const matchingIds = entityTypeKeyMap.get(groupKey) || [];
    if (matchingIds.length === 0) return;
    
    const groupLabel = entitySizeGroups.find(g => g.key === groupKey)?.label || "New Group";
    const groupEntities = matchingIds.map(id => dState.dxfEntities.find(e => e.id === id)).filter(Boolean) as DxfEntity[];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    groupEntities.forEach(e => {
        minX = Math.min(minX, e.minX); maxX = Math.max(maxX, e.maxX);
        minY = Math.min(minY, e.minY); maxY = Math.max(maxY, e.maxY);
    });

    // Fix: Removed typo 'strokeM =' from isMark property definition
    const newComponent: DxfComponent = {
        id: generateId(), name: groupLabel, isVisible: true, isWeld: type === 'weld', isMark: type === 'mark',
        color: getRandomColor(), entityIds: matchingIds, seedSize: matchingIds.length,
        centroid: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
        bounds: { minX, minY, maxX, maxY },
        rotation: 0,
        rotationDeg: 0
    };

    dState.setDxfComponents((prev: DxfComponent[]) => [...prev, newComponent]);
    aState.setMatchStatus({ text: `Set ${matchingIds.length} items as ${type === 'weld' ? 'Weld' : 'Mark'}`, type: 'success' });
  }, [dState, aState, entitySizeGroups, entityTypeKeyMap]);

  const handleAutoMatch = useCallback(() => {
    if (!aState.selectedComponentId) { alert("Please select a 'seed' group first to auto-match similar components."); return; }
    const seedGroup = dState.dxfComponents.find((c: DxfComponent) => c.id === aState.selectedComponentId);
    if (!seedGroup) return;

    // Load dynamic parameters from state
    const { geometryTolerance, positionFuzziness, angleTolerance, minMatchDistance } = aState.dxfMatchSettings;
    const isFuzzy = geometryTolerance !== 0.5 || positionFuzziness !== 1.0 || angleTolerance !== 1.0 || minMatchDistance > 0;

    setIsProcessing(true);
    setTimeout(() => {
        const seedEntities = getSeedEntitiesRecursive(aState.selectedComponentId);
        const seedEntityIds = new Set(seedEntities.map(e => e.id));
        if (seedEntities.length === 0) { setIsProcessing(false); return; }

        const existingMatches = dState.dxfComponents.filter((c: DxfComponent) => c.parentGroupId === seedGroup.id);
        const alreadyMatchedEntityIds = new Set<string>();
        existingMatches.forEach((m: DxfComponent) => {
            m.entityIds.forEach((eid: string) => alreadyMatchedEntityIds.add(eid));
        });

        const getCenter = (e: DxfEntity) => e.rawEntity.center ? { x: e.rawEntity.center.x, y: e.rawEntity.center.y } : { x: (e.minX + e.maxX) / 2, y: (e.minY + e.maxY) / 2 };
        
        const propsMatch = (e1: DxfEntity, e2: DxfEntity) => {
            if (e1.type !== e2.type) return false;
            // Using dynamic geometry tolerance (baseline = 0.5)
            const T = geometryTolerance; 
            if (e1.type === 'CIRCLE') return Math.abs(e1.rawEntity.radius - e2.rawEntity.radius) < T;
            const l1 = Math.sqrt(Math.pow(e1.maxX - e1.minX, 2) + Math.pow(e1.maxY - e1.minY, 2));
            const l2 = Math.sqrt(Math.pow(e2.maxX - e2.minX, 2) + Math.pow(e2.maxY - e2.minY, 2));
            return Math.abs(l1 - l2) < T;
        };

        // ROI filtering support
        const hasROI = dState.dxfSearchROI && dState.dxfSearchROI.length === 2;
        let roiBounds: { minX: number, maxX: number, minY: number, maxY: number } | null = null;
        if (hasROI && dState.rawDxfData) {
            const { minX, maxY, totalW, totalH, padding } = dState.rawDxfData;
            const p1 = dState.dxfSearchROI[0];
            const p2 = dState.dxfSearchROI[1];
            roiBounds = {
                minX: Math.min(p1.x, p2.x) * totalW + minX - padding,
                maxX: Math.max(p1.x, p2.x) * totalW + minX - padding,
                minY: (maxY + padding) - Math.max(p1.y, p2.y) * totalH,
                maxY: (maxY + padding) - Math.min(p1.y, p2.y) * totalH
            };
        }

        const isPointInROI = (cx: number, cy: number) => {
            if (!roiBounds) return true;
            return cx >= roiBounds.minX && cx <= roiBounds.maxX && cy >= roiBounds.minY && cy <= roiBounds.maxY;
        };

        let bestAnchorIdx = 0; let maxSigValue = -1;
        seedEntities.forEach((e, idx) => {
            let sig = e.type === 'CIRCLE' ? e.rawEntity.radius * 2 : Math.sqrt(Math.pow(e.maxX - e.minX, 2) + Math.pow(e.maxY - e.minY, 2));
            if (sig > maxSigValue) { maxSigValue = sig; bestAnchorIdx = idx; }
        });

        const s0 = seedEntities[bestAnchorIdx]; const c0 = getCenter(s0);
        const groupW = seedGroup.bounds.maxX - seedGroup.bounds.minX; 
        const groupH = seedGroup.bounds.maxY - seedGroup.bounds.minY;
        
        // Baseline 2% tolerance, scaled by fuzziness multiplier
        const DYNAMIC_TOLERANCE = Math.max(groupW, groupH, 1.0) * 0.02 * positionFuzziness;

        const GRID_SIZE = Math.max(DYNAMIC_TOLERANCE * 20, 100); 
        const spatialGrid = new Map<string, DxfEntity[]>();
        dState.dxfEntities.forEach(e => {
            if (seedEntityIds.has(e.id) || alreadyMatchedEntityIds.has(e.id)) return;
            const center = getCenter(e);
            if (!isPointInROI(center.x, center.y)) return; // Spatial Skip

            const gx = Math.floor(center.x / GRID_SIZE);
            const gy = Math.floor(center.y / GRID_SIZE);
            const key = `${gx},${gy}`;
            if (!spatialGrid.get(key)) spatialGrid.set(key, []);
            spatialGrid.get(key)!.push(e);
        });

        let s1 = seedEntities[(bestAnchorIdx + 1) % seedEntities.length]; let maxDistSq = -1;
        seedEntities.forEach(e => {
            const c = getCenter(e); const dSq = Math.pow(c.x - c0.x, 2) + Math.pow(c.y - c0.y, 2);
            if (dSq > maxDistSq) { maxDistSq = dSq; s1 = e; }
        });

        const c1 = getCenter(s1); const refDist = Math.sqrt(Math.pow(c1.x - c0.x, 2) + Math.pow(c1.y - c0.y, 2)); const refAngle = Math.atan2(c1.y - c0.y, c1.x - c0.x);
        const potentialAnchors = dState.dxfEntities.filter(e => {
            if (seedEntityIds.has(e.id) || alreadyMatchedEntityIds.has(e.id) || e.type !== s0.type) return false;
            const center = getCenter(e);
            return isPointInROI(center.x, center.y);
        });
        
        const newMatchGroups: DxfComponent[] = []; const usedEntityIdsForThisMatchRun = new Set<string>(); let matchFoundCount = 0;
        const rotate = (dx: number, dy: number, angle: number) => ({ x: dx * Math.cos(angle) - dy * Math.sin(angle), y: dx * Math.sin(angle) + dy * Math.cos(angle) });

        potentialAnchors.forEach(candA => {
            if (usedEntityIdsForThisMatchRun.has(candA.id)) return; 
            const ca = getCenter(candA); if (!propsMatch(candA, s0)) return;
            
            // Note: Currently we check the baseline orientation, but angleTolerance adds safety for drift
            let possibleAngles = [0]; 
            if (seedEntities.length > 1) {
                possibleAngles = [];
                const gx = Math.floor(ca.x / GRID_SIZE);
                const gy = Math.floor(ca.y / GRID_SIZE);
                const searchRadius = Math.ceil((refDist + DYNAMIC_TOLERANCE * 5) / GRID_SIZE);
                
                for (let dx = -searchRadius; dx <= searchRadius; dx++) {
                    for (let dy = -searchRadius; dy <= searchRadius; dy++) {
                        const cell = spatialGrid.get(`${gx + dx},${gy + dy}`);
                        if (!cell) continue;
                        cell.forEach(candR => {
                            // Fix: Corrected variable name usedEntityIdsForThisRun to usedEntityIdsForThisMatchRun
                            if (usedEntityIdsForThisMatchRun.has(candR.id) || !propsMatch(candR, s1)) return;
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
                    
                    const gx = Math.floor(tx / GRID_SIZE); const gy = Math.floor(ty / GRID_SIZE);
                    let found: DxfEntity | undefined;
                    for (let dx = -1; dx <= 1 && !found; dx++) {
                        for (let dy = -1; dy <= 1 && !found; dy++) {
                            const cell = spatialGrid.get(`${gx + dx},${gy + dy}`);
                            if (cell) found = cell.find(e => !tempConsumed.has(e.id) && !usedEntityIdsForThisMatchRun.has(e.id) && propsMatch(e, s) && Math.abs(getCenter(e).x - tx) < DYNAMIC_TOLERANCE && Math.abs(getCenter(e).y - ty) < DYNAMIC_TOLERANCE);
                        }
                    }

                    if (found) { 
                        cluster.push(found.id); tempConsumed.add(found.id); 
                        minX = Math.min(minX, found.minX); minY = Math.min(minY, found.minY); maxX = Math.max(maxX, found.maxX); maxY = Math.max(maxY, found.maxY); 
                    } else { 
                        allMatched = false; break; 
                    }
                }
                if (allMatched && cluster.length === seedEntities.length) {
                    const candidateCentroid = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
                    
                    // Centroid Distance filtering (minMatchDistance)
                    if (minMatchDistance > 0) {
                        // Check against seed group
                        const distToSeed = Math.sqrt(Math.pow(candidateCentroid.x - seedGroup.centroid.x, 2) + Math.pow(candidateCentroid.y - seedGroup.centroid.y, 2));
                        if (distToSeed < minMatchDistance) { allMatched = false; break; }

                        // Check against existing matches
                        const tooCloseToExisting = existingMatches.some(m => {
                            const d = Math.sqrt(Math.pow(candidateCentroid.x - m.centroid.x, 2) + Math.pow(candidateCentroid.y - m.centroid.y, 2));
                            return d < minMatchDistance;
                        });
                        if (tooCloseToExisting) { allMatched = false; break; }

                        // Check against new matches in this run
                        const tooCloseToNew = newMatchGroups.some(m => {
                            const d = Math.sqrt(Math.pow(candidateCentroid.x - m.centroid.x, 2) + Math.pow(candidateCentroid.y - m.centroid.y, 2));
                            return d < minMatchDistance;
                        });
                        if (tooCloseToNew) { allMatched = false; break; }
                    }

                    // Normalize angles to positive [0, 2π) and [0, 360)
                    const normalizedTheta = ((deltaTheta % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
                    const normalizedDeg = ((deltaTheta * 180 / Math.PI) % 360 + 360) % 360;

                    matchFoundCount++; 
                    newMatchGroups.push({ 
                        id: generateId(), 
                        name: `${seedGroup.name} Match ${existingMatches.length + matchFoundCount}`, 
                        isVisible: seedGroup.isVisible, 
                        isWeld: seedGroup.isWeld, 
                        isMark: seedGroup.isMark, 
                        color: seedGroup.color, 
                        entityIds: cluster, 
                        seedSize: seedEntities.length, 
                        centroid: candidateCentroid, 
                        bounds: { minX, minY, maxX, maxY }, 
                        parentGroupId: seedGroup.id,
                        rotation: normalizedTheta,
                        rotationDeg: normalizedDeg
                    });
                    cluster.forEach(id => usedEntityIdsForThisMatchRun.add(id)); break; 
                }
            }
        });

        if (newMatchGroups.length > 0) { 
            dState.setDxfComponents((prev: DxfComponent[]) => [...prev, ...newMatchGroups]); 
            aState.setMatchStatus({ text: `Auto-Match: Created ${newMatchGroups.length} new matching groups using ${isFuzzy ? 'Fuzzy' : 'Standard'} parameters!`, type: 'success' }); 
        } else { 
            aState.setMatchStatus({ text: `Auto-Match: No new matches found.`, type: 'info' }); 
        }
        setIsProcessing(false);
    }, 50);
  }, [dState, aState, setIsProcessing, getSeedEntitiesRecursive]);

  const updateComponentProperty = useCallback((id: string, prop: 'isWeld' | 'isMark' | 'isVisible', value: boolean) => 
    dState.setDxfComponents((prev: DxfComponent[]) => {
      const target = prev.find(c => c.id === id);
      if (!target) return prev;
      
      const isParent = !target.parentGroupId;
      return prev.map(c => {
          if (c.id === id) return { ...c, [prop]: value };
          if (isParent && c.parentGroupId === id) return { ...c, [prop]: value };
          return c;
      });
    }), [dState]);

  const updateComponentColor = useCallback((id: string, color: string) => 
    dState.setDxfComponents((prev: DxfComponent[]) => prev.map(c => (c.id === id || c.parentGroupId === id) ? { ...c, color } : c)), [dState]);

  const deleteComponent = useCallback((id: string) => {
    dState.setDxfComponents((prev: DxfComponent[]) => prev.filter(c => c.id !== id && c.parentGroupId !== id).map(c => ({ ...c, childGroupIds: (c.childGroupIds || []).filter(cid => cid !== id) })));
    if (aState.selectedComponentId === id) aState.setSelectedComponentId(null);
    if (aState.inspectComponentId === id || aState.inspectMatchesParentId === id) { aState.setInspectComponentId(null); aState.setInspectMatchesParentId(null); aState.setAnalysisTab('components'); }
  }, [dState, aState]);

  const confirmDeleteComponent = useCallback((id: string) => {
    const comp = dState.dxfComponents.find((c: DxfComponent) => c.id === id);
    if (!comp) return;

    setPromptState({
      isOpen: true,
      title: "Confirm Deletion",
      description: `Are you sure you want to delete the group "${comp.name}"? This will also remove any of its matching instances.`,
      defaultValue: "",
      hideInput: true,
      onConfirm: () => {
        deleteComponent(id);
        setPromptState((p: any) => ({ ...p, isOpen: false }));
      }
    });
  }, [dState.dxfComponents, deleteComponent, setPromptState]);

  const deleteAllMatches = useCallback((parentId: string) => {
    dState.setDxfComponents((prev: DxfComponent[]) => {
      const toRemoveIds = prev.filter(c => c.parentGroupId === parentId).map(c => c.id);
      if (toRemoveIds.length === 0) return prev;
      
      return prev
        .filter(c => c.parentGroupId !== parentId)
        .map(c => ({
          ...c,
          childGroupIds: (c.childGroupIds || []).filter(cid => !toRemoveIds.includes(cid))
        }));
    });

    if (aState.inspectMatchesParentId === parentId) {
      aState.setInspectMatchesParentId(null);
      aState.setAnalysisTab('components');
    }
    
    aState.setMatchStatus({ text: "All matching groups cleared successfully.", type: 'info' });
  }, [dState, aState]);

  const confirmDeleteAllMatches = useCallback((parentId: string) => {
    const parentComp = dState.dxfComponents.find((c: DxfComponent) => c.id === parentId);
    if (!parentComp) return;
    
    const matchCount = dState.dxfComponents.filter((c: DxfComponent) => c.parentGroupId === parentId).length;
    if (matchCount === 0) return;

    setPromptState({
      isOpen: true,
      title: "Confirm Deletion",
      description: `Are you sure you want to clear all ${matchCount} matching groups for "${parentComp.name}"? This action cannot be undone.`,
      defaultValue: "",
      hideInput: true,
      onConfirm: () => {
        deleteAllMatches(parentId);
        setPromptState((p: any) => ({ ...p, isOpen: false }));
      }
    });
  }, [dState.dxfComponents, deleteAllMatches, setPromptState]);

  const handleMoveSelectionToNewGroup = useCallback(() => {
    if (aState.selectedInsideEntityIds.size === 0 || !aState.inspectComponentId) return;
    const moveIds = Array.from(aState.selectedInsideEntityIds as Set<string>); 
    const sourceComp = dState.dxfComponents.find((c: DxfComponent) => c.id === aState.inspectComponentId); 
    if (!sourceComp) return;

    setPromptState({ isOpen: true, title: "Create New Subgroup", description: `Moving ${moveIds.length} entities.`, defaultValue: `${sourceComp.name} Subgroup`, onConfirm: (val: string) => {
        const moveEntities = moveIds.map(id => dState.dxfEntities.find(e => e.id === id)).filter(Boolean) as DxfEntity[];
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        moveEntities.forEach(e => { minX = Math.min(minX, e.minX); maxX = Math.max(maxX, e.maxX); minY = Math.min(minY, e.minY); maxY = Math.max(maxY, e.maxY); });
        const newComp: DxfComponent = { 
          id: generateId(), name: val.trim() || "New Subgroup", isVisible: true, isWeld: false, isMark: false, color: getRandomColor(), 
          entityIds: moveIds, seedSize: moveIds.length, centroid: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }, bounds: { minX, minY, maxX, maxY },
          rotation: 0, rotationDeg: 0
        };
        dState.setDxfComponents((prev: DxfComponent[]) => [...prev.map(c => c.id === aState.inspectComponentId ? { ...c, entityIds: c.entityIds.filter(id => !aState.selectedInsideEntityIds.has(id)) } : c), newComp]);
        aState.setInspectComponentId(newComp.id); aState.setSelectedInsideEntityIds(new Set()); aState.setMatchStatus({ text: "Subgroup created", type: 'success' }); setPromptState((p: any) => ({ ...p, isOpen: false }));
    }});
  }, [dState, aState, setPromptState]);

  const handleRemoveSingleEntity = useCallback((id: string) => {
    if (!aState.inspectComponentId) return; 
    dState.setDxfComponents((prev: DxfComponent[]) => prev.map(c => c.id === aState.inspectComponentId ? { ...c, entityIds: c.entityIds.filter(eid => eid !== id) } : c)); 
    aState.setSelectedInsideEntityIds((prev: Set<string>) => { const n = new Set(prev); n.delete(id); return n; });
  }, [dState, aState]);

  const handleRemoveChildGroup = useCallback((id: string) => {
    if (!aState.inspectComponentId) return; 
    dState.setDxfComponents((prev: DxfComponent[]) => prev.map(c => c.id === aState.inspectComponentId ? { ...c, childGroupIds: (c.childGroupIds || []).filter(cid => cid !== id) } : c));
  }, [dState, aState]);

  return {
    entitySizeGroups, entityTypeKeyMap, topLevelComponents,
    currentInspectedEntities, currentInspectedChildGroups, currentMatchedGroups,
    createAutoGroup, handleAutoMatch, updateComponentProperty, updateComponentColor, deleteComponent, 
    confirmDeleteComponent, deleteAllMatches, confirmDeleteAllMatches,
    handleMoveSelectionToNewGroup, handleRemoveSingleEntity, handleRemoveChildGroup
  };
}
