import React, { useRef, useState, useEffect } from 'react';
import { Point, LineSegment, ParallelMeasurement, CalibrationData } from '../types';
import { X, Ruler } from 'lucide-react';

interface ImageCanvasProps {
  src: string;
  mode: 'calibrate' | 'measure' | 'parallel';
  calibrationData: CalibrationData | null;
  measurements: LineSegment[];
  parallelMeasurements?: ParallelMeasurement[];
  currentPoints: Point[];
  onPointClick: (p: Point) => void;
  onDeleteMeasurement: (id: string) => void;
  onDeleteParallelMeasurement?: (id: string) => void;
}

interface ParallelRendererProps {
  start: Point;
  end: Point;
  offsetPoint: Point;
  id?: string;
  isGhost?: boolean;
  toPx: (p: Point) => { x: number; y: number };
  formatDistance: (pixels: number) => string;
  onDelete?: (id: string) => void;
}

const ParallelRenderer: React.FC<ParallelRendererProps> = ({ 
  start, 
  end, 
  offsetPoint, 
  id, 
  isGhost = false,
  toPx,
  formatDistance,
  onDelete
}) => {
  const p1 = toPx(start);
  const p2 = toPx(end);
  const p3 = toPx(offsetPoint);

  // Vector representing the first line
  const v = { x: p2.x - p1.x, y: p2.y - p1.y };
  const lenV = Math.sqrt(v.x * v.x + v.y * v.y);
  if (lenV === 0) return null;

  // Normal vector (normalized)
  const n = { x: -v.y / lenV, y: v.x / lenV };

  // Vector from Start to Offset Point
  const w = { x: p3.x - p1.x, y: p3.y - p1.y };

  // Project w onto n to get perpendicular distance (signed)
  const dist = w.x * n.x + w.y * n.y;
  
  // Offset vector
  const offsetVec = { x: n.x * dist, y: n.y * dist };

  // New line points
  const p1_prime = { x: p1.x + offsetVec.x, y: p1.y + offsetVec.y };
  const p2_prime = { x: p2.x + offsetVec.x, y: p2.y + offsetVec.y };

  // Midpoint of original line for dimension label anchor
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  
  // Corresponding point on parallel line
  const midX_prime = midX + offsetVec.x;
  const midY_prime = midY + offsetVec.y;

  // Center of the dimension line
  const labelX = (midX + midX_prime) / 2;
  const labelY = (midY + midY_prime) / 2;

  const color = isGhost ? "#c084fc" : "#a855f7"; // Purple

  return (
    <g className={!isGhost ? "group pointer-events-auto" : ""}>
      {/* First Line */}
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth="2" filter="url(#shadow)" />
      <circle cx={p1.x} cy={p1.y} r="3" fill={color} stroke="white" strokeWidth="1" />
      <circle cx={p2.x} cy={p2.y} r="3" fill={color} stroke="white" strokeWidth="1" />

      {/* Second Line (Parallel) */}
      <line x1={p1_prime.x} y1={p1_prime.y} x2={p2_prime.x} y2={p2_prime.y} stroke={color} strokeWidth="2" strokeDasharray={isGhost ? "4" : "0"} filter="url(#shadow)" />
      
      {/* Dimension Line (Perpendicular) */}
      <line x1={midX} y1={midY} x2={midX_prime} y2={midY_prime} stroke="white" strokeWidth="1" strokeDasharray="2" opacity="0.8" />

      {/* Distance Label */}
      <g transform={`translate(${labelX}, ${labelY})`}>
        <rect x="-30" y="-12" width="60" height="24" rx="12" fill="rgba(15, 23, 42, 0.9)" />
        <text 
          x="0" 
          y="4" 
          textAnchor="middle" 
          fill="white" 
          fontSize="11" 
          fontWeight="bold"
          className="pointer-events-none"
        >
          {formatDistance(Math.abs(dist))}
        </text>
         {/* Delete button (only for committed) */}
         {!isGhost && id && onDelete && (
           <foreignObject x="35" y="-12" width="24" height="24">
             <button 
               onClick={(e) => { e.stopPropagation(); onDelete(id); }}
               className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 shadow-sm"
               title="Remove measurement"
             >
               <X size={12} />
             </button>
          </foreignObject>
         )}
      </g>
    </g>
  );
};

