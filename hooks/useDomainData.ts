
import { useState, useCallback } from 'react';
import { Point, CalibrationData, DxfEntity, DxfComponent, AiFeatureGroup } from '../types';

export function useDomainData() {
  // 基础物理与校准状态
  const [imgDimensions, setImgDimensions] = useState<{width: number, height: number} | null>(null);
  const [calibrationData, setCalibrationData] = useState<CalibrationData | null>(null);
  
  // DXF 数据源
  const [rawDxfData, setRawDxfData] = useState<any | null>(null);
  const [manualOriginCAD, setManualOriginCAD] = useState<{x: number, y: number} | null>(null);
  
  // 核心集合数据
  const [dxfEntities, setDxfEntities] = useState<DxfEntity[]>([]);
  const [dxfComponents, setDxfComponents] = useState<DxfComponent[]>([]);
  const [aiFeatureGroups, setAiFeatureGroups] = useState<AiFeatureGroup[]>([]);
  
  // AI 搜索运行时状态
  const [featureROI, setFeatureROI] = useState<Point[]>([]); 
  const [isSearchingFeatures, setIsSearchingFeatures] = useState(false);

  // 坐标与缩放计算逻辑 (物理迁移自 App.tsx)
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

  const getLogicCoords = useCallback((p: Point) => {
      const scaleInfo = getScaleInfo();
      const hasOrigin = !!manualOriginCAD || (!!rawDxfData);
      
      if (!scaleInfo || !hasOrigin) return null;

      if (rawDxfData) {
        const { minX, maxY, totalW, totalH, padding, defaultCenterX, defaultCenterY } = rawDxfData;
        const ox = manualOriginCAD ? manualOriginCAD.x : defaultCenterX; 
        const oy = manualOriginCAD ? manualOriginCAD.y : defaultCenterY;
        return { x: (p.x * totalW + minX - padding) - ox, y: (maxY + padding - p.y * totalH) - oy, isCad: true };
      } 
      
      const absX = p.x * scaleInfo.totalWidthMM; 
      const absY = p.y * scaleInfo.totalHeightMM;
      const ox = manualOriginCAD?.x || 0;
      const oy = manualOriginCAD?.y || 0;
      
      return { x: absX - ox, y: absY - oy, isCad: false };
  }, [rawDxfData, manualOriginCAD, getScaleInfo]);

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
    getLogicCoords
  };
}
