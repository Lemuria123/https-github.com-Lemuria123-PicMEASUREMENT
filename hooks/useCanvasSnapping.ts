
import { useState, useMemo, useCallback } from 'react';
import { Point, CalibrationData, LineSegment } from '../types';

interface UseCanvasSnappingProps {
  calibrationData: CalibrationData | null;
  originCanvasPos?: Point | null;
  currentPoints: Point[];
  measurements: LineSegment[];
  layoutSize: { width: number, height: number };
  scale: number;
}

export function useCanvasSnapping({
  calibrationData,
  originCanvasPos,
  currentPoints,
  measurements,
  layoutSize,
  scale
}: UseCanvasSnappingProps) {
  const [snappedPos, setSnappedPos] = useState<Point | null>(null);

  const snapTargets = useMemo(() => {
    const targets: Point[] = [];
    if (calibrationData) targets.push(calibrationData.start, calibrationData.end);
    if (originCanvasPos) targets.push(originCanvasPos);
    currentPoints.forEach(p => targets.push(p));
    measurements.forEach(m => targets.push(m.start, m.end));
    return targets;
  }, [calibrationData, originCanvasPos, currentPoints, measurements]);

  const findSnappedPoint = useCallback((p: Point | null) => {
    if (!p || layoutSize.width === 0) {
        setSnappedPos(null);
        return null;
    }

    let closest: Point | null = null;
    let minDist = Infinity;
    const SNAP_RADIUS = 12; // 像素级吸附半径

    for (const target of snapTargets) {
      const dx = (p.x - target.x) * (layoutSize.width * scale);
      const dy = (p.y - target.y) * (layoutSize.height * scale);
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < SNAP_RADIUS && dist < minDist) {
        minDist = dist;
        closest = target;
      }
    }

    setSnappedPos(closest);
    return closest;
  }, [snapTargets, layoutSize, scale]);

  return { snappedPos, setSnappedPos, findSnappedPoint };
}
