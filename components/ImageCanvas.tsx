import React, { useRef, useState, useEffect } from 'react';
import { Point, LineSegment, ParallelMeasurement, AreaMeasurement, CurveMeasurement, CalibrationData } from '../types';
import { X, Ruler } from 'lucide-react';

interface ImageCanvasProps {
  src: string;
  mode: 'calibrate' | 'measure' | 'parallel' | 'area' | 'curve';
  calibrationData: CalibrationData | null;
  measurements: LineSegment[];
  parallelMeasurements?: ParallelMeasurement[];
  areaMeasurements?: AreaMeasurement[];
  curveMeasurements?: CurveMeasurement[];
  currentPoints: Point[];
  onPointClick: (p: Point) => void;
  onFinishShape?: () => void;
  onDeleteMeasurement: (id: string) => void;
  onDeleteParallelMeasurement?: (id: string) => void;
  onDeleteAreaMeasurement?: (id: string) => void;
  onDeleteCurveMeasurement?: (id: string) => void;
}

// --- Utils for Curve Fitting ---

// Distance between two points
const dist = (p1: Point, p2: Point) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

// Generate a Catmull-Rom spline path string and calculate its length
// Input: points in pixel coordinates
const getSplineData = (points: {x:number, y:number}[]) => {
  if (points.length < 2) return { path: "", length: 0 };
  
  // Flattening factor for length calculation (samples per segment)
  const samples = 10;
  let totalLength = 0;
  let path = `M ${points[0].x} ${points[0].y}`;

  // If only 2 points, it's a straight line
  if (points.length === 2) {
    path += ` L ${points[1].x} ${points[1].y}`;
    totalLength = dist(points[0], points[1]);
    return { path, length: totalLength };
  }

  // Catmull-Rom to Cubic Bezier conversion
  // For each segment P_i -> P_{i+1}
  // Control points are derived from P_{i-1}, P_i, P_{i+1}, P_{i+2}
  
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    // Tension = 0.5 (standard Catmull-Rom)
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;

    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;

    // Approximate length for this segment
    let prev = p1;
    for (let j = 1; j <= samples; j++) {
      const t = j / samples;
      // Cubic Bezier Formula
      const cx = Math.pow(1-t, 3)*p1.x + 3*Math.pow(1-t, 2)*t*cp1x + 3*(1-t)*Math.pow(t, 2)*cp2x + Math.pow(t, 3)*p2.x;
      const cy = Math.pow(1-t, 3)*p1.y + 3*Math.pow(1-t, 2)*t*cp1y + 3*(1-t)*Math.pow(t, 2)*cp2y + Math.pow(t, 3)*p2.y;
      const curr = { x: cx, y: cy };
      totalLength += dist(prev, curr);
      prev = curr;
    }
  }

  return { path, length: totalLength };
};

// --- Sub-components ---

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
  start, end, offsetPoint, id, isGhost = false, toPx, formatDistance, onDelete 
}) => {
  const p1 = toPx(start);
  const p2 = toPx(end);
  const p3 = toPx(offsetPoint);

  const v = { x: p2.x - p1.x, y: p2.y - p1.y };
  const lenV = Math.sqrt(v.x * v.x + v.y * v.y);
  if (lenV === 0) return null;

  const n = { x: -v.y / lenV, y: v.x / lenV };
  const w = { x: p3.x - p1.x, y: p3.y - p1.y };
  const dist = w.x * n.x + w.y * n.y;
  const offsetVec = { x: n.x * dist, y: n.y * dist };
  const p1_prime = { x: p1.x + offsetVec.x, y: p1.y + offsetVec.y };
  const p2_prime = { x: p2.x + offsetVec.x, y: p2.y + offsetVec.y };

  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const midX_prime = midX + offsetVec.x;
  const midY_prime = midY + offsetVec.y;
  const labelX = (midX + midX_prime) / 2;
  const labelY = (midY + midY_prime) / 2;
  const color = isGhost ? "#c084fc" : "#a855f7";

  return (
    <g className={!isGhost ? "group pointer-events-auto" : ""}>
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth="2" filter="url(#shadow)" />
      <circle cx={p1.x} cy={p1.y} r="3" fill={color} stroke="white" strokeWidth="1" />
      <circle cx={p2.x} cy={p2.y} r="3" fill={color} stroke="white" strokeWidth="1" />
      <line x1={p1_prime.x} y1={p1_prime.y} x2={p2_prime.x} y2={p2_prime.y} stroke={color} strokeWidth="2" strokeDasharray={isGhost ? "4" : "0"} filter="url(#shadow)" />
      <line x1={midX} y1={midY} x2={midX_prime} y2={midY_prime} stroke="white" strokeWidth="1" strokeDasharray="2" opacity="0.8" />
      <g transform={`translate(${labelX}, ${labelY})`}>
        <rect x="-30" y="-12" width="60" height="24" rx="12" fill="rgba(15, 23, 42, 0.9)" />
        <text x="0" y="4" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" className="pointer-events-none">
          {formatDistance(Math.abs(dist))}
        </text>
         {!isGhost && id && onDelete && (
           <foreignObject x="35" y="-12" width="24" height="24">
             <button onClick={(e) => { e.stopPropagation(); onDelete(id); }} className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 shadow-sm">
               <X size={12} />
             </button>
          </foreignObject>
         )}
      </g>
    </g>
  );
};

