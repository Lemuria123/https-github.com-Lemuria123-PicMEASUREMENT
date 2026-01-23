
import React, { useState, useEffect, useMemo, useRef } from 'react';
import DxfParser from 'dxf-parser';
import { 
  Point, AppMode, ViewTransform, DxfEntity, DxfComponent, 
  DxfEntityType
} from '../types';
import { generateId } from '../utils';
import { 
  identityMatrix, multiplyMatrix, transformPoint, 
  checkEntityHit, type Matrix2D 
} from '../utils/matrixUtils';

import { useMeasurementState } from './useMeasurementState';
import { useAnalysisState } from './useAnalysisState';
import { useDomainData } from './useDomainData';
import { useDxfAnalysis } from './useDxfAnalysis';
import { useAiAnalysis } from './useAiAnalysis';
import { useInteractionLogic } from './useInteractionLogic';
import { useDxfOverlay } from './useDxfOverlay';
import { useAiOverlay } from './useAiOverlay';
import { useKeyboardNudge } from './useKeyboardNudge';
import { useProjectPersistence } from './useProjectPersistence';
import { useShapeFinisher } from './useShapeFinisher';

export function useAppLogic() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [mode, setMode] = useState<AppMode>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [originalFileName, setOriginalFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [mouseNormPos, setMouseNormPos] = useState<Point | null>(null);
  const [viewTransform, setViewTransform] = useState<ViewTransform | null>(null);

  const mState = useMeasurementState();
  const aState = useAnalysisState();
  const dState = useDomainData();

  const [promptState, setPromptState] = useState<{
    isOpen: boolean; title: string; description?: string; defaultValue: string;
    defaultUnit?: string; showUnitSelector?: boolean; hideInput?: boolean;
    onConfirm: (val: string, unit?: string) => void;
  }>({ isOpen: false, title: '', defaultValue: '', onConfirm: () => {} });

  const persistence = useProjectPersistence({
    originalFileName, setOriginalFileName, dState, mState, aState, 
    mode, setMode, viewTransform, setViewTransform, setImageSrc
  });

  const dxfAnalysis = useDxfAnalysis({ dState, aState, setIsProcessing, setMode, setPromptState });
  const aiAnalysis = useAiAnalysis({ imageSrc, dState, aState });
  const interaction = useInteractionLogic({ mode, setMode, dState, mState, aState, setPromptState, imgDimensions: dState.imgDimensions });

  const finisher = useShapeFinisher({
    mode, setMode, currentPoints: interaction.currentPoints, setCurrentPoints: interaction.setCurrentPoints,
    dState, mState, aState, setPromptState
  });

  useKeyboardNudge({ currentPoints: interaction.currentPoints, setCurrentPoints: interaction.setCurrentPoints, getScaleInfo: dState.getScaleInfo, imgDimensions: dState.imgDimensions });

  const uiBase = useMemo(() => (!dState.imgDimensions ? 1.5 : Math.min(dState.imgDimensions.width, dState.imgDimensions.height) / 500), [dState.imgDimensions]);

  const dxfOverlayEntities = useDxfOverlay({
    rawDxfData: dState.rawDxfData, dxfEntities: dState.dxfEntities, dxfComponents: dState.dxfComponents,
    selectedComponentId: aState.selectedComponentId, hoveredComponentId: aState.hoveredComponentId,
    hoveredEntityId: aState.hoveredEntityId, hoveredObjectGroupKey: aState.hoveredObjectGroupKey,
    selectedInsideEntityIds: aState.selectedInsideEntityIds, entityTypeKeyMap: dxfAnalysis.entityTypeKeyMap
  });

  const aiOverlayEntities = useAiOverlay({ aiFeatureGroups: dState.aiFeatureGroups, selectedAiGroupId: aState.selectedAiGroupId, hoveredFeatureId: aState.hoveredFeatureId, uiBase, scale: viewTransform?.scale || 1 });

  // --- 坐标悬停检测逻辑 (优化版：多级优先级评分) ---
  useEffect(() => {
    if (!mouseNormPos || !dState.imgDimensions) { 
        aState.setHoveredComponentId(null); 
        aState.setHoveredFeatureId(null); 
        return; 
    }
    
    const isDxfMode = ['dxf_analysis', 'box_rect', 'box_poly', 'box_find_roi', 'manual_weld'].includes(mode);
    const isAiMode = ['feature_analysis', 'feature'].includes(mode);
    
    if (isDxfMode && dState.rawDxfData) {
      const { minX, maxY, totalW, totalH, padding } = dState.rawDxfData;
      if (totalW <= 0 || totalH <= 0) return;
      
      const cadX = (mouseNormPos.x * totalW) + (minX - padding);
      const cadY = (maxY + padding) - (mouseNormPos.y * totalH);
      const hitThreshold = (10 / (viewTransform?.scale || 1)) * (totalW / 1000); 
      
      let bestCompId: string | null = null;
      let minCompScore = Infinity; 

      dState.dxfComponents.forEach((c: DxfComponent) => {
        if (!c.isVisible || !c.bounds) return;
        
        // 1. 基础碰撞判定
        let isHit = false;
        if (c.isManual && c.entityIds.length === 0) {
            const dist = Math.sqrt(Math.pow(cadX - c.centroid.x, 2) + Math.pow(cadY - c.centroid.y, 2));
            if (dist < hitThreshold * 2.5) isHit = true; 
        } else {
            // 矩形检测 + 距离冗余
            if (cadX >= c.bounds.minX - hitThreshold && cadX <= c.bounds.maxX + hitThreshold && 
                cadY >= c.bounds.minY - hitThreshold && cadY <= c.bounds.maxY + hitThreshold) {
                isHit = true;
            }
        }

        if (isHit) {
            const area = (c.bounds.maxX - c.bounds.minX) * (c.bounds.maxY - c.bounds.minY);
            const distToCenter = Math.sqrt(Math.pow(cadX - c.centroid.x, 2) + Math.pow(cadY - c.centroid.y, 2));
            
            /**
             * 评分逻辑优化：分值越低，优先级越高
             * 基础分 = 面积权值 + 距离权值
             */
            let score = (area * 1000) + distToCenter;

            // --- 优先级调整 (Priority Layers) ---

            // Layer A (Highest): 是否属于当前选中的组件或其关联的 Matches
            const isSelectedGroup = (c.id === aState.selectedComponentId || c.parentGroupId === aState.selectedComponentId);
            if (isSelectedGroup) {
                score -= 1e15; // 绝对优先权
            }

            // Layer B: 显式标记为 Weld 或 Mark 的组件 (即使没有选中)
            if (c.isWeld || c.isMark) {
                score -= 1e12; // 较高优先权，确保能在密集实体中穿透
            }

            // Layer C: 拾取深度 (如果正在检查某个组，该组内部成员优先)
            if (aState.inspectComponentId === c.id || aState.inspectMatchesParentId === c.parentGroupId) {
                score -= 1e10;
            }

            if (score < minCompScore) { 
                minCompScore = score; 
                bestCompId = c.id; 
            }
        }
      });
      aState.setHoveredComponentId(bestCompId);
    } 
    else if (isAiMode) {
      const hitThresholdNorm = 0.01 / (viewTransform?.scale || 1);
      let bestFeatureId: string | null = null;
      let minScore = Infinity;
      
      dState.aiFeatureGroups.forEach((g: any) => {
        if (!g.isVisible) return;
        g.features.forEach((f: any) => {
            if (mouseNormPos.x >= f.minX - hitThresholdNorm && mouseNormPos.x <= f.maxX + hitThresholdNorm && 
                mouseNormPos.y >= f.minY - hitThresholdNorm && mouseNormPos.y <= f.maxY + hitThresholdNorm) {
                
                const area = (f.maxX - f.minX) * (f.maxY - f.minY);
                const dist = Math.sqrt(Math.pow(mouseNormPos.x - (f.minX+f.maxX)/2, 2) + Math.pow(mouseNormPos.y - (f.minY+f.maxY)/2, 2));
                
                let score = area * 1000 + dist;
                
                // 同样为选中的 AI 组提供优先级
                if (g.id === aState.selectedAiGroupId) {
                    score -= 1e12;
                }
                if (g.isWeld || g.isMark) {
                    score -= 1e10;
                }

                if (score < minScore) { 
                    minScore = score; 
                    bestFeatureId = f.id; 
                }
            }
        });
      });
      aState.setHoveredFeatureId(bestFeatureId);
    }
  }, [mouseNormPos, dState.dxfComponents, dState.aiFeatureGroups, mode, viewTransform?.scale, aState.selectedComponentId, aState.selectedAiGroupId, aState.inspectComponentId, aState.inspectMatchesParentId]);

  const originCanvasPos = useMemo(() => {
    if (dState.rawDxfData) {
        const { minX, maxY, totalW, totalH, padding, defaultCenterX, defaultCenterY } = dState.rawDxfData;
        const tx = dState.manualOriginCAD ? dState.manualOriginCAD.x : defaultCenterX; 
        const ty = dState.manualOriginCAD ? dState.manualOriginCAD.y : defaultCenterY;
        return { x: (tx - (minX - padding)) / totalW, y: ((maxY + padding) - ty) / totalH };
    }
    if (dState.calibrationData && dState.manualOriginCAD && dState.imgDimensions) {
        const scaleInfo = dState.getScaleInfo();
        if (scaleInfo) return { x: dState.manualOriginCAD.x / scaleInfo.totalWidthMM, y: dState.manualOriginCAD.y / scaleInfo.totalHeightMM };
    }
    return null;
  }, [dState.rawDxfData, dState.manualOriginCAD, dState.calibrationData, dState.imgDimensions, dState.getScaleInfo]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    event.target.value = ''; setIsProcessing(true); setOriginalFileName(file.name);
    mState.setMeasurements([]); mState.setParallelMeasurements([]); mState.setAreaMeasurements([]); mState.setCurveMeasurements([]);
    dState.setManualOriginCAD(null); dState.setCalibrationData(null); setViewTransform(null);
    dState.setDxfEntities([]); dState.setDxfComponents([]); dState.setAiFeatureGroups([]); 
    aState.clearAllSelections(); interaction.setCurrentPoints([]);

    if (file.name.toLowerCase().endsWith('.dxf')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parser = new DxfParser(); const dxf = parser.parseSync(e.target?.result as string);
          if (dxf) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            const parsedEntities: DxfEntity[] = []; const circles: any[] = [];
            const processEntities = (entities: any[], transform: Matrix2D) => {
              if (!entities) return;
              entities.forEach((entity: any) => {
                if (entity.type === 'INSERT' && dxf.blocks?.[entity.name]?.entities) {
                    const block = dxf.blocks[entity.name];
                    const px = entity.position?.x || 0, py = entity.position?.y || 0;
                    const rot = (entity.rotation || 0) * Math.PI / 180;
                    const sx = entity.scale?.x ?? 1, sy = entity.scale?.y ?? 1;
                    const cos = Math.cos(rot), sin = Math.sin(rot);
                    const a = sx * cos, b = sx * sin, c = -sy * sin, d = sy * cos;
                    const tx = px - (a * (block.position?.x || 0) + c * (block.position?.y || 0)), ty = py - (b * (block.position?.x || 0) + d * (block.position?.y || 0));
                    processEntities(block.entities, multiplyMatrix(transform, { a, b, c, d, tx, ty }));
                    return;
                }
                let type: DxfEntityType = 'UNKNOWN', entBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 }, isValid = false;
                const rawEntity = { ...entity };
                if (entity.type === 'LINE') { type = 'LINE'; rawEntity.vertices = entity.vertices.map((v: any) => transformPoint(v.x, v.y, transform)); entBounds = { minX: Math.min(rawEntity.vertices[0].x, rawEntity.vertices[1].x), maxX: Math.max(rawEntity.vertices[0].x, rawEntity.vertices[1].x), minY: Math.min(rawEntity.vertices[0].y, rawEntity.vertices[1].y), maxY: Math.max(rawEntity.vertices[0].y, rawEntity.vertices[1].y) }; isValid = true; } 
                else if (entity.type === 'CIRCLE') { type = 'CIRCLE'; rawEntity.center = transformPoint(entity.center.x, entity.center.y, transform); rawEntity.radius = entity.radius * Math.sqrt(transform.a * transform.a + transform.b * transform.b); const r = rawEntity.radius; entBounds = { minX: rawEntity.center.x - r, maxX: rawEntity.center.x + r, minY: rawEntity.center.y - r, maxY: rawEntity.center.y + r }; isValid = true; circles.push(rawEntity); } 
                else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') { type = 'LWPOLYLINE'; rawEntity.vertices = entity.vertices.map((v: any) => transformPoint(v.x, v.y, transform)); const xs = rawEntity.vertices.map((v:any) => v.x), ys = rawEntity.vertices.map((v:any) => v.y); entBounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }; isValid = true; } 
                else if (entity.type === 'ARC') { type = 'ARC'; rawEntity.center = transformPoint(entity.center.x, entity.center.y, transform); rawEntity.radius = entity.radius * Math.sqrt(transform.a * transform.a + transform.b * transform.b); rawEntity.startAngle = entity.startAngle + Math.atan2(transform.b, transform.a); rawEntity.endAngle = entity.endAngle + Math.atan2(transform.b, transform.a); const r = rawEntity.radius; entBounds = { minX: rawEntity.center.x - r, maxX: rawEntity.center.x + r, minY: rawEntity.center.y - r, maxY: rawEntity.center.y + r }; isValid = true; }
                if (isValid) { minX = Math.min(minX, entBounds.minX); minY = Math.min(minY, entBounds.minY); maxX = Math.max(maxX, entBounds.maxX); maxY = Math.max(maxY, entBounds.maxY); parsedEntities.push({ id: generateId(), type, layer: entity.layer || '0', minX: entBounds.minX, minY: entBounds.minY, maxX: entBounds.maxX, maxY: entBounds.maxY, rawEntity }); }
              });
            };
            processEntities(dxf.entities, identityMatrix); dState.setDxfEntities(parsedEntities);
            const w = maxX - minX, h = maxY - minY, pad = w * 0.05 || 10;
            dState.setRawDxfData({ circles, defaultCenterX: (minX + maxX) / 2, defaultCenterY: (minY + maxY) / 2, minX, maxX, maxY, totalW: w + pad * 2, totalH: h + pad * 2, padding: pad });
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX - pad} ${-maxY - pad} ${w + pad * 2} ${h + pad * 2}" width="1000" height="${(h/w)*1000}" style="background: #111;"></svg>`;
            setImageSrc(URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })));
            dState.setCalibrationData({ start: { x: pad/(w+pad*2), y: 0.5 }, end: { x: (w+pad)/(w+pad*2), y: 0.5 }, realWorldDistance: w, unit: 'mm' });
            setMode('dxf_analysis');
          }
        } catch(err) { alert("DXF Parse Fail"); }
        setIsProcessing(false);
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader(); reader.onload = (e) => { setImageSrc(e.target?.result as string); dState.setRawDxfData(null); setMode('calibrate'); setIsProcessing(false); }; reader.readAsDataURL(file);
    }
  };

  const toggleEntityInSelection = (id: string) => aState.setSelectedInsideEntityIds((prev: Set<string>) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return {
    imageSrc, setImageSrc, mode, setMode, isProcessing, setIsProcessing, originalFileName, setOriginalFileName, fileInputRef, mouseNormPos, setMouseNormPos, viewTransform, setViewTransform,
    mState, aState, dState, promptState, setPromptState, dxfOverlayEntities, aiOverlayEntities, originCanvasPos, handleFileUpload, toggleEntityInSelection,
    ...persistence, ...dxfAnalysis, ...aiAnalysis, ...interaction, ...finisher
  };
}
