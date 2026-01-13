import React, { useRef, useState, useEffect } from 'react';
import { Point, LineSegment, ParallelMeasurement, AreaMeasurement, CurveMeasurement, CalibrationData, SolderPoint, ViewTransform, FeatureResult, RenderableDxfEntity } from '../types';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

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
  solderPoints?: SolderPoint[];
  dxfOverlayEntities?: RenderableDxfEntity[];
  originCanvasPos?: Point | null;
  onMousePositionChange?: (pos: Point | null) => void;
  onHoverPointChange?: (point: SolderPoint | null) => void;
  onDimensionsChange?: (width: number, height: number) => void;
  initialTransform?: ViewTransform | null;
  onViewChange?: (transform: ViewTransform) => void;
  showCalibration?: boolean;
  showMeasurements?: boolean;
  featureROI?: Point[];
  featureResults?: FeatureResult[];
  selectedComponentId?: string | null;
  selectedObjectGroupKey?: string | null;
}

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
  solderPoints = [],
  dxfOverlayEntities = [],
  originCanvasPos,
  onMousePositionChange,
  onHoverPointChange,
  onDimensionsChange,
  initialTransform,
  onViewChange,
  showCalibration = true,
  showMeasurements = true,
  featureROI = [],
  featureResults = [],
  // 补全缺失的解构
  selectedComponentId,
  selectedObjectGroupKey
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState({ width: 1, height: 1 });

  useEffect(() => { 
    if (initialTransform) {
      setScale(initialTransform.scale);
      setPosition({ x: initialTransform.x, y: initialTransform.y });
    } else {
      setScale(1); 
      setPosition({ x: 0, y: 0 }); 
    }
  }, [src]);

  useEffect(() => {
    onViewChange?.({ x: position.x, y: position.y, scale });
  }, [scale, position.x, position.y]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth && naturalHeight) {
      setImgSize({ width: naturalWidth, height: naturalHeight });
      onDimensionsChange?.(naturalWidth, naturalHeight);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault(); setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    } 
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    if (imgRef.current) {
      const rect = imgRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) onMousePositionChange?.({ x, y });
      else onMousePositionChange?.(null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDragging) { setIsDragging(false); return; }
    if (e.button === 0 && imgRef.current) {
      const rect = imgRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) onPointClick({ x, y });
    }
  };

  const uiBase = Math.min(imgSize.width, imgSize.height) / 500;
  
  const getS = (mult: number = 0.5) => (uiBase * mult) / scale;
  const getR = (mult: number = 0.7) => (uiBase * mult) / scale;
  const getF = (mult: number = 9) => (uiBase * mult) / scale;

  const unitLabel = calibrationData?.unit || 'mm';

  const getMmPerPixel = () => {
    if (!calibrationData) return 0;
    const dx = (calibrationData.start.x - calibrationData.end.x) * imgSize.width;
    const dy = (calibrationData.start.y - calibrationData.end.y) * imgSize.height;
    const pixelDist = Math.sqrt(dx*dx + dy*dy);
    return pixelDist > 0 ? calibrationData.realWorldDistance / pixelDist : 0;
  };

  const getPhysDist = (p1: Point, p2: Point) => {
    const s = getMmPerPixel();
    if (s === 0) return 0;
    const dx = (p1.x - p2.x) * imgSize.width;
    const dy = (p1.y - p2.y) * imgSize.height;
    return Math.sqrt(dx*dx + dy*dy) * s;
  };

  const projectPointToLine = (p: Point, l1: Point, l2: Point) => {
    const x1 = l1.x * imgSize.width, y1 = l1.y * imgSize.height;
    const x2 = l2.x * imgSize.width, y2 = l2.y * imgSize.height;
    const xp = p.x * imgSize.width, yp = p.y * imgSize.height;
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx*dx + dy*dy;
    if (lenSq === 0) return { x: l1.x, y: l1.y };
    const t = ((xp - x1) * dx + (yp - y1) * dy) / lenSq;
    return { x: (x1 + t * dx) / imgSize.width, y: (y1 + t * dy) / imgSize.height };
  };

  const getPolygonArea = (points: Point[]) => {
    const s = getMmPerPixel();
    if (s === 0) return 0;
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % n];
      area += (p1.x * imgSize.width * p2.y * imgSize.height) - (p2.x * imgSize.width * p1.y * imgSize.height);
    }
    return Math.abs(area / 2) * s * s;
  };

  const getPolylineLength = (points: Point[]) => {
    const s = getMmPerPixel();
    if (s === 0) return 0;
    let len = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const dx = (points[i+1].x - points[i].x) * imgSize.width;
        const dy = (points[i+1].y - points[i].y) * imgSize.height;
        len += Math.sqrt(dx*dx + dy*dy);
    }
    return len * s;
  };

  const getCentroid = (points: Point[]) => {
     let sx = 0, sy = 0;
     points.forEach(p => { sx += p.x; sy += p.y; });
     return { x: (sx / points.length) * imgSize.width, y: (sy / points.length) * imgSize.height };
  };

  const getSmoothPath = (points: Point[], close: boolean = false) => {
    if (points.length < 2) return "";
    const pts = points.map(p => ({ x: p.x * imgSize.width, y: p.y * imgSize.height }));
    if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
    const k = 1;
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2] || p2;
        const cp1x = p1.x + (p2.x - p0.x) / 6 * k;
        const cp1y = p1.y + (p2.y - p0.y) / 6 * k;
        const cp2x = p2.x - (p3.x - p1.x) / 6 * k;
        const cp2y = p2.y - (p3.y - p1.y) / 6 * k;
        path += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
    }
    if (close) path += " Z";
    return path;
  };

  return (
    <div className="relative w-full h-full bg-slate-900/40 rounded-2xl overflow-hidden border border-slate-800 shadow-inner group">
      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-2">
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-xl p-1.5 flex flex-col gap-1.5 shadow-2xl">
          <button onClick={() => setScale(s => s * 1.3)} className="p-2.5 text-slate-400 hover:text-white transition-colors"><ZoomIn size={22} /></button>
          <button onClick={() => setScale(s => s / 1.3)} className="p-2.5 text-slate-400 hover:text-white transition-colors"><ZoomOut size={22} /></button>
          <button onClick={() => { setScale(1); setPosition({x:0,y:0}); }} className="p-2.5 text-slate-400 hover:text-white transition-colors"><RotateCcw size={22} /></button>
        </div>
      </div>

      <div ref={containerRef} className="w-full h-full overflow-hidden" onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={() => {onMousePositionChange?.(null); onHoverPointChange?.(null);}}>
        <div className="origin-top-left w-full h-full flex items-center justify-center pointer-events-none" style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, transition: isDragging ? 'none' : 'transform 0.1s ease-out' }}>
          {src && (
            <div className="relative inline-block shadow-2xl pointer-events-auto">
              <img ref={imgRef} src={src} onLoad={handleImageLoad} className="max-w-[none] max-h-[85vh] block object-contain pointer-events-none select-none" />
              <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" viewBox={`0 0 ${imgSize.width} ${imgSize.height}`}>
                
                {dxfOverlayEntities.map(entity => {
                    const { geometry, isSelected } = entity;
                    const baseMult = entity.strokeWidth ? entity.strokeWidth * (isSelected ? 1.5 : 0.5) : 0.5;
                    const strokeW = getS(baseMult);
                    const strokeC = isSelected ? "#ffffff" : (entity.strokeColor || "rgba(255, 255, 255, 0.3)");
                    
                    const selectionFilter = isSelected ? "drop-shadow(0 0 4px rgba(255, 255, 255, 0.8)) drop-shadow(0 0 8px rgba(34, 211, 238, 0.4))" : "";
                    const hoverClass = "hover:stroke-cyan-400 hover:drop-shadow-[0_0_2px_rgba(0,255,255,0.8)] transition-all cursor-crosshair pointer-events-auto";

                    if (geometry.type === 'line') {
                        return (
                            <line 
                                key={entity.id}
                                x1={geometry.props.x1! * imgSize.width}
                                y1={geometry.props.y1! * imgSize.height}
                                x2={geometry.props.x2! * imgSize.width}
                                y2={geometry.props.y2! * imgSize.height}
                                stroke={strokeC}
                                strokeWidth={strokeW}
                                style={{ filter: selectionFilter }}
                                className={hoverClass}
                            />
                        );
                    } else if (geometry.type === 'polyline') {
                        const pts = geometry.props.points?.split(' ').map(pair => {
                            const [x, y] = pair.split(',');
                            return `${parseFloat(x) * imgSize.width},${parseFloat(y) * imgSize.height}`;
                        }).join(' ');
                        return (
                            <polyline
                                key={entity.id}
                                points={pts}
                                fill="none"
                                stroke={strokeC}
                                strokeWidth={strokeW}
                                style={{ filter: selectionFilter }}
                                className={hoverClass.replace('cyan', 'violet')}
                            />
                        );
                    } else if (geometry.type === 'path') {
                        return (
                            <g key={entity.id} transform={`scale(${imgSize.width}, ${imgSize.height})`}>
                                <path
                                    d={geometry.props.d}
                                    fill="none"
                                    stroke={strokeC}
                                    vectorEffect="non-scaling-stroke" 
                                    strokeWidth={strokeW * scale}
                                    style={{ filter: selectionFilter }}
                                    className={hoverClass.replace('cyan', 'amber')}
                                />
                            </g>
                        );
                    } else if (geometry.type === 'circle') {
                        return (
                            <circle
                                key={entity.id}
                                cx={geometry.props.cx! * imgSize.width}
                                cy={geometry.props.cy! * imgSize.height}
                                r={geometry.props.r! * imgSize.width}
                                fill="none"
                                stroke={strokeC}
                                strokeWidth={strokeW}
                                style={{ filter: selectionFilter }}
                                className={hoverClass.replace('cyan', 'emerald')}
                            />
                        );
                    }
                    return null;
                })}

                {calibrationData && showCalibration && (
                  <g>
                    <line x1={calibrationData.start.x * imgSize.width} y1={calibrationData.start.y * imgSize.height} x2={calibrationData.end.x * imgSize.width} y2={calibrationData.end.y * imgSize.height} stroke="#fbbf24" strokeWidth={getS(0.5)} strokeDasharray={getS(3)} />
                    <circle cx={calibrationData.start.x * imgSize.width} cy={calibrationData.start.y * imgSize.height} r={getR(0.7)} fill="#fbbf24" />
                    <circle cx={calibrationData.end.x * imgSize.width} cy={calibrationData.end.y * imgSize.height} r={getR(0.7)} fill="#fbbf24" />
                  </g>
                )}

                {featureROI.length === 2 && (
                    <rect 
                        x={Math.min(featureROI[0].x, featureROI[1].x) * imgSize.width}
                        y={Math.min(featureROI[0].y, featureROI[1].y) * imgSize.height}
                        width={Math.abs(featureROI[0].x - featureROI[1].x) * imgSize.width}
                        height={Math.abs(featureROI[0].y - featureROI[1].y) * imgSize.height}
                        fill="rgba(139, 92, 246, 0.2)"
                        stroke="#8b5cf6"
                        strokeWidth={getS(0.5)} 
                        strokeDasharray={getS(2)} 
                    />
                )}

                {featureResults.map((feat, idx) => {
                    const isSnapped = feat.snapped;
                    const strokeColor = isSnapped ? '#06b6d4' : '#fbbf24'; 
                    const strokeWidth = getS(0.5); 
                    const fontSize = getF(4);
                    if (isSnapped && feat.entityType === 'circle') {
                        const cx = (feat.minX + feat.maxX) / 2 * imgSize.width;
                        const cy = (feat.minY + feat.maxY) / 2 * imgSize.height;
                        const r = (feat.maxX - feat.minX) / 2 * imgSize.width; 
                        return (
                            <g key={feat.id}>
                                <circle cx={cx} cy={cy} r={r} fill="rgba(6, 182, 212, 0.05)" stroke={strokeColor} strokeWidth={strokeWidth} />
                                <line x1={cx - getS(2)} y1={cy} x2={cx + getS(2)} y2={cy} stroke={strokeColor} strokeWidth={strokeWidth} />
                                <line x1={cx} y1={cy - getS(2)} x2={cx} y2={cy + getS(2)} stroke={strokeColor} strokeWidth={strokeWidth} />
                                <text x={cx} y={cy - r - getS(2)} fontSize={fontSize} textAnchor="middle" fill={strokeColor} style={{ textShadow: '0 0 2px black' }} fontWeight="bold">{idx + 1}</text>
                            </g>
                        );
                    }
                    return (
                        <g key={feat.id}>
                            <rect x={feat.minX * imgSize.width} y={feat.minY * imgSize.height} width={(feat.maxX - feat.minX) * imgSize.width} height={(feat.maxY - feat.minY) * imgSize.height} fill={isSnapped ? "rgba(6, 182, 212, 0.05)" : "none"} stroke={strokeColor} strokeWidth={strokeWidth} />
                            <text x={feat.minX * imgSize.width} y={(feat.minY * imgSize.height) - getS(2)} fontSize={fontSize} textAnchor="start" fill={strokeColor} style={{ textShadow: '0 0 2px black' }} fontWeight="bold">{idx + 1}</text>
                        </g>
                    );
                })}

                {showMeasurements && measurements.map(m => {
                  const d = getPhysDist(m.start, m.end);
                  return (
                    <g key={m.id}>
                      <line x1={m.start.x * imgSize.width} y1={m.start.y * imgSize.height} x2={m.end.x * imgSize.width} y2={m.end.y * imgSize.height} stroke="#6366f1" strokeWidth={getS(0.5)} strokeLinecap="round" />
                      <text x={(m.start.x + m.end.x)/2 * imgSize.width} y={(m.start.y + m.end.y)/2 * imgSize.height} fill="white" fontSize={getF(10)} fontWeight="bold" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1) }}>{d.toFixed(2)}{unitLabel}</text>
                    </g>
                  );
                })}

                {showMeasurements && parallelMeasurements.map(pm => {
                  const proj = projectPointToLine(pm.offsetPoint, pm.baseStart, pm.baseEnd);
                  const d = getPhysDist(pm.offsetPoint, proj);
                  return (
                    <g key={pm.id}>
                      <line x1={pm.baseStart.x * imgSize.width} y1={pm.baseStart.y * imgSize.height} x2={pm.baseEnd.x * imgSize.width} y2={pm.baseEnd.y * imgSize.height} stroke="#8b5cf6" strokeWidth={getS(0.5)} />
                      <line x1={pm.offsetPoint.x * imgSize.width} y1={pm.offsetPoint.y * imgSize.height} x2={proj.x * imgSize.width} y2={proj.y * imgSize.height} stroke="#8b5cf6" strokeWidth={getS(0.5)} strokeDasharray={getS(2)} />
                      <text x={pm.offsetPoint.x * imgSize.width} y={pm.offsetPoint.y * imgSize.height} fill="#a78bfa" fontSize={getF(9)} fontWeight="bold" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1) }}>Gap: {d.toFixed(2)}{unitLabel}</text>
                    </g>
                  );
                })}

                {showMeasurements && areaMeasurements.map(area => {
                  const areaVal = getPolygonArea(area.points);
                  const center = getCentroid(area.points);
                  return (
                    <g key={area.id}>
                      <polygon points={area.points.map(p => `${p.x * imgSize.width},${p.y * imgSize.height}`).join(' ')} fill="rgba(99,102,241,0.2)" stroke="#6366f1" strokeWidth={getS(0.5)} />
                      <text x={center.x} y={center.y} textAnchor="middle" fill="white" fontSize={getF(10)} fontWeight="bold" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1) }}>{areaVal.toFixed(2)} {unitLabel}²</text>
                    </g>
                  );
                })}
                
                {showMeasurements && curveMeasurements.map(curve => {
                   const len = getPolylineLength(curve.points);
                   const pathD = getSmoothPath(curve.points);
                   const lastPt = curve.points[curve.points.length - 1];
                   return (
                     <g key={curve.id}>
                        <path d={pathD} fill="none" stroke="#6366f1" strokeWidth={getS(0.5)} strokeLinecap="round" strokeLinejoin="round"/>
                        <text x={lastPt.x * imgSize.width} y={lastPt.y * imgSize.height} fill="white" fontSize={getF(10)} fontWeight="bold" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1) }}>{len.toFixed(2)} {unitLabel}</text>
                     </g>
                   );
                })}

                {currentPoints.length > 0 && (
                  <g>
                    {currentPoints.map((p, i) => (
                      <circle key={i} cx={p.x * imgSize.width} cy={p.y * imgSize.height} r={getR(0.7)} fill={(mode === 'calibrate' || mode === 'origin') ? '#fbbf24' : '#6366f1'} stroke="white" strokeWidth={getS(0.5)} />
                    ))}
                    {mode === 'origin' && currentPoints.length === 1 && (
                      <g transform={`translate(${currentPoints[0].x * imgSize.width}, ${currentPoints[0].y * imgSize.height})`}>
                          <line x1={-getS(20)} y1="0" x2={getS(20)} y2="0" stroke="#fbbf24" strokeWidth={getS(0.5)} strokeDasharray={getS(2)} />
                          <line x1="0" y1={-getS(20)} x2="0" y2={getS(20)} stroke="#fbbf24" strokeWidth={getS(0.5)} strokeDasharray={getS(2)} />
                      </g>
                    )}
                    {(mode === 'feature' || mode === 'box_group') && currentPoints.length === 2 && (() => {
                        const p1 = currentPoints[0], p2 = currentPoints[1];
                         return (
                            <rect x={Math.min(p1.x, p2.x) * imgSize.width} y={Math.min(p1.y, p2.y) * imgSize.height} width={Math.abs(p1.x - p2.x) * imgSize.width} height={Math.abs(p1.y - p2.y) * imgSize.height} fill={mode === 'box_group' ? "rgba(16, 185, 129, 0.1)" : "rgba(139, 92, 246, 0.1)"} stroke={mode === 'box_group' ? "#10b981" : "#8b5cf6"} strokeWidth={getS(0.5)} strokeDasharray={getS(2)} />
                         );
                    })()}
                    {mode === 'measure' && currentPoints.length === 2 && (() => {
                        const d = getPhysDist(currentPoints[0], currentPoints[1]);
                        return (
                          <g>
                            <line x1={currentPoints[0].x * imgSize.width} y1={currentPoints[0].y * imgSize.height} x2={currentPoints[1].x * imgSize.width} y2={currentPoints[1].y * imgSize.height} stroke="#6366f1" strokeWidth={getS(0.5)} strokeLinecap="round" strokeDasharray={getS(2)} />
                            <text x={(currentPoints[0].x + currentPoints[1].x)/2 * imgSize.width} y={(currentPoints[0].y + currentPoints[1].y)/2 * imgSize.height} fill="white" fontSize={getF(10)} fontWeight="bold" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1) }}>{d.toFixed(2)}{unitLabel}</text>
                          </g>
                        );
                    })()}
                    {mode === 'parallel' && currentPoints.length >= 2 && <line x1={currentPoints[0].x * imgSize.width} y1={currentPoints[0].y * imgSize.height} x2={currentPoints[1].x * imgSize.width} y2={currentPoints[1].y * imgSize.height} stroke="#8b5cf6" strokeWidth={getS(0.5)} />}
                    {mode === 'parallel' && currentPoints.length === 3 && (() => {
                        const proj = projectPointToLine(currentPoints[2], currentPoints[0], currentPoints[1]);
                        const d = getPhysDist(currentPoints[2], proj);
                        return (
                           <g>
                              <line x1={currentPoints[2].x * imgSize.width} y1={currentPoints[2].y * imgSize.height} x2={proj.x * imgSize.width} y2={proj.y * imgSize.height} stroke="#8b5cf6" strokeWidth={getS(0.5)} strokeDasharray={getS(2)} />
                              <text x={currentPoints[2].x * imgSize.width} y={currentPoints[2].y * imgSize.height} fill="#a78bfa" fontSize={getF(9)} fontWeight="bold" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1) }}>Gap: {d.toFixed(2)}{unitLabel}</text>
                           </g>
                        );
                    })()}
                    {currentPoints.length > 1 && (mode === 'curve' ? <path d={getSmoothPath(currentPoints)} fill="none" stroke="#6366f1" strokeWidth={getS(0.5)} strokeDasharray={getS(3)} /> : mode === 'area' ? <polyline points={currentPoints.map(p => `${p.x * imgSize.width},${p.y * imgSize.height}`).join(' ')} fill={'rgba(99,102,241,0.1)'} stroke={'#6366f1'} strokeWidth={getS(0.5)} strokeDasharray={getS(3)} /> : null)}
                  </g>
                )}

                {solderPoints.map(p => (
                  <circle key={p.id} cx={p.canvasX * imgSize.width} cy={p.canvasY * imgSize.height} r={getR(0.7)} fill="#22c55e" stroke="white" strokeWidth={getS(0.5)} onMouseEnter={() => onHoverPointChange?.(p)} onMouseLeave={() => onHoverPointChange?.(null)} className="pointer-events-auto cursor-help" />
                ))}
                {originCanvasPos && (
                    <g transform={`translate(${originCanvasPos.x * imgSize.width}, ${originCanvasPos.y * imgSize.height})`}>
                       <circle r={getR(0.7)} fill="none" stroke="#ef4444" strokeWidth={getS(0.5)} />
                       <line x1={-getS(8)} y1="0" x2={getS(8)} y2="0" stroke="#ef4444" strokeWidth={getS(0.5)} />
                       <line x1="0" y1={-getS(8)} x2="0" y2={getS(8)} stroke="#ef4444" strokeWidth={getS(0.5)} />
                    </g>
                )}
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};