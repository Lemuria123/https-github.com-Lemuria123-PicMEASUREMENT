
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Scale, Ruler, Rows, Pentagon, Spline, Loader2, Target, Download, Plus, Crosshair, Check, X, Keyboard, Eye, EyeOff, ScanFace, Search, Trash2, Settings, Layers, BoxSelect, Grid, ChevronLeft, MousePointer2, Palette, Zap } from 'lucide-react';
import { Button } from './components/Button';
import { ImageCanvas } from './components/ImageCanvas';
import { Point, LineSegment, ParallelMeasurement, AreaMeasurement, CurveMeasurement, CalibrationData, AppMode, SolderPoint, ViewTransform, FeatureResult, DxfComponent, DxfEntity, DxfEntityType, RenderableDxfEntity } from './types';
import DxfParser from 'dxf-parser';
import { GoogleGenAI, Type } from "@google/genai";
import { PromptModal } from './components/PromptModal';
import { UNIT_CONVERSIONS, getScaleInfo, getLogicCoords } from './utils/geoUtils';

const GROUP_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', 
  '#06b6d4', '#8b5cf6', '#a855f7', '#14b8a6', '#f97316'
];

const getRandomColor = () => GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)];

export default function App() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [mode, setMode] = useState<AppMode>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [originalFileName, setOriginalFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [mouseNormPos, setMouseNormPos] = useState<Point | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<SolderPoint | null>(null);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [imgDimensions, setImgDimensions] = useState<{width: number, height: number} | null>(null);
  const [viewTransform, setViewTransform] = useState<ViewTransform | null>(null);

  // Modal State
  const [promptState, setPromptState] = useState<{
    isOpen: boolean;
    title: string;
    description?: string;
    defaultValue: string;
    onConfirm: (val: string) => void;
  }>({
    isOpen: false,
    title: '',
    defaultValue: '',
    onConfirm: () => {}
  });

  // State Containers
  const [calibrationData, setCalibrationData] = useState<CalibrationData | null>(null);
  const [measurements, setMeasurements] = useState<LineSegment[]>([]);
  const [parallelMeasurements, setParallelMeasurements] = useState<ParallelMeasurement[]>([]);
  const [areaMeasurements, setAreaMeasurements] = useState<AreaMeasurement[]>([]);
  const [curveMeasurements, setCurveMeasurements] = useState<CurveMeasurement[]>([]);
  
  // DXF Data
  const [rawDxfData, setRawDxfData] = useState<any | null>(null);
  const [manualOriginCAD, setManualOriginCAD] = useState<{x: number, y: number} | null>(null);
  
  // DXF Analysis State
  const [dxfEntities, setDxfEntities] = useState<DxfEntity[]>([]);
  const [dxfComponents, setDxfComponents] = useState<DxfComponent[]>([]);
  const [analysisTab, setAnalysisTab] = useState<'objects' | 'components'>('components');
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selectedObjectGroupKey, setSelectedObjectGroupKey] = useState<string | null>(null);

  // Feature Search State
  const [featureROI, setFeatureROI] = useState<Point[]>([]);
  const [featureResults, setFeatureResults] = useState<FeatureResult[]>([]);
  const [isSearchingFeatures, setIsSearchingFeatures] = useState(false);
  
  // AI Settings State
  const [aiSettings, setAiSettings] = useState<{resolution: number, quality: number}>({ resolution: 800, quality: 0.4 });
  const [showAiSettings, setShowAiSettings] = useState(false);

  // Feedback State
  const [matchStatus, setMatchStatus] = useState<{text: string, type: 'success' | 'info'} | null>(null);

  // Dialog State
  const [dialogUnit, setDialogUnit] = useState<string>('mm');

  // Visibility State
  const [showCalibration, setShowCalibration] = useState(true);
  const [showMeasurements, setShowMeasurements] = useState(true);

  // --- LOCAL STORAGE PERSISTENCE ---
  const saveStateToLocal = () => {
     if (!originalFileName) return;
     const state = {
        fileName: originalFileName,
        manualOriginCAD,
        viewTransform,
     };
     localStorage.setItem('metricmate_last_session', JSON.stringify(state));
  };

  useEffect(() => {
     const t = setTimeout(saveStateToLocal, 500);
     return () => clearTimeout(t);
  }, [originalFileName, manualOriginCAD, viewTransform]);

  // Clear current drawing points when switching modes
  useEffect(() => {
    setCurrentPoints([]);
    setDialogUnit('mm'); 
  }, [mode]);

  useEffect(() => {
    if (matchStatus) {
      const t = setTimeout(() => setMatchStatus(null), 3000);
      return () => clearTimeout(t);
    }
  }, [matchStatus]);

  // --- HELPER WRAPPERS ---
  const currentScaleInfo = useMemo(() => 
    getScaleInfo(imgDimensions, rawDxfData, calibrationData), 
    [imgDimensions, rawDxfData, calibrationData]
  );

  const displayCoords = useMemo(() => 
    mouseNormPos ? getLogicCoords(mouseNormPos, rawDxfData, calibrationData, manualOriginCAD, currentScaleInfo) : null, 
    [mouseNormPos, calibrationData, rawDxfData, manualOriginCAD, currentScaleInfo]
  );
  
  const activePointCoords = useMemo(() => 
    currentPoints.length > 0 ? getLogicCoords(currentPoints[currentPoints.length - 1], rawDxfData, calibrationData, manualOriginCAD, currentScaleInfo) : null, 
    [currentPoints, calibrationData, rawDxfData, manualOriginCAD, currentScaleInfo]
  );

  const changeGlobalUnit = (newUnit: string) => {
    if (!calibrationData) return;
    const oldUnit = calibrationData.unit;
    const mmValue = calibrationData.realWorldDistance * (UNIT_CONVERSIONS[oldUnit] || 1);
    const newValue = mmValue / (UNIT_CONVERSIONS[newUnit] || 1);
    
    setCalibrationData({
      ...calibrationData,
      realWorldDistance: newValue,
      unit: newUnit
    });
  };

  const createGroupFromObjectKey = (groupKey: string) => {
      if (!rawDxfData) return;
      const matchingIds = entityTypeKeyMap.get(groupKey) || [];
      if (matchingIds.length === 0) return;

      const groupLabel = entitySizeGroups.find(g => g.key === groupKey)?.label || "New Group";
      
      setPromptState({
        isOpen: true,
        title: "Create Component Group",
        description: `Grouping ${matchingIds.length} matching entities.`,
        defaultValue: groupLabel,
        onConfirm: (finalName) => {
          const groupEntities = matchingIds.map(id => dxfEntities.find(e => e.id === id)).filter(Boolean) as DxfEntity[];
          
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          let sx = 0, sy = 0;
          groupEntities.forEach(e => {
              minX = Math.min(minX, e.minX); maxX = Math.max(maxX, e.maxX);
              minY = Math.min(minY, e.minY); maxY = Math.max(maxY, e.maxY);
              sx += (e.minX + e.maxX) / 2;
              sy += (e.minY + e.maxY) / 2;
          });

          const newComponent: DxfComponent = {
              id: crypto.randomUUID(),
              name: finalName.trim() || groupLabel,
              isVisible: true,
              isWeld: false,
              isMark: false,
              color: getRandomColor(),
              entityIds: matchingIds,
              seedSize: matchingIds.length,
              centroid: { x: sx / matchingIds.length, y: sy / matchingIds.length },
              bounds: { minX, minY, maxX, maxY }
          };

          setDxfComponents(prev => [...prev, newComponent]);
          setAnalysisTab('components');
          setSelectedComponentId(newComponent.id);
          setSelectedObjectGroupKey(null);
          setMatchStatus({ text: `Created component "${newComponent.name}" with ${matchingIds.length} entities`, type: 'success' });
          setPromptState(prev => ({ ...prev, isOpen: false }));
        }
      });
  };

  const finishShape = () => {
    if (currentPoints.length < 1) return;

    if (mode === 'calibrate' && currentPoints.length === 2) {
        setPromptState({
          isOpen: true,
          title: "Calibration",
          description: "Enter the real-world distance for the line you just drew.",
          defaultValue: "10.0",
          onConfirm: (val) => {
            const dist = parseFloat(val);
            if (!isNaN(dist) && dist > 0) {
              setCalibrationData({
                start: currentPoints[0],
                end: currentPoints[1],
                realWorldDistance: dist,
                unit: dialogUnit
              });
              setMode('measure'); 
              setCurrentPoints([]); 
              setPromptState(p => ({ ...p, isOpen: false }));
            } else {
              alert("Please enter a valid positive number.");
            }
          }
        });
        return;
    }
    
    if (mode === 'box_group' && currentPoints.length === 2) {
        if (!rawDxfData) return;
        const p1 = currentPoints[0];
        const p2 = currentPoints[1];
        const { minX, maxY, totalW, totalH, padding } = rawDxfData;
        const normMinX = Math.min(p1.x, p2.x);
        const normMaxX = Math.max(p1.x, p2.x);
        const normMinY = Math.min(p1.y, p2.y);
        const normMaxY = Math.max(p1.y, p2.y);
        const selMinX = (normMinX * totalW) + (minX - padding);
        const selMaxX = (normMaxX * totalW) + (minX - padding);
        const selMinY = (maxY + padding) - (normMaxY * totalH); 
        const selMaxY = (maxY + padding) - (normMinY * totalH);

        const enclosedIds: string[] = [];
        const EPS = 0.001; 
        const isInside = (e: DxfEntity) => e.minX >= selMinX - EPS && e.maxX <= selMaxX + EPS && e.minY >= selMinY - EPS && e.maxY <= selMaxY + EPS;

        dxfEntities.forEach(ent => {
             if (isInside(ent)) enclosedIds.push(ent.id);
        });

        if (enclosedIds.length > 0) {
            const defaultName = `Group ${dxfComponents.length + 1}`;
            setPromptState({
              isOpen: true,
              title: "New Component Group",
              description: `Create a group for the ${enclosedIds.length} selected entities.`,
              defaultValue: defaultName,
              onConfirm: (val) => {
                const finalName = val.trim() || defaultName;
                const newComponent: DxfComponent = {
                    id: crypto.randomUUID(),
                    name: finalName,
                    isVisible: true,
                    isWeld: false,
                    isMark: false,
                    color: getRandomColor(),
                    entityIds: enclosedIds,
                    seedSize: enclosedIds.length,
                    centroid: { x: (selMinX+selMaxX)/2, y: (selMinY+selMaxY)/2 },
                    bounds: { minX: selMinX, minY: selMinY, maxX: selMaxX, maxY: selMaxY }
                };
                setDxfComponents(prev => [...prev, newComponent]);
                setSelectedComponentId(newComponent.id);
                setAnalysisTab('components');
                setMode('dxf_analysis'); 
                setCurrentPoints([]);
                setMatchStatus({ text: `Created Group "${finalName}"`, type: 'info' });
                setPromptState(p => ({ ...p, isOpen: false }));
              }
            });
        } else {
            alert("No entities found in selection box.");
        }
        return;
    }

    if (mode === 'measure' && currentPoints.length === 2) {
         setMeasurements(prev => [...prev, { id: crypto.randomUUID(), start: currentPoints[0], end: currentPoints[1] }]);
         setCurrentPoints([]);
    } else if (mode === 'parallel' && currentPoints.length === 3) {
        setParallelMeasurements(prev => [...prev, { 
          id: crypto.randomUUID(), 
          baseStart: currentPoints[0], 
          baseEnd: currentPoints[1], 
          offsetPoint: currentPoints[2] 
        }]);
        setCurrentPoints([]);
    } else if (mode === 'area' && currentPoints.length > 2) {
        setAreaMeasurements(prev => [...prev, { id: crypto.randomUUID(), points: currentPoints }]);
        setCurrentPoints([]);
    } else if (mode === 'curve' && currentPoints.length > 1) {
        setCurveMeasurements(prev => [...prev, { id: crypto.randomUUID(), points: currentPoints }]);
        setCurrentPoints([]);
    } else if (mode === 'origin' && currentPoints.length === 1) {
        const p = currentPoints[0];
        const scaleInfo = getScaleInfo(imgDimensions, rawDxfData, calibrationData);
        if (scaleInfo) {
            if (scaleInfo.isDxf && rawDxfData) {
                const { minX, maxY, totalW, totalH, padding } = rawDxfData;
                const cadX = p.x * totalW + (minX - padding);
                const cadY = (maxY + padding) - p.y * totalH;
                setManualOriginCAD({ x: cadX, y: cadY });
                setMode('dxf_analysis');
            } else {
                const absX = p.x * scaleInfo.totalWidthMM;
                const absY = p.y * scaleInfo.totalHeightMM;
                setManualOriginCAD({ x: absX, y: absY });
                setMode('measure'); 
            }
        }
        setCurrentPoints([]);
    } else if (mode === 'feature' && currentPoints.length === 2) {
        setFeatureROI(currentPoints);
        setCurrentPoints([]);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
       if (promptState.isOpen) return;
       if (e.key === 'Enter') {
         const readyToFinish = (mode === 'calibrate' && currentPoints.length === 2) || (mode === 'measure' && currentPoints.length === 2) || (mode === 'parallel' && currentPoints.length === 3) || (mode === 'area' && currentPoints.length > 2) || (mode === 'curve' && currentPoints.length > 1) || (mode === 'origin' && currentPoints.length === 1) || (mode === 'feature' && currentPoints.length === 2) || (mode === 'box_group' && currentPoints.length === 2);
         if (readyToFinish) { e.preventDefault(); finishShape(); return; }
       }
       if (!imgDimensions || currentPoints.length === 0) return;
       const allowedModes: AppMode[] = ['calibrate', 'measure', 'parallel', 'area', 'curve', 'origin', 'feature', 'box_group'];
       if (!allowedModes.includes(mode)) return;
       if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT') return;

       if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
         e.preventDefault();
         let stepX = 0; let stepY = 0;
         const targetUnit = e.shiftKey ? 0.1 : 0.01;
         const scaleInfo = getScaleInfo(imgDimensions, rawDxfData, calibrationData);
         if (scaleInfo) {
             stepX = (targetUnit / scaleInfo.mmPerPxX) / imgDimensions.width;
             stepY = (targetUnit / scaleInfo.mmPerPxY) / imgDimensions.height;
         } else {
             const px = e.shiftKey ? 10 : 1;
             stepX = px / imgDimensions.width; stepY = px / imgDimensions.height;
         }
         setCurrentPoints(prev => {
            if (prev.length === 0) return prev;
            const lastIdx = prev.length - 1;
            const p = { ...prev[lastIdx] };
            switch (e.key) {
               case 'ArrowUp': p.y -= stepY; break;
               case 'ArrowDown': p.y += stepY; break;
               case 'ArrowLeft': p.x -= stepX; break;
               case 'ArrowRight': p.x += stepX; break;
            }
            p.x = Math.max(0, Math.min(1, p.x)); p.y = Math.max(0, Math.min(1, p.y));
            const newPoints = [...prev]; newPoints[lastIdx] = p; return newPoints;
         });
       }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imgDimensions, currentPoints, mode, rawDxfData, calibrationData, promptState.isOpen]);

  const handlePointClick = (p: Point) => {
    if (mode === 'upload' || mode === 'dxf_analysis' || promptState.isOpen || isSearchingFeatures) return; 
    if (mode === 'origin') { if (rawDxfData || calibrationData) { if (currentPoints.length < 1) setCurrentPoints([p]); } else { alert("Please calibrate the image first."); setMode('calibrate'); } return; }
    if (mode === 'calibrate' || mode === 'feature' || mode === 'box_group') { if (currentPoints.length < 2) setCurrentPoints(prev => [...prev, p]); return; }
    const nextPoints = [...currentPoints, p];
    if (mode === 'measure' && currentPoints.length < 2) setCurrentPoints(nextPoints);
    else if (mode === 'parallel' && currentPoints.length < 3) setCurrentPoints(nextPoints);
    else if (mode === 'area' || mode === 'curve') setCurrentPoints(nextPoints);
  };

  const handleAutoMatch = () => {
      if (!selectedComponentId) { alert("Please select a 'seed' group first to auto-match similar components."); return; }
      const seedGroup = dxfComponents.find(c => c.id === selectedComponentId);
      if (!seedGroup || seedGroup.entityIds.length === 0) return;
      setIsProcessing(true);
      setTimeout(() => {
          const seedEntities = seedGroup.entityIds.slice(0, seedGroup.seedSize).map(id => dxfEntities.find(e => e.id === id)).filter(Boolean) as DxfEntity[];
          if (seedEntities.length === 0) { setIsProcessing(false); return; }
          seedEntities.sort((a, b) => {
               if (a.type !== b.type) return a.type.localeCompare(b.type);
               if (a.type === 'CIRCLE' && b.type === 'CIRCLE') return b.rawEntity.radius - a.rawEntity.radius;
               return 0;
          });
          const anchor = seedEntities[0];
          const relativeMap = seedEntities.map(e => ({
               type: e.type,
               dx: e.rawEntity.center ? e.rawEntity.center.x - (anchor.rawEntity.center?.x || 0) : 0,
               dy: e.rawEntity.center ? e.rawEntity.center.y - (anchor.rawEntity.center?.y || 0) : 0,
               propHash: e.type === 'CIRCLE' ? e.rawEntity.radius.toFixed(4) : (e.maxX - e.minX).toFixed(4)
          }));
          const alreadyGroupedIds = new Set(dxfComponents.flatMap(c => c.entityIds));
          const candidates = dxfEntities.filter(e => !alreadyGroupedIds.has(e.id) && e.type === anchor.type && (e.type === 'CIRCLE' ? e.rawEntity.radius.toFixed(4) === relativeMap[0].propHash : (e.maxX - e.minX).toFixed(4) === relativeMap[0].propHash));
          const matchedEntityIds: string[] = [];
          let matchFoundCount = 0;
          candidates.forEach(candAnchor => {
               const clusterIds: string[] = [candAnchor.id];
               let matchFailed = false;
               for (let i = 1; i < relativeMap.length; i++) {
                   const spec = relativeMap[i];
                   const tx = (candAnchor.rawEntity.center?.x || 0) + spec.dx; const ty = (candAnchor.rawEntity.center?.y || 0) + spec.dy;
                   const found = dxfEntities.find(e => !alreadyGroupedIds.has(e.id) && !clusterIds.includes(e.id) && !matchedEntityIds.includes(e.id) && e.type === spec.type && (e.type === 'CIRCLE' ? e.rawEntity.radius.toFixed(4) === spec.propHash : true) && Math.abs((e.rawEntity.center?.x || 0) - tx) < 0.5 && Math.abs((e.rawEntity.center?.y || 0) - ty) < 0.5);
                   if (found) clusterIds.push(found.id); else { matchFailed = true; break; }
               }
               if (!matchFailed && clusterIds.length === seedEntities.length) { clusterIds.forEach(id => matchedEntityIds.push(id)); matchFoundCount++; }
          });
          if (matchedEntityIds.length > 0) {
              setDxfComponents(prev => prev.map(c => c.id === selectedComponentId ? { ...c, entityIds: [...c.entityIds, ...matchedEntityIds] } : c));
              setMatchStatus({ text: `Auto-Match: Found and merged ${matchFoundCount} new matches!`, type: 'success' });
          } else { setMatchStatus({ text: "Auto-Match: No additional matches found.", type: 'info' }); }
          setIsProcessing(false);
      }, 300);
  };

  const updateComponentProperty = (id: string, prop: 'isWeld' | 'isMark' | 'isVisible', value: boolean) => {
      setDxfComponents(prev => prev.map(c => c.id === id ? { ...c, [prop]: value } : c));
  };
  const updateComponentColor = (id: string, color: string) => {
      setDxfComponents(prev => prev.map(c => c.id === id ? { ...c, color } : c));
  };
  const deleteComponent = (id: string) => {
      setDxfComponents(prev => prev.filter(c => c.id !== id));
      if (selectedComponentId === id) setSelectedComponentId(null);
  };

  const optimizeImageForAPI = async (src: string, maxRes: number, quality: number): Promise<{ data: string; mimeType: string }> => {
     return new Promise((resolve, reject) => {
        const img = new Image(); img.crossOrigin = "Anonymous"; 
        img.onload = () => {
           let width = img.width; let height = img.height;
           if (width > maxRes || height > maxRes) {
               if (width > height) { height = Math.round((height * maxRes) / width); width = maxRes; }
               else { width = Math.round((width * maxRes) / height); height = maxRes; }
           }
           const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
           const ctx = canvas.getContext('2d'); if (!ctx) { reject(new Error("Canvas error")); return; }
           ctx.fillStyle = "#111111"; ctx.fillRect(0, 0, width, height); ctx.drawImage(img, 0, 0, width, height);
           const parts = canvas.toDataURL('image/jpeg', quality).split(','); resolve({ data: parts[1], mimeType: 'image/jpeg' });
        };
        img.onerror = () => reject(new Error("Failed to load image")); img.src = src;
     });
  };

  const snapResultsToDxf = (rawResults: FeatureResult[], dxf: any): FeatureResult[] => {
      if (!dxf || !dxf.circles) return rawResults;
      const { minX, maxY, totalW, totalH, padding } = dxf;
      return rawResults.map(res => {
          const normCenterX = (res.minX + res.maxX) / 2; const normCenterY = (res.minY + res.maxY) / 2;
          const cadX = (normCenterX * totalW) + (minX - padding); const cadY = (maxY + padding) - (normCenterY * totalH);
          let closestCircle: any = null; let minDistSq = Infinity;
          const boxWidthCAD = (res.maxX - res.minX) * totalW;
          const searchThresholdSq = Math.pow(Math.max(boxWidthCAD, totalW * 0.05), 2);
          for (const circle of dxf.circles) {
              const dx = circle.center.x - cadX; const dy = circle.center.y - cadY; const distSq = dx*dx + dy*dy;
              if (distSq < searchThresholdSq && distSq < minDistSq) { minDistSq = distSq; closestCircle = circle; }
          }
          if (closestCircle) {
              const r = closestCircle.radius; const cx = closestCircle.center.x; const cy = closestCircle.center.y;
              return { ...res, minX: ((cx - r) - (minX - padding)) / totalW, maxX: ((cx + r) - (minX - padding)) / totalW, minY: ((maxY + padding) - (cy + r)) / totalH, maxY: ((maxY + padding) - (cy - r)) / totalH, snapped: true, entityType: 'circle' };
          }
          return res;
      });
  };

  const performFeatureSearch = async () => {
    if (!imageSrc || featureROI.length !== 2) return;
    setIsSearchingFeatures(true);
    const runSearch = async (res: number, qual: number) => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const { data, mimeType } = await optimizeImageForAPI(imageSrc, res, qual);
        const p1 = featureROI[0]; const p2 = featureROI[1];
        const ymin = Math.round(Math.min(p1.y, p2.y) * 1000); const xmin = Math.round(Math.min(p1.x, p2.x) * 1000);
        const ymax = Math.round(Math.max(p1.y, p2.y) * 1000); const xmax = Math.round(Math.max(p1.x, p2.x) * 1000);
        return await ai.models.generateContent({
            model: 'gemini-3-flash-preview', 
            contents: [{ parts: [{ inlineData: { mimeType, data } }, { text: `Identify feature in box [ymin, xmin, ymax, xmax]: [${ymin}, ${xmin}, ${ymax}, ${xmax}]. Return JSON with "boxes" on 0-1000 scale.` }] }],
            config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { boxes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { ymin: { type: Type.NUMBER }, xmin: { type: Type.NUMBER }, ymax: { type: Type.NUMBER }, xmax: { type: Type.NUMBER } } } } } } }
        });
    };
    try {
        let response = await runSearch(aiSettings.resolution, aiSettings.quality);
        if (response && response.text) {
            const data = JSON.parse(response.text);
            if (data.boxes && Array.isArray(data.boxes)) {
                let results: FeatureResult[] = data.boxes.map((box: any) => ({ id: crypto.randomUUID(), minX: box.xmin / 1000, minY: box.ymin / 1000, maxX: box.xmax / 1000, maxY: box.ymax / 1000, snapped: false }));
                if (rawDxfData) results = snapResultsToDxf(results, rawDxfData);
                setFeatureResults(results);
            }
        }
    } catch (e: any) { alert("Search failed: " + e.message); } finally { setIsSearchingFeatures(false); }
  };

  const solderPoints = useMemo(() => {
    if (!rawDxfData || mode === 'dxf_analysis' || mode === 'box_group') return [];
    const { circles, defaultCenterX, defaultCenterY, minX, maxY, totalW, totalH, padding } = rawDxfData;
    const curX = manualOriginCAD ? manualOriginCAD.x : defaultCenterX; const curY = manualOriginCAD ? manualOriginCAD.y : defaultCenterY;
    let id = 1;
    return circles.map((c: any) => ({ id: id++, x: c.center.x - curX, y: c.center.y - curY, canvasX: (c.center.x - (minX - padding)) / totalW, canvasY: ((maxY + padding) - c.center.y) / totalH }));
  }, [rawDxfData, manualOriginCAD, mode]);
  
  const entityTypeKeyMap = useMemo(() => {
    const map = new Map<string, string[]>(); const TOLERANCE = 0.1;
    dxfEntities.forEach(e => {
        let key = "";
        if (e.type === 'CIRCLE') key = `CIRCLE_${(Math.round((e.rawEntity.radius*2)/TOLERANCE)*TOLERANCE).toFixed(2)}`;
        else if (e.type === 'LINE') {
            const dx = e.rawEntity.vertices[1].x - e.rawEntity.vertices[0].x; const dy = e.rawEntity.vertices[1].y - e.rawEntity.vertices[0].y;
            key = `LINE_${(Math.round(Math.sqrt(dx*dx+dy*dy)/TOLERANCE)*TOLERANCE).toFixed(2)}`;
        } else key = e.type;
        const list = map.get(key) || []; list.push(e.id); map.set(key, list);
    });
    return map;
  }, [dxfEntities]);

  const dxfOverlayEntities = useMemo(() => {
    if (!rawDxfData || !dxfEntities.length) return [];
    const { minX, maxY, totalW, totalH, padding } = rawDxfData;
    const toNormX = (x: number) => (x - (minX - padding)) / totalW; const toNormY = (y: number) => ((maxY + padding) - y) / totalH;
    const entityGroupMap = new Map<string, string>(); dxfComponents.forEach(comp => comp.entityIds.forEach(eid => entityGroupMap.set(eid, comp.id)));
    const objectGroupIds = new Set<string>();
    if (selectedObjectGroupKey && analysisTab === 'objects') (entityTypeKeyMap.get(selectedObjectGroupKey) || []).forEach(id => objectGroupIds.add(id));

    return dxfEntities.map(e => {
       const groupId = entityGroupMap.get(e.id); const component = groupId ? dxfComponents.find(c => c.id === groupId) : null;
       const isSelected = groupId === selectedComponentId || objectGroupIds.has(e.id);
       const baseProps = { id: e.id, strokeColor: component?.color || 'rgba(6, 182, 212, 0.5)', strokeWidth: 1, isGrouped: !!component, isVisible: component ? component.isVisible : true, isSelected };

       if (e.type === 'LINE') return { ...baseProps, type: 'LINE', geometry: { type: 'line', props: { x1: toNormX(e.rawEntity.vertices[0].x), y1: toNormY(e.rawEntity.vertices[0].y), x2: toNormX(e.rawEntity.vertices[1].x), y2: toNormY(e.rawEntity.vertices[1].y) } } };
       if (e.type === 'LWPOLYLINE' && e.rawEntity.vertices) return { ...baseProps, type: 'LWPOLYLINE', geometry: { type: 'polyline', props: { points: e.rawEntity.vertices.map((v: any) => `${toNormX(v.x)},${toNormY(v.y)}`).join(' ') } } };
       if (e.type === 'CIRCLE') return { ...baseProps, type: 'CIRCLE', geometry: { type: 'circle', props: { cx: toNormX(e.rawEntity.center.x), cy: toNormY(e.rawEntity.center.y), r: e.rawEntity.radius/totalW } } };
       if (e.type === 'ARC') {
           const { center, radius, startAngle, endAngle } = e.rawEntity;
           const d = `M ${toNormX(center.x + radius * Math.cos(startAngle))} ${toNormY(center.y + radius * Math.sin(startAngle))} A ${radius/totalW} ${radius/totalH} 0 ${((endAngle-startAngle+2*Math.PI)%(2*Math.PI))>Math.PI?1:0} 0 ${toNormX(center.x + radius * Math.cos(endAngle))} ${toNormY(center.y + radius * Math.sin(endAngle))}`;
           return { ...baseProps, type: 'ARC', geometry: { type: 'path', props: { d } } };
       }
       return null;
    }).filter(Boolean) as RenderableDxfEntity[];
  }, [dxfEntities, rawDxfData, dxfComponents, selectedComponentId, selectedObjectGroupKey, analysisTab, entityTypeKeyMap]);

  const originCanvasPos = useMemo(() => {
    if (rawDxfData) {
        const { defaultCenterX, defaultCenterY, minX, maxY, totalW, totalH, padding } = rawDxfData;
        const tx = manualOriginCAD ? manualOriginCAD.x : defaultCenterX; const ty = manualOriginCAD ? manualOriginCAD.y : defaultCenterY;
        return { x: (tx - (minX - padding)) / totalW, y: ((maxY + padding) - ty) / totalH };
    }
    const sInfo = getScaleInfo(imgDimensions, rawDxfData, calibrationData);
    if (calibrationData && manualOriginCAD && sInfo) return { x: manualOriginCAD.x / sInfo.totalWidthMM, y: manualOriginCAD.y / sInfo.totalHeightMM };
    return null;
  }, [rawDxfData, manualOriginCAD, calibrationData, imgDimensions]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    setIsProcessing(true); setOriginalFileName(file.name);
    setMeasurements([]); setParallelMeasurements([]); setAreaMeasurements([]); setCurveMeasurements([]); setManualOriginCAD(null); setCalibrationData(null); setDxfEntities([]); setDxfComponents([]);
    if (file.name.toLowerCase().endsWith('.dxf')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parser = new DxfParser(); const dxf = parser.parseSync(e.target?.result as string);
          if (dxf) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            const circles: any[] = [], parsedEntities: DxfEntity[] = [];
            dxf.entities.forEach((entity: any) => {
              let type: DxfEntityType = 'UNKNOWN', entBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 }, isValid = false;
              if (entity.type === 'LINE') { type = 'LINE'; const xs = entity.vertices.map((v:any) => v.x), ys = entity.vertices.map((v:any) => v.y); entBounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }; isValid = true; }
              else if (entity.type === 'CIRCLE') { type = 'CIRCLE'; const r = entity.radius; entBounds = { minX: entity.center.x - r, maxX: entity.center.x + r, minY: entity.center.y - r, maxY: entity.center.y + r }; isValid = true; circles.push(entity); }
              else if (entity.type === 'LWPOLYLINE') { type = 'LWPOLYLINE'; if (entity.vertices?.length) { const xs = entity.vertices.map((v:any) => v.x), ys = entity.vertices.map((v:any) => v.y); entBounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }; isValid = true; } }
              else if (entity.type === 'ARC') { type = 'ARC'; const r = entity.radius; entBounds = { minX: entity.center.x - r, maxX: entity.center.x + r, minY: entity.center.y - r, maxY: entity.center.y + r }; isValid = true; }
              if (isValid) { minX = Math.min(minX, entBounds.minX); minY = Math.min(minY, entBounds.minY); maxX = Math.max(maxX, entBounds.maxX); maxY = Math.max(maxY, entBounds.maxY); parsedEntities.push({ id: entity.handle || crypto.randomUUID(), type, layer: entity.layer || '0', minX: entBounds.minX, minY: entBounds.minY, maxX: entBounds.maxX, maxY: entBounds.maxY, rawEntity: entity }); }
            });
            setDxfEntities(parsedEntities);
            const width = maxX - minX, height = maxY - minY, padding = Math.max(width, height) * 0.05 || 10, totalW = width + padding * 2, totalH = height + padding * 2;
            setRawDxfData({ circles, defaultCenterX: (minX + maxX) / 2, defaultCenterY: (minY + maxY) / 2, minX, maxX, maxY, totalW, totalH, padding });
            let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX - padding} ${-maxY - padding} ${totalW} ${totalH}" width="1000" style="background: #111;">`;
            dxf.entities.forEach((entity: any) => {
              const sw = totalW/800;
              if (entity.type === 'LINE') svg += `<line x1="${entity.vertices[0].x}" y1="${-entity.vertices[0].y}" x2="${entity.vertices[1].x}" y2="${-entity.vertices[1].y}" stroke="#00ffff" stroke-width="${sw}" />`;
              else if (entity.type === 'CIRCLE') svg += `<circle cx="${entity.center.x}" cy="${-entity.center.y}" r="${entity.radius}" fill="none" stroke="#00ffff" stroke-width="${sw}" />`;
            });
            svg += `</svg>`;
            setImageSrc(URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))); setCalibrationData({ start: { x: padding/totalW, y: 0.5 }, end: { x: (width+padding)/totalW, y: 0.5 }, realWorldDistance: width, unit: 'mm' }); setMode('dxf_analysis'); 
          }
        } catch(err) { alert("Failed to parse DXF"); } setIsProcessing(false);
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader(); reader.onload = (e) => { setImageSrc(e.target?.result as string); setMode('calibrate'); setIsProcessing(false); }; reader.readAsDataURL(file);
    }
  };

  const exportCSV = () => {
    let csvContent = "";
    if (dxfComponents.length > 0) {
        csvContent = "ID,Name,Mark,Weld,Count,X,Y\n";
        const { defaultCenterX, defaultCenterY } = rawDxfData || { defaultCenterX: 0, defaultCenterY: 0 };
        const ox = manualOriginCAD ? manualOriginCAD.x : defaultCenterX; const oy = manualOriginCAD ? manualOriginCAD.y : defaultCenterY;
        dxfComponents.forEach((comp, idx) => { csvContent += `${idx+1},${comp.name},${comp.isMark},${comp.isWeld},${comp.entityIds.length},${(comp.centroid.x - ox).toFixed(4)},${(comp.centroid.y - oy).toFixed(4)}\n`; });
    } else { alert("Nothing to export."); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv' })); a.download = `${originalFileName?.split('.')[0] || 'export'}.csv`; a.click();
  };

  const entitySizeGroups = useMemo(() => {
    const groups: Map<string, { label: string, count: number, key: string }> = new Map(); const TOLERANCE = 0.1;
    dxfEntities.forEach(e => {
        let key = "", label = "";
        if (e.type === 'CIRCLE') { const d = e.rawEntity.radius*2; const rd = Math.round(d/TOLERANCE)*TOLERANCE; key = `CIRCLE_${rd.toFixed(2)}`; label = `Circles - φ${rd.toFixed(2)}`; }
        else if (e.type === 'LINE') { const dx = e.rawEntity.vertices[1].x-e.rawEntity.vertices[0].x, dy = e.rawEntity.vertices[1].y-e.rawEntity.vertices[0].y; const len = Math.sqrt(dx*dx+dy*dy); const rl = Math.round(len/TOLERANCE)*TOLERANCE; key = `LINE_${rl.toFixed(2)}`; label = `Lines - L${rl.toFixed(2)}`; }
        else { key = e.type; label = `${e.type}s`; }
        const existing = groups.get(key) || { label, count: 0, key }; groups.set(key, { ...existing, count: existing.count + 1 });
    });
    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [dxfEntities]);

  const canFinish = (mode === 'calibrate' && currentPoints.length === 2) || (mode === 'measure' && currentPoints.length === 2) || (mode === 'parallel' && currentPoints.length === 3) || (mode === 'area' && currentPoints.length > 2) || (mode === 'curve' && currentPoints.length > 1) || (mode === 'origin' && currentPoints.length === 1) || (mode === 'feature' && currentPoints.length === 2) || (mode === 'box_group' && currentPoints.length === 2);

  return (
    <div className="h-screen bg-slate-950 flex flex-col md:flex-row text-slate-200 overflow-hidden font-sans">
      <input ref={fileInputRef} type="file" accept="image/*,.dxf" onChange={handleFileUpload} className="hidden" />
      <PromptModal isOpen={promptState.isOpen} title={promptState.title} description={promptState.description} defaultValue={promptState.defaultValue} onConfirm={promptState.onConfirm} onCancel={() => setPromptState(p => ({ ...p, isOpen: false }))} />

      {matchStatus && <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-2xl animate-in fade-in slide-in-from-top-4 font-bold flex items-center gap-3 ${matchStatus.type === 'success' ? 'bg-emerald-600' : 'bg-indigo-600'}`}>{matchStatus.type === 'success' ? <Check size={20}/> : <Layers size={20}/>}<span>{matchStatus.text}</span></div>}

      {showAiSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
             <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-2xl w-80 space-y-5 relative">
                 <button onClick={() => setShowAiSettings(false)} className="absolute top-3 right-3 text-slate-500 hover:text-white"><X size={18}/></button>
                 <div className="flex items-center gap-2 text-violet-400 border-b border-slate-800 pb-3"><Settings size={20} /><h3 className="font-bold text-sm tracking-wide uppercase">AI Search Settings</h3></div>
                 <div className="space-y-4">
                     <div className="space-y-1"><div className="flex justify-between text-xs text-slate-400"><label>Resolution</label><span className="font-mono text-white">{aiSettings.resolution}px</span></div><input type="range" min="400" max="2000" step="100" value={aiSettings.resolution} onChange={(e) => setAiSettings({...aiSettings, resolution: parseInt(e.target.value)})} className="w-full accent-violet-500" /></div>
                     <div className="space-y-1"><div className="flex justify-between text-xs text-slate-400"><label>Quality</label><span className="font-mono text-white">{aiSettings.quality}</span></div><input type="range" min="0.1" max="1.0" step="0.1" value={aiSettings.quality} onChange={(e) => setAiSettings({...aiSettings, quality: parseFloat(e.target.value)})} className="w-full accent-violet-500" /></div>
                 </div>
                 <Button variant="primary" className="w-full bg-violet-600" onClick={() => setShowAiSettings(false)}>Save & Close</Button>
             </div>
        </div>
      )}

      <div className="w-full md:w-72 bg-slate-900 border-r border-slate-800 flex flex-col z-10 shadow-xl shrink-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
          <h1 className="font-bold text-sm text-white flex items-center gap-2"><Scale className="text-indigo-400" size={16}/> MetricMate</h1>
          <button onClick={() => {setImageSrc(null); setMode('upload');}} className="text-[9px] text-slate-500 hover:text-red-400 font-bold uppercase transition-colors">RESET</button>
        </div>

        <div className="p-3 space-y-4 flex-1 overflow-y-auto">
          {mode === 'dxf_analysis' || mode === 'box_group' ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
                  <div className="flex items-center justify-between bg-emerald-950/20 p-2 rounded-lg border border-emerald-500/20">
                      <div className="flex items-center gap-2 font-bold text-[10px] text-emerald-100 uppercase"><Layers size={14}/> DXF ANALYSIS</div>
                      <Button variant="ghost" onClick={() => setMode('measure')} className="h-6 text-[9px]">DONE</Button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <h3 className="text-[10px] font-bold text-slate-500 uppercase">Entities</h3>
                      <div className="flex gap-1">
                        <button onClick={() => { setAnalysisTab('objects'); setSelectedComponentId(null); }} className={`p-1 rounded ${analysisTab === 'objects' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}><BoxSelect size={12}/></button>
                        <button onClick={() => { setAnalysisTab('components'); setSelectedObjectGroupKey(null); }} className={`p-1 rounded ${analysisTab === 'components' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}><Layers size={12}/></button>
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-2 min-h-[200px] border border-slate-800 max-h-[300px] overflow-y-auto">
                        {analysisTab === 'objects' ? (
                            entitySizeGroups.map(g => (
                                <div key={g.key} onClick={() => setSelectedObjectGroupKey(g.key === selectedObjectGroupKey ? null : g.key)} className={`flex justify-between items-center p-2 rounded border mb-1 cursor-pointer transition-all group/item ${selectedObjectGroupKey === g.key ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-slate-800/30 border-slate-800 hover:border-slate-700'}`}>
                                    <span className="text-[10px] truncate">{g.label} ({g.count})</span>
                                    <button onClick={(e) => { e.stopPropagation(); createGroupFromObjectKey(g.key); }} className="opacity-0 group-hover/item:opacity-100 p-1 bg-cyan-500/20 rounded text-cyan-400"><Plus size={12}/></button>
                                </div>
                            ))
                        ) : (
                            dxfComponents.map(comp => (
                                <div key={comp.id} onClick={() => setSelectedComponentId(comp.id)} className={`p-2 rounded border mb-2 cursor-pointer transition-all ${selectedComponentId === comp.id ? 'bg-indigo-500/10 border-indigo-500/50' : 'bg-slate-800/30 border-slate-800 hover:border-slate-600'}`}>
                                    <div className="flex justify-between items-center mb-1">
                                        <div className="flex items-center gap-2 truncate"><input type="color" value={comp.color} onChange={(e) => updateComponentColor(comp.id, e.target.value)} className="w-4 h-4 rounded border-0 bg-transparent flex-shrink-0" onClick={e=>e.stopPropagation()}/><span className="text-[11px] font-bold truncate">{comp.name}</span></div>
                                        <div className="flex items-center gap-1"><button onClick={(e) => {e.stopPropagation(); updateComponentProperty(comp.id,'isVisible',!comp.isVisible);}} className={comp.isVisible?'text-indigo-400':'text-slate-600'}>{comp.isVisible?<Eye size={12}/>:<EyeOff size={12}/>}</button><button onClick={(e)=>{e.stopPropagation();deleteComponent(comp.id);}} className="text-slate-600 hover:text-red-400"><Trash2 size={12}/></button></div>
                                    </div>
                                    <div className="flex justify-between items-center border-t border-slate-800 pt-1 text-[9px] text-slate-500"><span>{comp.entityIds.length} ITEMS</span><div className="flex gap-2"><button onClick={(e)=>{e.stopPropagation();updateComponentProperty(comp.id,'isWeld',!comp.isWeld);}} className={`px-1.5 py-0.5 rounded font-bold ${comp.isWeld?'bg-emerald-600 text-white':'bg-slate-700 text-slate-500'}`}>WELD</button><button onClick={(e)=>{e.stopPropagation();updateComponentProperty(comp.id,'isMark',!comp.isMark);}} className={`px-1.5 py-0.5 rounded font-bold ${comp.isMark?'bg-amber-600 text-white':'bg-slate-700 text-slate-500'}`}>MARK</button></div></div>
                                </div>
                            ))
                        )}
                    </div>
                  </div>
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Grouping Tools</h3>
                      <div className="grid grid-cols-2 gap-2">
                          <Button variant={mode==='box_group'?'primary':'secondary'} className="h-8 text-[10px]" icon={mode==='box_group'?<X size={12}/>:<MousePointer2 size={12}/>} onClick={()=>setMode(mode==='box_group'?'dxf_analysis':'box_group')}>{mode==='box_group'?'Cancel':'Box Group'}</Button>
                          <Button variant="secondary" className="h-8 text-[10px]" icon={<Grid size={12}/>} disabled={!selectedComponentId} onClick={handleAutoMatch}>Auto-Match</Button>
                      </div>
                      <Button variant="secondary" onClick={exportCSV} className="w-full h-8 text-[10px]" icon={<Download size={12}/>}>Export Component CSV</Button>
                  </div>
              </div>
          ) : (
              <div className="space-y-4 animate-in fade-in">
                  <Button variant="primary" className="w-full text-[11px] h-9 font-bold tracking-wider" icon={<Plus size={14}/>} onClick={()=>fileInputRef.current?.click()}>IMPORT FILE</Button>
                  <div className={`px-3 py-2 rounded-xl border flex flex-col gap-1 ${calibrationData ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                    <div className="flex justify-between items-center mb-1"><span className="text-[9px] font-bold text-slate-500 uppercase">Calibration</span><button onClick={()=>setShowCalibration(!showCalibration)} className="text-slate-500 hover:text-indigo-400">{showCalibration ? <Eye size={14}/> : <EyeOff size={14}/>}</button></div>
                    {calibrationData ? <div className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-lg border border-slate-800"><span className="font-mono text-emerald-400 text-sm flex-1">{calibrationData.realWorldDistance.toFixed(2)}</span><select value={calibrationData.unit} onChange={(e)=>changeGlobalUnit(e.target.value)} className="bg-slate-800 text-xs border border-slate-700 rounded px-1 py-0.5">{Object.keys(UNIT_CONVERSIONS).map(u => <option key={u} value={u}>{u}</option>)}</select></div> : <div className="text-[10px] text-slate-500 italic px-1">No calibration set</div>}
                    <Button variant="ghost" active={mode==='calibrate'} onClick={()=>setMode('calibrate')} className="h-7 text-[9px] mt-2 border border-slate-700/50" icon={<Scale size={12}/>}>MANUAL CALIBRATE</Button>
                  </div>
                  <div className="px-3 py-2 rounded-xl border flex flex-col gap-1 bg-violet-500/5 border-violet-500/20">
                        <div className="flex justify-between items-center mb-1"><span className="text-[9px] font-bold text-slate-500 uppercase">Feature Search (AI)</span><div className="flex items-center gap-2"><button onClick={()=>setShowAiSettings(true)} className="text-slate-500 hover:text-violet-400"><Settings size={14}/></button><ScanFace size={14} className="text-violet-400"/></div></div>
                        <Button variant="ghost" active={mode==='feature'} onClick={()=>setMode('feature')} className={`h-8 text-[10px] border border-slate-700/50 ${mode==='feature'?'bg-violet-600 text-white':''}`} icon={<Target size={12}/>}>SELECT FEATURE (RECT)</Button>
                        {featureROI.length===2 && <div className="flex gap-2 mt-1 animate-in fade-in"><Button variant="primary" className="flex-1 h-8 text-[10px] bg-violet-600" onClick={performFeatureSearch} disabled={isSearchingFeatures} icon={isSearchingFeatures?<Loader2 className="animate-spin" size={12}/>:<Search size={12}/>}>{isSearchingFeatures?'SCANNING...':'FIND SIMILAR'}</Button><Button variant="secondary" className="w-8 h-8 px-0" onClick={()=>{setFeatureROI([]);setFeatureResults([]);}}><Trash2 size={12}/></Button></div>}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1"><h3 className="text-[10px] font-bold text-slate-500 uppercase">Active Tools</h3><button onClick={()=>setShowMeasurements(!showMeasurements)} className="text-slate-500 hover:text-indigo-400">{showMeasurements?<Eye size={14}/>:<EyeOff size={14}/>}</button></div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" className="h-9 text-[10px]" active={mode==='measure'} onClick={()=>setMode('measure')} disabled={!calibrationData}><Ruler size={14}/> Distance</Button>
                      <Button variant="secondary" className="h-9 text-[10px]" active={mode==='parallel'} onClick={()=>setMode('parallel')} disabled={!calibrationData}><Rows size={14} className="rotate-90"/> Parallel</Button>
                      <Button variant="secondary" className="h-9 text-[10px]" active={mode==='area'} onClick={()=>setMode('area')} disabled={!calibrationData}><Pentagon size={14}/> Area</Button>
                      <Button variant="secondary" className="h-9 text-[10px]" active={mode==='curve'} onClick={()=>setMode('curve')} disabled={!calibrationData}><Spline size={14}/> Curve</Button>
                      <Button variant="secondary" active={mode==='origin'} onClick={()=>setMode('origin')} disabled={!calibrationData && !rawDxfData} className="col-span-1 h-9 text-[10px]"><Crosshair size={14}/> Set Origin</Button>
                      <Button variant="secondary" onClick={exportCSV} disabled={(!calibrationData||!manualOriginCAD)&&(!rawDxfData)} className="col-span-1 h-9 text-[10px]"><Download size={14}/> Export CSV</Button>
                      {rawDxfData && <Button variant="secondary" className={`h-9 text-[10px] col-span-2 ${mode==='dxf_analysis'?'bg-emerald-600/20 text-emerald-400 border-emerald-500/50':''}`} active={mode==='dxf_analysis'} onClick={()=>setMode('dxf_analysis')}><Layers size={14}/> DXF Analysis</Button>}
                    </div>
                  </div>
              </div>
          )}
          {canFinish && mode!=='dxf_analysis' && <Button variant="primary" className="h-9 text-[11px] w-full bg-emerald-600 shadow-emerald-500/20" onClick={finishShape} icon={<Check size={16}/>}>CONFIRM (ENTER)</Button>}
          {currentPoints.length>0 && mode!=='dxf_analysis' && <div className="px-1 pt-2 border-t border-slate-800/50"><div className="flex items-center gap-2 text-[9px] text-slate-500 bg-slate-800/50 p-2 rounded"><Keyboard size={12}/><span>Fine-tune with arrow keys.</span></div></div>}
        </div>
      </div>

      <div className="flex-1 relative flex flex-col">
        <div className="h-14 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex items-center px-4 justify-between z-10 gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-400 uppercase">MODE: {mode}</div>
            {displayCoords && !activePointCoords && <div className="flex gap-4 font-mono text-[11px] text-slate-400"><span className="bg-slate-800/50 px-2 py-0.5 rounded">X: {displayCoords.x.toFixed(2)}</span><span className="bg-slate-800/50 px-2 py-0.5 rounded">Y: {displayCoords.y.toFixed(2)}</span>{displayCoords.isCad && <span className="text-[9px] self-center text-slate-500 uppercase">CAD</span>}</div>}
            {activePointCoords && mode !== 'origin' && <div className="flex gap-4 font-mono text-[11px] text-emerald-400 bg-emerald-950/30 px-3 py-1 rounded border border-emerald-500/30"><span className="font-bold text-[9px] text-emerald-500 uppercase self-center">Selected:</span><span>X: {activePointCoords.x.toFixed(2)}</span><span>Y: {activePointCoords.y.toFixed(2)}</span></div>}
          </div>
          {(selectedComponentId || selectedObjectGroupKey) && (
            <div className="flex items-center gap-4 animate-in fade-in slide-in-from-right-4">
              {selectedComponentId && (
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                    <Zap size={14} className="text-emerald-400" /><span>FLAGS:</span>
                    <div className="flex gap-1">
                      <span className={`px-1 rounded border ${dxfComponents.find(c => c.id === selectedComponentId)?.isWeld ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-600'}`}>W</span>
                      <span className={`px-1 rounded border ${dxfComponents.find(c => c.id === selectedComponentId)?.isMark ? 'bg-amber-600/20 border-amber-500/50 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-600'}`}>M</span>
                    </div>
                  </div>
              )}
              {selectedComponentId && (
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 border-l border-slate-800 pl-4">
                    <Palette size={14} /><span>COLOR:</span>
                    <input type="color" value={dxfComponents.find(c => c.id === selectedComponentId)?.color || '#6366f1'} onChange={(e) => updateComponentColor(selectedComponentId, e.target.value)} className="w-5 h-5 rounded cursor-pointer border border-slate-700 bg-transparent" onClick={e => e.stopPropagation()}/>
                </div>
              )}
              {selectedObjectGroupKey && (
                  <div className="flex items-center gap-2 text-[10px] font-bold text-cyan-400 bg-cyan-950/30 px-3 py-1 rounded-full border border-cyan-500/30 shadow-lg shadow-cyan-500/10">
                      <BoxSelect size={14} /><span className="uppercase">Viewing: {entitySizeGroups.find(g => g.key === selectedObjectGroupKey)?.label}</span>
                  </div>
              )}
            </div>
          )}
        </div>
        <div className="flex-1 p-6 relative bg-slate-950 flex items-center justify-center overflow-hidden">
          {isProcessing && <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center"><Loader2 className="animate-spin text-indigo-400 mb-2" size={48}/><p className="text-xs text-indigo-300 font-bold uppercase tracking-widest">Analyzing Geometry...</p></div>}
          <ImageCanvas src={imageSrc} mode={mode} calibrationData={calibrationData} measurements={measurements} parallelMeasurements={parallelMeasurements} areaMeasurements={areaMeasurements} curveMeasurements={curveMeasurements} currentPoints={currentPoints} onPointClick={handlePointClick} onDeleteMeasurement={(id)=>setMeasurements(m=>m.filter(x=>x.id!==id))} solderPoints={(mode === 'dxf_analysis' || mode === 'origin' || mode === 'box_group') ? solderPoints : []} dxfOverlayEntities={dxfOverlayEntities} originCanvasPos={originCanvasPos} onMousePositionChange={setMouseNormPos} onDimensionsChange={(w,h)=>setImgDimensions({width:w,height:h})} initialTransform={viewTransform} onViewChange={setViewTransform} showCalibration={showCalibration} showMeasurements={showMeasurements} featureROI={featureROI} featureResults={featureResults} selectedComponentId={selectedComponentId} selectedObjectGroupKey={selectedObjectGroupKey} />
        </div>
      </div>
    </div>
  );
}
