
import { useState, useEffect, useCallback } from 'react';
import { ProjectConfig, AppMode, ViewTransform } from '../types';
import { saveProjectConfig, loadProjectConfig } from '../utils/configUtils';

interface PersistenceProps {
  originalFileName: string | null;
  setOriginalFileName: (val: string | null) => void;
  dState: any;
  mState: any;
  aState: any;
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  viewTransform: ViewTransform | null;
  setViewTransform: (val: ViewTransform | null) => void;
  setImageSrc: (val: string | null) => void;
}

export function useProjectPersistence({
  originalFileName, setOriginalFileName, dState, mState, aState, 
  mode, setMode, viewTransform, setViewTransform, setImageSrc
}: PersistenceProps) {
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  const getProjectConfig = useCallback((): ProjectConfig => ({
    version: '1.2',
    originalFileName,
    lastModified: Date.now(),
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
  }), [originalFileName, dState, mState, mode, viewTransform, aState.dxfMatchSettings]);

  // 自动存入 localStorage 备份 (防抖)
  useEffect(() => {
    if (!originalFileName || mode === 'upload') return;
    const handler = setTimeout(() => {
      const config = getProjectConfig();
      localStorage.setItem('mark_weld_active_project', JSON.stringify(config));
      setLastSaved(Date.now());
    }, 3000);
    return () => clearTimeout(handler);
  }, [getProjectConfig, originalFileName, mode]);

  const saveProject = useCallback(() => {
    const config = getProjectConfig();
    saveProjectConfig(originalFileName, config);
    aState.setMatchStatus({ text: "Project Configuration Exported", type: 'success' });
  }, [getProjectConfig, originalFileName, aState]);

  const loadProject = useCallback(async (fileOrConfig: File | ProjectConfig) => {
    try {
      const config = fileOrConfig instanceof File ? await loadProjectConfig(fileOrConfig) : fileOrConfig;
      
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
      if (config.dxfMatchSettings) aState.setDxfMatchSettings(config.dxfMatchSettings);

      if (config.rawDxfData) {
        dState.setRawDxfData(config.rawDxfData);
        const { minX, maxY, totalW, totalH, padding } = config.rawDxfData;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX - padding} ${-maxY - padding} ${totalW} ${totalH}" width="1000" height="${(totalH/totalW)*1000}" style="background: #111;"></svg>`;
        setImageSrc(URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })));
        setMode('dxf_analysis');
      } else if (config.aiFeatureGroups?.length > 0) {
        setMode('feature_analysis');
      } else if (config.mode) {
        setMode(config.mode);
      }

      aState.setMatchStatus({ text: "Session Restored Successfully", type: 'success' });
    } catch (err: any) {
      aState.setMatchStatus({ text: `Restore failed: ${err.message}`, type: 'info' });
    }
  }, [dState, mState, aState, setOriginalFileName, setViewTransform, setImageSrc, setMode]);

  return { saveProject, loadProject, lastSaved };
}
