import { useState, useMemo, useCallback, useEffect } from 'react';
import { Point, AppMode, DxfComponent, DxfEntity, AiFeatureGroup, FeatureResult } from '../types';
import { generateId, getRandomColor } from '../utils';

interface InteractionLogicProps {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  dState: any;
  mState: any;
  aState: any;
  setPromptState: (state: any) => void;
  imgDimensions: { width: number, height: number } | null;
}

export function useInteractionLogic({ 
  mode, setMode, dState, mState, aState, setPromptState, imgDimensions 
}: InteractionLogicProps) {
  
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);

  // --- 计算属性 ---

  const canFinish = useMemo(() => {
    return (mode === 'calibrate' && currentPoints.length === 2) ||
           (mode === 'measure' && currentPoints.length === 2) ||
           (mode === 'parallel' && currentPoints.length === 3) ||
           (mode === 'area' && currentPoints.length > 2) ||
           (mode === 'curve' && currentPoints.length > 1) ||
           (mode === 'origin' && currentPoints.length === 1) ||
           (mode === 'feature' && currentPoints.length === 2) ||
           (mode === 'box_group' && currentPoints.length === 2);
  }, [mode, currentPoints]);

  // --- 辅助方法 ---

  const getComponentTightBounds = useCallback((compId: string) => {
    const comp = dState.dxfComponents.find((c: DxfComponent) => c.id === compId);
    if (!comp) return null;
    
    let b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    const processComp = (c: DxfComponent) => {
        c.entityIds.forEach(eid => {
            const ent = dState.dxfEntities.find((e: DxfEntity) => e.id === eid);
            if (ent) {
                b.minX = Math.min(b.minX, ent.minX); b.maxX = Math.max(b.maxX, ent.maxX);
                b.minY = Math.min(b.minY, ent.minY); b.maxY = Math.max(b.maxY, ent.maxY);
            }
        });
        (c.childGroupIds || []).forEach(cid => {
            const child = dState.dxfComponents.find((cc: DxfComponent) => cc.id === cid);
            if (child) processComp(child);
        });
    };
    processComp(comp);
    return b.minX === Infinity ? null : b;
  }, [dState.dxfComponents, dState.dxfEntities]);

  // --- 核心逻辑 ---

  const finishShape = useCallback(() => {
    try {
        if (currentPoints.length < 1) return;
        
        if (mode === 'calibrate' && currentPoints.length === 2) {
            setPromptState({
              isOpen: true, 
              title: "Calibration",
              description: "Enter the real-world distance and select the unit for the line you just drew.",
              defaultValue: "10.0",
              defaultUnit: dState.calibrationData?.unit || 'mm',
              showUnitSelector: true,
              onConfirm: (val: string, unit: string) => {
                const dist = parseFloat(val);
                if (!isNaN(dist) && dist > 0) {
                  dState.setCalibrationData({ 
                    start: currentPoints[0], 
                    end: currentPoints[1], 
                    realWorldDistance: dist, 
                    unit: unit || 'mm' 
                  });
                  setMode('measure'); 
                  setCurrentPoints([]); 
                  setPromptState((p: any) => ({ ...p, isOpen: false }));
                } else { 
                  alert("Please enter a valid positive number."); 
                }
              }
            });
            return;
        }

        if (mode === 'box_group' && currentPoints.length === 2) {
            if (!dState.rawDxfData) return;
            const p1 = currentPoints[0]; const p2 = currentPoints[1];
            const { minX, maxY, totalW, totalH, padding } = dState.rawDxfData;
            const normMinX = Math.min(p1.x, p2.x); const normMaxX = Math.max(p1.x, p2.x);
            const normMinY = Math.min(p1.y, p2.y); const normMaxY = Math.max(p1.y, p2.y);
            
            // Convert selection normalized coordinates to CAD coordinates
            const selMinX = (normMinX * totalW) + (minX - padding);
            const selMaxX = (normMaxX * totalW) + (minX - padding);
            const selMinY = (maxY + padding) - (normMaxY * totalH); 
            const selMaxY = (maxY + padding) - (normMinY * totalH);
            
            const EPS = 0.005; // Use a small tolerance for floating point comparisons

            // 1. Identify existing components whose PHYSICAL entities are fully within the box
            const enclosedGroups: string[] = [];
            // We only check top-level components to build a meta-structure
            const topLevelGroups = dState.dxfComponents.filter((c: DxfComponent) => !c.parentGroupId);
            
            topLevelGroups.forEach((comp: DxfComponent) => {
                const tb = getComponentTightBounds(comp.id);
                if (tb && 
                    tb.minX >= selMinX - EPS && tb.maxX <= selMaxX + EPS && 
                    tb.minY >= selMinY - EPS && tb.maxY <= selMaxY + EPS) {
                    enclosedGroups.push(comp.id);
                }
            });

            // 2. Map entities already claimed by identified groups to avoid redundancy
            const handledEntityIds = new Set<string>();
            const collectEntities = (groupId: string) => {
                const comp = dState.dxfComponents.find((c: DxfComponent) => c.id === groupId);
                if (comp) {
                    comp.entityIds.forEach(eid => handledEntityIds.add(eid));
                    (comp.childGroupIds || []).forEach(cid => collectEntities(cid));
                }
            };
            enclosedGroups.forEach(collectEntities);

            // 3. Find remaining loose entities within selection
            const enclosedEntities: string[] = [];
            dState.dxfEntities.forEach((ent: DxfEntity) => { 
                if (!handledEntityIds.has(ent.id)) {
                    if (ent.minX >= selMinX - EPS && ent.maxX <= selMaxX + EPS && 
                        ent.minY >= selMinY - EPS && ent.maxY <= selMaxY + EPS) {
                        enclosedEntities.push(ent.id); 
                    }
                }
            });

            if (enclosedEntities.length > 0 || enclosedGroups.length > 0) {
                const totalItemCount = enclosedEntities.length + enclosedGroups.length;
                const defaultName = `Meta Group ${dState.dxfComponents.length + 1}`;
                setPromptState({
                  isOpen: true, title: "New Component Group",
                  description: `Identified ${enclosedGroups.length} existing groups and ${enclosedEntities.length} loose items within selection.`,
                  defaultValue: defaultName,
                  onConfirm: (val: string) => {
                    const finalName = val.trim() || defaultName;
                    const newComponent: DxfComponent = {
                        id: generateId(), name: finalName, isVisible: true, isWeld: false, isMark: false, color: getRandomColor(),
                        entityIds: enclosedEntities, // Only direct loose entities
                        childGroupIds: enclosedGroups, // Hierarchical subgroups
                        seedSize: totalItemCount,
                        centroid: { x: (selMinX+selMaxX)/2, y: (selMinY+selMaxY)/2 },
                        bounds: { minX: selMinX, minY: selMinY, maxX: selMaxX, maxY: selMaxY }
                    };
                    dState.setDxfComponents((prev: DxfComponent[]) => [...prev, newComponent]);
                    aState.setSelectedComponentId(newComponent.id);
                    aState.setAnalysisTab('components');
                    setMode('dxf_analysis'); setCurrentPoints([]);
                    aState.setMatchStatus({ text: `Created Meta Group "${finalName}"`, type: 'info' });
                    setPromptState((p: any) => ({ ...p, isOpen: false }));
                  }
                });
            } else { aState.setMatchStatus({ text: "No items found in selection. Try a larger box.", type: 'info' }); }
            return;
        }

        if (mode === 'measure' && currentPoints.length === 2) {
             mState.setMeasurements((prev: any[]) => [...prev, { id: generateId(), start: currentPoints[0], end: currentPoints[1] }]);
             setCurrentPoints([]);
        } else if (mode === 'parallel' && currentPoints.length === 3) {
            mState.setParallelMeasurements((prev: any[]) => [...prev, { id: generateId(), baseStart: currentPoints[0], baseEnd: currentPoints[1], offsetPoint: currentPoints[2] }]);
            setCurrentPoints([]);
        } else if (mode === 'area' && currentPoints.length > 2) {
            mState.setAreaMeasurements((prev: any[]) => [...prev, { id: generateId(), points: currentPoints }]);
            setCurrentPoints([]);
        } else if (mode === 'curve' && currentPoints.length > 1) {
            mState.setCurveMeasurements((prev: any[]) => [...prev, { id: generateId(), points: currentPoints }]);
            setCurrentPoints([]);
        } else if (mode === 'origin' && currentPoints.length === 1) {
            const p = currentPoints[0]; const scaleInfo = dState.getScaleInfo();
            if (scaleInfo) {
                if (scaleInfo.isDxf && dState.rawDxfData) {
                    const { minX, maxY, totalW, totalH, padding } = dState.rawDxfData;
                    const cadX = p.x * totalW + (minX - padding);
                    const cadY = (maxY + padding) - p.y * totalH;
                    dState.setManualOriginCAD({ x: cadX, y: cadY });
                    setMode('measure'); 
                } else {
                    const absX = p.x * scaleInfo.totalWidthMM; const absY = p.y * scaleInfo.totalHeightMM;
                    dState.setManualOriginCAD({ x: absX, y: absY });
                    setMode('measure'); 
                }
            }
            setCurrentPoints([]);
        } else if (mode === 'feature' && currentPoints.length === 2) {
            const p1 = currentPoints[0]; const p2 = currentPoints[1];
            const defaultName = `Feature ${dState.aiFeatureGroups.length + 1}`;
            setPromptState({
                isOpen: true, title: "New Feature Group",
                description: "Name this feature definition.",
                defaultValue: defaultName,
                onConfirm: (val: string) => {
                    const finalName = val.trim() || defaultName;
                    const newFeature: FeatureResult = { id: generateId(), minX: Math.min(p1.x, p2.x), maxX: Math.max(p1.x, p2.x), minY: Math.min(p1.y, p2.y), maxY: Math.max(p1.y, p2.y), snapped: false };
                    const newGroup: AiFeatureGroup = { id: generateId(), name: finalName, isVisible: true, isWeld: false, isMark: false, color: getRandomColor(), features: [newFeature] };
                    dState.setAiFeatureGroups((prev: AiFeatureGroup[]) => [...prev, newGroup]);
                    aState.setSelectedAiGroupId(newGroup.id);
                    dState.setFeatureROI([]); setCurrentPoints([]); setMode('feature_analysis');
                    aState.setMatchStatus({ text: `Defined Feature "${finalName}"`, type: 'success' });
                    setPromptState((p: any) => ({ ...p, isOpen: false }));
                }
            });
        }
    } catch (err) { aState.setMatchStatus({ text: "An error occurred during confirmation.", type: 'info' }); }
  }, [currentPoints, mode, dState, aState, mState, setMode, setPromptState, getComponentTightBounds]);

  const handlePointClick = useCallback((p: Point) => {
    if (mode === 'upload' || mode === 'dxf_analysis' || mode === 'feature_analysis' || dState.isSearchingFeatures) return; 
    
    if (mode === 'origin') {
        if (dState.rawDxfData || dState.calibrationData) { if (currentPoints.length < 1) setCurrentPoints([p]); } 
        else { alert("Please calibrate the image first."); setMode('calibrate'); }
        return;
    }
    if (mode === 'calibrate') { if (currentPoints.length < 2) setCurrentPoints(prev => [...prev, p]); return; }
    if (mode === 'feature' || mode === 'box_group') { if (currentPoints.length < 2) setCurrentPoints(prev => [...prev, p]); return; }
    
    const nextPoints = [...currentPoints, p];
    if (mode === 'measure') { if (currentPoints.length < 2) setCurrentPoints(nextPoints); return; }
    if (mode === 'parallel') { if (currentPoints.length < 3) setCurrentPoints(nextPoints); return; }
    
    setCurrentPoints(nextPoints);
  }, [mode, currentPoints, dState, setMode]);

  // --- 键盘微调逻辑 ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
       if (e.key === 'Enter' && canFinish) { 
           // 确保不在输入框中时触发
           if (document.activeElement?.tagName !== 'INPUT') {
               e.preventDefault(); e.stopPropagation(); finishShape(); return; 
           }
       }
       if (!imgDimensions || currentPoints.length === 0) return;
       if (!['calibrate', 'measure', 'parallel', 'area', 'curve', 'origin', 'feature', 'box_group'].includes(mode)) return;
       if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT') return;

       if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
         e.preventDefault(); 
         let stepX = 0, stepY = 0; 
         const targetUnit = e.shiftKey ? 0.1 : 0.01; 
         const scaleInfo = dState.getScaleInfo();

         if (scaleInfo) { 
           stepX = (targetUnit / scaleInfo.mmPerPxX) / imgDimensions.width; 
           stepY = (targetUnit / scaleInfo.mmPerPxY) / imgDimensions.height; 
         } else { 
           stepX = (e.shiftKey ? 10 : 1) / imgDimensions.width; 
           stepY = (e.shiftKey ? 10 : 1) / imgDimensions.height; 
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
           p.x = Math.max(0, Math.min(1, p.x)); 
           p.y = Math.max(0, Math.min(1, p.y)); 
           const n = [...prev]; 
           n[lastIdx] = p; 
           return n; 
         });
       }
    };
    window.addEventListener('keydown', handleKeyDown); 
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canFinish, finishShape, imgDimensions, currentPoints, mode, dState]);

  return {
    currentPoints,
    setCurrentPoints,
    canFinish,
    finishShape,
    handlePointClick
  };
}
