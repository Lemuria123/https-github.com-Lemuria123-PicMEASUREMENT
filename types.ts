
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
  distance?: number; // Real world distance
}

export interface ParallelMeasurement {
  id: string;
  start: Point; // Start of reference line
  end: Point;   // End of reference line
  offsetPoint: Point; // A point determining the parallel line's position
  distance?: number;
}

export interface AreaMeasurement {
  id: string;
  points: Point[];
  area?: number;
}

export interface CurveMeasurement {
  id: string;
  points: Point[];
  length?: number;
}

export type AppMode = 'upload' | 'calibrate' | 'measure' | 'parallel' | 'area' | 'curve' | 'solder' | 'origin';

export interface CalibrationData {
  start: Point;
  end: Point;
  realWorldDistance: number;
  unit: string;
}

export interface ImageDimensions {
  width: number;
  height: number;
}