interface AreaRendererProps {
  points: Point[];
  id?: string;
  isGhost?: boolean;
  toPx: (p: Point) => { x: number; y: number };
  formatArea: (points: Point[]) => string;
  onDelete?: (id: string) => void;
}

const AreaRenderer: React.FC<AreaRendererProps> = ({ points, id, isGhost = false, toPx, formatArea, onDelete }) => {
  if (points.length < 3) return null;
  const pxPoints = points.map(toPx);
  const pointsStr = pxPoints.map(p => `${p.x},${p.y}`).join(' ');
  const centroid = pxPoints.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  centroid.x /= points.length;
  centroid.y /= points.length;
  const color = "#f97316";

  return (
    <g className={!isGhost ? "group pointer-events-auto" : ""}>
      <polygon points={pointsStr} fill={color} fillOpacity="0.2" stroke={color} strokeWidth="2" className={!isGhost ? "group-hover:fill-opacity-30 transition-all" : ""} />
      {points.map((p, i) => {
        const px = toPx(p);
        return <circle key={i} cx={px.x} cy={px.y} r="3" fill={color} stroke="white" strokeWidth="1" />;
      })}
      {!isGhost && (
        <g transform={`translate(${centroid.x}, ${centroid.y})`}>
          <rect x="-40" y="-12" width="80" height="24" rx="12" fill="rgba(15, 23, 42, 0.9)" />
          <text x="0" y="4" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" className="pointer-events-none">{formatArea(points)}</text>
          {id && onDelete && (
            <foreignObject x="45" y="-12" width="24" height="24">
              <button onClick={(e) => { e.stopPropagation(); onDelete(id); }} className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 shadow-sm">
                <X size={12} />
              </button>
            </foreignObject>
          )}
        </g>
      )}
    </g>
  );
};

interface CurveRendererProps {
  points: Point[];
  id?: string;
  isGhost?: boolean;
  toPx: (p: Point) => { x: number; y: number };
  formatDistance: (pixels: number) => string;
  onDelete?: (id: string) => void;
}

const CurveRenderer: React.FC<CurveRendererProps> = ({ points, id, isGhost = false, toPx, formatDistance, onDelete }) => {
  if (points.length < 2) return null;
  const pxPoints = points.map(toPx);
  const { path, length } = getSplineData(pxPoints);
  const lastP = pxPoints[pxPoints.length - 1];
  const color = "#ec4899"; // Pink 500

  return (
    <g className={!isGhost ? "group pointer-events-auto" : ""}>
      <path d={path} fill="none" stroke={color} strokeWidth="3" filter="url(#shadow)" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => {
        const px = toPx(p);
        return <circle key={i} cx={px.x} cy={px.y} r={isGhost ? 3 : 2} fill={color} stroke="white" strokeWidth="1" />;
      })}
      
      {!isGhost && (
        <g transform={`translate(${lastP.x + 10}, ${lastP.y})`}>
          <rect x="0" y="-12" width="80" height="24" rx="12" fill="rgba(15, 23, 42, 0.9)" />
          <text x="40" y="4" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" className="pointer-events-none">{formatDistance(length)}</text>
          {id && onDelete && (
            <foreignObject x="85" y="-12" width="24" height="24">
              <button onClick={(e) => { e.stopPropagation(); onDelete(id); }} className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 shadow-sm">
                <X size={12} />
              </button>
            </foreignObject>
          )}
        </g>
      )}
    </g>
  );
};

