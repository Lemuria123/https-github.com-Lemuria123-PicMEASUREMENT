
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

/**
 * Common properties for both CAD components and AI Feature groups
 */
export interface BaseAnalysisGroup {
  id: string;
  name: string;
  isVisible: boolean;
  isWeld: boolean;
  isMark: boolean;
  color: string;
  parentGroupId?: string; // Links matches to their seed/parent
  rotation?: number;      // Rotation in radians
  rotationDeg?: number;   // Rotation in degrees
}

export interface FeatureResult {
  id: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  entityType?: 'circle' | 'rect';
  // Fix: added missing optional property 'snapped' to resolve object literal errors in hooks
  snapped?: boolean;
}

export interface AiFeatureGroup extends BaseAnalysisGroup {
  features: FeatureResult[];
}

export interface RenderableAiFeature {
  id: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  strokeColor: string;
  strokeWidth: number;
  isVisible: boolean;
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

export interface DxfComponent extends BaseAnalysisGroup {
  entityIds: string[];
  childGroupIds?: string[]; // IDs of nested DxfComponents
  seedSize: number;
  centroid: { x: number, y: number };
  bounds: { minX: number, minY: number, maxX: number, maxY: number };
}

export interface RenderableDxfEntity {
  id: string;
  type: DxfEntityType;
  strokeColor?: string;
  strokeWidth?: number;
  isVisible?: boolean;
  isSelected?: boolean; 
  isHovered?: boolean;
  // Fix: added missing optional property 'isGrouped' to resolve object literal errors in DXF overlay hook
  isGrouped?: boolean;
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

export interface DxfMatchSettings {
  geometryTolerance: number; 
  positionFuzziness: number; 
  angleTolerance: number;
  minMatchDistance: number;
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
  dxfEntities?: DxfEntity[]; 
  rawDxfData?: any; 
  aiFeatureGroups: AiFeatureGroup[];
  mode: AppMode;
  viewTransform: ViewTransform | null;
  dxfMatchSettings?: DxfMatchSettings;
}