export const ImageCanvas: React.FC<ImageCanvasProps> = ({
  src,
  mode,
  calibrationData,
  measurements,
  parallelMeasurements = [],
  currentPoints,
  onPointClick,
  onDeleteMeasurement,
  onDeleteParallelMeasurement
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);

  // Convert percentage point to pixel coordinates based on current image size
  const toPx = (p: Point) => {
    if (!imgRef.current) return { x: 0, y: 0 };
    const { width, height } = imgRef.current.getBoundingClientRect();
    return {
      x: p.x * width,
      y: p.y * height
    };
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    
    // Calculate percentage coordinates
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Boundary check
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      onPointClick({ x, y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    // Only track inside image
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      setHoverPoint({ x, y });
    } else {
      setHoverPoint(null);
    }
  };

  // Helper to get formatted distance
  const formatDistance = (pixels: number) => {
    if (!calibrationData || !imgRef.current) return "";
    
    const { width, height } = imgRef.current.getBoundingClientRect();
    const pxScaleX = width;
    const pxScaleY = height;
    
    // Calibration factor
    const cDx = (calibrationData.end.x - calibrationData.start.x) * pxScaleX;
    const cDy = (calibrationData.end.y - calibrationData.start.y) * pxScaleY;
    const calDistPx = Math.sqrt(cDx * cDx + cDy * cDy);
    
    const scaleFactor = calibrationData.realWorldDistance / calDistPx;
    const realDist = pixels * scaleFactor;

    return `${realDist.toFixed(2)} ${calibrationData.unit}`;
  };

  const getDistanceLabel = (start: Point, end: Point, knownDistance?: number) => {
    if (knownDistance) return `${knownDistance.toFixed(2)}`;
    if (!calibrationData || !imgRef.current) return "Not calibrated";
    
    const pxStart = toPx(start);
    const pxEnd = toPx(end);
    const dx = pxEnd.x - pxStart.x;
    const dy = pxEnd.y - pxStart.y;
    const distPx = Math.sqrt(dx * dx + dy * dy);

    return formatDistance(distPx);
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-slate-900/50 rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
      <div 
        ref={containerRef}
        className="relative inline-block select-none shadow-2xl"
      >
        <img
          ref={imgRef}
          src={src}
          alt="Workspace"
          className="max-h-[80vh] max-w-full block object-contain crosshair-cursor"
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          draggable={false}
        />

        {/* SVG Overlay */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="black" floodOpacity="0.8"/>
            </filter>
          </defs>

          {/* Render Calibration Line */}
          {calibrationData && (
            <g>
              <line
                x1={`${calibrationData.start.x * 100}%`}
                y1={`${calibrationData.start.y * 100}%`}
                x2={`${calibrationData.end.x * 100}%`}
                y2={`${calibrationData.end.y * 100}%`}
                stroke="#10b981" // Emerald 500
                strokeWidth="2"
                strokeDasharray="4"
                filter="url(#shadow)"
              />
              <circle cx={`${calibrationData.start.x * 100}%`} cy={`${calibrationData.start.y * 100}%`} r="4" fill="#10b981" stroke="white" strokeWidth="2" />
              <circle cx={`${calibrationData.end.x * 100}%`} cy={`${calibrationData.end.y * 100}%`} r="4" fill="#10b981" stroke="white" strokeWidth="2" />
            </g>
          )}

          {/* Render Measurements (Distance) */}
          {measurements.map((m) => {
             const pxStart = toPx(m.start);
             const pxEnd = toPx(m.end);
             const midX = (pxStart.x + pxEnd.x) / 2;
             const midY = (pxStart.y + pxEnd.y) / 2;
             
             return (
              <g key={m.id} className="group pointer-events-auto">
                <line
                  x1={`${m.start.x * 100}%`}
                  y1={`${m.start.y * 100}%`}
                  x2={`${m.end.x * 100}%`}
                  y2={`${m.end.y * 100}%`}
                  stroke="#3b82f6" // Blue 500
                  strokeWidth="2"
                  filter="url(#shadow)"
                  className="group-hover:stroke-blue-400 transition-colors"
                />
                <circle cx={`${m.start.x * 100}%`} cy={`${m.start.y * 100}%`} r="3" fill="#3b82f6" stroke="white" strokeWidth="1" />
                <circle cx={`${m.end.x * 100}%`} cy={`${m.end.y * 100}%`} r="3" fill="#3b82f6" stroke="white" strokeWidth="1" />
                
                {/* Distance Label */}
                <g transform={`translate(${midX}, ${midY})`}>
                  <rect x="-30" y="-12" width="60" height="24" rx="12" fill="rgba(15, 23, 42, 0.9)" />
                  <text 
                    x="0" 
                    y="4" 
                    textAnchor="middle" 
                    fill="white" 
                    fontSize="11" 
                    fontWeight="bold"
                    className="pointer-events-none"
                  >
                    {getDistanceLabel(m.start, m.end, m.distance)}
                  </text>
                  {/* Delete button (small x) */}
                  <foreignObject x="35" y="-12" width="24" height="24">
                     <button 
                       onClick={(e) => { e.stopPropagation(); onDeleteMeasurement(m.id); }}
                       className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 shadow-sm"
                       title="Remove measurement"
                     >
                       <X size={12} />
                     </button>
                  </foreignObject>
                </g>
              </g>
            );
          })}

          {/* Render Parallel Measurements */}
          {parallelMeasurements.map((m) => (
            <ParallelRenderer 
              key={m.id} 
              start={m.start} 
              end={m.end} 
              offsetPoint={m.offsetPoint} 
              id={m.id} 
              toPx={toPx}
              formatDistance={formatDistance}
              onDelete={onDeleteParallelMeasurement}
            />
          ))}

          {/* Render Active Points */}
          {currentPoints.map((p, i) => (
            <circle 
              key={i} 
              cx={`${p.x * 100}%`} 
              cy={`${p.y * 100}%`} 
              r="4" 
              fill={mode === 'calibrate' ? '#fbbf24' : mode === 'parallel' ? '#c084fc' : '#60a5fa'}
              stroke="white" 
              strokeWidth="2"
              className="animate-pulse"
            />
          ))}

          {/* Render Active Line Interaction (Rubber banding) */}
          {currentPoints.length === 1 && hoverPoint && mode !== 'parallel' && (
             <line
                x1={`${currentPoints[0].x * 100}%`}
                y1={`${currentPoints[0].y * 100}%`}
                x2={`${hoverPoint.x * 100}%`}
                y2={`${hoverPoint.y * 100}%`}
                stroke={mode === 'calibrate' ? '#fbbf24' : '#60a5fa'}
                strokeWidth="2"
                strokeDasharray="4"
                opacity="0.6"
             />
          )}

          {/* Render Parallel Mode Interactions */}
          {mode === 'parallel' && (
            <>
              {/* Step 1: Drawing the first line */}
              {currentPoints.length === 1 && hoverPoint && (
                <line
                  x1={`${currentPoints[0].x * 100}%`}
                  y1={`${currentPoints[0].y * 100}%`}
                  x2={`${hoverPoint.x * 100}%`}
                  y2={`${hoverPoint.y * 100}%`}
                  stroke="#c084fc"
                  strokeWidth="2"
                  strokeDasharray="4"
                  opacity="0.6"
                />
              )}
              
              {/* Step 2: Placing the parallel line */}
              {currentPoints.length === 2 && hoverPoint && (
                 <ParallelRenderer 
                   start={currentPoints[0]} 
                   end={currentPoints[1]} 
                   offsetPoint={hoverPoint} 
                   isGhost={true} 
                   toPx={toPx}
                   formatDistance={formatDistance}
                 />
              )}
            </>
          )}

        </svg>
      </div>
      
      {/* Help text overlay */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-sm text-slate-200 pointer-events-none flex items-center gap-2 border border-white/10">
        {mode === 'calibrate' && !calibrationData && currentPoints.length === 0 && "Click first point for calibration"}
        {mode === 'calibrate' && !calibrationData && currentPoints.length === 1 && "Click second point to set reference"}
        {(mode === 'measure' || mode === 'parallel') && !calibrationData && <span className="text-amber-400">Please calibrate first</span>}
        
        {mode === 'measure' && calibrationData && currentPoints.length === 0 && "Click to start measurement"}
        {mode === 'measure' && calibrationData && currentPoints.length === 1 && "Click to finish measurement"}

        {mode === 'parallel' && calibrationData && currentPoints.length === 0 && "Click start of reference line"}
        {mode === 'parallel' && calibrationData && currentPoints.length === 1 && "Click end of reference line"}
        {mode === 'parallel' && calibrationData && currentPoints.length === 2 && "Move to adjust width, click to finish"}
      </div>
    </div>
  );
};
