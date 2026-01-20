import { Point, DxfEntity } from '../types';

/**
 * 2D Transformation Matrix Type
 */
export type Matrix2D = { a: number, b: number, c: number, d: number, tx: number, ty: number };

export const identityMatrix: Matrix2D = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

/**
 * Unified Coordinate Transformer
 * Handles all translations between CAD/Logic space and Normalized Canvas space (0-1).
 */
export class CoordinateTransformer {
  constructor(
    private rawDxfData: any | null,
    private calibrationScale: { totalWidthMM: number; totalHeightMM: number } | null,
    private manualOrigin: { x: number; y: number } | null,
    private imgSize: { width: number, height: number } | null = null
  ) {}

  /**
   * Internal helper: Get the current anchor (manual origin or default center)
   */
  private getAnchor(): { x: number, y: number } {
    if (this.rawDxfData) {
      return this.manualOrigin || { 
        x: this.rawDxfData.defaultCenterX, 
        y: this.rawDxfData.defaultCenterY 
      };
    }
    return this.manualOrigin || { x: 0, y: 0 };
  }

  /**
   * Normalized (0-1) to Absolute CAD/Physical MM (ignore origin)
   */
  toAbsoluteCAD(p: Point): { x: number, y: number } | null {
    if (this.rawDxfData) {
      const { minX, maxY, totalW, totalH, padding } = this.rawDxfData;
      
      let effectiveH = totalH;
      if (this.imgSize && this.imgSize.width > 0 && this.imgSize.height > 0) {
          const renderedRatio = this.imgSize.height / this.imgSize.width;
          effectiveH = totalW * renderedRatio;
      }

      return {
        x: (p.x * totalW + minX - padding),
        y: (maxY + padding - p.y * effectiveH)
      };
    }
    if (this.calibrationScale) {
      return {
        x: p.x * this.calibrationScale.totalWidthMM,
        y: p.y * this.calibrationScale.totalHeightMM
      };
    }
    return null;
  }

  /**
   * CAD Absolute to Normalized (0-1)
   */
  toNormalizedFromAbsolute(absP: { x: number, y: number }): Point | null {
    if (this.rawDxfData) {
      const { minX, maxY, totalW, totalH, padding } = this.rawDxfData;
      
      let effectiveH = totalH;
      if (this.imgSize && this.imgSize.width > 0 && this.imgSize.height > 0) {
          const renderedRatio = this.imgSize.height / this.imgSize.width;
          effectiveH = totalW * renderedRatio;
      }

      return {
        x: (absP.x - (minX - padding)) / totalW,
        y: (maxY + padding - absP.y) / effectiveH
      };
    }
    if (this.calibrationScale) {
      return {
        x: absP.x / this.calibrationScale.totalWidthMM,
        y: absP.y / this.calibrationScale.totalHeightMM
      };
    }
    return null;
  }

  /**
   * NEW: Direct CAD Absolute to Logic (relative to origin)
   * This is the master function for all coordinate displays and exports.
   */
  absoluteToLogic(absP: { x: number, y: number }): { x: number, y: number } | null {
    const anchor = this.getAnchor();
    // In DXF mode, the logic system is simply a translation in CAD space.
    // The pixel-rounding compensation is only needed when mapping to/from Normalized space.
    return {
      x: absP.x - anchor.x,
      y: absP.y - anchor.y
    };
  }

  /**
   * Normalized (0-1) to Logic (relative to origin)
   */
  toLogic(p: Point): { x: number; y: number } | null {
    const abs = this.toAbsoluteCAD(p);
    if (!abs) return null;
    return this.absoluteToLogic(abs);
  }

  /**
   * Logic (relative to origin) to Normalized (0-1)
   */
  toNormalized(lp: { x: number, y: number }): Point | null {
    const anchor = this.getAnchor();
    const absX = lp.x + anchor.x;
    const absY = lp.y + anchor.y;
    return this.toNormalizedFromAbsolute({ x: absX, y: absY });
  }
}

