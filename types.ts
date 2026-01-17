export interface Point {
  x: number; // stored as percentage (0-1) of image width
  y: number; // stored as percentage (0-1) of image height
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

export interface AiFeatureGroup {
  id: string;
  name: string;
  isVisible: boolean;
  isWeld: boolean;
  isMark: boolean;
  color: string;
  features: FeatureResult[];
  parentGroupId?: string; // If this group was found via "Find Similar" from another group
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
  childGroupIds?: string[]; // IDs of other DxfComponents contained within this one
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
  isSelected?: boolean; 
  isHovered?: boolean;
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

export type AppMode = 'upload' | 'calibrate' | 'measure' | 'parallel' | 'area' | 'curve' | 'dxf_analysis' | 'feature_analysis' | 'origin' | 'feature' | 'box_group';

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

export interface ProjectConfig {
  version: string;
  originalFileName: string | null;
  calibrationData: CalibrationData | null;
  manualOriginCAD: { x: number; y: number } | null;
  measurements: LineSegment[];
  parallelMeasurements: ParallelMeasurement[];
  areaMeasurements: AreaMeasurement[];
  curveMeasurements: CurveMeasurement[];
  dxfComponents: DxfComponent[];
  aiFeatureGroups: AiFeatureGroup[];
  mode: AppMode;
  viewTransform: ViewTransform | null;
}