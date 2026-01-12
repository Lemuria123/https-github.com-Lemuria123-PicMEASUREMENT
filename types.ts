
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

export type AppMode = 'upload' | 'calibrate' | 'measure' | 'parallel' | 'area' | 'curve' | 'solder' | 'origin' | 'feature';

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
