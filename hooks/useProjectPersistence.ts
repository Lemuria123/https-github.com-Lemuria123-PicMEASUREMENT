import { useCallback, useEffect } from 'react';
import { ProjectConfig, AppMode, ViewTransform } from '../types';
import { saveProjectConfig, loadProjectConfig } from '../utils/configUtils';

interface PersistenceProps {
  originalFileName: string | null;
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  viewTransform: ViewTransform | null;
  setViewTransform: (vt: ViewTransform | null) => void;
  dState: any;
  mState: any;
  aState: any;
}

export function useProjectPersistence({
  originalFileName, 
  mode, 
  setMode, 
  viewTransform, 
  setViewTransform, 
  dState, 
  mState, 
  aState
}: PersistenceProps) {
  
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
      viewTransform,
      dxfMatchSettings: aState.dxfMatchSettings
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
      if (config.dxfMatchSettings) aState.setDxfMatchSettings(config.dxfMatchSettings);
      
      aState.setMatchStatus({ text: "Project Configuration Loaded", type: 'success' });
    } catch (err: any) { aState.setMatchStatus({ text: `Reload failed: ${err.message}`, type: 'info' }); }
  }, [dState, mState, aState, setMode, setViewTransform]);

  useEffect(() => {
     if (!originalFileName) return;
     const t = setTimeout(() => { 
        localStorage.setItem('mark_weld_last_session', JSON.stringify({ 
            fileName: originalFileName, 
            manualOriginCAD: dState.manualOriginCAD, 
            viewTransform 
        })); 
     }, 500);
     return () => clearTimeout(t);
  }, [originalFileName, dState.manualOriginCAD, viewTransform]);

  return { saveProject, loadProject };
}
