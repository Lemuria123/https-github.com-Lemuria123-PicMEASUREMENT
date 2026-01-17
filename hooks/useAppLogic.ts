// Fix: Added React to imports to resolve 'Cannot find namespace React' for types like React.ChangeEvent
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
    
    // Entity to Component Map
    const entityGroupMap = new Map<string, string>();
    dState.dxfComponents.forEach((comp: DxfComponent) => { 
        comp.entityIds.forEach(eid => entityGroupMap.set(eid, comp.id)); 
    });
    
    // Pre-calculate recursive entity sets for selection and hover detection
    const componentToEntitiesCache = new Map<string, Set<string>>();
    const getEntitiesRecursive = (compId: string): Set<string> => {
        if (componentToEntitiesCache.has(compId)) return componentToEntitiesCache.get(compId)!;
        const comp = dState.dxfComponents.find((c: DxfComponent) => c.id === compId);
        const entitySet = new Set<string>();
        if (comp) {
            comp.entityIds.forEach((eid: string) => entitySet.add(eid));
            (comp.childGroupIds || []).forEach((cid: string) => {
                getEntitiesRecursive(cid).forEach(eid => entitySet.add(eid));
            });
        }
        componentToEntitiesCache.set(compId, entitySet);
        return entitySet;
    };

    // Level 1 (Top Priority): Pre-calculate Hovered Sets
    const hoveredComponentEntitySet = aState.hoveredComponentId ? getEntitiesRecursive(aState.hoveredComponentId) : new Set<string>();

    // Level 2: Pre-calculate Selected Sets
    const selectedComponentEntitySet = aState.selectedComponentId ? getEntitiesRecursive(aState.selectedComponentId) : new Set<string>();
    const objectGroupIds = new Set<string>();
    if (aState.selectedObjectGroupKey && aState.analysisTab === 'objects') {
        (dxfAnalysis.entityTypeKeyMap.get(aState.selectedObjectGroupKey) || []).forEach((id: string) => objectGroupIds.add(id));
    }

    return dState.dxfEntities.map((e: DxfEntity) => {
       const groupId = entityGroupMap.get(e.id); 
       const component = groupId ? dState.dxfComponents.find((c: DxfComponent) => c.id === groupId) : null;
       
       // Selection Checks
       const isSelected = selectedComponentEntitySet.has(e.id) || 
                          aState.selectedInsideEntityIds.has(e.id) || 
                          objectGroupIds.has(e.id);

       // Hover Checks
       const isHovered = hoveredComponentEntitySet.has(e.id) || aState.hoveredEntityId === e.id;
       
       // Base Rendering Attributes
       let strokeColor = 'rgba(6, 182, 212, 0.4)'; // Default (Level 5)
       
       // EXCLUSIVE PRIORITY LOGIC
       if (isHovered) {
           strokeColor = '#facc15'; // Priority 1: Hover (Strict Yellow)
       } else if (isSelected) {
           strokeColor = '#ffffff'; // Priority 2: Selection (Strict White)
       } else if (component) {
           const isSource = !component.parentGroupId;
           const parentIsSelected = component.parentGroupId === aState.selectedComponentId;
           
           if (isSource) {
               strokeColor = component.color; // Priority 3: Source Group Color
           } else {
               // Priority 4: Linked Match Mode
               if (parentIsSelected) {
                   strokeColor = component.color; // Match Linked: Show Color when Parent is Selected
               } else {
                   strokeColor = 'rgba(6, 182, 212, 0.4)'; // Match Unlinked: Option C (Default Entity Color)
               }
           }
       }

       const baseProps = { 
           id: e.id, 
           strokeColor, 
           isGrouped: !!component, 
           isVisible: component ? component.isVisible : true, 
           isSelected,
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
  }, [dState, aState, dxfAnalysis.entityTypeKeyMap]);

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
  }, [dState]);

  // --- 交互函数 (Handlers) ---

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    
    // Clear input value so same file can be imported again
    event.target.value = '';
    
    setIsProcessing(true); setOriginalFileName(file.name);
    mState.setMeasurements([]); mState.setParallelMeasurements([]); mState.setAreaMeasurements([]); mState.setCurveMeasurements([]);
    dState.setManualOriginCAD(null); dState.setCalibrationData(null); setViewTransform(null);
    dState.setFeatureROI([]); dState.setDxfEntities([]); dState.setDxfComponents([]);
    dState.setAiFeatureGroups([]); 
    aState.clearAllSelections();
    aState.setInspectComponentId(null);
    
    // Clear selection points on upload
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

  // --- Effects ---

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
