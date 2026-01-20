
import { Point } from '../types';

/**
 * Calculates the scale factor (units per pixel) based on calibration data.
 */
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

/**
 * Calculates physical distance between two points based on a scale factor and image dimensions.
 */
export const getPhysDist = (p1: Point, p2: Point, imgWidth: number, imgHeight: number, mmPerPixel: number) => {
  const dx = (p1.x - p2.x) * imgWidth;
  const dy = (p1.y - p2.y) * imgHeight;
  return Math.sqrt(dx * dx + dy * dy) * mmPerPixel;
};

/**
 * Finds the perpendicular projection of a point p onto the line defined by l1 and l2.
 */
export const getPerpendicularPoint = (p: Point, l1: Point, l2: Point, imgWidth: number, imgHeight: number) => {
  const px = p.x * imgWidth, py = p.y * imgHeight;
  const l1x = l1.x * imgWidth, l1y = l1.y * imgHeight;
  const l2x = l2.x * imgWidth, l2y = l2.y * imgHeight;
  const dx = l2x - l1x;
  const dy = l2y - l1y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return l1;
  const t = ((px - l1x) * dx + (py - l1y) * dy) / lenSq;
  return { x: (l1x + t * dx) / imgWidth, y: (l1y + t * dy) / imgHeight };
};

/**
 * Calculates the physical area of a polygon defined by a set of points.
 */
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

/**
 * Calculates the total physical length of a polyline.
 */
export const getPolylineLength = (points: Point[], imgWidth: number, imgHeight: number, mmPerPixel: number) => {
  let len = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = (points[i + 1].x - points[i].x) * imgWidth;
    const dy = (points[i + 1].y - points[i].y) * imgHeight;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len * mmPerPixel;
};

/**
 * Generates an SVG path string for a set of points.
 */
export const getPathData = (points: Point[], imgWidth: number, imgHeight: number) => {
  if (points.length < 1) return "";
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * imgWidth} ${p.y * imgHeight}`).join(' ');
};

/**
 * Generates a Catmull-Rom spline SVG path string for a set of points.
 */
export const getCatmullRomPath = (points: Point[], imgWidth: number, imgHeight: number) => {
  if (points.length < 2) return "";
  const pts = points.map(p => ({ x: p.x * imgWidth, y: p.y * imgHeight }));
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

  const p = [pts[0], ...pts, pts[pts.length - 1]];
  let pathData = `M ${pts[0].x} ${pts[0].y}`;
  const tension = 0.5;

  for (let i = 1; i < p.length - 2; i++) {
    const p0 = p[i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2];
    const cp1x = p1.x + (p2.x - p0.x) / 6 * tension;
    const cp1y = p1.y + (p2.y - p0.y) / 6 * tension;
    const cp2x = p2.x - (p3.x - p1.x) / 6 * tension;
    const cp2y = p2.y - (p3.y - p1.y) / 6 * tension;
    pathData += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return pathData;
};
