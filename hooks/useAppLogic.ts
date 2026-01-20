
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import DxfParser from 'dxf-parser';
import { 
  Point, AppMode, ViewTransform, DxfEntity, DxfComponent, 
  DxfEntityType, ProjectConfig, AiFeatureGroup 
} from '../types';
import { generateId } from '../utils';
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

// Helper for Point-in-Polygon (Ray casting)
const isPointInPolygon = (px: number, py: number, vertices: {x: number, y: number}[]) => {
    if (!vertices || vertices.length < 3) return false;
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const xi = vertices[i].x, yi = vertices[i].y;
        const xj = vertices[j].x, yj = vertices[j].y;
        const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

// Refined Hit Test for Entities (Edge + Interior)
const checkEntityHit = (px: number, py: number, ent: DxfEntity, threshold: number): boolean => {
    const raw = ent.rawEntity;
    if (!raw) return false;
    
    // 1. Edge/Distance check
    let dist = Infinity;
    if (ent.type === 'LINE') {
        const v = raw.vertices;
        if (!v || v.length < 2) return false;
        const x1 = v[0].x, y1 = v[0].y, x2 = v[1].x, y2 = v[1].y;
        const l2 = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
        if (l2 === 0) dist = Math.sqrt(Math.pow(px - x1, 2) + Math.pow(py - y1, 2));
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

  // --- REFINED: Hover Detection Logic with Selection Priority ---
  useEffect(() => {
    if (!mouseNormPos || !dState.imgDimensions) {
        aState.setHoveredComponentId(null);
        aState.setHoveredFeatureId(null);
        return;
    }
    
    const isDxfMode = mode === 'dxf_analysis' || mode === 'box_group';
    const isAiMode = mode === 'feature_analysis' || mode === 'feature';

    if (isDxfMode && dState.rawDxfData) {
      const { minX, maxY, totalW, totalH, padding } = dState.rawDxfData;
      if (totalW <= 0 || totalH <= 0) return;

      const cadX = (mouseNormPos.x * totalW) + (minX - padding);
      const cadY = (maxY + padding) - (mouseNormPos.y * totalH);

      const hitThreshold = (10 / (viewTransform?.scale || 1)) * (totalW / 1000); 

      // 1. Identify currently selected family (Seed and its matches)
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

        // 1. Optimized check for Rotated Components (Match Instances)
        if (c.parentGroupId && c.rotation !== undefined) {
            const dx = cadX - c.centroid.x;
            const dy = cadY - c.centroid.y;
            const angle = -c.rotation; // Inverse rotation
            const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
            const localY = dx * Math.sin(angle) + dy * Math.cos(angle);

            const seed = dState.dxfComponents.find((s: DxfComponent) => s.id === c.parentGroupId);
            if (seed && seed.bounds) {
                const halfW = (seed.bounds.maxX - seed.bounds.minX) / 2 + hitThreshold;
                const halfH = (seed.bounds.maxY - seed.bounds.minY) / 2 + hitThreshold;
                if (Math.abs(localX) <= halfW && Math.abs(localY) <= halfH) isHit = true;
            }
        } 
        
        // 2. Standard check for Seeds or Loose Meta Groups (AABB Interior)
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
            
            // PRIORITY BIAS: If part of selected family, subtract a massive value to guarantee focus
            let score = area * 1000 + distToCenter;
            if (selectedFamilyIds.has(c.id)) {
                score -= 1e12; // Massive bias for selected family
            }

            if (score < minCompScore) {
                minCompScore = score;
                bestCompId = c.id;
            }
        }
      });

      aState.setHoveredComponentId(bestCompId);
      aState.setHoveredFeatureId(null);
    } else if (isAiMode) {
      const hitThresholdNorm = 0.01 / (viewTransform?.scale || 1);
      
      // AI Priority Logic
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
                if (selectedAiFamilyIds.has(g.id)) {
                    score -= 1e12; 
                }

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
      if (config.calibrationData) dState.setCalibrationData(config.calibrationData);
      if (config.manualOriginCAD) dState.setManualOriginCAD(config.manualOriginCAD);
      if (config.measurements) mState.setMeasurements(config.measurements);
      if (config.parallelMeasurements) mState.setParallelMeasurements(config.parallelMeasurements);
      if (config.areaMeasurements) mState.setAreaMeasurements(config.areaMeasurements);
      if (config.curveMeasurements) mState.setCurveMeasurements(config.curveMeasurements);
      if (config.dxfComponents) dState.setDxfComponents(config.dxfComponents);
      if (config.dxfEntities) dState.setDxfEntities(config.dxfEntities); 
      if (config.rawDxfData) dState.setRawDxfData(config.rawDxfData);   
      if (config.aiFeatureGroups) dState.setAiFeatureGroups(config.aiFeatureGroups);
      if (config.mode) setMode(config.mode);
      if (config.viewTransform) setViewTransform(config.viewTransform);
      aState.setMatchStatus({ text: "Project Configuration Loaded", type: 'success' });
    } catch (err: any) { aState.setMatchStatus({ text: `Reload failed: ${err.message}`, type: 'info' }); }
  }, [dState, mState, aState]);

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
                       const px = entity.position?.x || 0;
                       const py = entity.position?.y || 0;
                       const rotRad = (entity.rotation || 0) * Math.PI / 180;
                       const sx = entity.scale?.x ?? 1;
                       const sy = entity.scale?.y ?? 1;
                       const bx = block.position?.x || 0;
                       const by = block.position?.y || 0;
                       const cos = Math.cos(rotRad);
                       const sin = Math.sin(rotRad);
                       const a = sx * cos;
                       const b = sx * sin;
                       const c = -sy * sin;
                       const d = sy * cos;
                       const tx = px - (a * bx + c * by);
                       const ty = py - (b * bx + d * by);
                       const localMatrix: Matrix2D = { a, b, c, d, tx, ty };
                       const nextMatrix = multiplyMatrix(transform, localMatrix);
                       processEntities(block.entities, nextMatrix);
                    }
                  }
                  return;
                }

                let type: DxfEntityType = 'UNKNOWN'; 
                let entBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 }; 
                let isValid = false;
                let rawEntity = { ...entity };

                if (entity.type === 'LINE') { 
                  type = 'LINE'; 
                  rawEntity.vertices = entity.vertices.map((v: any) => {
                    const tv = transformPoint(v.x, v.y, transform);
                    return { ...v, x: tv.x, y: tv.y };
                  });
                  const xs = rawEntity.vertices.map((v:any) => v.x); 
                  const ys = rawEntity.vertices.map((v:any) => v.y); 
                  entBounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }; 
                  isValid = true; 
                } 
                else if (entity.type === 'CIRCLE') { 
                  type = 'CIRCLE'; 
                  const tc = transformPoint(entity.center.x, entity.center.y, transform);
                  rawEntity.center = { ...entity.center, x: tc.x, y: tc.y };
                  const sVecX = Math.sqrt(transform.a * transform.a + transform.b * transform.b); 
                  const sVecY = Math.sqrt(transform.c * transform.c + transform.d * transform.d); 
                  const scaleFactor = (sVecX + sVecY) / 2; 
                  rawEntity.radius = entity.radius * scaleFactor;
                  const r = rawEntity.radius; 
                  entBounds = { minX: rawEntity.center.x - r, maxX: rawEntity.center.x + r, minY: rawEntity.center.y - r, maxY: rawEntity.center.y + r }; 
                  isValid = true; 
                  circles.push(rawEntity); 
                } 
                else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') { 
                  type = 'LWPOLYLINE'; 
                  if (entity.vertices?.length > 0) { 
                    rawEntity.vertices = entity.vertices.map((v: any) => {
                        const tv = transformPoint(v.x, v.y, transform);
                        return { ...v, x: tv.x, y: tv.y };
                    });
                    const xs = rawEntity.vertices.map((v:any) => v.x); 
                    const ys = rawEntity.vertices.map((v:any) => v.y); 
                    entBounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }; 
                    isValid = true; 
                  } 
                } 
                else if (entity.type === 'ARC') { 
                  type = 'ARC'; 
                  const tc = transformPoint(entity.center.x, entity.center.y, transform);
                  rawEntity.center = { ...entity.center, x: tc.x, y: tc.y };
                  const sVecX = Math.sqrt(transform.a * transform.a + transform.b * transform.b);
                  const sVecY = Math.sqrt(transform.c * transform.c + transform.d * transform.d);
                  const scaleFactor = (sVecX + sVecY) / 2;
                  rawEntity.radius = entity.radius * scaleFactor;
                  const matrixRot = Math.atan2(transform.b, transform.a);
                  rawEntity.startAngle = entity.startAngle + matrixRot;
                  rawEntity.endAngle = entity.endAngle + matrixRot;
                  const r = rawEntity.radius; 
                  entBounds = { minX: rawEntity.center.x - r, maxX: rawEntity.center.x + r, minY: rawEntity.center.y - r, maxY: rawEntity.center.y + r }; 
                  isValid = true; 
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
            setMode('measure'); 
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

  return {
    imageSrc, setImageSrc, mode, setMode, isProcessing, setIsProcessing, originalFileName, setOriginalFileName, fileInputRef, mouseNormPos, setMouseNormPos, viewTransform, setViewTransform,
    mState, aState, dState, promptState, setPromptState, dxfOverlayEntities, aiOverlayEntities, originCanvasPos, handleFileUpload, toggleEntityInSelection, saveProject, loadProject,
    ...dxfAnalysis, ...aiAnalysis, ...interaction
  };
}
