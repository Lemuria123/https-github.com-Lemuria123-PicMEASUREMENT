
import { useMemo } from 'react';
import { DxfEntity, DxfComponent, RenderableDxfEntity, AppMode } from '../types';
import { getDxfEntityPathData } from '../utils/dxfUtils';

interface UseDxfOverlayProps {
  rawDxfData: any;
  dxfEntities: DxfEntity[];
  dxfComponents: DxfComponent[];
  selectedComponentId: string | null;
  hoveredComponentId: string | null;
  hoveredEntityId: string | null;
  hoveredObjectGroupKey: string | null;
  selectedInsideEntityIds: Set<string>;
  entityTypeKeyMap: Map<string, string[]>;
  mode: AppMode;
}

interface RenderableWithPriority extends RenderableDxfEntity {
  priority: number;
  compIdx: number; 
  isManualPoint?: boolean;
}

export function useDxfOverlay({
  rawDxfData,
  dxfEntities,
  dxfComponents,
  selectedComponentId,
  hoveredComponentId,
  hoveredEntityId,
  hoveredObjectGroupKey,
  selectedInsideEntityIds,
  entityTypeKeyMap,
  mode
}: UseDxfOverlayProps) {
  
  const staticCache = useMemo(() => {
    if (!rawDxfData) return null;
    const { minX, maxY, totalW, totalH, padding } = rawDxfData;
    const toNormX = (x: number) => (x - (minX - padding)) / totalW;
    const toNormY = (y: number) => ((maxY + padding) - y) / totalH;

    const geometryMap = new Map<string, any>();
    dxfEntities.forEach(e => {
        const geo = getDxfEntityPathData(e, toNormX, toNormY, totalW, totalH);
        if (geo) geometryMap.set(e.id, geo);
    });

    const entityToOwners = new Map<string, DxfComponent[]>();
    const compToIndex = new Map<string, number>();
    dxfComponents.forEach((c, i) => {
        compToIndex.set(c.id, i);
        c.entityIds.forEach(eid => {
            const owners = entityToOwners.get(eid) || [];
            owners.push(c);
            entityToOwners.set(eid, owners);
        });
    });

    return { geometryMap, entityToOwners, compToIndex, toNormX, toNormY, totalW, totalH };
  }, [rawDxfData, dxfEntities, dxfComponents]);

  return useMemo(() => {
    if (!staticCache || !rawDxfData) return [];
    const { geometryMap, entityToOwners, compToIndex, toNormX, toNormY, totalW, totalH } = staticCache;
    const isWeldMode = mode === 'weld_sequence';

    const selectedFamilyIds = new Set<string>();
    if (selectedComponentId) {
        selectedFamilyIds.add(selectedComponentId);
        dxfComponents.forEach(c => {
            if (c.parentGroupId === selectedComponentId) selectedFamilyIds.add(c.id);
        });
    }

    const selectedDeepIds = new Set<string>();
    if (selectedComponentId) {
        const stack = [selectedComponentId];
        const visited = new Set<string>();
        while (stack.length > 0) {
            const id = stack.pop()!;
            if (visited.has(id)) continue;
            visited.add(id);
            selectedDeepIds.add(id);
            const comp = dxfComponents.find(c => c.id === id);
            if (comp?.childGroupIds) stack.push(...comp.childGroupIds);
        }
    }

    const entityHoveredSet = new Set<string>();
    const hoveredManualCompIds = new Set<string>();
    const hoveredFamilyGroupIds = new Set<string>();

    if (hoveredComponentId) {
        hoveredFamilyGroupIds.add(hoveredComponentId);
        const stack = [hoveredComponentId];
        const visited = new Set<string>();
        while (stack.length > 0) {
            const id = stack.pop()!;
            if (visited.has(id)) continue;
            visited.add(id);
            const comp = dxfComponents.find(c => c.id === id);
            if (comp) {
                if (comp.isManual) hoveredManualCompIds.add(comp.id);
                comp.entityIds.forEach(eid => entityHoveredSet.add(eid));
                if (comp.childGroupIds) stack.push(...comp.childGroupIds);
            }
        }
    }

    const hoveredObjectGroupEntities = hoveredObjectGroupKey ? (entityTypeKeyMap.get(hoveredObjectGroupKey) || []) : [];
    const results: RenderableWithPriority[] = [];

    for (let i = 0; i < dxfEntities.length; i++) {
       const e = dxfEntities[i];
       const geometry = geometryMap.get(e.id);
       if (!geometry) continue;

       const owners = entityToOwners.get(e.id) || [];
       let priority = 0; 
       let bestComp: DxfComponent | null = null;
       let bestCompIdx = -1;
       
       if (owners.length > 0) {
           priority = -1; 
           for (let j = 0; j < owners.length; j++) {
               const comp = owners[j];
               const idx = compToIndex.get(comp.id) ?? -1;
               
               let p = comp.isVisible ? 10 : -1;
               if (comp.isMark) p = 20; 
               if (comp.isWeld) p = 30; 
               if (selectedFamilyIds.has(comp.id)) p = 50;
               if (selectedDeepIds.has(comp.id)) p = 80;
               if (hoveredFamilyGroupIds.has(comp.id)) p = 100;

               if (p > priority || (p === priority && idx > bestCompIdx)) {
                   priority = p;
                   bestComp = comp;
                   bestCompIdx = idx;
               }
           }
       }
       
       if (selectedInsideEntityIds.has(e.id)) { if (85 > priority) { priority = 85; bestComp = null; } }
       
       const isHovered = hoveredEntityId === e.id || 
                         hoveredObjectGroupEntities.includes(e.id) || 
                         entityHoveredSet.has(e.id);
                         
       if (isHovered) priority = 100;
       if (priority === -1) continue;

       // 工序模式下的视觉压制
       let finalColor = priority === 100 ? '#facc15' : (priority >= 80 ? '#ffffff' : (bestComp?.color || 'rgba(6, 182, 212, 0.4)'));
       if (isWeldMode && (!bestComp || !bestComp.isWeld)) {
           finalColor = 'rgba(71, 85, 105, 0.1)'; // 淡化非焊接实体
       }

       results.push({
           id: e.id, 
           type: e.type, 
           strokeColor: finalColor,
           isGrouped: owners.length > 0, 
           isVisible: true, 
           isSelected: priority >= 50, 
           isHovered, 
           geometry, 
           priority, 
           compIdx: bestCompIdx
       });
    }

    dxfComponents.forEach((comp, idx) => {
        if (!comp.isManual || !comp.isVisible) return;
        if (isWeldMode && !comp.isWeld) return; // 工序模式不显示非焊接手动点

        const isHovered = hoveredComponentId === comp.id || hoveredManualCompIds.has(comp.id) || hoveredFamilyGroupIds.has(comp.id);
        const isSelectedDirectly = selectedComponentId === comp.id;
        const isSelectedInFamily = selectedFamilyIds.has(comp.id);
        
        let priority = 20;
        if (comp.isMark) priority = 30;
        if (comp.isWeld) priority = 40;
        if (isSelectedInFamily) priority = 85;
        if (isSelectedDirectly) priority = 95;
        if (isHovered) priority = 110;

        const baseRadius = 1.6;

        results.push({
            id: comp.id,
            type: 'UNKNOWN',
            strokeColor: isHovered ? '#facc15' : (isSelectedDirectly ? '#ffffff' : comp.color),
            isVisible: true,
            isHovered,
            isSelected: isSelectedInFamily,
            isManualPoint: true,
            geometry: {
                type: 'circle',
                props: { 
                    cx: toNormX(comp.centroid.x), 
                    cy: toNormY(comp.centroid.y), 
                    r: baseRadius/totalW, 
                    rx: baseRadius/totalW,
                    ry: baseRadius/totalH 
                } 
            },
            priority,
            compIdx: idx
        });
    });

    return results.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.compIdx - b.compIdx;
    });

  }, [
    staticCache, rawDxfData, dxfComponents, dxfEntities,
    selectedComponentId, hoveredComponentId, hoveredEntityId, hoveredObjectGroupKey, selectedInsideEntityIds, mode
  ]);
}
