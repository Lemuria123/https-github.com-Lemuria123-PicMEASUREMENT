
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import DxfParser from 'dxf-parser';
import { 
  Point, AppMode, ViewTransform, DxfEntity, DxfComponent, 
  DxfEntityType, ProjectConfig 
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
      dxfEntities: dState.dxfEntities, // Fixed: Save entities
      rawDxfData: dState.rawDxfData,   // Fixed: Save raw layout data
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
      if (config.dxfEntities) dState.setDxfEntities(config.dxfEntities); // Fixed: Load entities
      if (config.rawDxfData) dState.setRawDxfData(config.rawDxfData);   // Fixed: Load raw data
      if (config.aiFeatureGroups) dState.setAiFeatureGroups(config.aiFeatureGroups);
      if (config.mode) setMode(config.mode);
      if (config.viewTransform) setViewTransform(config.viewTransform);
      aState.setMatchStatus({ text: "Project Configuration Loaded", type: 'success' });
    } catch (err: any) { aState.setMatchStatus({ text: `Reload failed: ${err.message}`, type: 'info' }); }
  }, [dState, mState, aState]);

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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    event.target.value = ''; setIsProcessing(true); setOriginalFileName(file.name);
    mState.setMeasurements([]); mState.setParallelMeasurements([]); mState.setAreaMeasurements([]); mState.setCurveMeasurements([]);
    dState.setManualOriginCAD(null); dState.setCalibrationData(null); setViewTransform(null);
    dState.setFeatureROI([]); dState.setDxfEntities([]); dState.setDxfComponents([]);
    dState.setAiFeatureGroups([]); aState.clearAllSelections(); aState.setInspectComponentId(null);
    interaction.setCurrentPoints([]);

    if (file.name.toLowerCase().endsWith('.dxf')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parser = new DxfParser(); const dxf = parser.parseSync(e.target?.result as string);
          if (dxf) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            const circles: any[] = []; const parsedEntities: DxfEntity[] = [];
            
            // Helper to recursively flatten blocks/inserts using Matrix Transforms
            const processEntities = (entities: any[], transform: Matrix2D) => {
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
                       
                       // Block definition base point (local origin)
                       const bx = block.position?.x || 0;
                       const by = block.position?.y || 0;
                       
                       // Construct local transform matrix:
                       // 1. Translate -BasePoint
                       // 2. Scale
                       // 3. Rotate
                       // 4. Translate +InsertPosition
                       // Combined Matrix components:
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
                  
                  // Approximate uniform scaling for radius. 
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
                  
                  // Scale radius similar to Circle
                  const sVecX = Math.sqrt(transform.a * transform.a + transform.b * transform.b);
                  const sVecY = Math.sqrt(transform.c * transform.c + transform.d * transform.d);
                  const scaleFactor = (sVecX + sVecY) / 2;
                  rawEntity.radius = entity.radius * scaleFactor;

                  // Adjust Angles for Rotation
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
