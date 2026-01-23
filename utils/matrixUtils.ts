
import { DxfEntity, DxfEntityType } from '../types';

/**
 * 2D 仿射变换矩阵类型定义
 */
export type Matrix2D = { a: number, b: number, c: number, d: number, tx: number, ty: number };

/**
 * 单位矩阵
 */
export const identityMatrix: Matrix2D = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

/**
 * 矩阵相乘 (m1 * m2)
 */
export const multiplyMatrix = (m1: Matrix2D, m2: Matrix2D): Matrix2D => ({
  a: m1.a * m2.a + m1.c * m2.b,
  b: m1.b * m2.a + m1.d * m2.b,
  c: m1.a * m2.c + m1.c * m2.d,
  d: m1.b * m2.c + m1.d * m2.d,
  tx: m1.a * m2.tx + m1.c * m2.ty + m1.tx,
  ty: m1.b * m2.tx + m1.d * m2.ty + m1.ty
});

/**
 * 将点坐标应用矩阵变换
 */
export const transformPoint = (x: number, y: number, m: Matrix2D) => ({
  x: m.a * x + m.c * y + m.tx,
  y: m.b * x + m.d * y + m.ty
});

/**
 * 射线法判断点是否在多边形内部
 * @param px 目标点 X
 * @param py 目标点 Y
 * @param vertices 多边形顶点数组
 * @param eps 容差
 */
export const isPointInPolygon = (px: number, py: number, vertices: {x: number, y: number}[], eps: number = 1e-9) => {
    if (!vertices || vertices.length < 3) return false;
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const xi = vertices[i].x, yi = vertices[i].y;
        const xj = vertices[j].x, yj = vertices[j].y;
        
        // 边界线碰撞检测（在线上视为在内）
        const onEdge = (Math.abs((yj - yi) * px - (xj - xi) * py + xj * yi - yj * xi) < eps) &&
                       (px >= Math.min(xi, xj) - eps && px <= Math.max(xi, xj) + eps) &&
                       (py >= Math.min(yi, yj) - eps && py <= Math.max(yi, yj) + eps);
        if (onEdge) return true;

        const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

/**
 * 精准碰撞检测：判断 CAD 空间坐标点是否命中某个实体
 * @param px 点击点 X
 * @param py 点击点 Y
 * @param ent CAD 实体
 * @param threshold 距离阈值
 */
export const checkEntityHit = (px: number, py: number, ent: DxfEntity, threshold: number): boolean => {
    const raw = ent.rawEntity;
    if (!raw) return false;
    let dist = Infinity;

    if (ent.type === 'LINE') {
        const v = raw.vertices;
        if (!v || v.length < 2) return false;
        const x1 = v[0].x, y1 = v[0].y, x2 = v[1].x, y2 = v[1].y;
        const l2 = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
        if (l2 === 0) dist = Math.sqrt(Math.pow(px - x1, 2) + Math.pow(py - x1, 2));
        else {
            let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
            t = Math.max(0, Math.min(1, t));
            dist = Math.sqrt(Math.pow(px - (x1 + t * (x2 - x1)), 2) + Math.pow(py - (y1 + t * (y2 - y1)), 2));
        }
    } else if (ent.type === 'CIRCLE') {
        if (!raw.center) return false;
        const distToCenter = Math.sqrt(Math.pow(px - raw.center.x, 2) + Math.pow(py - raw.center.y, 2));
        // 如果点在圆内，直接视为命中
        if (distToCenter <= (raw.radius || 0)) return true;
        // 否则判断到圆周的距离
        dist = Math.abs(distToCenter - (raw.radius || 0));
    } else if (ent.type === 'LWPOLYLINE') {
        const v = raw.vertices;
        if (!v || v.length < 2) return false;
        // 闭合多边形内部检测
        if (v.length > 2) {
            const isClosed = raw.shape || (
                Math.abs(v[0].x - v[v.length-1].x) < 0.001 &&
                Math.abs(v[0].y - v[v.length-1].y) < 0.001
            );
            if (isClosed && isPointInPolygon(px, py, v)) return true;
        }
        // 线段距离检测
        for (let i = 0; i < v.length - 1; i++) {
            const x1 = v[i].x, y1 = v[i].y, x2 = v[i+1].x, y2 = v[i+1].y;
            const l2 = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
            let t = l2 === 0 ? 0 : ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
            t = Math.max(0, Math.min(1, t));
            const d = Math.sqrt(Math.pow(px - (x1 + t * (x2 - x1)), 2) + Math.pow(py - (y1 + t * (y2 - y1)), 2));
            if (d < dist) dist = d;
        }
    } else if (ent.type === 'ARC') {
        if (!raw.center) return false;
        const dx = px - raw.center.x, dy = py - raw.center.y;
        const distToCenter = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const normAngle = (angle + Math.PI * 2) % (Math.PI * 2);
        const start = ((raw.startAngle || 0) + Math.PI * 2) % (Math.PI * 2);
        const end = ((raw.endAngle || 0) + Math.PI * 2) % (Math.PI * 2);
        let inRange = start < end ? (normAngle >= start && normAngle <= end) : (normAngle >= start || normAngle <= end);
        if (inRange) dist = Math.abs(distToCenter - (raw.radius || 0));
    }
    return dist < threshold;
};
