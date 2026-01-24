
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
  hoveredMarker?: { x: number, y: number, color: string } | null;
  dxfSearchROI?: Point[];
}

export const ImageCanvas: React.FC<ImageCanvasProps> = ({
  src, mode, calibrationData, measurements, parallelMeasurements = [], areaMeasurements = [],
  curveMeasurements = [], currentPoints, onPointClick, dxfOverlayEntities = [],
  aiOverlayEntities = [],
  onMousePositionChange, onDimensionsChange, initialTransform, onViewChange,
  showCalibration = true, showMeasurements = true, originCanvasPos,
  hoveredMarker, dxfSearchROI = []
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 }); 
  const [layoutSize, setLayoutSize] = useState({ width: 0, height: 0 }); 
  const [mousePos, setMousePos] = useState<Point | null>(null);
  const [snappedPos, setSnappedPos] = useState<Point | null>(null);

  useEffect(() => { 
    if (initialTransform) { setScale(initialTransform.scale); setPosition({ x: initialTransform.x, y: initialTransform.y }); } 
    else { setScale(1); setPosition({ x: 0, y: 0 }); }
  }, [src]);

  useEffect(() => { 
    onViewChange?.({ x: position.x, y: position.y, scale }); 
    (window as any).lastCanvasScale = scale;
  }, [scale, position.x, position.y]);

  const updateLayoutSize = () => {
    if (!imgRef.current) return;
    const style = window.getComputedStyle(imgRef.current);
    const w = parseFloat(style.width), h = parseFloat(style.height);
    if (!isNaN(w) && !isNaN(h)) setLayoutSize({ width: w, height: h });
  };

  useEffect(() => {
    if (!src) return;
    const observer = new ResizeObserver(() => updateLayoutSize());
    if (containerRef.current) observer.observe(containerRef.current);
    updateLayoutSize();
    return () => observer.disconnect();
  }, [src]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth && naturalHeight) { setImgSize({ width: naturalWidth, height: naturalHeight }); onDimensionsChange?.(naturalWidth, naturalHeight); updateLayoutSize(); }
  };

  const getNormalizedPoint = (clientX: number, clientY: number) => {
    if (!containerRef.current || layoutSize.width === 0 || layoutSize.height === 0) return null;
    const containerRect = containerRef.current.getBoundingClientRect();
    const centerX = containerRect.left + containerRect.width / 2, centerY = containerRect.top + containerRect.height / 2;
    const unscaledX = (clientX - centerX - position.x) / scale, unscaledY = (clientY - centerY - position.y) / scale;
    const normX = (unscaledX / layoutSize.width) + 0.5, normY = (unscaledY / layoutSize.height) + 0.5;
    if (normX >= -0.005 && normX <= 1.005 && normY >= -0.005 && normY <= 1.005) return { x: Math.max(0, Math.min(1, normX)), y: Math.max(0, Math.min(1, normY)) };
    return null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault(); const delta = -e.deltaY * 0.0015; const newScale = Math.min(Math.max(0.1, scale * (1 + delta)), 100); 
    const rect = containerRef.current?.getBoundingClientRect(); if (!rect) return;
    const centerX = rect.left + rect.width / 2, centerY = rect.top + rect.height / 2;
    const relX = e.clientX - centerX, relY = e.clientY - centerY;
    setPosition(prev => ({ x: relX - (relX - prev.x) * (newScale / scale), y: relY - (relY - prev.y) * (newScale / scale) }));
    setScale(newScale);
  };

  const handleMouseDown = (e: React.MouseEvent) => { if (e.button === 1 || (e.button === 0 && e.shiftKey)) { e.preventDefault(); setIsDragging(true); setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y }); } };

  const snapTargets = useMemo(() => {
    const targets: Point[] = [];
    if (calibrationData) targets.push(calibrationData.start, calibrationData.end);
    if (originCanvasPos) targets.push(originCanvasPos);
    currentPoints.forEach(p => targets.push(p));
    measurements.forEach(m => targets.push(m.start, m.end));
    return targets;
  }, [calibrationData, originCanvasPos, currentPoints, measurements]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    const p = getNormalizedPoint(e.clientX, e.clientY); setMousePos(p);
    if (p && layoutSize.width > 0) {
        let closest: Point | null = null; let minDist = Infinity;
        for (const target of snapTargets) {
          const dx = (p.x - target.x) * (layoutSize.width * scale), dy = (p.y - target.y) * (layoutSize.height * scale); 
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 12 && dist < minDist) { minDist = dist; closest = target; }
        }
        setSnappedPos(closest); onMousePositionChange?.(closest || p);
    } else { setSnappedPos(null); onMousePositionChange?.(p); }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDragging) { setIsDragging(false); return; }
    if (e.button === 0) { const p = getNormalizedPoint(e.clientX, e.clientY); if (p) onPointClick(snappedPos || p); }
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
      <div ref={containerRef} className="w-full h-full overflow-hidden" onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={() => { setMousePos(null); setSnappedPos(null); onMousePositionChange?.(null); }}>
        <div className="w-full h-full flex items-center justify-center pointer-events-none" style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, transformOrigin: 'center center', transition: isDragging ? 'none' : 'transform 0.1s ease-out' }}>
          {src && (
            <div className="relative inline-block shadow-2xl pointer-events-auto">
              <img ref={imgRef} src={src} onLoad={handleImageLoad} className="max-w-[none] max-h-[85vh] block object-contain pointer-events-none select-none" />
              {imgSize.width > 0 && (
                <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" viewBox={`0 0 ${imgSize.width} ${imgSize.height}`} preserveAspectRatio="none">
                  <DxfLayer entities={dxfOverlayEntities} imgWidth={imgSize.width} imgHeight={imgSize.height} uiBase={uiBase} scale={scale} />
                  <AiLayer entities={aiOverlayEntities} imgWidth={imgSize.width} imgHeight={imgSize.height} />
                  <g>
                    {/* Render Persistent DXF Search ROI if set */}
                    {dxfSearchROI.length === 2 && (
                      <rect 
                        x={Math.min(dxfSearchROI[0].x, dxfSearchROI[1].x) * imgSize.width} 
                        y={Math.min(dxfSearchROI[0].y, dxfSearchROI[1].y) * imgSize.height} 
                        width={Math.abs(dxfSearchROI[0].x - dxfSearchROI[1].x) * imgSize.width} 
                        height={Math.abs(dxfSearchROI[0].y - dxfSearchROI[1].y) * imgSize.height} 
                        fill="rgba(16, 185, 129, 0.05)" 
                        stroke="#10b981" 
                        strokeWidth={getS(1)} 
                        strokeDasharray={`${getS(4)} ${getS(4)}`} 
                      />
                    )}

                    {showCalibration && calibrationData && (
                      <g>
                        <line 
                          x1={calibrationData.start.x * imgSize.width} 
                          y1={calibrationData.start.y * imgSize.height} 
                          x2={calibrationData.end.x * imgSize.width} 
                          y2={calibrationData.end.y * imgSize.height} 
                          stroke="#fbbf24" 
                          strokeWidth={getS(1.2)} 
                          strokeDasharray={getS(4)} 
                        />
                        <circle cx={calibrationData.start.x * imgSize.width} cy={calibrationData.start.y * imgSize.height} r={getR(1.3)} fill="#fbbf24" stroke="white" strokeWidth={getS(0.6)} />
                        <circle cx={calibrationData.end.x * imgSize.width} cy={calibrationData.end.y * imgSize.height} r={getR(1.3)} fill="#fbbf24" stroke="white" strokeWidth={getS(0.6)} />
                      </g>
                    )}

                    {showMeasurements && <MeasurementLayer measurements={measurements} parallelMeasurements={parallelMeasurements} areaMeasurements={areaMeasurements} curveMeasurements={curveMeasurements} imgWidth={imgSize.width} imgHeight={imgSize.height} mmPerPixel={mmPerPixel} unitLabel={unitLabel} uiBase={uiBase} scale={scale} getS={getS} getR={getR} getF={getF} />}
                    
                    {currentPoints.length > 0 && (
                      <g>
                        {/* Manual Weld Point Active Selection */}
                        {mode === 'manual_weld' && currentPoints.length === 1 && (
                          <g transform={`translate(${currentPoints[0].x * imgSize.width}, ${currentPoints[0].y * imgSize.height})`}>
                            <circle r={getR(6)} fill="rgba(16, 185, 129, 0.1)" stroke="#10b981" strokeWidth={getS(0.8)} strokeDasharray={getS(3)} className="animate-pulse" />
                            <line x1={-getS(10)} y1="0" x2={getS(10)} y2="0" stroke="#10b981" strokeWidth={getS(1)} />
                            <line x1="0" y1={-getS(10)} x2="0" y2={getS(10)} stroke="#10b981" strokeWidth={getS(1)} />
                            <circle r={getR(1.5)} fill="#10b981" />
                          </g>
                        )}

                        {/* 动态绘制预览：Distance / Calibrate */}
                        {(mode === 'measure' || mode === 'calibrate') && (currentPoints.length === 1 || currentPoints.length === 2) && (
                          <g>
                            {(() => {
                                const p1 = currentPoints[0];
                                const p2 = currentPoints.length === 2 ? currentPoints[1] : (snappedPos || mousePos);
                                if (!p2) return null;
                                const dist = getPhysDist(p1, p2, imgSize.width, imgSize.height, mmPerPixel);
                                return (
                                    <>
                                        <line x1={p1.x * imgSize.width} y1={p1.y * imgSize.height} x2={p2.x * imgSize.width} y2={p2.y * imgSize.height} stroke={mode === 'calibrate' ? "#fbbf24" : "#6366f1"} strokeWidth={getS(1)} strokeDasharray={getS(4)} />
                                        <text x={(p1.x + p2.x)/2 * imgSize.width} y={(p1.y + p2.y)/2 * imgSize.height} fill="white" fontSize={getF(10)} fontWeight="bold" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1.5) }}>
                                          {dist.toFixed(2)}{unitLabel}
                                        </text>
                                    </>
                                );
                            })()}
                          </g>
                        )}

                        {/* 动态绘制预览：Parallel */}
                        {mode === 'parallel' && (
                          <g>
                            {/* 基准线 */}
                            {currentPoints.length >= 2 && (
                                <line 
                                  x1={currentPoints[0].x * imgSize.width} y1={currentPoints[0].y * imgSize.height} 
                                  x2={currentPoints[1].x * imgSize.width} y2={currentPoints[1].y * imgSize.height} 
                                  stroke="#6366f1" strokeWidth={getS(1)} 
                                />
                            )}
                            {/* 偏移预览 */}
                            {(currentPoints.length === 2 || currentPoints.length === 3) && (
                                <g>
                                    {(() => {
                                        const target = currentPoints.length === 3 ? currentPoints[2] : (snappedPos || mousePos);
                                        if (!target) return null;
                                        const proj = getPerpendicularPoint(target, currentPoints[0], currentPoints[1], imgSize.width, imgSize.height);
                                        const dist = getPhysDist(target, proj, imgSize.width, imgSize.height, mmPerPixel);
                                        return (
                                            <>
                                              <line x1={target.x * imgSize.width} y1={target.y * imgSize.height} x2={proj.x * imgSize.width} y2={proj.y * imgSize.height} stroke="#fbbf24" strokeWidth={getS(0.6)} strokeDasharray={getS(2)} />
                                              <text x={target.x * imgSize.width} y={target.y * imgSize.height} fill="#fbbf24" fontSize={getF(10)} fontWeight="bold" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1.5) }}>D: {dist.toFixed(2)}{unitLabel}</text>
                                            </>
                                        );
                                    })()}
                                </g>
                            )}
                          </g>
                        )}

                        {/* 动态绘制预览：Area / Curve */}
                        {(mode === 'area' || mode === 'curve') && currentPoints.length >= 1 && (
                          <g>
                            {(() => {
                              const pts = [...currentPoints];
                              if (mousePos || snappedPos) pts.push(snappedPos || mousePos!);
                              const path = mode === 'area' ? getPathData(pts, imgSize.width, imgSize.height) + ' Z' : getCatmullRomPath(pts, imgSize.width, imgSize.height);
                              
                              let label = null;
                              if (pts.length >= 2) {
                                  if (mode === 'area' && pts.length >= 3) {
                                      const area = getPolygonArea(pts, imgSize.width, imgSize.height, mmPerPixel);
                                      const cx = (pts.reduce((s,p)=>s+p.x,0)/pts.length)*imgSize.width;
                                      const cy = (pts.reduce((s,p)=>s+p.y,0)/pts.length)*imgSize.height;
                                      label = <text x={cx} y={cy} fill="white" fontSize={getF(10)} fontWeight="bold" textAnchor="middle" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1.5) }}>{area.toFixed(2)}{unitLabel}²</text>;
                                  } else if (mode === 'curve') {
                                      const len = getPolylineLength(pts, imgSize.width, imgSize.height, mmPerPixel);
                                      const midPt = pts[Math.floor(pts.length/2)];
                                      label = <text x={midPt.x * imgSize.width} y={midPt.y * imgSize.height} fill="white" fontSize={getF(10)} fontWeight="bold" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1.5) }}>{len.toFixed(2)}{unitLabel}</text>;
                                  }
                              }

                              return (
                                <>
                                    <path d={path} fill={mode === 'area' ? "rgba(99, 102, 241, 0.1)" : "none"} stroke={mode === 'area' ? "#6366f1" : "#a855f7"} strokeWidth={getS(0.8)} strokeDasharray={getS(3)} />
                                    {label}
                                </>
                              );
                            })()}
                          </g>
                        )}

                        {/* RECT: 1-2 points (Shared by box_rect, box_find_roi, and feature search) */}
                        {((mode === 'box_rect' || mode === 'box_find_roi' || mode === 'feature')) && (
                          <g>
                            {currentPoints.length === 1 && (mousePos || snappedPos) ? (
                                <rect 
                                  x={Math.min(currentPoints[0].x, (snappedPos || mousePos!).x) * imgSize.width} 
                                  y={Math.min(currentPoints[0].y, (snappedPos || mousePos!).y) * imgSize.height} 
                                  width={Math.abs(currentPoints[0].x - (snappedPos || mousePos!).x) * imgSize.width} 
                                  height={Math.abs(currentPoints[0].y - (snappedPos || mousePos!).y) * imgSize.height} 
                                  fill={mode === 'box_find_roi' ? "rgba(16, 185, 129, 0.1)" : "rgba(99, 102, 241, 0.1)"} 
                                  stroke={mode === 'box_find_roi' ? "#10b981" : "#6366f1"} 
                                  strokeWidth={getS(0.6)} 
                                  strokeDasharray={getS(3)} 
                                />
                            ) : currentPoints.length === 2 ? (
                                <rect 
                                  x={Math.min(currentPoints[0].x, currentPoints[1].x) * imgSize.width} 
                                  y={Math.min(currentPoints[0].y, currentPoints[1].y) * imgSize.height} 
                                  width={Math.abs(currentPoints[0].x - currentPoints[1].x) * imgSize.width} 
                                  height={Math.abs(currentPoints[0].y - currentPoints[1].y) * imgSize.height} 
                                  fill={mode === 'box_find_roi' ? "rgba(16, 185, 129, 0.15)" : "rgba(99, 102, 241, 0.15)"} 
                                  stroke={mode === 'box_find_roi' ? "#10b981" : "#6366f1"} 
                                  strokeWidth={getS(0.8)} 
                                />
                            ) : null}
                          </g>
                        )}

                        {/* POLYGON: 3+ points (box_poly) */}
                        {mode === 'box_poly' && (
                          <g>
                            {(() => {
                              const pts = [...currentPoints]; const activeMouse = snappedPos || mousePos;
                              if (activeMouse) { const dist = Math.sqrt(Math.pow(activeMouse.x - pts[0].x, 2) + Math.pow(activeMouse.y - pts[0].y, 2)); if (dist >= 0.012/scale) pts.push(activeMouse); }
                              return <path d={getPathData(pts, imgSize.width, imgSize.height) + (pts.length > 2 ? ' Z' : '')} fill="rgba(99, 102, 241, 0.15)" stroke="#6366f1" strokeWidth={getS(0.8)} strokeDasharray={getS(2)} />;
                            })()}
                          </g>
                        )}
                        {currentPoints.map((p, i) => (
                           <circle key={`pt-${i}`} cx={p.x * imgSize.width} cy={p.y * imgSize.height} r={getR(1.3)} fill={mode === 'box_find_roi' ? "#10b981" : "#6366f1"} stroke="white" strokeWidth={getS(0.6)} />
                        ))}
                      </g>
                    )}
                    {originCanvasPos && (
                      <g transform={`translate(${originCanvasPos.x * imgSize.width}, ${originCanvasPos.y * imgSize.height})`}><line x1={-getS(25)} y1="0" x2={getS(25)} y2="0" stroke="#f43f5e" strokeWidth={getS(0.4)} /><line x1="0" y1={-getS(25)} x2="0" y2={getS(25)} stroke="#f43f5e" strokeWidth={getS(0.4)} /><circle r={getR(10)} fill="none" stroke="#f43f5e" strokeWidth={getS(0.4)} /></g>
                    )}
                    {snappedPos && <circle cx={snappedPos.x * imgSize.width} cy={snappedPos.y * imgSize.height} r={getR(6)} fill="none" stroke="#22c55e" strokeWidth={getS(1.5)} strokeDasharray={getS(3)} className="animate-pulse" />}
                    {hoveredMarker && (
                        <g transform={`translate(${hoveredMarker.x * imgSize.width}, ${hoveredMarker.y * imgSize.height})`} pointerEvents="none">
                            <line x1={-getS(20)} y1="0" x2={getS(20)} y2="0" stroke="black" strokeWidth={getS(2.5)} strokeOpacity="0.5" />
                            <line x1="0" y1={-getS(20)} x2="0" y2={getS(20)} stroke="black" strokeWidth={getS(2.5)} strokeOpacity="0.5" />
                            <line x1={-getS(20)} y1="0" x2={getS(20)} y2="0" stroke={hoveredMarker.color} strokeWidth={getS(1.2)} />
                            <line x1="0" y1={-getS(20)} x2="0" y2={getS(20)} stroke={hoveredMarker.color} strokeWidth={getS(1.2)} />
                            <circle r={getR(4)} fill="none" stroke={hoveredMarker.color} strokeWidth={getS(1.2)} />
                        </g>
                    )}
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
