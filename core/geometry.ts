
import { Point } from './types';

export const getMmPerPixel = (
  calibrationData: { start: Point; end: Point; realWorldDistance: number } | null,
  imgWidth: number,
  imgHeight: number
) => {
  if (!calibrationData || imgWidth === 0) return 0;
  const dx = (calibrationData.start.x - calibrationData.end.x) * imgWidth;
  const dy = (calibrationData.start.y - calibrationData.end.y) * imgHeight;
  const distPx = Math.sqrt(dx * dx + dy * dy);
  return distPx > 0 ? calibrationData.realWorldDistance / distPx : 0;
};

export const getPhysDist = (p1: Point, p2: Point, imgWidth: number, imgHeight: number, mmPerPixel: number) => {
  const dx = (p1.x - p2.x) * imgWidth;
  const dy = (p1.y - p2.y) * imgHeight;
  return Math.sqrt(dx * dx + dy * dy) * mmPerPixel;
};

export const getPerpendicularPoint = (p: Point, l1: Point, l2: Point, imgWidth: number, imgHeight: number) => {
  const px = p.x * imgWidth, py = p.y * imgHeight;
  const l1x = l1.x * imgWidth, l1y = l1.y * imgHeight;
  const l2x = l2.x * imgWidth, l2y = l2.y * imgHeight;
  const dx = l2x - l1x, dy = l2y - l1y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return l1;
  const t = ((px - l1x) * dx + (py - l1y) * dy) / lenSq;
  return { x: (l1x + t * dx) / imgWidth, y: (l1y + t * dy) / imgHeight };
};

export const getPolygonArea = (points: Point[], imgWidth: number, imgHeight: number, mmPerPixel: number) => {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    area += (p1.x * imgWidth * p2.y * imgHeight) - (p2.x * imgWidth * p1.y * imgHeight);
  }
  return Math.abs(area / 2) * mmPerPixel * mmPerPixel;
};

export const getPolylineLength = (points: Point[], imgWidth: number, imgHeight: number, mmPerPixel: number) => {
  let len = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = (points[i + 1].x - points[i].x) * imgWidth;
    const dy = (points[i + 1].y - points[i].y) * imgHeight;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len * mmPerPixel;
};
