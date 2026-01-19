
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Point, LineSegment, ParallelMeasurement, AreaMeasurement, CurveMeasurement, CalibrationData, ViewTransform, RenderableDxfEntity, RenderableAiFeature } from '../types';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { getMmPerPixel, getPhysDist, getPerpendicularPoint, getPolygonArea, getPolylineLength, getPathData, getCatmullRomPath } from '../utils/geometry';
import { DxfLayer, AiLayer, MeasurementLayer } from './CanvasLayers';

interface ImageCanvasProps {
  src: string | null;
  mode: string;
  calibrationData: CalibrationData | null;
  measurements: LineSegment[];
  parallelMeasurements?: ParallelMeasurement[];
  areaMeasurements?: AreaMeasurement[];
  curveMeasurements?: CurveMeasurement[];
  currentPoints: Point[];
  onPointClick: (p: Point) => void;
  onDeleteMeasurement: (id: string) => void;
  dxfOverlayEntities?: RenderableDxfEntity[];
  aiOverlayEntities?: RenderableAiFeature[];
  originCanvasPos?: Point | null;
  onMousePositionChange?: (pos: Point | null) => void;
  onDimensionsChange?: (width: number, height: number) => void;
  initialTransform?: ViewTransform | null;
  onViewChange?: (transform: ViewTransform) => void;
  showCalibration?: boolean;
  showMeasurements?: boolean;
}

