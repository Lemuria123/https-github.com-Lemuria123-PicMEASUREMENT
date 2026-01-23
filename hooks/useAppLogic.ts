
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import DxfParser from 'dxf-parser';
import { 
  Point, AppMode, ViewTransform, DxfEntity, DxfComponent, 
  DxfEntityType, ProjectConfig, AiFeatureGroup, FeatureResult 
} from '../types';
import { generateId, getRandomColor } from '../utils';
import { saveProjectConfig, loadProjectConfig } from '../utils/configUtils';

import { useMeasurementState } from './useMeasurementState';
import { useAnalysisState } from './useAnalysisState';
import { useDomainData } from './useDomainData';
import { useDxfAnalysis } from './useDxfAnalysis';
import { useAiAnalysis } from './useAiAnalysis';
import { useInteractionLogic } from './useInteractionLogic';
import { useDxfOverlay } from './useDxfOverlay';
import { useAiOverlay } from './useAiOverlay';

// Matrix Helper Types & Functions
type Matrix2D = { a: number, b: number, c: number, d: number, tx: number, ty: number };
const identityMatrix: Matrix2D = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

const multiplyMatrix = (m1: Matrix2D, m2: Matrix2D): Matrix2D => ({
  a: m1.a * m2.a + m1.c * m2.b,
  b: m1.b * m2.a + m1.d * m2.b,
  c: m1.a * m2.c + m1.c * m2.d,
  d: m1.b * m2.c + m1.d * m2.d,
  tx: m1.a * m2.tx + m1.c * m2.ty + m1.tx,
  ty: m1.b * m2.tx + m1.d * m2.ty + m1.ty
});

const transformPoint = (x: number, y: number, m: Matrix2D) => ({
  x: m.a * x + m.c * y + m.tx,
  y: m.b * x + m.d * y + m.ty
});

