import { useMemo } from 'react';
import { DxfEntity, DxfComponent, RenderableDxfEntity } from '../types';

interface UseWeldSequenceOverlayProps {
  mode: string;
  rawDxfData: any;
  dxfEntities: DxfEntity[];
  dxfComponents: DxfComponent[];
  hoveredSequenceNum: number | null;
  selectedWeldPointId: string | null;
  hoveredComponentId: string | null;
  staticCache: any;
}

export interface RenderableWeldPoint extends RenderableDxfEntity {
  sequenceLabel?: string;
  isBackground?: boolean;
  priority: number;
}

/**
 * Weld Sequence Overlay logic (STAGE_PRODUCTION Isolation)
 * 专门用于工序模块的渲染计算，优化了自动/手动焊点的视觉区分
 */
export function useWeldSequenceOverlay({
  mode,
  rawDxfData,
  dxfEntities,
  dxfComponents,
  hoveredSequenceNum,
  selectedWeldPointId,
  hoveredComponentId,
  staticCache
}: UseWeldSequenceOverlayProps) {

  return useMemo(() => {
    if (mode !== 'weld_sequence' || !rawDxfData || !staticCache) return [];
    
    const { geometryMap, entityToOwners, toNormX, toNormY, totalW, totalH } = staticCache;
    const results: RenderableWeldPoint[] = [];

    // 1. 处理 CAD 背景实体 (非焊接关联的散乱线条)
    dxfEntities.forEach(e => {
       const owners = entityToOwners.get(e.id) || [];
       const isWeldEntity = owners.some(o => o.isWeld);
       
       if (!isWeldEntity) {
          const geo = geometryMap.get(e.id);
          if (geo) {
             results.push({
                id: `bg-${e.id}`,
                type: e.type,
                strokeColor: 'rgba(71, 85, 105, 0.25)', // 背景压制更暗一些
                isVisible: true,
                geometry: geo,
                priority: 10,
                isBackground: true
             });
          }
       }
    });

    // 2. 处理焊接组件及其工序状态
    dxfComponents.forEach((comp, idx) => {
       if (!comp.isWeld || !comp.isVisible) return;

       // 判定当前组件的渲染状态
       const isDirectHover = hoveredComponentId === comp.id;
       const isSequenceHover = hoveredSequenceNum !== null && comp.sequence === hoveredSequenceNum;
       const isSelected = selectedWeldPointId === comp.id;
       const isHighLighted = isDirectHover || isSequenceHover;
       
       /**
        * 优先级权重:
        * 120: Active Hover (高亮)
        * 100: Sequence Family (同工序组高亮)
        * 80: Selected (选中态)
        * 40: Default
        */
       let priority = 40;
       if (isDirectHover) priority = 120;
       else if (isSequenceHover) priority = 100;
       else if (isSelected) priority = 80;

       // 颜色逻辑：默认使用组件色，高亮时转为亮黄/白色
       const strokeColor = isHighLighted ? '#facc15' : (isSelected ? '#ffffff' : comp.color);

       // --- 逻辑 A: 仅手动点显示精密准星圆圈 ---
       if (comp.isManual) {
          results.push({
             id: `marker-${comp.id}`,
             type: 'UNKNOWN',
             strokeColor,
             isVisible: true,
             isSelected,
             isHovered: isHighLighted,
             isManualPoint: true, // 触发 CanvasLayers 中的 Reticle 渲染
             geometry: {
                type: 'circle',
                props: {
                   cx: toNormX(comp.centroid.x),
                   cy: toNormY(comp.centroid.y),
                   r: 1.6/totalW, 
                   rx: 1.6/totalW,
                   ry: 1.6/totalH
                }
             },
             priority: priority + 5,
             compIdx: idx
          } as any);
       }

       // --- 逻辑 B: 标签锚点 (不可见，仅承载 S{N} 标签) ---
       // 无论手动自动，只要标记为焊接，都需要一个锚点来放标签
       results.push({
          id: `label-anchor-${comp.id}`,
          type: 'UNKNOWN',
          strokeColor: comp.color, // 用于标签背景色
          isVisible: false, // 不直接绘制几何体
          sequenceLabel: comp.sequence ? `S${comp.sequence}` : undefined,
          geometry: {
             type: 'circle',
             props: {
                cx: toNormX(comp.centroid.x),
                cy: toNormY(comp.centroid.y),
                r: 0.1/totalW // 极小
             }
          },
          priority: priority + 10,
          compIdx: idx
       } as any);

       // --- 逻辑 C: 成员实体渲染 ---
       // 使用组件定义的颜色，并同步悬停高亮状态
       comp.entityIds.forEach(eid => {
          const geo = geometryMap.get(eid);
          if (geo) {
             results.push({
                id: `ent-${comp.id}-${eid}`,
                type: 'UNKNOWN',
                strokeColor, // 使用上面算好的颜色
                isVisible: true,
                isHovered: isHighLighted,
                geometry: geo,
                priority: priority, 
                compIdx: idx
             } as any);
          }
       });
    });

    return results.sort((a, b) => a.priority - b.priority);
  }, [mode, rawDxfData, dxfEntities, dxfComponents, hoveredSequenceNum, selectedWeldPointId, hoveredComponentId, staticCache]);
}
