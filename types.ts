
export interface Point {
  x: number; // stored as percentage (0-1) of image width
  y: number; // stored as percentage (0-1) of image height
}

export interface SolderPoint {
  id: number;
  x: number; // Real CAD coordinate relative to origin
  y: number; // Real CAD coordinate relative to origin
  canvasX: number; // percentage for rendering
  canvasY: number; // percentage for rendering
}

export interface LineSegment {
  id: string;
  start: Point;
  end: Point;
}

export interface ParallelMeasurement {
  id: string;
  baseStart: Point;
  baseEnd: Point;
  offsetPoint: Point;
}

export interface AreaMeasurement {
  id: string;
  points: Point[];
}

export interface CurveMeasurement {
  id: string;
  points: Point[];
}

export interface FeatureResult {
  id: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  confidence?: number;
  snapped?: boolean;
  entityType?: 'circle' | 'rect';
}

export type DxfEntityType = 'CIRCLE' | 'LINE' | 'LWPOLYLINE' | 'ARC' | 'UNKNOWN';

export interface DxfEntity {
  id: string;
  type: DxfEntityType;
  layer: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  rawEntity: any; 
}

export interface DxfComponent {
  id: string;
  name: string;
  isVisible: boolean;
  isWeld: boolean;
  isMark: boolean;
  color: string;
  entityIds: string[];
  seedSize: number;
  centroid: { x: number, y: number };
  bounds: { minX: number, minY: number, maxX: number, maxY: number };
  parentGroupId?: string; // If set, this is a match of another group
}

export interface RenderableDxfEntity {
  id: string;
  type: DxfEntityType;
  strokeColor?: string;
  strokeWidth?: number;
  isGrouped?: boolean;
  isVisible?: boolean;
  isSelected?: boolean; // 用于组级高亮或对象级高亮
  geometry: {
    type: 'line' | 'polyline' | 'circle' | 'path';
    props: {
        x1?: number; y1?: number; x2?: number; y2?: number;
        points?: string;
        cx?: number; cy?: number; r?: number; rx?: number; ry?: number;
        d?: string;
    };
  };
}

export type AppMode = 'upload' | 'calibrate' | 'measure' | 'parallel' | 'area' | 'curve' | 'dxf_analysis' | 'origin' | 'feature' | 'box_group';

export interface CalibrationData {
  start: Point;
  end: Point;
  realWorldDistance: number;
  unit: string;
}

export interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}