const isPointInPolygon = (px: number, py: number, vertices: {x: number, y: number}[], eps: number = 1e-9) => {
    if (!vertices || vertices.length < 3) return false;
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const xi = vertices[i].x, yi = vertices[i].y;
        const xj = vertices[j].x, yj = vertices[j].y;
        const onEdge = (Math.abs((yj - yi) * px - (xj - xi) * py + xj * yi - yj * xi) < eps) &&
                       (px >= Math.min(xi, xj) - eps && px <= Math.max(xi, xj) + eps) &&
                       (py >= Math.min(yi, yj) - eps && py <= Math.max(yi, yj) + eps);
        if (onEdge) return true;
        const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

const checkEntityHit = (px: number, py: number, ent: DxfEntity, threshold: number): boolean => {
    const raw = ent.rawEntity;
    if (!raw) return false;
    let dist = Infinity;
    if (ent.type === 'LINE') {
        const v = raw.vertices;
        if (!v || v.length < 2) return false;
        const x1 = v[0].x, y1 = v[0].y, x2 = v[1].x, y2 = v[1].y;
        const l2 = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
        if (l2 === 0) dist = Math.sqrt(Math.pow(px - x1, 2) + Math.pow(py - x1, 2));
        else {
            let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
            t = Math.max(0, Math.min(1, t));
            dist = Math.sqrt(Math.pow(px - (x1 + t * (x2 - x1)), 2) + Math.pow(py - (y1 + t * (y2 - y1)), 2));
        }
    } else if (ent.type === 'CIRCLE') {
        if (!raw.center) return false;
        const distToCenter = Math.sqrt(Math.pow(px - raw.center.x, 2) + Math.pow(py - raw.center.y, 2));
        if (distToCenter <= (raw.radius || 0)) return true;
        dist = Math.abs(distToCenter - (raw.radius || 0));
    } else if (ent.type === 'LWPOLYLINE') {
        const v = raw.vertices;
        if (!v || v.length < 2) return false;
        if (v.length > 2) {
            const isClosed = raw.shape || (
                Math.abs(v[0].x - v[v.length-1].x) < 0.001 &&
                Math.abs(v[0].y - v[v.length-1].y) < 0.001
            );
            if (isClosed && isPointInPolygon(px, py, v)) return true;
        }
        for (let i = 0; i < v.length - 1; i++) {
            const x1 = v[i].x, y1 = v[i].y, x2 = v[i+1].x, y2 = v[i+1].y;
            const l2 = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
            let t = l2 === 0 ? 0 : ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
            t = Math.max(0, Math.min(1, t));
            const d = Math.sqrt(Math.pow(px - (x1 + t * (x2 - x1)), 2) + Math.pow(py - (y1 + t * (y2 - y1)), 2));
            if (d < dist) dist = d;
        }
    } else if (ent.type === 'ARC') {
        if (!raw.center) return false;
        const dx = px - raw.center.x, dy = py - raw.center.y;
        const distToCenter = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const normAngle = (angle + Math.PI * 2) % (Math.PI * 2);
        const start = ((raw.startAngle || 0) + Math.PI * 2) % (Math.PI * 2);
        const end = ((raw.endAngle || 0) + Math.PI * 2) % (Math.PI * 2);
        let inRange = start < end ? (normAngle >= start && normAngle <= end) : (normAngle >= start || normAngle <= end);
        if (inRange) dist = Math.abs(distToCenter - (raw.radius || 0));
    }
    return dist < threshold;
};

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
    isOpen: boolean;
    title: string;
    description?: string;
    defaultValue: string;
    defaultUnit?: string;
    showUnitSelector?: boolean;
    hideInput?: boolean;
    onConfirm: (val: string, unit?: string) => void;
  }>({
    isOpen: false, title: '', defaultValue: '', onConfirm: () => {}
  });

  const dxfAnalysis = useDxfAnalysis({ dState, aState, setIsProcessing, setMode, setPromptState });
  const aiAnalysis = useAiAnalysis({ imageSrc, dState, aState });
  const interaction = useInteractionLogic({ 
    mode, setMode, dState, mState, aState, setPromptState, 
    imgDimensions: dState.imgDimensions 
  });

  const uiBase = useMemo(() => {
    if (!dState.imgDimensions) return 1.5;
    return Math.min(dState.imgDimensions.width, dState.imgDimensions.height) / 500;
  }, [dState.imgDimensions]);

  const dxfOverlayEntities = useDxfOverlay({
    rawDxfData: dState.rawDxfData,
    dxfEntities: dState.dxfEntities,
    dxfComponents: dState.dxfComponents,
    selectedComponentId: aState.selectedComponentId,
    hoveredComponentId: aState.hoveredComponentId,
    hoveredEntityId: aState.hoveredEntityId,
    hoveredObjectGroupKey: aState.hoveredObjectGroupKey,
    selectedInsideEntityIds: aState.selectedInsideEntityIds,
    entityTypeKeyMap: dxfAnalysis.entityTypeKeyMap
  });

  const aiOverlayEntities = useAiOverlay({
    aiFeatureGroups: dState.aiFeatureGroups,
    selectedAiGroupId: aState.selectedAiGroupId,
    hoveredFeatureId: aState.hoveredFeatureId,
    uiBase,
    scale: viewTransform?.scale || 1
  });

  // Keyboard Nudge Logic
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (interaction.currentPoints.length === 0) return;
        e.preventDefault();
        
        const scaleInfo = dState.getScaleInfo();
        const nudgeAmount = e.shiftKey ? 10 : 1;
        const stepBase = (scaleInfo ? 0.01 : 1) * nudgeAmount;
        const dx = (e.key === 'ArrowLeft' ? -stepBase : e.key === 'ArrowRight' ? stepBase : 0);
        const dy = (e.key === 'ArrowUp' ? -stepBase : e.key === 'ArrowDown' ? stepBase : 0);

        const lastIdx = interaction.currentPoints.length - 1;
        const lastPt = interaction.currentPoints[lastIdx];
        
        let normDx = dx;
        let normDy = dy;
        if (scaleInfo && dState.imgDimensions) {
            normDx = dx / scaleInfo.totalWidthMM;
            normDy = dy / scaleInfo.totalHeightMM;
        } else if (dState.imgDimensions) {
            normDx = dx / dState.imgDimensions.width;
            normDy = dy / dState.imgDimensions.height;
        }

        interaction.setCurrentPoints(prev => {
            const next = [...prev];
            next[lastIdx] = { 
                x: Math.max(0, Math.min(1, lastPt.x + normDx)), 
                y: Math.max(0, Math.min(1, lastPt.y + normDy)) 
            };
            return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [interaction.currentPoints, dState]);

  useEffect(() => {
    if (!mouseNormPos || !dState.imgDimensions) {
        aState.setHoveredComponentId(null);
        aState.setHoveredFeatureId(null);
        return;
    }
    const isDxfMode = mode === 'dxf_analysis' || mode === 'box_rect' || mode === 'box_poly' || mode === 'box_find_roi' || mode === 'manual_weld';
    const isAiMode = mode === 'feature_analysis' || mode === 'feature';
    if (isDxfMode && dState.rawDxfData) {
      const { minX, maxY, totalW, totalH, padding } = dState.rawDxfData;
      if (totalW <= 0 || totalH <= 0) return;
      const cadX = (mouseNormPos.x * totalW) + (minX - padding);
      const cadY = (maxY + padding) - (mouseNormPos.y * totalH);
      const hitThreshold = (10 / (viewTransform?.scale || 1)) * (totalW / 1000); 
      const selectedFamilyIds = new Set<string>();
      if (aState.selectedComponentId) {
          const selComp = dState.dxfComponents.find((c: DxfComponent) => c.id === aState.selectedComponentId);
          const rootId = selComp?.parentGroupId || aState.selectedComponentId;
          selectedFamilyIds.add(rootId);
          dState.dxfComponents.forEach((c: DxfComponent) => {
              if (c.parentGroupId === rootId) selectedFamilyIds.add(c.id);
          });
      }
      let bestCompId: string | null = null;
      let minCompScore = Infinity; 
      dState.dxfComponents.forEach((c: DxfComponent) => {
        if (!c.isVisible || !c.bounds) return;
        let isHit = false;
        
        // --- 核心优化：手动点位（精密准星）悬停判定 ---
        if (c.isManual && c.entityIds.length === 0) {
            const distToPoint = Math.sqrt(Math.pow(cadX - c.centroid.x, 2) + Math.pow(cadY - c.centroid.y, 2));
            // 准星变小，热区也相应收缩，保持在屏幕上约 20-25px 的有效判定范围
            if (distToPoint < hitThreshold * 2.5) isHit = true; 
        } else if (c.parentGroupId && c.rotation !== undefined) {
            const dx = cadX - c.centroid.x;
            const dy = cadY - c.centroid.y;
            const angle = -c.rotation; 
            const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
            const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
            const seed = dState.dxfComponents.find((s: DxfComponent) => s.id === c.parentGroupId);
            if (seed && seed.bounds) {
                const halfW = (seed.bounds.maxX - seed.bounds.minX) / 2 + hitThreshold;
                const halfH = (seed.bounds.maxY - seed.bounds.minY) / 2 + hitThreshold;
                if (Math.abs(localX) <= halfW && Math.abs(localY) <= halfH) isHit = true;
            }
        } 
        
        if (!isHit && c.bounds) {
            if (cadX >= c.bounds.minX - hitThreshold && cadX <= c.bounds.maxX + hitThreshold &&
                cadY >= c.bounds.minY - hitThreshold && cadY <= c.bounds.maxY + hitThreshold) {
                if (c.entityIds.length > 1 || (c.childGroupIds?.length || 0) > 0) {
                    isHit = true;
                } else {
                    c.entityIds.forEach(eid => {
                        if (isHit) return;
                        const ent = dState.dxfEntities.find(e => e.id === eid);
                        if (ent && checkEntityHit(cadX, cadY, ent, hitThreshold)) isHit = true;
                    });
                }
            }
        }

        if (isHit && c.bounds) {
            const area = (c.bounds.maxX - c.bounds.minX) * (c.bounds.maxY - c.bounds.minY);
            const distToCenter = Math.sqrt(Math.pow(cadX - c.centroid.x, 2) + Math.pow(cadY - c.centroid.y, 2));
            let score = area * 1000 + distToCenter;
            if (selectedFamilyIds.has(c.id)) score -= 1e12; 
            if (score < minCompScore) { minCompScore = score; bestCompId = c.id; }
        }
      });
      aState.setHoveredComponentId(bestCompId);
      aState.setHoveredEntityId(null);
    } else if (isAiMode) {
      const hitThresholdNorm = 0.01 / (viewTransform?.scale || 1);
      const selectedAiFamilyIds = new Set<string>();
      if (aState.selectedAiGroupId) {
          const selGroup = dState.aiFeatureGroups.find((g: AiFeatureGroup) => g.id === aState.selectedAiGroupId);
          const rootId = selGroup?.parentGroupId || aState.selectedAiGroupId;
          selectedAiFamilyIds.add(rootId);
          dState.aiFeatureGroups.forEach((g: AiFeatureGroup) => {
              if (g.parentGroupId === rootId) selectedAiFamilyIds.add(g.id);
          });
      }
      let bestFeatureId: string | null = null;
      let minScore = Infinity;
      dState.aiFeatureGroups.forEach((g: AiFeatureGroup) => {
        if (!g.isVisible) return;
        g.features.forEach(f => {
            if (mouseNormPos.x >= f.minX - hitThresholdNorm && mouseNormPos.x <= f.maxX + hitThresholdNorm &&
                mouseNormPos.y >= f.minY - hitThresholdNorm && mouseNormPos.y <= f.maxY + hitThresholdNorm) {
                const area = (f.maxX - f.minX) * (f.maxY - f.minY);
                const cx = (f.minX + f.maxX) / 2, cy = (f.minY + f.maxY) / 2;
                const dist = Math.sqrt(Math.pow(mouseNormPos.x - cx, 2) + Math.pow(mouseNormPos.y - cy, 2));
                let score = area * 1000 + dist;
                if (selectedAiFamilyIds.has(g.id)) score -= 1e12; 
                if (score < minScore) { minScore = score; bestFeatureId = f.id; }
            }
        });
      });
      aState.setHoveredFeatureId(bestFeatureId);
      aState.setHoveredComponentId(null);
    } else {
      aState.setHoveredComponentId(null);
      aState.setHoveredFeatureId(null);
    }
  }, [mouseNormPos, dState.dxfComponents, dState.aiFeatureGroups, dState.rawDxfData, mode, viewTransform?.scale, aState.selectedComponentId, aState.selectedAiGroupId]);

  const saveProject = useCallback(() => {
    const config: ProjectConfig = {
      version: '1.0', 
      originalFileName, 
      calibrationData: dState.calibrationData, 
      manualOriginCAD: dState.manualOriginCAD,
      measurements: mState.measurements, 
      parallelMeasurements: mState.parallelMeasurements, 
      areaMeasurements: mState.areaMeasurements,
      curveMeasurements: mState.curveMeasurements, 
      dxfComponents: dState.dxfComponents, 
      dxfEntities: dState.dxfEntities, 
      rawDxfData: dState.rawDxfData,   
      aiFeatureGroups: dState.aiFeatureGroups,
      mode, 
      viewTransform
    };
    saveProjectConfig(originalFileName, config);
    aState.setMatchStatus({ text: "Project Configuration Saved", type: 'success' });
  }, [originalFileName, dState, mState, mode, viewTransform, aState]);

  const loadProject = useCallback(async (file: File) => {
    try {
      const config = await loadProjectConfig(file);
      if (config.originalFileName) setOriginalFileName(config.originalFileName);
      if (config.calibrationData) dState.setCalibrationData(config.calibrationData);
      if (config.manualOriginCAD) dState.setManualOriginCAD(config.manualOriginCAD);
      if (config.measurements) mState.setMeasurements(config.measurements);
      if (config.parallelMeasurements) mState.setParallelMeasurements(config.parallelMeasurements);
      if (config.areaMeasurements) mState.setAreaMeasurements(config.areaMeasurements);
      if (config.curveMeasurements) mState.setCurveMeasurements(config.curveMeasurements);
      if (config.dxfComponents) dState.setDxfComponents(config.dxfComponents);
      if (config.dxfEntities) dState.setDxfEntities(config.dxfEntities); 
      if (config.aiFeatureGroups) dState.setAiFeatureGroups(config.aiFeatureGroups);
      if (config.viewTransform) setViewTransform(config.viewTransform);
      if (config.rawDxfData) {
        dState.setRawDxfData(config.rawDxfData);
        const { minX, maxY, totalW, totalH, padding } = config.rawDxfData;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX - padding} ${-maxY - padding} ${totalW} ${totalH}" width="1000" height="${(totalH/totalW)*1000}" style="background: #111;"></svg>`;
        setImageSrc(URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })));
      }
      
      // 核心修复：重载项目后根据数据类型强制切换模式和页签
      if (config.rawDxfData || (config.dxfComponents && config.dxfComponents.length > 0)) {
        setMode('dxf_analysis');
        aState.setAnalysisTab('components');
      } else if (config.aiFeatureGroups && config.aiFeatureGroups.length > 0) {
        setMode('feature_analysis');
      } else if (config.mode) {
        setMode(config.mode);
      }
      
      aState.setMatchStatus({ text: "Project Configuration Reloaded", type: 'success' });
    } catch (err: any) { 
      aState.setMatchStatus({ text: `Reload failed: ${err.message}`, type: 'info' }); 
    }
  }, [dState, mState, aState, setImageSrc, setMode, setOriginalFileName, setViewTransform]);

  const originCanvasPos = useMemo(() => {
    if (dState.rawDxfData) {
        const { defaultCenterX, defaultCenterY, minX, maxY, totalW, totalH, padding } = dState.rawDxfData;
        if (!totalW || !totalH) return null;
        const tx = dState.manualOriginCAD ? dState.manualOriginCAD.x : defaultCenterX; const ty = dState.manualOriginCAD ? dState.manualOriginCAD.y : defaultCenterY;
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
    dState.setFeatureROI([]); dState.setDxfEntities([]); dState.setDxfComponents([]);
    dState.setAiFeatureGroups([]); aState.clearAllSelections(); aState.setInspectComponentId(null);
    interaction.setCurrentPoints([]);
    setMouseNormPos(null);
    if (file.name.toLowerCase().endsWith('.dxf')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parser = new DxfParser(); const dxf = parser.parseSync(e.target?.result as string);
          if (dxf) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            const circles: any[] = []; const parsedEntities: DxfEntity[] = [];
            const processEntities = (entities: any[], transform: Matrix2D) => {
              if (!entities) return;
              entities.forEach((entity: any) => {
                if (entity.type === 'INSERT') {
                  if (dxf.blocks && entity.name && dxf.blocks[entity.name]) {
                    const block = dxf.blocks[entity.name];
                    if (block.entities) {
                       const px = entity.position?.x || 0; const py = entity.position?.y || 0;
                       const rotRad = (entity.rotation || 0) * Math.PI / 180;
                       const sx = entity.scale?.x ?? 1; const sy = entity.scale?.y ?? 1;
                       const bx = block.position?.x || 0; const by = block.position?.y || 0;
                       const cos = Math.cos(rotRad); const sin = Math.sin(rotRad);
                       const a = sx * cos, b = sx * sin, c = -sy * sin, d = sy * cos;
                       const tx = px - (a * bx + c * by), ty = py - (b * bx + d * by);
                       processEntities(block.entities, multiplyMatrix(transform, { a, b, c, d, tx, ty }));
                    }
                  }
                  return;
                }
                let type: DxfEntityType = 'UNKNOWN'; let entBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 }; let isValid = false; let rawEntity = { ...entity };
                if (entity.type === 'LINE') { 
                  type = 'LINE'; rawEntity.vertices = entity.vertices.map((v: any) => transformPoint(v.x, v.y, transform));
                  const xs = rawEntity.vertices.map((v:any) => v.x), ys = rawEntity.vertices.map((v:any) => v.y); 
                  entBounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }; isValid = true; 
                } else if (entity.type === 'CIRCLE') { 
                  type = 'CIRCLE'; rawEntity.center = transformPoint(entity.center.x, entity.center.y, transform);
                  const sVecX = Math.sqrt(transform.a * transform.a + transform.b * transform.b); 
                  const sVecY = Math.sqrt(transform.c * transform.c + transform.d * transform.d); 
                  rawEntity.radius = entity.radius * ((sVecX + sVecY) / 2);
                  const r = rawEntity.radius; entBounds = { minX: rawEntity.center.x - r, maxX: rawEntity.center.x + r, minY: rawEntity.center.y - r, maxY: rawEntity.center.y + r }; 
                  isValid = true; circles.push(rawEntity); 
                } else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') { 
                  type = 'LWPOLYLINE'; rawEntity.vertices = entity.vertices.map((v: any) => transformPoint(v.x, v.y, transform));
                  const xs = rawEntity.vertices.map((v:any) => v.x), ys = rawEntity.vertices.map((v:any) => v.y); 
                  entBounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }; isValid = true; 
                } else if (entity.type === 'ARC') { 
                  type = 'ARC'; rawEntity.center = transformPoint(entity.center.x, entity.center.y, transform);
                  rawEntity.radius = entity.radius * (Math.sqrt(transform.a * transform.a + transform.b * transform.b));
                  const matrixRot = Math.atan2(transform.b, transform.a);
                  rawEntity.startAngle = entity.startAngle + matrixRot; rawEntity.endAngle = entity.endAngle + matrixRot;
                  const r = rawEntity.radius; entBounds = { minX: rawEntity.center.x - r, maxX: rawEntity.center.x + r, minY: rawEntity.center.y - r, maxY: rawEntity.center.y + r }; isValid = true; 
                }
                if (isValid) {
                    minX = Math.min(minX, entBounds.minX); minY = Math.min(minY, entBounds.minY); maxX = Math.max(maxX, entBounds.maxX); maxY = Math.max(maxY, entBounds.maxY);
                    parsedEntities.push({ id: generateId(), type, layer: entity.layer || '0', minX: entBounds.minX, minY: entBounds.minY, maxX: entBounds.maxX, maxY: entBounds.maxY, rawEntity });
                }
              });
            };
            processEntities(dxf.entities, identityMatrix);
            dState.setDxfEntities(parsedEntities);
            const width = maxX - minX, height = maxY - minY;
            const validWidth = isFinite(width) ? width : 1000;
            const padding = validWidth * 0.05 || 10;
            const totalW = validWidth + padding * 2, totalH = height + padding * 2;
            dState.setRawDxfData({ circles, defaultCenterX: (minX + maxX) / 2, defaultCenterY: (minY + maxY) / 2, minX, maxX, maxY, totalW, totalH, padding });
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX - padding} ${-maxY - padding} ${totalW} ${totalH}" width="1000" height="${(totalH/totalW)*1000}" style="background: #111;"></svg>`;
            setImageSrc(URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })));
            dState.setCalibrationData({ start: { x: padding/totalW, y: 0.5 }, end: { x: (validWidth+padding)/totalW, y: 0.5 }, realWorldDistance: validWidth, unit: 'mm' });
            
            // 优化：初次上传 DXF 默认进入分析模式
            setMode('dxf_analysis'); 
            aState.setAnalysisTab('components');
          }
        } catch(err) { alert("Fail DXF"); } setIsProcessing(false);
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader(); reader.onload = (e) => { setImageSrc(e.target?.result as string); dState.setRawDxfData(null); setMode('calibrate'); setIsProcessing(false); }; reader.readAsDataURL(file);
    }
  };

  const toggleEntityInSelection = (id: string) => aState.setSelectedInsideEntityIds((prev: Set<string>) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  useEffect(() => {
     if (!originalFileName) return;
     const t = setTimeout(() => { localStorage.setItem('mark_weld_last_session', JSON.stringify({ fileName: originalFileName, manualOriginCAD: dState.manualOriginCAD, viewTransform })); }, 500);
     return () => clearTimeout(t);
  }, [originalFileName, dState.manualOriginCAD, viewTransform]);

  const finishShape = useCallback(() => {
    try {
        const currentPoints = interaction.currentPoints;
        if (currentPoints.length < 1) return;
        
        if (mode === 'calibrate' && currentPoints.length === 2) {
            setPromptState({
              isOpen: true, title: "Calibration", description: "Enter real-world distance.", defaultValue: "10.0", defaultUnit: dState.calibrationData?.unit || 'mm', showUnitSelector: true,
              onConfirm: (val, unit) => {
                const dist = parseFloat(val);
                if (!isNaN(dist) && dist > 0) {
                  dState.setCalibrationData({ start: currentPoints[0], end: currentPoints[1], realWorldDistance: dist, unit: unit || 'mm' });
                  setMode('measure'); interaction.setCurrentPoints([]); setPromptState((p: any) => ({ ...p, isOpen: false }));
                }
              }
            });
            return;
        }

        if (mode === 'measure' && currentPoints.length === 2) {
             mState.setMeasurements((prev) => [...prev, { id: generateId(), start: currentPoints[0], end: currentPoints[1] }]);
             interaction.setCurrentPoints([]);
             return;
        }
        
        if (mode === 'parallel' && currentPoints.length === 3) {
             mState.setParallelMeasurements((prev) => [...prev, { id: generateId(), baseStart: currentPoints[0], baseEnd: currentPoints[1], offsetPoint: currentPoints[2] }]);
             interaction.setCurrentPoints([]);
             return;
        }

        if (mode === 'area' && currentPoints.length > 2) {
             mState.setAreaMeasurements((prev) => [...prev, { id: generateId(), points: currentPoints }]);
             interaction.setCurrentPoints([]);
             return;
        }

        if (mode === 'curve' && currentPoints.length > 1) {
             mState.setCurveMeasurements((prev) => [...prev, { id: generateId(), points: currentPoints }]);
             interaction.setCurrentPoints([]);
             return;
        }

        if (mode === 'box_find_roi' && currentPoints.length === 2) {
            dState.setDxfSearchROI([currentPoints[0], currentPoints[1]]);
            setMode('dxf_analysis');
            interaction.setCurrentPoints([]);
            aState.setMatchStatus({ text: "Find ROI area set successfully.", type: 'success' });
            return;
        }

        if (mode === 'manual_weld' && currentPoints.length === 1) {
            if (!dState.rawDxfData) return;
            const p = currentPoints[0];
            const { minX, maxY, totalW, totalH, padding } = dState.rawDxfData;
            const cadCentroid = { 
                x: (p.x * totalW) + (minX - padding), 
                y: (maxY + padding) - (p.y * totalH) 
            };

            const existingManualSeed = dState.dxfComponents.find((c: DxfComponent) => c.isManual && !c.parentGroupId);

            if (existingManualSeed) {
                const matchCount = dState.dxfComponents.filter((c: DxfComponent) => c.parentGroupId === existingManualSeed.id).length;
                const newInstance: DxfComponent = {
                    id: generateId(), name: `Manual Match ${matchCount + 1}`, isVisible: true, isWeld: true, isMark: false, isManual: true, color: existingManualSeed.color,
                    entityIds: [], seedSize: 1, centroid: cadCentroid, bounds: { minX: cadCentroid.x - 0.01, maxX: cadCentroid.x + 0.01, minY: cadCentroid.y - 0.01, maxY: cadCentroid.y + 0.01 },
                    parentGroupId: existingManualSeed.id, rotation: 0, rotationDeg: 0
                };
                dState.setDxfComponents((prev: DxfComponent[]) => [...prev, newInstance]);
                aState.setMatchStatus({ text: "Added manual weld instance.", type: 'success' });
                interaction.setCurrentPoints([]);
            } else {
                setPromptState({
                  isOpen: true, title: "Manual Weld Group", description: "Create a new manual welding group.", defaultValue: "Manual Weld Seed",
                  onConfirm: (val) => {
                    const newSeed: DxfComponent = {
                        id: generateId(), name: val.trim() || "Manual Weld Seed", isVisible: true, isWeld: true, isMark: false, isManual: true, color: '#10b981',
                        entityIds: [], seedSize: 1, centroid: cadCentroid, bounds: { minX: cadCentroid.x - 0.01, maxX: cadCentroid.x + 0.01, minY: cadCentroid.y - 0.01, maxY: cadCentroid.y + 0.01 },
                        rotation: 0, rotationDeg: 0
                    };
                    dState.setDxfComponents((prev: DxfComponent[]) => [...prev, newSeed]);
                    aState.setSelectedComponentId(newSeed.id); aState.setAnalysisTab('components'); interaction.setCurrentPoints([]); setMode('dxf_analysis');
                    setPromptState((p: any) => ({ ...p, isOpen: false }));
                  }
                });
            }
            return;
        }

        if ((mode === 'box_rect' || mode === 'box_poly') && currentPoints.length >= 2) {
            if (!dState.rawDxfData) return;
            const { minX, maxY, totalW, totalH, padding } = dState.rawDxfData;
            
            const cadVertices = currentPoints.map(p => ({ 
                x: (p.x * totalW) + (minX - padding), 
                y: (maxY + padding) - (p.y * totalH) 
            }));

            let polyMinX = Infinity, polyMaxX = -Infinity, polyMinY = Infinity, polyMaxY = -Infinity;
            cadVertices.forEach(v => { 
                polyMinX = Math.min(polyMinX, v.x); polyMaxX = Math.max(polyMaxX, v.x); 
                polyMinY = Math.min(polyMinY, v.y); polyMaxY = Math.max(polyMaxY, v.y); 
            });

            const isPolygon = mode === 'box_poly';
            const ADAPTIVE_EPS = Math.max(polyMaxX - polyMinX, polyMaxY - polyMinY) * 0.0001;
            
            const isEntityEnclosed = (ent: DxfEntity) => {
                if (ent.minX < polyMinX - ADAPTIVE_EPS || ent.maxX > polyMaxX + ADAPTIVE_EPS || 
                    ent.minY < polyMinY - ADAPTIVE_EPS || ent.maxY > polyMaxY + ADAPTIVE_EPS) return false;
                
                if (!isPolygon) return true;
                const raw = ent.rawEntity;
                if (ent.type === 'CIRCLE') {
                    const r = raw.radius, c = raw.center;
                    const samples = [{ x: c.x, y: c.y }];
                    for (let i = 0; i < 8; i++) {
                        const angle = i * (Math.PI / 4);
                        samples.push({ x: c.x + r * Math.cos(angle), y: c.y + r * Math.sin(angle) });
                    }
                    return samples.every(s => isPointInPolygon(s.x, s.y, cadVertices, ADAPTIVE_EPS));
                } 
                else if (ent.type === 'ARC') {
                    const r = raw.radius, c = raw.center;
                    const sA = raw.startAngle, eA = raw.endAngle;
                    const samples = [];
                    const sweep = ((eA - sA + 2 * Math.PI) % (2 * Math.PI)) || (2 * Math.PI);
                    for (let i = 0; i < 8; i++) {
                        const sweepVal = i / 7;
                        const curA = sA + (sweep * sweepVal);
                        samples.push({ x: c.x + r * Math.cos(curA), y: c.y + r * Math.sin(curA) });
                    }
                    return samples.every(s => isPointInPolygon(s.x, s.y, cadVertices, ADAPTIVE_EPS));
                }
                else if (ent.type === 'LINE' || ent.type === 'LWPOLYLINE') {
                    if (!raw.vertices || raw.vertices.length === 0) return false;
                    return raw.vertices.every((v: any) => isPointInPolygon(v.x, v.y, cadVertices, ADAPTIVE_EPS));
                }
                return false;
            };

            const isComponentEnclosed = (compId: string): boolean => {
                const comp = dState.dxfComponents.find((c: DxfComponent) => c.id === compId);
                if (!comp) return false;
                return comp.entityIds.every(eid => isEntityEnclosed(dState.dxfEntities.find(e => e.id === eid)!)) && 
                       (comp.childGroupIds || []).every(cid => isComponentEnclosed(cid));
            };

            const enclosedGroups = dState.dxfComponents.filter((comp: DxfComponent) => 
                !dState.dxfComponents.some(other => other.id !== comp.id && (other.childGroupIds || []).includes(comp.id)) && 
                isComponentEnclosed(comp.id)
            ).map(c => c.id);

            const handledEntityIds = new Set<string>();
            const collect = (gid: string) => { 
                const c = dState.dxfComponents.find(co => co.id === gid); 
                if(c){ 
                    c.entityIds.forEach(eid => handledEntityIds.add(eid)); 
                    (c.childGroupIds || []).forEach(collect); 
                } 
            };
            enclosedGroups.forEach(collect);
            const enclosedEntities = dState.dxfEntities.filter(ent => !handledEntityIds.has(ent.id) && isEntityEnclosed(ent)).map(e => e.id);

            if (enclosedEntities.length > 0 || enclosedGroups.length > 0) {
                const defaultName = `Area Group ${dState.dxfComponents.length + 1}`;
                setPromptState({
                  isOpen: true, title: "New Group from Selection", description: `Selected ${enclosedEntities.length} entities and ${enclosedGroups.length} existing groups with high precision.`, defaultValue: defaultName,
                  onConfirm: (val) => {
                    const newComponent: DxfComponent = {
                        id: generateId(), name: val.trim() || defaultName, isVisible: true, isWeld: false, isMark: false, color: getRandomColor(),
                        entityIds: enclosedEntities, childGroupIds: enclosedGroups, seedSize: enclosedEntities.length + enclosedGroups.length,
                        centroid: { x: (polyMinX + polyMaxX) / 2, y: (polyMinY + polyMaxY) / 2 }, bounds: { minX: polyMinX, minY: polyMinY, maxX: polyMaxX, maxY: polyMaxY },
                        rotation: 0, rotationDeg: 0
                    };
                    dState.setDxfComponents((prev: DxfComponent[]) => [...prev, newComponent]);
                    aState.setSelectedComponentId(newComponent.id); aState.setAnalysisTab('components'); setMode('dxf_analysis'); interaction.setCurrentPoints([]);
                    setPromptState((p: any) => ({ ...p, isOpen: false }));
                  }
                });
            } else aState.setMatchStatus({ text: "Selection area empty. Adjust your boundaries.", type: 'info' });
            return;
        }

        if (mode === 'origin' && currentPoints.length === 1) {
            const p = currentPoints[0]; const s = dState.getScaleInfo();
            if (s) {
                if (s.isDxf) dState.setManualOriginCAD({ x: p.x * dState.rawDxfData.totalW + dState.rawDxfData.minX - dState.rawDxfData.padding, y: dState.rawDxfData.maxY + dState.rawDxfData.padding - p.y * dState.rawDxfData.totalH });
                else dState.setManualOriginCAD({ x: p.x * s.totalWidthMM, y: p.y * s.totalHeightMM });
                setMode('measure'); 
            }
            interaction.setCurrentPoints([]);
        } else if (mode === 'feature' && currentPoints.length === 2) {
            setPromptState({
                isOpen: true, title: "AI Feature Search Area", description: "Name the visual feature.", defaultValue: `Feature ${dState.aiFeatureGroups.length + 1}`,
                onConfirm: (val) => {
                    const g = { id: generateId(), name: val.trim(), isVisible: true, isWeld: false, isMark: false, color: getRandomColor(), features: [{ id: generateId(), minX: Math.min(currentPoints[0].x, currentPoints[1].x), maxX: Math.max(currentPoints[0].x, currentPoints[1].x), minY: Math.min(currentPoints[0].y, currentPoints[1].y), maxY: Math.max(currentPoints[0].y, currentPoints[1].y) }] };
                    dState.setAiFeatureGroups((prev: AiFeatureGroup[]) => [...prev, g]); aState.setSelectedAiGroupId(g.id); interaction.setCurrentPoints([]); setMode('feature_analysis');
                    setPromptState((p: any) => ({ ...p, isOpen: false }));
                }
            });
        }
    } catch (err) { }
  }, [interaction.currentPoints, mode, dState, aState, mState, setMode, setPromptState]);

  return {
    imageSrc, setImageSrc, mode, setMode, isProcessing, setIsProcessing, originalFileName, setOriginalFileName, fileInputRef, mouseNormPos, setMouseNormPos, viewTransform, setViewTransform,
    mState, aState, dState, promptState, setPromptState, dxfOverlayEntities, aiOverlayEntities, originCanvasPos, handleFileUpload, toggleEntityInSelection, saveProject, loadProject,
    ...dxfAnalysis, ...aiAnalysis, ...interaction, finishShape
  };
}