// --- Main Component ---

export const ImageCanvas: React.FC<ImageCanvasProps> = ({
  src,
  mode,
  calibrationData,
  measurements,
  parallelMeasurements = [],
  areaMeasurements = [],
  curveMeasurements = [],
  currentPoints,
  onPointClick,
  onFinishShape,
  onDeleteMeasurement,
  onDeleteParallelMeasurement,
  onDeleteAreaMeasurement,
  onDeleteCurveMeasurement
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const [isHoveringStart, setIsHoveringStart] = useState(false);

  const toPx = (p: Point) => {
    if (!imgRef.current) return { x: 0, y: 0 };
    const { width, height } = imgRef.current.getBoundingClientRect();
    return { x: p.x * width, y: p.y * height };
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!imgRef.current) return;
    if (isHoveringStart && onFinishShape) {
      onFinishShape();
      return;
    }
    const rect = imgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      onPointClick({ x, y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    if (mode === 'area' && currentPoints.length > 2) {
      const startPx = toPx(currentPoints[0]);
      const mousePx = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const dist = Math.sqrt(Math.pow(startPx.x - mousePx.x, 2) + Math.pow(startPx.y - mousePx.y, 2));
      if (dist < 20) {
        setIsHoveringStart(true);
        setHoverPoint(null);
        return;
      }
    }
    setIsHoveringStart(false);

    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      setHoverPoint({ x, y });
    } else {
      setHoverPoint(null);
    }
  };

  const formatDistance = (pixels: number) => {
    if (!calibrationData || !imgRef.current) return "";
    const { width, height } = imgRef.current.getBoundingClientRect();
    const pxScaleX = width;
    const pxScaleY = height;
    const cDx = (calibrationData.end.x - calibrationData.start.x) * pxScaleX;
    const cDy = (calibrationData.end.y - calibrationData.start.y) * pxScaleY;
    const calDistPx = Math.sqrt(cDx * cDx + cDy * cDy);
    const scaleFactor = calibrationData.realWorldDistance / calDistPx;
    const realDist = pixels * scaleFactor;
    return `${realDist.toFixed(2)} ${calibrationData.unit}`;
  };

  const formatArea = (points: Point[]) => {
    if (!calibrationData || !imgRef.current || points.length < 3) return "";
    const { width, height } = imgRef.current.getBoundingClientRect();
    const pxScaleX = width;
    const pxScaleY = height;
    const cDx = (calibrationData.end.x - calibrationData.start.x) * pxScaleX;
    const cDy = (calibrationData.end.y - calibrationData.start.y) * pxScaleY;
    const calDistPx = Math.sqrt(cDx * cDx + cDy * cDy);
    const scaleFactor = calibrationData.realWorldDistance / calDistPx;

    let areaPx = 0;
    const pxPoints = points.map(toPx);
    for (let i = 0; i < pxPoints.length; i++) {
      const j = (i + 1) % pxPoints.length;
      areaPx += pxPoints[i].x * pxPoints[j].y;
      areaPx -= pxPoints[j].x * pxPoints[i].y;
    }
    areaPx = Math.abs(areaPx) / 2;
    const realArea = areaPx * (scaleFactor * scaleFactor);
    return `${realArea.toFixed(2)} ${calibrationData.unit}²`;
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
      <div ref={containerRef} className="relative inline-block select-none shadow-2xl">
        <img
          ref={imgRef}
          src={src}
          alt="Workspace"
          className="max-h-[80vh] max-w-full block object-contain crosshair-cursor"
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          draggable={false}
        />

        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="black" floodOpacity="0.8"/>
            </filter>
          </defs>

          {calibrationData && (
            <g>
              <line x1={`${calibrationData.start.x * 100}%`} y1={`${calibrationData.start.y * 100}%`} x2={`${calibrationData.end.x * 100}%`} y2={`${calibrationData.end.y * 100}%`} stroke="#10b981" strokeWidth="2" strokeDasharray="4" filter="url(#shadow)" />
              <circle cx={`${calibrationData.start.x * 100}%`} cy={`${calibrationData.start.y * 100}%`} r="4" fill="#10b981" stroke="white" strokeWidth="2" />
              <circle cx={`${calibrationData.end.x * 100}%`} cy={`${calibrationData.end.y * 100}%`} r="4" fill="#10b981" stroke="white" strokeWidth="2" />
            </g>
          )}

          {measurements.map((m) => {
             const pxStart = toPx(m.start);
             const pxEnd = toPx(m.end);
             const midX = (pxStart.x + pxEnd.x) / 2;
             const midY = (pxStart.y + pxEnd.y) / 2;
             return (
              <g key={m.id} className="group pointer-events-auto">
                <line x1={`${m.start.x * 100}%`} y1={`${m.start.y * 100}%`} x2={`${m.end.x * 100}%`} y2={`${m.end.y * 100}%`} stroke="#3b82f6" strokeWidth="2" filter="url(#shadow)" className="group-hover:stroke-blue-400 transition-colors" />
                <circle cx={`${m.start.x * 100}%`} cy={`${m.start.y * 100}%`} r="3" fill="#3b82f6" stroke="white" strokeWidth="1" />
                <circle cx={`${m.end.x * 100}%`} cy={`${m.end.y * 100}%`} r="3" fill="#3b82f6" stroke="white" strokeWidth="1" />
                <g transform={`translate(${midX}, ${midY})`}>
                  <rect x="-30" y="-12" width="60" height="24" rx="12" fill="rgba(15, 23, 42, 0.9)" />
                  <text x="0" y="4" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" className="pointer-events-none">
                    {getDistanceLabel(m.start, m.end, m.distance)}
                  </text>
                  <foreignObject x="35" y="-12" width="24" height="24">
                     <button onClick={(e) => { e.stopPropagation(); onDeleteMeasurement(m.id); }} className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 shadow-sm">
                       <X size={12} />
                     </button>
                  </foreignObject>
                </g>
              </g>
            );
          })}

          {parallelMeasurements.map((m) => <ParallelRenderer key={m.id} start={m.start} end={m.end} offsetPoint={m.offsetPoint} id={m.id} toPx={toPx} formatDistance={formatDistance} onDelete={onDeleteParallelMeasurement} />)}
          {areaMeasurements && areaMeasurements.map((m) => <AreaRenderer key={m.id} points={m.points} id={m.id} toPx={toPx} formatArea={formatArea} onDelete={onDeleteAreaMeasurement} />)}
          {curveMeasurements && curveMeasurements.map((m) => <CurveRenderer key={m.id} points={m.points} id={m.id} toPx={toPx} formatDistance={formatDistance} onDelete={onDeleteCurveMeasurement} />)}

          {currentPoints.map((p, i) => (
            <circle 
              key={i} 
              cx={`${p.x * 100}%`} 
              cy={`${p.y * 100}%`} 
              r={i === 0 && isHoveringStart ? 8 : 4} 
              fill={mode === 'calibrate' ? '#fbbf24' : mode === 'parallel' ? '#c084fc' : mode === 'area' ? '#f97316' : mode === 'curve' ? '#ec4899' : '#60a5fa'}
              stroke="white" 
              strokeWidth={i === 0 && isHoveringStart ? 3 : 2}
              className={`${i === 0 && isHoveringStart ? 'cursor-pointer' : ''}`}
            />
          ))}

          {currentPoints.length > 0 && hoverPoint && mode !== 'parallel' && mode !== 'area' && mode !== 'curve' && (
             <line x1={`${currentPoints[currentPoints.length - 1].x * 100}%`} y1={`${currentPoints[currentPoints.length - 1].y * 100}%`} x2={`${hoverPoint.x * 100}%`} y2={`${hoverPoint.y * 100}%`} stroke={mode === 'calibrate' ? '#fbbf24' : '#60a5fa'} strokeWidth="2" strokeDasharray="4" opacity="0.6" />
          )}

          {mode === 'parallel' && (
            <>
              {currentPoints.length === 1 && hoverPoint && <line x1={`${currentPoints[0].x * 100}%`} y1={`${currentPoints[0].y * 100}%`} x2={`${hoverPoint.x * 100}%`} y2={`${hoverPoint.y * 100}%`} stroke="#c084fc" strokeWidth="2" strokeDasharray="4" opacity="0.6" />}
              {currentPoints.length === 2 && hoverPoint && <ParallelRenderer start={currentPoints[0]} end={currentPoints[1]} offsetPoint={hoverPoint} isGhost={true} toPx={toPx} formatDistance={formatDistance} />}
            </>
          )}

          {mode === 'area' && currentPoints.length > 0 && (
            <>
              <polyline points={currentPoints.map(p => `${p.x * 100}%,${p.y * 100}%`).join(' ')} fill="none" stroke="#f97316" strokeWidth="2" strokeDasharray="4" />
              {hoverPoint && !isHoveringStart && <line x1={`${currentPoints[currentPoints.length - 1].x * 100}%`} y1={`${currentPoints[currentPoints.length - 1].y * 100}%`} x2={`${hoverPoint.x * 100}%`} y2={`${hoverPoint.y * 100}%`} stroke="#f97316" strokeWidth="2" strokeDasharray="4" opacity="0.6" />}
              {isHoveringStart && currentPoints.length > 2 && <line x1={`${currentPoints[currentPoints.length - 1].x * 100}%`} y1={`${currentPoints[currentPoints.length - 1].y * 100}%`} x2={`${currentPoints[0].x * 100}%`} y2={`${currentPoints[0].y * 100}%`} stroke="#f97316" strokeWidth="2" strokeDasharray="0" opacity="1" />}
            </>
          )}

          {mode === 'curve' && currentPoints.length > 0 && (
             <>
               {/* Use the same Spline function but with current points + hover point temporarily */}
               {hoverPoint && (
                 <CurveRenderer points={[...currentPoints, hoverPoint]} isGhost={true} toPx={toPx} formatDistance={formatDistance} />
               )}
             </>
          )}

        </svg>
      </div>
      
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-sm text-slate-200 pointer-events-none flex items-center gap-2 border border-white/10 z-20 whitespace-nowrap">
        {mode === 'calibrate' && !calibrationData && currentPoints.length === 0 && "Click first point for calibration"}
        {mode === 'calibrate' && !calibrationData && currentPoints.length === 1 && "Click second point to set reference"}
        {(mode === 'measure' || mode === 'parallel' || mode === 'area' || mode === 'curve') && !calibrationData && <span className="text-amber-400">Please calibrate first</span>}
        
        {mode === 'measure' && calibrationData && currentPoints.length === 0 && "Click to start measurement"}
        {mode === 'measure' && calibrationData && currentPoints.length === 1 && "Click to finish measurement"}

        {mode === 'parallel' && calibrationData && currentPoints.length === 0 && "Click start of reference line"}
        {mode === 'parallel' && calibrationData && currentPoints.length === 1 && "Click end of reference line"}
        {mode === 'parallel' && calibrationData && currentPoints.length === 2 && "Move to adjust width, click to finish"}

        {mode === 'area' && calibrationData && currentPoints.length === 0 && "Click to start defining area"}
        {mode === 'area' && calibrationData && currentPoints.length > 0 && currentPoints.length < 3 && "Click next point"}
        {mode === 'area' && calibrationData && currentPoints.length >= 3 && "Click start point to close shape"}

        {mode === 'curve' && calibrationData && currentPoints.length === 0 && "Click start of curve"}
        {mode === 'curve' && calibrationData && currentPoints.length > 0 && "Click next point, then 'Finish Curve'"}
      </div>
    </div>
  );
};