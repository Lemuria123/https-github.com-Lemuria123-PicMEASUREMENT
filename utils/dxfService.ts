import DxfParser from 'dxf-parser';
import { generateId } from '../utils';
import { 
  identityMatrix, 
  multiplyMatrix, 
  transformPoint, 
  Matrix2D 
} from './geometry';
import { DxfEntity, DxfEntityType, CalibrationData } from '../types';

export interface DxfParseResult {
  entities: DxfEntity[];
  rawDxfData: {
    circles: any[];
    defaultCenterX: number;
    defaultCenterY: number;
    minX: number;
    maxX: number;
    maxY: number;
    totalW: number;
    totalH: number;
    padding: number;
  };
  svgPreview: string;
  initialCalibration: CalibrationData;
}

/**
 * Parses a DXF file string and returns structured data for the application.
 * This is a pure utility function decoupled from React state.
 */
export const parseDxfFile = (content: string): DxfParseResult => {
  const parser = new DxfParser();
  const dxf = parser.parseSync(content);
  if (!dxf) throw new Error("Failed to parse DXF structure.");

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const circles: any[] = [];
  const parsedEntities: DxfEntity[] = [];

  // Recursive function to handle INSERT entities and BLOCKS
  const processEntities = (entities: any[], transform: Matrix2D) => {
    entities.forEach((entity: any) => {
      if (entity.type === 'INSERT') {
        if (dxf.blocks && entity.name && dxf.blocks[entity.name]) {
          const block = dxf.blocks[entity.name];
          if (block.entities) {
            const px = entity.position?.x || 0;
            const py = entity.position?.y || 0;
            const rotRad = (entity.rotation || 0) * Math.PI / 180;
            const sx = entity.scale?.x ?? 1;
            const sy = entity.scale?.y ?? 1;
            const bx = block.position?.x || 0;
            const by = block.position?.y || 0;
            
            const cos = Math.cos(rotRad);
            const sin = Math.sin(rotRad);
            
            const a = sx * cos;
            const b = sx * sin;
            const c = -sy * sin;
            const d = sy * cos;
            
            const tx = px - (a * bx + c * by);
            const ty = py - (b * bx + d * by);
            
            const localMatrix: Matrix2D = { a, b, c, d, tx, ty };
            const nextMatrix = multiplyMatrix(transform, localMatrix);
            processEntities(block.entities, nextMatrix);
          }
        }
        return;
      }

      let type: DxfEntityType = 'UNKNOWN';
      let entBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
      let isValid = false;
      let rawEntity = { ...entity };

      if (entity.type === 'LINE') {
        type = 'LINE';
        rawEntity.vertices = entity.vertices.map((v: any) => {
          const tv = transformPoint(v.x, v.y, transform);
          return { ...v, x: tv.x, y: tv.y };
        });
        const xs = rawEntity.vertices.map((v: any) => v.x);
        const ys = rawEntity.vertices.map((v: any) => v.y);
        entBounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
        isValid = true;
      }
      else if (entity.type === 'CIRCLE') {
        type = 'CIRCLE';
        const tc = transformPoint(entity.center.x, entity.center.y, transform);
        rawEntity.center = { ...entity.center, x: tc.x, y: tc.y };
        const sVecX = Math.sqrt(transform.a * transform.a + transform.b * transform.b);
        const sVecY = Math.sqrt(transform.c * transform.c + transform.d * transform.d);
        const scaleFactor = (sVecX + sVecY) / 2;
        rawEntity.radius = entity.radius * scaleFactor;
        const r = rawEntity.radius;
        entBounds = { minX: rawEntity.center.x - r, maxX: rawEntity.center.x + r, minY: rawEntity.center.y - r, maxY: rawEntity.center.y + r };
        isValid = true;
        circles.push(rawEntity);
      }
      else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
        type = 'LWPOLYLINE';
        if (entity.vertices?.length > 0) {
          rawEntity.vertices = entity.vertices.map((v: any) => {
            const tv = transformPoint(v.x, v.y, transform);
            return { ...v, x: tv.x, y: tv.y };
          });
          const xs = rawEntity.vertices.map((v: any) => v.x);
          const ys = rawEntity.vertices.map((v: any) => v.y);
          entBounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
          isValid = true;
        }
      }
      else if (entity.type === 'ARC') {
        type = 'ARC';
        const tc = transformPoint(entity.center.x, entity.center.y, transform);
        rawEntity.center = { ...entity.center, x: tc.x, y: tc.y };
        const sVecX = Math.sqrt(transform.a * transform.a + transform.b * transform.b);
        const sVecY = Math.sqrt(transform.c * transform.c + transform.d * transform.d);
        const scaleFactor = (sVecX + sVecY) / 2;
        rawEntity.radius = entity.radius * scaleFactor;
        const matrixRot = Math.atan2(transform.b, transform.a);
        rawEntity.startAngle = entity.startAngle + matrixRot;
        rawEntity.endAngle = entity.endAngle + matrixRot;
        const r = rawEntity.radius;
        entBounds = { minX: rawEntity.center.x - r, maxX: rawEntity.center.x + r, minY: rawEntity.center.y - r, maxY: rawEntity.center.y + r };
        isValid = true;
      }

      if (isValid) {
        minX = Math.min(minX, entBounds.minX);
        minY = Math.min(minY, entBounds.minY);
        maxX = Math.max(maxX, entBounds.maxX);
        maxY = Math.max(maxY, entBounds.maxY);
        parsedEntities.push({
          id: generateId(),
          type,
          layer: entity.layer || '0',
          minX: entBounds.minX,
          minY: entBounds.minY,
          maxX: entBounds.maxX,
          maxY: entBounds.maxY,
          rawEntity
        });
      }
    });
  };

  processEntities(dxf.entities, identityMatrix);

  const width = maxX - minX;
  const height = maxY - minY;
  const padding = Math.max(width, height) * 0.05 || 10;
  const totalW = width + padding * 2;
  const totalH = height + padding * 2;

  // Generate an empty SVG with the correct viewbox for initial rendering
  const svgPreview = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX - padding} ${-maxY - padding} ${totalW} ${totalH}" width="1000" height="${(totalH / totalW) * 1000}" style="background: #111;"></svg>`;

  return {
    entities: parsedEntities,
    rawDxfData: {
      circles,
      defaultCenterX: (minX + maxX) / 2,
      defaultCenterY: (minY + maxY) / 2,
      minX,
      maxX,
      maxY,
      totalW,
      totalH,
      padding
    },
    svgPreview,
    initialCalibration: {
      start: { x: padding / totalW, y: 0.5 },
      end: { x: (width + padding) / totalW, y: 0.5 },
      realWorldDistance: width,
      unit: 'mm'
    }
  };
};
