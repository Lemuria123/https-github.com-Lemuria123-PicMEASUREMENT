
import { Point, CalibrationData } from '../types';

export const UNIT_CONVERSIONS: Record<string, number> = {
  'mm': 1,
  'cm': 10,
  'm': 1000,
  'in': 25.4,
  'ft': 304.8,
  'yd': 914.4
};

export const getScaleInfo = (
  imgDimensions: { width: number; height: number } | null,
  rawDxfData: any | null,
  calibrationData: CalibrationData | null
) => {
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
};

export const getLogicCoords = (
    p: Point, 
    rawDxfData: any | null, 
    calibrationData: CalibrationData | null, 
    manualOriginCAD: { x: number, y: number } | null,
    scaleInfo: any | null
) => {
  if (rawDxfData) {
    const { minX, maxY, totalW, totalH, padding, defaultCenterX, defaultCenterY } = rawDxfData;
    const ox = manualOriginCAD ? manualOriginCAD.x : defaultCenterX;
    const oy = manualOriginCAD ? manualOriginCAD.y : defaultCenterY;
    return { x: (p.x * totalW + minX - padding) - ox, y: (maxY + padding - p.y * totalH) - oy, isCad: true };
  } 
  if (calibrationData && scaleInfo) {
      const absX = p.x * scaleInfo.totalWidthMM; 
      const absY = p.y * scaleInfo.totalHeightMM;
      return manualOriginCAD ? { x: absX - manualOriginCAD.x, y: absY - manualOriginCAD.y, isCad: false } : { x: absX, y: absY, isCad: false };
  }
  return null;
};