export const multiplyMatrix = (m1: Matrix2D, m2: Matrix2D): Matrix2D => ({
  a: m1.a * m2.a + m1.c * m2.b,
  b: m1.b * m2.a + m1.d * m2.b,
  c: m1.a * m2.c + m1.c * m2.d,
  d: m1.b * m2.c + m1.d * m2.d,
  tx: m1.a * m2.tx + m1.c * m2.ty + m1.tx,
  ty: m1.b * m2.tx + m1.d * m2.ty + m1.ty
});

export const transformPoint = (x: number, y: number, m: Matrix2D) => ({
  x: m.a * x + m.c * y + m.tx,
  y: m.b * x + m.d * y + m.ty
});

export const isPointInPolygon = (px: number, py: number, vertices: {x: number, y: number}[]) => {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const xi = vertices[i].x, yi = vertices[i].y;
        const xj = vertices[j].x, yj = vertices[j].y;
        const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

export const checkEntityHit = (px: number, py: number, ent: DxfEntity, threshold: number): boolean => {
    const raw = ent.rawEntity;
    let dist = Infinity;
    if (ent.type === 'LINE') {
        const v = raw.vertices;
        const x1 = v[0].x, y1 = v[0].y, x2 = v[1].x, y2 = v[1].y;
        const l2 = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
        if (l2 === 0) dist = Math.sqrt(Math.pow(px - x1, 2) + Math.pow(py - y1, 2));
        else {
            let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
            t = Math.max(0, Math.min(1, t));
            dist = Math.sqrt(Math.pow(px - (x1 + t * (x2 - x1)), 2) + Math.pow(py - (y1 + t * (y2 - y1)), 2));
        }
    } else if (ent.type === 'CIRCLE') {
        const distToCenter = Math.sqrt(Math.pow(px - raw.center.x, 2) + Math.pow(py - raw.center.y, 2));
        if (distToCenter <= raw.radius) return true;
        dist = Math.abs(distToCenter - raw.radius);
    } else if (ent.type === 'LWPOLYLINE') {
        if (raw.vertices.length > 2) {
            const isClosed = raw.shape || (
                Math.abs(raw.vertices[0].x - raw.vertices[raw.vertices.length-1].x) < 0.001 &&
                Math.abs(raw.vertices[0].y - raw.vertices[raw.vertices.length-1].y) < 0.001
            );
            if (isClosed && isPointInPolygon(px, py, raw.vertices)) return true;
        }
        for (let i = 0; i < raw.vertices.length - 1; i++) {
            const x1 = raw.vertices[i].x, y1 = raw.vertices[i].y, x2 = raw.vertices[i+1].x, y2 = raw.vertices[i+1].y;
            const l2 = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
            let t = l2 === 0 ? 0 : ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
            t = Math.max(0, Math.min(1, t));
            const d = Math.sqrt(Math.pow(px - (x1 + t * (x2 - x1)), 2) + Math.pow(py - (y1 + t * (y2 - y1)), 2));
            if (d < dist) dist = d;
        }
    } else if (ent.type === 'ARC') {
        const dx = px - raw.center.x, dy = py - raw.center.y;
        const distToCenter = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const normAngle = (angle + Math.PI * 2) % (Math.PI * 2);
        const start = (raw.startAngle + Math.PI * 2) % (Math.PI * 2);
        const end = (raw.endAngle + Math.PI * 2) % (Math.PI * 2);
        let inRange = start < end ? (normAngle >= start && normAngle <= end) : (normAngle >= start || normAngle <= end);
        if (inRange) dist = Math.abs(distToCenter - raw.radius);
    }
    return dist < threshold;
};

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
  const dx = l2x - l1x;
  const dy = l2y - l1y;
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

export const getPathData = (points: Point[], imgWidth: number, imgHeight: number) => {
  if (points.length < 1) return "";
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * imgWidth} ${p.y * imgHeight}`).join(' ');
};

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