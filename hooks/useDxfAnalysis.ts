import { useMemo, useCallback } from 'react';
import { DxfEntity, DxfComponent, DxfEntityType } from '../types';
import { generateId, getRandomColor } from '../utils';
import { matchSimilarComponents } from '../utils/matchEngine';

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

    const quantize = (val: number, type: 'angle' | 'dist') => {
        if (type === 'angle') {
            const step = 10.0;
            return (Math.round(val / step) * step);
        } else {
            const step = val < 10 ? 0.5 : 1.0; 
            return (Math.round(val / step) * step);
        }
    };

    dState.dxfEntities.forEach((e: DxfEntity) => {
      let key = "", label = "";
      
      if (e.type === 'CIRCLE') { 
          const diam = e.rawEntity.radius * 2; 
          const qDiam = quantize(diam, 'dist');
          key = `CIRCLE_${qDiam.toFixed(1)}`; 
          label = `Circle Ø~${qDiam.toFixed(1)}`;
      } 
      else if (e.type === 'ARC') {
          const diam = e.rawEntity.radius * 2;
          let angleRad = e.rawEntity.endAngle - e.rawEntity.startAngle;
          if (angleRad < 0) angleRad += Math.PI * 2;
          const angleDeg = angleRad * (180 / Math.PI);
          const qDiam = quantize(diam, 'dist');
          const qAngle = quantize(angleDeg, 'angle');
          key = `ARC_${qDiam.toFixed(1)}_${qAngle}`;
          label = `Arc Ø~${qDiam.toFixed(1)} / ~${qAngle}°`;
      }
      else if (e.type === 'LINE') { 
          const dx = e.rawEntity.vertices[1].x - e.rawEntity.vertices[0].x; 
          const dy = e.rawEntity.vertices[1].y - e.rawEntity.vertices[0].y; 
          const len = Math.sqrt(dx*dx + dy*dy);
          key = `LINE_${(Math.round(len / TOLERANCE) * TOLERANCE).toFixed(2)}`; 
          label = `Line L${len.toFixed(2)}`;
      } 
      else if (e.type === 'LWPOLYLINE') {
          const vertexCount = e.rawEntity.vertices?.length || 0;
          key = `POLY_${vertexCount}`;
          label = `Poly (${vertexCount}pt)`;
      }
      else {
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
    return Array.from(collectedEntityIds).map(id => dState.dxfEntities.find((e: DxfEntity) => e.id === id)).filter(Boolean) as DxfEntity[];
  }, [dState.dxfComponents, dState.dxfEntities]);

  const createAutoGroup = useCallback((groupKey: string, type: 'weld' | 'mark') => {
    if (!dState.rawDxfData) return;
    const matchingIds = entityTypeKeyMap.get(groupKey) || [];
    if (matchingIds.length === 0) return;
    const seedId = matchingIds[0];
    const matchIds = matchingIds.slice(1);
    const groupLabel = entitySizeGroups.find(g => g.key === groupKey)?.label || "New Group";
    const seedEntity = dState.dxfEntities.find((e: DxfEntity) => e.id === seedId);
    if (!seedEntity) return;

    const seedComponent: DxfComponent = {
        id: generateId(), 
        name: groupLabel, isVisible: true, isWeld: type === 'weld', isMark: type === 'mark',
        color: getRandomColor(), entityIds: [seedId], seedSize: 1,
        centroid: { x: (seedEntity.minX + seedEntity.maxX) / 2, y: (seedEntity.minY + seedEntity.maxY) / 2 },
        bounds: { minX: seedEntity.minX, minY: seedEntity.minY, maxX: seedEntity.maxX, maxY: seedEntity.maxY },
        rotation: 0, rotationDeg: 0
    };

    const matchComponents = matchIds.map(mid => {
        const ent = dState.dxfEntities.find((e: DxfEntity) => e.id === mid);
        if (!ent) return null;
        return {
            id: generateId(), name: `${groupLabel} Match`, isVisible: true, isWeld: type === 'weld', isMark: type === 'mark', color: seedComponent.color,
            entityIds: [mid], seedSize: 1, centroid: { x: (ent.minX + ent.maxX) / 2, y: (ent.minY + ent.maxY) / 2 },
            bounds: { minX: ent.minX, minY: ent.minY, maxX: ent.maxX, maxY: ent.maxY },
            parentGroupId: seedComponent.id, rotation: 0, rotationDeg: 0
        } as DxfComponent;
    }).filter(Boolean) as DxfComponent[];

    dState.setDxfComponents((prev: DxfComponent[]) => [...prev, seedComponent, ...matchComponents]);
    aState.setMatchStatus({ text: `Grouped 1 Seed + ${matchComponents.length} Matches as ${type === 'weld' ? 'Weld' : 'Mark'}`, type: 'success' });
  }, [dState, aState, entitySizeGroups, entityTypeKeyMap]);

  const handleAutoMatch = useCallback(() => {
    if (!aState.selectedComponentId) { alert("Please select a 'seed' group first to auto-match similar components."); return; }
    const seedGroup = dState.dxfComponents.find((c: DxfComponent) => c.id === aState.selectedComponentId);
    if (!seedGroup) return;

    setIsProcessing(true);
    setTimeout(() => {
        const seedEntities = getSeedEntitiesRecursive(aState.selectedComponentId);
        if (seedEntities.length === 0) { setIsProcessing(false); return; }

        const existingMatches = dState.dxfComponents.filter((c: DxfComponent) => c.parentGroupId === seedGroup.id);
        const results = matchSimilarComponents(
            seedEntities,
            dState.dxfEntities,
            seedGroup,
            existingMatches,
            aState.dxfMatchSettings
        );

        if (results.length > 0) { 
            const newComponents: DxfComponent[] = results.map(r => ({
              ...r,
              isVisible: seedGroup.isVisible,
              isWeld: seedGroup.isWeld,
              isMark: seedGroup.isMark,
              color: seedGroup.color,
              seedSize: seedEntities.length,
              parentGroupId: seedGroup.id 
            }));
            dState.setDxfComponents((prev: DxfComponent[]) => [...prev, ...newComponents]); 
            aState.setMatchStatus({ 
              text: `Auto-Match: Created ${results.length} new matching groups!`, 
              type: 'success' 
            }); 
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
      isOpen: true, title: "Confirm Deletion",
      description: `Are you sure you want to delete the group "${comp.name}"? This will also remove any of its matching instances.`,
      defaultValue: "", hideInput: true,
      onConfirm: () => { deleteComponent(id); setPromptState((p: any) => ({ ...p, isOpen: false })); }
    });
  }, [dState.dxfComponents, deleteComponent, setPromptState]);

  const deleteAllMatches = useCallback((parentId: string) => {
    dState.setDxfComponents((prev: DxfComponent[]) => {
      const toRemoveIds = prev.filter(c => c.parentGroupId === parentId).map(c => c.id);
      if (toRemoveIds.length === 0) return prev;
      return prev.filter(c => c.parentGroupId !== parentId).map(c => ({ ...c, childGroupIds: (c.childGroupIds || []).filter(cid => !toRemoveIds.includes(cid)) }));
    });
    if (aState.inspectMatchesParentId === parentId) { aState.setInspectMatchesParentId(null); aState.setAnalysisTab('components'); }
    aState.setMatchStatus({ text: "All matching groups cleared successfully.", type: 'info' });
  }, [dState, aState]);

  const confirmDeleteAllMatches = useCallback((parentId: string) => {
    const parentComp = dState.dxfComponents.find((c: DxfComponent) => c.id === parentId);
    if (!parentComp) return;
    const matchCount = dState.dxfComponents.filter((c: DxfComponent) => c.parentGroupId === parentId).length;
    if (matchCount === 0) return;
    setPromptState({
      isOpen: true, title: "Confirm Deletion",
      description: `Are you sure you want to clear all ${matchCount} matching groups for "${parentComp.name}"? This action cannot be undone.`,
      defaultValue: "", hideInput: true,
      onConfirm: () => { deleteAllMatches(parentId); setPromptState((p: any) => ({ ...p, isOpen: false })); }
    });
  }, [dState.dxfComponents, deleteAllMatches, setPromptState]);

  const handleMoveSelectionToNewGroup = useCallback(() => {
    if (aState.selectedInsideEntityIds.size === 0 || !aState.inspectComponentId) return;
    const moveIds = Array.from(aState.selectedInsideEntityIds as Set<string>); 
    const sourceComp = dState.dxfComponents.find((c: DxfComponent) => c.id === aState.inspectComponentId); 
    if (!sourceComp) return;
    setPromptState({ isOpen: true, title: "Create New Subgroup", description: `Moving ${moveIds.length} entities.`, defaultValue: `${sourceComp.name} Subgroup`, onConfirm: (val: string) => {
        const moveEntities = moveIds.map(id => dState.dxfEntities.find(e => e.id === id)).filter(Boolean) as DxfEntity[];
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, sx = 0, sy = 0;
        moveEntities.forEach(e => { minX = Math.min(minX, e.minX); maxX = Math.max(maxX, e.maxX); minY = Math.min(minY, e.minY); maxY = Math.max(maxY, e.maxY); sx += (e.minX+e.maxX)/2; sy += (e.minY+e.maxY)/2; });
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