export const ImageCanvas: React.FC<ImageCanvasProps> = ({
  src, mode, calibrationData, measurements, parallelMeasurements = [], areaMeasurements = [],
  curveMeasurements = [], currentPoints, onPointClick, dxfOverlayEntities = [],
  aiOverlayEntities = [],
  onMousePositionChange, onDimensionsChange, initialTransform, onViewChange,
  showCalibration = true, showMeasurements = true, originCanvasPos
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null); // New wrapper ref for accurate bounds
  const imgRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const [mousePos, setMousePos] = useState<Point | null>(null);
  const [snappedPos, setSnappedPos] = useState<Point | null>(null);

  useEffect(() => { 
    if (initialTransform) { setScale(initialTransform.scale); setPosition({ x: initialTransform.x, y: initialTransform.y }); } 
    else { setScale(1); setPosition({ x: 0, y: 0 }); }
  }, [src]);

  useEffect(() => { onViewChange?.({ x: position.x, y: position.y, scale }); }, [scale, position.x, position.y]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth && naturalHeight) { setImgSize({ width: naturalWidth, height: naturalHeight }); onDimensionsChange?.(naturalWidth, naturalHeight); }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault(); e.stopPropagation();
    const delta = -e.deltaY * 0.0015;
    const newScale = Math.min(Math.max(0.1, scale * (1 + delta)), 100); 
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scaleRatio = newScale / scale;
    setPosition(prev => ({ 
      x: (e.clientX - rect.left) - ((e.clientX - rect.left) - prev.x) * scaleRatio, 
      y: (e.clientY - rect.top) - ((e.clientY - rect.top) - prev.y) * scaleRatio 
    }));
    setScale(newScale);
  };

  const handleMouseDown = (e: React.MouseEvent) => { if (e.button === 1 || (e.button === 0 && e.shiftKey)) { e.preventDefault(); setIsDragging(true); setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y }); } };

  const snapTargets = useMemo(() => {
    const targets: Point[] = [];
    if (calibrationData) targets.push(calibrationData.start, calibrationData.end);
    if (originCanvasPos) targets.push(originCanvasPos);
    currentPoints.forEach(p => targets.push(p));
    measurements.forEach(m => targets.push(m.start, m.end));
    parallelMeasurements.forEach(pm => targets.push(pm.baseStart, pm.baseEnd, pm.offsetPoint));
    areaMeasurements.forEach(am => am.points.forEach(p => targets.push(p)));
    curveMeasurements.forEach(cm => cm.points.forEach(p => targets.push(p)));
    return targets;
  }, [calibrationData, originCanvasPos, currentPoints, measurements, parallelMeasurements, areaMeasurements, curveMeasurements]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    
    // Use wrapperRef for coordinate calculation to ensure alignment with SVG
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const rawX = (e.clientX - rect.left) / rect.width;
      const rawY = (e.clientY - rect.top) / rect.height;
      
      const p = (rawX >= 0 && rawX <= 1 && rawY >= 0 && rawY <= 1) ? { x: rawX, y: rawY } : null;
      setMousePos(p);
      
      if (p && imgSize.width > 0) {
        const SNAP_RADIUS_PX = 12; 
        let closest: Point | null = null; let minDist = Infinity;
        for (const target of snapTargets) {
          const dx = (p.x - target.x) * rect.width; const dy = (p.y - target.y) * rect.height; const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < SNAP_RADIUS_PX && dist < minDist) { minDist = dist; closest = target; }
        }
        setSnappedPos(closest); onMousePositionChange?.(closest || p);
      } else { setSnappedPos(null); onMousePositionChange?.(p); }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDragging) { setIsDragging(false); return; }
    // Use wrapperRef here as well
    if (e.button === 0 && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const rawX = (e.clientX - rect.left) / rect.width; const rawY = (e.clientY - rect.top) / rect.height;
      if (rawX >= 0 && rawX <= 1 && rawY >= 0 && rawY <= 1) onPointClick(snappedPos || { x: rawX, y: rawY });
    }
  };

  const uiBase = useMemo(() => (imgSize.width <= 1 || imgSize.height <= 1) ? 1.5 : Math.min(imgSize.width, imgSize.height) / 500, [imgSize]);
  const getS = (mult: number = 0.5) => (uiBase * mult) / scale;
  const getR = (mult: number = 0.7) => (uiBase * mult) / scale;
  const getF = (mult: number = 9) => (uiBase * mult) / scale;

  const mmPerPixel = getMmPerPixel(calibrationData, imgSize.width, imgSize.height);
  const unitLabel = calibrationData?.unit || 'mm';

  return (
    <div className="relative w-full h-full bg-slate-900/40 rounded-2xl overflow-hidden border border-slate-800 shadow-inner group">
      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-2">
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-xl p-1.5 flex flex-col gap-1.5 shadow-2xl">
          <button onClick={() => setScale(s => s * 1.3)} className="p-2.5 text-slate-400 hover:text-white transition-colors"><ZoomIn size={22} /></button>
          <button onClick={() => setScale(s => s / 1.3)} className="p-2.5 text-slate-400 hover:text-white transition-colors"><ZoomOut size={22} /></button>
          <button onClick={() => { setScale(1); setPosition({x:0,y:0}); }} className="p-2.5 text-slate-400 hover:text-white transition-colors"><RotateCcw size={22} /></button>
        </div>
      </div>
      <div ref={containerRef} className="w-full h-full overflow-hidden" onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={() => { onMousePositionChange?.(null); setSnappedPos(null); }}>
        <div className="origin-top-left w-full h-full flex items-center justify-center pointer-events-none" style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, transition: isDragging ? 'none' : 'transform 0.1s ease-out' }}>
          {src && (
            <div ref={wrapperRef} className="relative inline-block shadow-2xl pointer-events-auto">
              <img ref={imgRef} src={src} onLoad={handleImageLoad} className="max-w-[none] max-h-[85vh] block object-contain pointer-events-none select-none" />
              {imgSize.width > 0 && (
                <svg 
                  className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" 
                  viewBox={`0 0 ${imgSize.width} ${imgSize.height}`}
                  preserveAspectRatio="none"
                >
                  <DxfLayer entities={dxfOverlayEntities} imgWidth={imgSize.width} imgHeight={imgSize.height} uiBase={uiBase} scale={scale} />
                  <AiLayer entities={aiOverlayEntities} imgWidth={imgSize.width} imgHeight={imgSize.height} />
                  <g>
                    {showMeasurements && (
                      <MeasurementLayer measurements={measurements} parallelMeasurements={parallelMeasurements} areaMeasurements={areaMeasurements} curveMeasurements={curveMeasurements} imgWidth={imgSize.width} imgHeight={imgSize.height} mmPerPixel={mmPerPixel} unitLabel={unitLabel} uiBase={uiBase} scale={scale} getS={getS} getR={getR} getF={getF} />
                    )}
                    {currentPoints.length > 0 && (
                      <g>
                        {(mode === 'box_group' || mode === 'feature') && (currentPoints.length === 1 && (mousePos || snappedPos) ? (
                            <rect x={Math.min(currentPoints[0].x, (snappedPos || mousePos!).x) * imgSize.width} y={Math.min(currentPoints[0].y, (snappedPos || mousePos!).y) * imgSize.height} width={Math.abs(currentPoints[0].x - (snappedPos || mousePos!).x) * imgSize.width} height={Math.abs(currentPoints[0].y - (snappedPos || mousePos!).y) * imgSize.height} fill="rgba(99, 102, 241, 0.1)" stroke="#6366f1" strokeWidth={getS(0.6)} strokeDasharray={getS(3)} />
                        ) : currentPoints.length === 2 ? (
                            <rect x={Math.min(currentPoints[0].x, currentPoints[1].x) * imgSize.width} y={Math.min(currentPoints[0].y, currentPoints[1].y) * imgSize.height} width={Math.abs(currentPoints[0].x - currentPoints[1].x) * imgSize.width} height={Math.abs(currentPoints[0].y - currentPoints[1].y) * imgSize.height} fill="rgba(99, 102, 241, 0.15)" stroke="#6366f1" strokeWidth={getS(0.8)} strokeDasharray={getS(3)} />
                        ) : null)}
                        {mode === 'measure' && currentPoints.length === 1 && (mousePos || snappedPos) && (
                          <g>
                            {(() => {
                              const p2 = snappedPos || mousePos!; const dist = getPhysDist(currentPoints[0], p2, imgSize.width, imgSize.height, mmPerPixel);
                              return (
                                <><line x1={currentPoints[0].x * imgSize.width} y1={currentPoints[0].y * imgSize.height} x2={p2.x * imgSize.width} y2={p2.y * imgSize.height} stroke="#6366f1" strokeWidth={getS(0.6)} strokeDasharray={getS(3)} />
                                <text x={((currentPoints[0].x + p2.x) / 2) * imgSize.width} y={((currentPoints[0].y + p2.y) / 2) * imgSize.height} fill="white" fontSize={getF(10)} fontWeight="bold" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1.5) }}>{dist.toFixed(2)}{unitLabel}</text></>
                              );
                            })()}
                          </g>
                        )}
                        {mode === 'parallel' && (
                          <g>{currentPoints.length >= 2 && <line x1={currentPoints[0].x * imgSize.width} y1={currentPoints[0].y * imgSize.height} x2={currentPoints[1].x * imgSize.width} y2={currentPoints[1].y * imgSize.height} stroke="#6366f1" strokeWidth={getS(1)} />}
                            {(currentPoints.length === 3 || (currentPoints.length === 2 && (mousePos || snappedPos))) && (
                              <g>{(() => {
                                    const p3 = currentPoints.length === 3 ? currentPoints[2] : (snappedPos || mousePos!); const proj = getPerpendicularPoint(p3, currentPoints[0], currentPoints[1], imgSize.width, imgSize.height); const dist = getPhysDist(p3, proj, imgSize.width, imgSize.height, mmPerPixel);
                                    return (<><line x1={p3.x * imgSize.width} y1={p3.y * imgSize.height} x2={proj.x * imgSize.width} y2={proj.y * imgSize.height} stroke="#fbbf24" strokeWidth={getS(0.6)} strokeDasharray={`${getS(2)} ${getS(2)}`} /><text x={p3.x * imgSize.width} y={p3.y * imgSize.height} fill="#fbbf24" fontSize={getF(10)} fontWeight="bold" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1.5) }}>D: {dist.toFixed(2)}{unitLabel}</text></>);
                                })()}</g>
                            )}
                          </g>
                        )}
                        {mode === 'area' && (
                            <g><path d={getPathData(currentPoints, imgSize.width, imgSize.height) + (currentPoints.length > 2 ? ' Z' : '')} fill="rgba(99, 102, 241, 0.2)" stroke="#6366f1" strokeWidth={getS(0.8)} strokeDasharray={getS(2)} />
                                {currentPoints.length > 2 && <text x={(currentPoints.reduce((s,p)=>s+p.x,0)/currentPoints.length)*imgSize.width} y={(currentPoints.reduce((s,p)=>s+p.y,0)/currentPoints.length)*imgSize.height} fill="white" fontSize={getF(10)} fontWeight="bold" textAnchor="middle" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1.5) }}>{getPolygonArea(currentPoints, imgSize.width, imgSize.height, mmPerPixel).toFixed(2)}{unitLabel}²</text>}</g>
                        )}
                        {mode === 'curve' && (
                            <g><path d={getCatmullRomPath(currentPoints, imgSize.width, imgSize.height)} fill="none" stroke="#a855f7" strokeWidth={getS(1.2)} strokeDasharray={`${getS(3)} ${getS(3)}`} />
                                {currentPoints.length > 1 && <text x={currentPoints[currentPoints.length-1].x * imgSize.width} y={currentPoints[currentPoints.length-1].y * imgSize.height} fill="white" fontSize={getF(10)} fontWeight="bold" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1.5) }}>{getPolylineLength(currentPoints, imgSize.width, imgSize.height, mmPerPixel).toFixed(2)}{unitLabel}</text>}</g>
                        )}
                        {currentPoints.map((p, i) => (<circle key={`pt-${i}`} cx={p.x * imgSize.width} cy={p.y * imgSize.height} r={getR(1.3)} fill="#6366f1" stroke="white" strokeWidth={getS(0.6)} />))}
                      </g>
                    )}
                    {calibrationData && showCalibration && (
                      <g><line x1={calibrationData.start.x * imgSize.width} y1={calibrationData.start.y * imgSize.height} x2={calibrationData.end.x * imgSize.width} y2={calibrationData.end.y * imgSize.height} stroke="#fbbf24" fill="none" strokeWidth={getS(0.6)} strokeDasharray={getS(3)} /><circle cx={calibrationData.start.x * imgSize.width} cy={calibrationData.start.y * imgSize.height} r={getR(1.1)} fill="#fbbf24" /><circle cx={calibrationData.end.x * imgSize.width} cy={calibrationData.end.y * imgSize.height} r={getR(1.1)} fill="#fbbf24" /></g>
                    )}
                    {originCanvasPos && (
                      <g transform={`translate(${originCanvasPos.x * imgSize.width}, ${originCanvasPos.y * imgSize.height})`}><line x1={-getS(25)} y1="0" x2={getS(25)} y2="0" stroke="#f43f5e" strokeWidth={getS(0.4)} /><line x1="0" y1={-getS(25)} x2="0" y2={getS(25)} stroke="#f43f5e" strokeWidth={getS(0.4)} /><circle r={getR(10)} fill="none" stroke="#f43f5e" strokeWidth={getS(0.4)} /></g>
                    )}
                    {snappedPos && (<circle cx={snappedPos.x * imgSize.width} cy={snappedPos.y * imgSize.height} r={getR(6)} fill="none" stroke="#22c55e" strokeWidth={getS(1.5)} strokeDasharray={getS(3)} className="animate-pulse" />)}
                  </g>
                </svg>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
