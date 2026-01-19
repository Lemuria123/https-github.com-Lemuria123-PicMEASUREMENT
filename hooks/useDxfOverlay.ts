
import { useMemo } from 'react';
import { DxfEntity, DxfComponent, RenderableDxfEntity } from '../types';
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
}

interface RenderableWithPriority extends RenderableDxfEntity {
  priority: number;
  compIdx: number; // For tie-breaking
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
  entityTypeKeyMap
}: UseDxfOverlayProps) {
  
  // 1. Static Cache: Geometry & Ownership
  // This only recalculates when the DXF file structure or dimensions change, NOT on hover/select.
  const staticCache = useMemo(() => {
    if (!rawDxfData || !dxfEntities.length) return null;

    const { minX, maxY, totalW, totalH, padding } = rawDxfData;
    const toNormX = (x: number) => (x - (minX - padding)) / totalW;
    const toNormY = (y: number) => ((maxY + padding) - y) / totalH;

    // A. Pre-calculate Geometry Paths for ALL entities
    const geometryMap = new Map<string, any>();
    dxfEntities.forEach(e => {
        const geo = getDxfEntityPathData(e, toNormX, toNormY, totalW, totalH);
        if (geo) geometryMap.set(e.id, geo);
    });

    // B. Pre-calculate Ownership Map (Entity ID -> List of Component Owners)
    // Also build Component Index for tie-breaking
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

    return { geometryMap, entityToOwners, compToIndex };
  }, [rawDxfData, dxfEntities, dxfComponents]); // Dependencies are strictly structural data

  // 2. Dynamic State Calculation
  // This runs on every hover/select, but it is now very lightweight (map lookups only).
  return useMemo(() => {
    if (!staticCache || !rawDxfData) return [];
    const { geometryMap, entityToOwners, compToIndex } = staticCache;

    // Identify the "Family" and "Descendants" of the current selection for bulk highlighting
    const activeSelection = selectedComponentId ? dxfComponents.find(c => c.id === selectedComponentId) : null;
    const rootSeedId = activeSelection?.parentGroupId || selectedComponentId;
    
    const selectedFamilyIds = new Set<string>();
    if (rootSeedId) {
        selectedFamilyIds.add(rootSeedId);
        dxfComponents.forEach(c => {
            if (c.parentGroupId === rootSeedId) selectedFamilyIds.add(c.id);
        });
    }

    // Identify all components that should show "Selected" state (Self + all recursive children)
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

    const hoveredObjectGroupEntities = hoveredObjectGroupKey ? (entityTypeKeyMap.get(hoveredObjectGroupKey) || []) : [];

    // Pre-calculate Hovered Set for O(1) lookup
    const entityHoveredSet = new Set<string>();
    if (hoveredComponentId) {
        const stack = [hoveredComponentId];
        const visited = new Set<string>();
        while (stack.length > 0) {
            const id = stack.pop()!;
            if (visited.has(id)) continue;
            visited.add(id);
            const comp = dxfComponents.find(c => c.id === id);
            if (comp) {
                comp.entityIds.forEach(eid => entityHoveredSet.add(eid));
                if (comp.childGroupIds) stack.push(...comp.childGroupIds);
                // Also hover peers if this is a match
                if (comp.parentGroupId === hoveredComponentId) {
                   comp.entityIds.forEach(eid => entityHoveredSet.add(eid));
                }
            }
        }
    }

    const results: RenderableWithPriority[] = [];

    // Fast pass through all entities
    for (let i = 0; i < dxfEntities.length; i++) {
       const e = dxfEntities[i];
       const geometry = geometryMap.get(e.id);
       if (!geometry) continue;

       const owners = entityToOwners.get(e.id) || [];
       
       /**
        * PRIORITY LADDER:
        * 100: Hovered (Yellow)
        * 85: Manually Selected loose entity (White)
        * 80: Selected Component or its Sub-groups (White)
        * 50: Family Match of Selection (Component Color)
        * 10: Standard Visible (Component Color)
        * 0: Background (Cyan)
        */
       let priority = 0; 
       let bestComp: DxfComponent | null = null;
       let bestCompIdx = -1;
       
       if (owners.length > 0) {
           priority = -1; // Default for entities with owners: hidden unless proven visible
           for (let j = 0; j < owners.length; j++) {
               const comp = owners[j];
               const idx = compToIndex.get(comp.id) ?? -1;
               let p = comp.isVisible ? 10 : -1;
               
               if (selectedFamilyIds.has(comp.id)) p = 50;
               if (selectedDeepIds.has(comp.id)) p = 80;

               // Bidding logic
               if (p > priority || (p === priority && idx > bestCompIdx)) {
                   priority = p;
                   bestComp = comp;
                   bestCompIdx = idx;
               }
           }
       }

       // Manual Overrides
       if (selectedInsideEntityIds.has(e.id)) {
           if (85 > priority) { priority = 85; bestComp = null; }
       }
       
       const isHovered = hoveredEntityId === e.id || 
                         hoveredObjectGroupEntities.includes(e.id) || 
                         entityHoveredSet.has(e.id);

       if (isHovered) {
           priority = 100;
       }

       if (priority === -1) continue;

       let strokeColor = 'rgba(6, 182, 212, 0.4)'; 
       if (priority === 100) strokeColor = '#facc15';
       else if (priority === 85 || priority === 80) strokeColor = '#ffffff';
       else if (bestComp) strokeColor = bestComp.color;

       results.push({
           id: e.id, 
           type: e.type,
           strokeColor, 
           isGrouped: owners.length > 0, 
           isVisible: true, 
           isSelected: priority >= 50,
           isHovered, // Prioritize this for dynamic rendering in layer
           geometry,
           priority,
           compIdx: bestCompIdx
       });
    }

    // Sort: High priority last (rendered on top)
    return results.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.compIdx - b.compIdx;
    });

  }, [
    staticCache, rawDxfData, // Structural deps
    selectedComponentId, hoveredComponentId, hoveredEntityId, hoveredObjectGroupKey, selectedInsideEntityIds // Dynamic deps
  ]);
}
