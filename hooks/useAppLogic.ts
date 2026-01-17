import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import DxfParser from 'dxf-parser';
import { 
  Point, AppMode, ViewTransform, DxfEntity, DxfComponent, 
  AiFeatureGroup, DxfEntityType, RenderableDxfEntity 
} from '../types';
import { generateId, getRandomColor } from '../utils';

// 引入底层状态 Hooks
import { useMeasurementState } from './useMeasurementState';
import { useAnalysisState } from './useAnalysisState';
import { useDomainData } from './useDomainData';
import { useDxfAnalysis } from './useDxfAnalysis';
import { useAiAnalysis } from './useAiAnalysis';
import { useInteractionLogic } from './useInteractionLogic';

export function useAppLogic() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [mode, setMode] = useState<AppMode>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [originalFileName, setOriginalFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [mouseNormPos, setMouseNormPos] = useState<Point | null>(null);
  const [viewTransform, setViewTransform] = useState<ViewTransform | null>(null);

  // 初始化底层状态
  const mState = useMeasurementState();
  const aState = useAnalysisState();
  const dState = useDomainData();

  // Modal 状态
  const [promptState, setPromptState] = useState<{
    isOpen: boolean;
    title: string;
    description?: string;
    defaultValue: string;
    defaultUnit?: string;
    showUnitSelector?: boolean;
    onConfirm: (val: string, unit?: string) => void;
  }>({
    isOpen: false,
    title: '',
    defaultValue: '',
    onConfirm: () => {}
  });

  // 引入分析与交互 Hook
  const dxfAnalysis = useDxfAnalysis({ dState, aState, setIsProcessing, setMode, setPromptState });
  const aiAnalysis = useAiAnalysis({ imageSrc, dState, aState });
  const interaction = useInteractionLogic({ 
    mode, setMode, dState, mState, aState, setPromptState, 
    imgDimensions: dState.imgDimensions 
  });

  // --- 衍生状态 (Calculated Properties) ---

  const dxfOverlayEntities = useMemo(() => {
    if (!dState.rawDxfData || !dState.dxfEntities.length) return [];
    const { minX, maxY, totalW, totalH, padding } = dState.rawDxfData;
    const toNormX = (x: number) => (x - (minX - padding)) / totalW;
    const toNormY = (y: number) => ((maxY + padding) - y) / totalH;
    
    // 1. 扁平化查找表预计算 - 确保渲染循环内是 O(1) 查找
    const entityColorMap = new Map<string, string>();
    const entityVisibilityMap = new Map<string, boolean>();
    const entitySelectedSet = new Set<string>();

    const selectedCompId = aState.selectedComponentId;

    // 辅助函数：提取组内所有实体 ID（包括子组）
    const getCompEntities = (compId: string) => {
        const ids = new Set<string>();
        const stack = [compId];
        const visited = new Set<string>();
        while (stack.length > 0) {
            const id = stack.pop()!;
            if (visited.has(id)) continue;
            visited.add(id);
            const comp = dState.dxfComponents.find((c: DxfComponent) => c.id === id);
            if (comp) {
                comp.entityIds.forEach(eid => ids.add(eid));
                if (comp.childGroupIds) stack.push(...comp.childGroupIds);
            }
        }
        return ids;
    };

    // 第一遍：处理普通组件颜色和可见性
    dState.dxfComponents.forEach((comp: DxfComponent) => {
        comp.entityIds.forEach(eid => {
            entityColorMap.set(eid, comp.color);
            entityVisibilityMap.set(eid, comp.isVisible);
        });
    });

    // 第二遍：处理当前选中组及其匹配项的特殊逻辑（优先级更高，覆盖第一遍）
    if (selectedCompId) {
        // A. 种子组处理
        const seedEntities = getCompEntities(selectedCompId);
        seedEntities.forEach(eid => {
            entityColorMap.set(eid, '#ffffff'); // 种子强制白色
            entitySelectedSet.add(eid);
            entityVisibilityMap.set(eid, true); // 选中项强制可见
        });

        // B. 匹配项处理
        dState.dxfComponents.forEach((comp: DxfComponent) => {
            if (comp.parentGroupId === selectedCompId) {
                const matchEntities = getCompEntities(comp.id);
                matchEntities.forEach(eid => {
                    entityColorMap.set(eid, comp.color); // 使用 Match 组的颜色
                    entitySelectedSet.add(eid);
                    entityVisibilityMap.set(eid, true);
                });
            }
        });
    }

    // 2. 最终映射 (严格 O(N))
    return dState.dxfEntities.map((e: DxfEntity) => {
       const isVisible = entityVisibilityMap.get(e.id) ?? true;
       if (!isVisible) return null;

       const isSelected = entitySelectedSet.has(e.id);
       const isDirectlySelected = aState.selectedInsideEntityIds.has(e.id);
       const isHovered = aState.hoveredEntityId === e.id;

       let strokeColor = entityColorMap.get(e.id) || 'rgba(6, 182, 212, 0.4)';
       if (isHovered) strokeColor = '#facc15';
       else if (isDirectlySelected) strokeColor = '#ffffff';

       const baseProps = { 
           id: e.id, 
           strokeColor, 
           isGrouped: entityColorMap.has(e.id), 
           isVisible: true, 
           isSelected: isSelected || isDirectlySelected,
           isHovered
       };

       if (e.type === 'LINE') { 
           const v = e.rawEntity.vertices; 
           return { ...baseProps, type: 'LINE' as DxfEntityType, geometry: { type: 'line' as const, props: { x1: toNormX(v[0].x), y1: toNormY(v[0].y), x2: toNormX(v[1].x), y2: toNormY(v[1].y) } } }; 
       } 
       if (e.type === 'LWPOLYLINE') { 
           return { ...baseProps, type: 'LWPOLYLINE' as DxfEntityType, geometry: { type: 'polyline' as const, props: { points: e.rawEntity.vertices.map((v: any) => `${toNormX(v.x)},${toNormY(v.y)}`).join(' ') } } }; 
       } 
       if (e.type === 'ARC') {
           const { center, radius, startAngle, endAngle } = e.rawEntity;
           const sx = center.x + radius * Math.cos(startAngle); 
           const sy = center.y + radius * Math.sin(startAngle);
           const ex = center.x + radius * Math.cos(endAngle); 
           const ey = center.y + radius * Math.sin(endAngle);
           const d = `M ${toNormX(sx)} ${toNormY(sy)} A ${radius/totalW} ${radius/totalH} 0 ${((endAngle-startAngle+2*Math.PI)%(2*Math.PI))>Math.PI?1:0} 0 ${toNormX(ex)} ${toNormY(ey)}`;
           return { ...baseProps, type: 'ARC' as DxfEntityType, geometry: { type: 'path' as const, props: { d } } };
       }
       if (e.type === 'CIRCLE') {
           return { ...baseProps, type: 'CIRCLE' as DxfEntityType, geometry: { type: 'circle' as const, props: { cx: toNormX(e.rawEntity.center.x), cy: toNormY(e.rawEntity.center.y), r: e.rawEntity.radius/totalW, rx: e.rawEntity.radius/totalW, ry: e.rawEntity.radius/totalH } } };
       }
       return null;
    }).filter(Boolean) as RenderableDxfEntity[];
  }, [
    dState.rawDxfData, dState.dxfEntities, dState.dxfComponents,
    aState.selectedComponentId, aState.hoveredComponentId, aState.hoveredEntityId,
    aState.selectedInsideEntityIds, aState.selectedObjectGroupKey, aState.analysisTab
  ]);

  const originCanvasPos = useMemo(() => {
    if (dState.rawDxfData) {
        const { defaultCenterX, defaultCenterY, minX, maxY, totalW, totalH, padding } = dState.rawDxfData;
        const tx = dState.manualOriginCAD ? dState.manualOriginCAD.x : defaultCenterX; const ty = dState.manualOriginCAD ? dState.manualOriginCAD.y : defaultCenterY;
        return { x: (tx - (minX - padding)) / totalW, y: ((maxY + padding) - ty) / totalH };
    }
    if (dState.calibrationData && dState.manualOriginCAD && dState.imgDimensions) {
        const scaleInfo = dState.getScaleInfo();
        if (scaleInfo) return { x: dState.manualOriginCAD.x / scaleInfo.totalWidthMM, y: dState.manualOriginCAD.y / scaleInfo.totalHeightMM };
    }
    return null;
  }, [dState.rawDxfData, dState.manualOriginCAD, dState.calibrationData, dState.imgDimensions, dState.getScaleInfo]);

  // --- 交互函数 (Handlers) ---

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    event.target.value = '';
    setIsProcessing(true); setOriginalFileName(file.name);
    mState.setMeasurements([]); mState.setParallelMeasurements([]); mState.setAreaMeasurements([]); mState.setCurveMeasurements([]);
    dState.setManualOriginCAD(null); dState.setCalibrationData(null); setViewTransform(null);
    dState.setFeatureROI([]); dState.setDxfEntities([]); dState.setDxfComponents([]);
    dState.setAiFeatureGroups([]); aState.clearAllSelections(); aState.setInspectComponentId(null);
    interaction.setCurrentPoints([]);

    if (file.name.toLowerCase().endsWith('.dxf')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parser = new DxfParser();
          const dxf = parser.parseSync(e.target?.result as string);
          if (dxf) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            const circles: any[] = []; const parsedEntities: DxfEntity[] = [];
            dxf.entities.forEach((entity: any) => {
              let type: DxfEntityType = 'UNKNOWN'; let entBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 }; let isValid = false;
              if (entity.type === 'LINE') { type = 'LINE'; const xs = entity.vertices.map((v:any) => v.x); const ys = entity.vertices.map((v:any) => v.y); entBounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }; isValid = true; } 
              else if (entity.type === 'CIRCLE') { type = 'CIRCLE'; const r = entity.radius; entBounds = { minX: entity.center.x - r, maxX: entity.center.x + r, minY: entity.center.y - r, maxY: entity.center.y + r }; isValid = true; circles.push(entity); } 
              else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') { type = 'LWPOLYLINE'; if (entity.vertices?.length > 0) { const xs = entity.vertices.map((v:any) => v.x); const ys = entity.vertices.map((v:any) => v.y); entBounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }; isValid = true; } } 
              else if (entity.type === 'ARC') { type = 'ARC'; const r = entity.radius; entBounds = { minX: entity.center.x - r, maxX: entity.center.x + r, minY: entity.center.y - r, maxY: entity.center.y + r }; isValid = true; }
              if (isValid) {
                  minX = Math.min(minX, entBounds.minX); minY = Math.min(minY, entBounds.minY); maxX = Math.max(maxX, entBounds.maxX); maxY = Math.max(maxY, entBounds.maxY);
                  parsedEntities.push({ id: entity.handle || generateId(), type, layer: entity.layer || '0', minX: entBounds.minX, minY: entBounds.minY, maxX: entBounds.maxX, maxY: entBounds.maxY, rawEntity: entity });
              }
            });
            dState.setDxfEntities(parsedEntities);
            const width = maxX - minX, height = maxY - minY, padding = Math.max(width, height) * 0.05 || 10;
            const totalW = width + padding * 2, totalH = height + padding * 2;
            dState.setRawDxfData({ circles, defaultCenterX: (minX + maxX) / 2, defaultCenterY: (minY + maxY) / 2, minX, maxX, maxY, totalW, totalH, padding });
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX - padding} ${-maxY - padding} ${totalW} ${totalH}" width="1000" height="${(totalH/totalW)*1000}" style="background: #111;"></svg>`;
            setImageSrc(URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })));
            dState.setCalibrationData({ start: { x: padding/totalW, y: 0.5 }, end: { x: (width+padding)/totalW, y: 0.5 }, realWorldDistance: width, unit: 'mm' });
            setMode('measure'); 
          }
        } catch(err) { alert("Fail DXF"); } setIsProcessing(false);
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => { 
          setImageSrc(e.target?.result as string); 
          dState.setRawDxfData(null); 
          setMode('calibrate'); 
          setIsProcessing(false); 
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleEntityInSelection = (id: string) => aState.setSelectedInsideEntityIds((prev: Set<string>) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  useEffect(() => {
     if (!originalFileName) return;
     const t = setTimeout(() => { localStorage.setItem('metricmate_last_session', JSON.stringify({ fileName: originalFileName, manualOriginCAD: dState.manualOriginCAD, viewTransform })); }, 500);
     return () => clearTimeout(t);
  }, [originalFileName, dState.manualOriginCAD, viewTransform]);

  return {
    imageSrc, setImageSrc, mode, setMode, isProcessing, setIsProcessing, originalFileName, setOriginalFileName, fileInputRef, mouseNormPos, setMouseNormPos, viewTransform, setViewTransform,
    mState, aState, dState, promptState, setPromptState,
    dxfOverlayEntities, originCanvasPos,
    handleFileUpload, toggleEntityInSelection,
    ...dxfAnalysis,
    ...aiAnalysis,
    ...interaction
  };
}
