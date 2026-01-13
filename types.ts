
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
  snapped?: boolean; // New: True if aligned to DXF entity
  entityType?: 'circle' | 'rect'; // New: Type of entity found
}

// DXF ANALYSIS TYPES
export type DxfEntityType = 'CIRCLE' | 'LINE' | 'LWPOLYLINE' | 'ARC' | 'UNKNOWN';

export interface DxfEntity {
  id: string; // Unique ID (e.g., entity handle or index)
  type: DxfEntityType;
  layer: string;
  // Bounding box for quick searching
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  // Specific data can be stored in a generic 'data' field or extended types, 
  // keeping it simple for now to avoid complexity overload.
  rawEntity: any; 
}

export interface DxfComponent {
  id: string;
  name: string; // Custom name for the group
  isVisible: boolean; // Control visibility on canvas
  isWeld: boolean;
  isMark: boolean;
  color: string; // Hex color for the group
  entityIds: string[]; // IDs of DxfEntity belonging to this group
  seedSize: number; // Number of entities in the original selection to calculate matches
  centroid: { x: number, y: number }; // CAD coordinates
  bounds: { minX: number, minY: number, maxX: number, maxY: number }; // CAD coordinates
}

// Pre-calculated normalized geometry for rendering
export interface RenderableDxfEntity {
  id: string;
  type: DxfEntityType;
  // Visual props
  strokeColor?: string;
  strokeWidth?: number;
  isGrouped?: boolean;
  isVisible?: boolean; // Respect group visibility
  isSelected?: boolean; // New: Highlight status
  geometry: {
    type: 'line' | 'polyline' | 'circle' | 'path';
    // Normalized coordinates (0-1)
    props: {
        x1?: number; y1?: number; x2?: number; y2?: number; // Line
        points?: string; // Polyline (string "x,y x,y")
        cx?: number; cy?: number; r?: number; rx?: number; ry?: number; // Circle/Arc
        d?: string; // Path (for Arc)
    };
  };
}

// Renamed 'solder' to 'dxf_analysis'
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
