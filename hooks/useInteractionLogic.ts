
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Point, AppMode } from '../types';

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

  useEffect(() => {
    setCurrentPoints([]);
  }, [mode]);

  const canFinish = useMemo(() => {
    return (mode === 'calibrate' && currentPoints.length === 2) ||
           (mode === 'measure' && currentPoints.length === 2) ||
           (mode === 'parallel' && currentPoints.length === 3) ||
           (mode === 'area' && currentPoints.length > 2) ||
           (mode === 'curve' && currentPoints.length > 1) ||
           (mode === 'origin' && currentPoints.length === 1) ||
           (mode === 'feature' && currentPoints.length === 2) ||
           (mode === 'box_rect' && currentPoints.length === 2) ||
           (mode === 'box_poly' && currentPoints.length >= 3) ||
           (mode === 'box_find_roi' && currentPoints.length === 2);
  }, [mode, currentPoints]);

  const handlePointClick = useCallback((p: Point) => {
    if (mode === 'upload' || mode === 'dxf_analysis' || mode === 'feature_analysis' || dState.isSearchingFeatures) return; 
    
    if (mode === 'origin') {
        if (dState.rawDxfData || dState.calibrationData) { if (currentPoints.length < 1) setCurrentPoints([p]); } 
        else { alert("Please calibrate the image first."); setMode('calibrate'); }
        return;
    }
    if (mode === 'calibrate') { if (currentPoints.length < 2) setCurrentPoints(prev => [...prev, p]); return; }
    if (mode === 'feature') { if (currentPoints.length < 2) setCurrentPoints(prev => [...prev, p]); return; }
    if (mode === 'box_find_roi') { if (currentPoints.length < 2) setCurrentPoints(prev => [...prev, p]); return; }
    
    // Rectangle logic: auto-stop at 2
    if (mode === 'box_rect') {
      if (currentPoints.length < 2) setCurrentPoints(prev => [...prev, p]);
      return;
    }

    // Polygon interaction: handle auto-close/threshold
    if (mode === 'box_poly') {
        if (currentPoints.length >= 3) {
            const start = currentPoints[0];
            const dx = (p.x - start.x);
            const dy = (p.y - start.y);
            const dist = Math.sqrt(dx*dx + dy*dy);
            const viewScale = (window as any).lastCanvasScale || 1.0;
            const threshold = 0.012 / viewScale; 
            if (dist < threshold) return; 
        }
    }

    const nextPoints = [...currentPoints, p];
    if (mode === 'measure') { if (currentPoints.length < 2) setCurrentPoints(nextPoints); return; }
    if (mode === 'parallel') { if (currentPoints.length < 3) setCurrentPoints(nextPoints); return; }
    
    setCurrentPoints(nextPoints);
  }, [mode, currentPoints, dState, setMode]);

  return {
    currentPoints,
    setCurrentPoints,
    canFinish,
    handlePointClick
  };
}
