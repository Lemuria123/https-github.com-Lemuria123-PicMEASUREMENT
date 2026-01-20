import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Point, AppMode, ViewTransform
} from '../types';
import { parseDxfFile } from '../utils/dxfService';

import { useMeasurementState } from './useMeasurementState';
import { useAnalysisState } from './useAnalysisState';
import { useDomainData } from './useDomainData';
import { useDxfAnalysis } from './useDxfAnalysis';
import { useAiAnalysis } from './useAiAnalysis';
import { useInteractionLogic } from './useInteractionLogic';
import { useDxfOverlay } from './useDxfOverlay';
import { useAiOverlay } from './useAiOverlay';
import { useProjectPersistence } from './useProjectPersistence';
import { useHoverDetection } from './useHoverDetection';

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

  const { saveProject, loadProject } = useProjectPersistence({
    originalFileName,
    mode,
    setMode,
    viewTransform,
    setViewTransform,
    dState,
    mState,
    aState
  });

  // --- HOVER DETECTION HOOK ---
  useHoverDetection({
    mouseNormPos,
    mode,
    viewTransform,
    dState,
    aState
  });

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
    uiBase: Math.min(dState.imgDimensions?.width || 500, dState.imgDimensions?.height || 500) / 500,
    scale: viewTransform?.scale || 1
  });

  const originCanvasPos = useMemo(() => {
    // UNIFIED: The origin in Logic space is ALWAYS (0,0).
    // Converting logic (0,0) to Normalized space gives us the pixel-percentage for the UI crosshair.
    return dState.transformer.toNormalized({ x: 0, y: 0 });
  }, [dState.transformer]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    event.target.value = ''; setIsProcessing(true); setOriginalFileName(file.name);
    
    // Reset States
    mState.setMeasurements([]); mState.setParallelMeasurements([]); mState.setAreaMeasurements([]); mState.setCurveMeasurements([]);
    dState.setManualOriginCAD(null); dState.setCalibrationData(null); setViewTransform(null);
    dState.setFeatureROI([]); dState.setDxfEntities([]); dState.setDxfComponents([]);
    dState.setAiFeatureGroups([]); aState.clearAllSelections(); aState.setInspectComponentId(null);
    interaction.setCurrentPoints([]);

    if (file.name.toLowerCase().endsWith('.dxf')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const result = parseDxfFile(e.target?.result as string);
          dState.setDxfEntities(result.entities);
          dState.setRawDxfData(result.rawDxfData);
          setImageSrc(URL.createObjectURL(new Blob([result.svgPreview], { type: 'image/svg+xml' })));
          dState.setCalibrationData(result.initialCalibration);
          setMode('measure'); 
        } catch(err: any) { 
          alert(`DXF Parse Error: ${err.message}`); 
        } finally {
          setIsProcessing(false);
        }
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

  return {
    imageSrc, setImageSrc, mode, setMode, isProcessing, setIsProcessing, originalFileName, setOriginalFileName, fileInputRef, mouseNormPos, setMouseNormPos, viewTransform, setViewTransform,
    mState, aState, dState, promptState, setPromptState, dxfOverlayEntities, aiOverlayEntities, originCanvasPos, handleFileUpload, toggleEntityInSelection, saveProject, loadProject,
    ...dxfAnalysis, ...aiAnalysis, ...interaction
  };
}