import { useState, useCallback, useMemo } from 'react';
import { Point, CalibrationData, DxfEntity, DxfComponent, AiFeatureGroup } from '../types';
import { CoordinateTransformer } from '../utils/geometry';

export function useDomainData() {
  const [imgDimensions, setImgDimensions] = useState<{width: number, height: number} | null>(null);
  const [calibrationData, setCalibrationData] = useState<CalibrationData | null>(null);
  const [rawDxfData, setRawDxfData] = useState<any | null>(null);
  const [manualOriginCAD, setManualOriginCAD] = useState<{x: number, y: number} | null>(null);
  const [dxfEntities, setDxfEntities] = useState<DxfEntity[]>([]);
  const [dxfComponents, setDxfComponents] = useState<DxfComponent[]>([]);
  const [aiFeatureGroups, setAiFeatureGroups] = useState<AiFeatureGroup[]>([]);
  const [featureROI, setFeatureROI] = useState<Point[]>([]); 
  const [isSearchingFeatures, setIsSearchingFeatures] = useState(false);

  const getScaleInfo = useCallback(() => {
      if (!imgDimensions) return null;
      if (rawDxfData) {
          return {
              mmPerPxX: rawDxfData.totalW / imgDimensions.width,
              mmPerPxY: rawDxfData.totalH / imgDimensions.height,
              totalWidthMM: rawDxfData.totalW,
              totalHeightMM: rawDxfData.totalH,
              isDxf: true
          };
      }
      if (calibrationData) {
          const cDx = (calibrationData.start.x - calibrationData.end.x) * imgDimensions.width;
          const cDy = (calibrationData.start.y - calibrationData.end.y) * imgDimensions.height;
          const distPx = Math.sqrt(cDx*cDx + cDy*cDy);
          const unitPerPx = distPx > 0 ? calibrationData.realWorldDistance / distPx : 0;
          return {
              mmPerPxX: unitPerPx,
              mmPerPxY: unitPerPx,
              totalWidthMM: imgDimensions.width * unitPerPx,
              totalHeightMM: imgDimensions.height * unitPerPx,
              isDxf: false
          };
      }
      return null;
  }, [imgDimensions, rawDxfData, calibrationData]);

  // Unified Transformer Instance - Now pixel-aware
  const transformer = useMemo(() => {
    return new CoordinateTransformer(rawDxfData, getScaleInfo(), manualOriginCAD, imgDimensions);
  }, [rawDxfData, getScaleInfo, manualOriginCAD, imgDimensions]);

  const getLogicCoords = useCallback((p: Point) => {
    const coords = transformer.toLogic(p);
    return coords ? { ...coords, isCad: !!rawDxfData } : null;
  }, [transformer, rawDxfData]);

  return {
    imgDimensions, setImgDimensions,
    calibrationData, setCalibrationData,
    rawDxfData, setRawDxfData,
    manualOriginCAD, setManualOriginCAD,
    dxfEntities, setDxfEntities,
    dxfComponents, setDxfComponents,
    aiFeatureGroups, setAiFeatureGroups,
    featureROI, setFeatureROI,
    isSearchingFeatures, setIsSearchingFeatures,
    getScaleInfo,
    getLogicCoords,
    transformer // Export transformer for direct use elsewhere
  };
}