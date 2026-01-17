
import { useMemo } from 'react';
import { AiFeatureGroup, RenderableAiFeature } from '../types';

interface UseAiOverlayProps {
  aiFeatureGroups: AiFeatureGroup[];
  selectedAiGroupId: string | null;
  hoveredFeatureId: string | null;
  uiBase: number;
  scale: number;
}

interface RenderableWithPriority extends RenderableAiFeature {
  priority: number;
  area: number;
}

export function useAiOverlay({
  aiFeatureGroups,
  selectedAiGroupId,
  hoveredFeatureId,
  uiBase,
  scale
}: UseAiOverlayProps) {
  return useMemo(() => {
    const candidates: RenderableWithPriority[] = [];

    // 1. Identify active selection and its matches
    const selectedGroup = selectedAiGroupId ? aiFeatureGroups.find(g => g.id === selectedAiGroupId) : null;
    const matchGroupIds = new Set<string>();
    if (selectedGroup && !selectedGroup.parentGroupId) {
        aiFeatureGroups.forEach(g => {
            if (g.parentGroupId === selectedGroup.id) matchGroupIds.add(g.id);
        });
    }

    // 2. Collect all visible features with their priorities
    aiFeatureGroups.forEach(group => {
        const isMatchOfSelection = matchGroupIds.has(group.id);
        const isSelected = selectedAiGroupId === group.id;
        const groupVisible = group.isVisible || isSelected || isMatchOfSelection;

        if (!groupVisible) return;

        group.features.forEach(feat => {
            const isHovered = hoveredFeatureId === feat.id;
            
            /**
             * PRIORITY SYSTEM:
             * 3: Hovered (Highest)
             * 2: Directly selected Seed/Group
             * 1: Match of the currently selected Seed
             * 0: Default visible
             */
            let priority = 0;
            if (isHovered) priority = 3;
            else if (isSelected) priority = 2;
            else if (isMatchOfSelection) priority = 1;

            let strokeColor = group.color;
            if (isHovered) {
                strokeColor = '#facc15'; 
            } else if (isSelected) {
                strokeColor = '#ffffff'; 
            } else {
                strokeColor = group.color;
            }

            const strokeWidth = (uiBase * (isHovered ? 1.25 : isSelected ? 0.9 : 0.6)) / scale;

            candidates.push({
                id: feat.id,
                minX: feat.minX,
                minY: feat.minY,
                maxX: feat.maxX,
                maxY: feat.maxY,
                strokeColor,
                strokeWidth,
                isVisible: true,
                priority,
                area: (feat.maxX - feat.minX) * (feat.maxY - feat.minY)
            });
        });
    });

    // 3. Spatial Deduplication (IoU Suppression)
    /**
     * If two features overlap significantly (e.g. Copper match and Weld match at the same spot),
     * only the one with the highest priority should be rendered.
     */
    // Sort by priority (descending) so we process the most "important" ones first
    const sorted = [...candidates].sort((a, b) => b.priority - a.priority || b.area - a.area);
    const finalRenderables: RenderableAiFeature[] = [];
    
    const calculateIoU = (boxA: RenderableAiFeature, boxB: RenderableAiFeature) => {
        const interXmin = Math.max(boxA.minX, boxB.minX);
        const interXmax = Math.min(boxA.maxX, boxB.maxX);
        const interYmin = Math.max(boxA.minY, boxB.minY);
        const interYmax = Math.min(boxA.maxY, boxB.maxY);

        const interArea = Math.max(0, interXmax - interXmin) * Math.max(0, interYmax - interYmin);
        const areaA = (boxA.maxX - boxA.minX) * (boxA.maxY - boxA.minY);
        const areaB = (boxB.maxX - boxB.minX) * (boxB.maxY - boxB.minY);
        const unionArea = areaA + areaB - interArea;
        return unionArea > 0 ? interArea / unionArea : 0;
    };

    for (const item of sorted) {
        // Check if this physical area is already "claimed" by a higher priority box
        const isAlreadyClaimed = finalRenderables.some(claimed => calculateIoU(item, claimed) > 0.85);
        
        if (!isAlreadyClaimed) {
            finalRenderables.push(item);
        }
    }

    // 4. Return in reverse order for Painter's Algorithm (SVG rendering order)
    // Higher priority items should be at the end of the array to be drawn on TOP.
    return finalRenderables.reverse();
  }, [aiFeatureGroups, selectedAiGroupId, hoveredFeatureId, uiBase, scale]);
}
