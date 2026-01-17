import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Point, LineSegment, ParallelMeasurement, AreaMeasurement, CurveMeasurement, CalibrationData, ViewTransform, RenderableDxfEntity, AiFeatureGroup } from '../types';
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
  dxfOverlayEntities?: RenderableDxfEntity[];
  originCanvasPos?: Point | null;
  onMousePositionChange?: (pos: Point | null) => void;
  onMouseUpOutside?: () => void;
  onDimensionsChange?: (width: number, height: number) => void;
  initialTransform?: ViewTransform | null;
  onViewChange?: (transform: ViewTransform) => void;
  showCalibration?: boolean;
  showMeasurements?: boolean;
  featureROI?: Point[];
  aiFeatureGroups?: AiFeatureGroup[];
  selectedAiGroupId?: string | null;
  hoveredFeatureId?: string | null;
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
  dxfOverlayEntities = [],
  onMousePositionChange,
  onDimensionsChange,
  initialTransform,
  onViewChange,
  showCalibration = true,
  showMeasurements = true,
  originCanvasPos,
  aiFeatureGroups = [],
  selectedAiGroupId,
  hoveredFeatureId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const [mousePos, setMousePos] = useState<Point | null>(null);
  const [snappedPos, setSnappedPos] = useState<Point | null>(null);

  useEffect(() => { 
    if (initialTransform) {
      setScale(initialTransform.scale);
      setPosition({ x: initialTransform.x, y: initialTransform.y });
    } else {
      setScale(1); setPosition({ x: 0, y: 0 }); 
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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault(); setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    } 
  };

  const snapTargets = useMemo(() => {
    const targets: Point[] = [];
    if (calibrationData) targets.push(calibrationData.start, calibrationData.end);
    if (originCanvasPos) targets.push(originCanvasPos);
    
    currentPoints.forEach(p => targets.push(p));
    measurements.forEach(m => { targets.push(m.start, m.end); });
    parallelMeasurements.forEach(pm => { 
      targets.push(pm.baseStart, pm.baseEnd, pm.offsetPoint); 
    });
    areaMeasurements.forEach(am => { am.points.forEach(p => targets.push(p)); });
    curveMeasurements.forEach(cm => { cm.points.forEach(p => targets.push(p)); });
    
    return targets;
  }, [calibrationData, originCanvasPos, currentPoints, measurements, parallelMeasurements, areaMeasurements, curveMeasurements]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    
    if (imgRef.current) {
      const rect = imgRef.current.getBoundingClientRect();
      const rawX = (e.clientX - rect.left) / rect.width;
      const rawY = (e.clientY - rect.top) / rect.height;
      const p = (rawX >= 0 && rawX <= 1 && rawY >= 0 && rawY <= 1) ? { x: rawX, y: rawY } : null;
      
      setMousePos(p);

      if (p && imgSize.width > 0) {
        const SNAP_RADIUS_PX = 12; 
        let closest: Point | null = null;
        let minDist = Infinity;

        for (const target of snapTargets) {
          const dx = (p.x - target.x) * rect.width;
          const dy = (p.y - target.y) * rect.height;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < SNAP_RADIUS_PX && dist < minDist) {
            minDist = dist;
            closest = target;
          }
        }
        setSnappedPos(closest);
        onMousePositionChange?.(closest || p);
      } else {
        setSnappedPos(null);
        onMousePositionChange?.(p);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDragging) { setIsDragging(false); return; }
    if (e.button === 0 && imgRef.current) {
      const rect = imgRef.current.getBoundingClientRect();
      const rawX = (e.clientX - rect.left) / rect.width;
      const rawY = (e.clientY - rect.top) / rect.height;
      
      if (rawX >= 0 && rawX <= 1 && rawY >= 0 && rawY <= 1) {
        onPointClick(snappedPos || { x: rawX, y: rawY });
      }
    }
  };

  const uiBase = useMemo(() => {
    if (imgSize.width <= 1 || imgSize.height <= 1) return 1.5;
    return Math.min(imgSize.width, imgSize.height) / 500;
  }, [imgSize]);
  
  const getS = (mult: number = 0.5) => (uiBase * mult) / scale;
  const getR = (mult: number = 0.7) => (uiBase * mult) / scale;
  const getF = (mult: number = 9) => (uiBase * mult) / scale;

  const unitLabel = calibrationData?.unit || 'mm';

  const getMmPerPixel = () => {
    if (!calibrationData || imgSize.width === 0) return 0;
    const dx = (calibrationData.start.x - calibrationData.end.x) * imgSize.width;
    const dy = (calibrationData.start.y - calibrationData.end.y) * imgSize.height;
    return calibrationData.realWorldDistance / Math.sqrt(dx*dx + dy*dy);
  };

  const getPhysDist = (p1: Point, p2: Point) => {
    const s = getMmPerPixel();
    const dx = (p1.x - p2.x) * imgSize.width;
    const dy = (p1.y - p2.y) * imgSize.height;
    return Math.sqrt(dx*dx + dy*dy) * s;
  };

  const getPerpendicularPoint = (p: Point, l1: Point, l2: Point) => {
      const px = p.x * imgSize.width, py = p.y * imgSize.height;
      const l1x = l1.x * imgSize.width, l1y = l1.y * imgSize.height;
      const l2x = l2.x * imgSize.width, l2y = l2.y * imgSize.height;
      const dx = l2x - l1x; const dy = l2y - l1y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return l1;
      const t = ((px - l1x) * dx + (py - l1y) * dy) / lenSq;
      return { x: (l1x + t * dx) / imgSize.width, y: (l1y + t * dy) / imgSize.height };
  };

  const getPolygonArea = (points: Point[]) => {
    const s = getMmPerPixel();
    let area = 0; const n = points.length;
    for (let i = 0; i < n; i++) {
      const p1 = points[i]; const p2 = points[(i + 1) % n];
      area += (p1.x * imgSize.width * p2.y * imgSize.height) - (p2.x * imgSize.width * p1.y * imgSize.height);
    }
    return Math.abs(area / 2) * s * s;
  };

  const getPolylineLength = (points: Point[]) => {
    const s = getMmPerPixel();
    let len = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const dx = (points[i+1].x - points[i].x) * imgSize.width;
        const dy = (points[i+1].y - points[i].y) * imgSize.height;
        len += Math.sqrt(dx*dx + dy*dy);
    }
    return len * s;
  };

  const getPathData = (points: Point[]) => {
    if (points.length < 1) return "";
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * imgSize.width} ${p.y * imgSize.height}`).join(' ');
  };

  const getCatmullRomPath = (points: Point[]) => {
    if (points.length < 2) return "";
    const pts = points.map(p => ({ x: p.x * imgSize.width, y: p.y * imgSize.height }));
    if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

    const p = [pts[0], ...pts, pts[pts.length - 1]];
    let pathData = `M ${pts[0].x} ${pts[0].y}`;
    const tension = 0.5;

    for (let i = 1; i < p.length - 2; i++) {
      const p0 = p[i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2];
      const cp1x = p1.x + (p2.x - p0.x) / 6 * tension;
      const cp1y = p1.y + (p2.y - p0.y) / 6 * tension;
      const cp2x = p2.x - (p3.x - p1.x) / 6 * tension;
      const cp2y = p2.y - (p3.y - p1.y) / 6 * tension;
      pathData += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return pathData;
  };

  const { bundledPaths, dynamicEntities } = useMemo(() => {
    const bundles = new Map<string, string>();
    const dynamic: RenderableDxfEntity[] = [];
    dxfOverlayEntities.forEach(entity => {
      if (entity.isVisible === false) return;
      if (entity.isSelected || entity.isHovered) { dynamic.push(entity); return; }
      const color = entity.strokeColor || "rgba(6, 182, 212, 0.4)";
      let d = bundles.get(color) || "";
      const { geometry } = entity;
      if (geometry.type === 'line') { d += `M${geometry.props.x1},${geometry.props.y1} L${geometry.props.x2},${geometry.props.y2} `; } 
      else if (geometry.type === 'polyline' && geometry.props.points) {
        const pts = geometry.props.points.split(' ');
        if (pts.length > 0) { d += `M${pts[0]} `; for (let i = 1; i < pts.length; i++) d += `L${pts[i]} `; }
      } else if (geometry.type === 'path' && geometry.props.d) { d += `${geometry.props.d} `; } 
      else if (geometry.type === 'circle') {
        const cx = geometry.props.cx!; const cy = geometry.props.cy!;
        const rx = geometry.props.rx ?? geometry.props.r!; const ry = geometry.props.ry ?? geometry.props.r!;
        d += `M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0 `;
      }
      bundles.set(color, d);
    });
    return { bundledPaths: Array.from(bundles.entries()).map(([color, d]) => ({ color, d })), dynamicEntities: dynamic };
  }, [dxfOverlayEntities]);

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
            <div className="relative inline-block shadow-2xl pointer-events-auto">
              <img ref={imgRef} src={src} onLoad={handleImageLoad} className="max-w-[none] max-h-[85vh] block object-contain pointer-events-none select-none" />
              {imgSize.width > 0 && (
                <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" viewBox={`0 0 ${imgSize.width} ${imgSize.height}`}>
                  
                  <g transform={`scale(${imgSize.width}, ${imgSize.height})`}>
                    {bundledPaths.map(({ color, d }, i) => (
                      <path key={`bundle-${i}`} d={d} stroke={color} fill="none" strokeWidth={uiBase * 0.5 / scale} vectorEffect="non-scaling-stroke" />
                    ))}
                    {dynamicEntities.map(entity => {
                        const { geometry } = entity;
                        const strokeW = (uiBase * ((entity.isSelected || entity.isHovered) ? 2.2 : 1.2)) / scale; 
                        const strokeC = entity.strokeColor;
                        const style: React.CSSProperties = { vectorEffect: 'non-scaling-stroke' };
                        if (geometry.type === 'line') return <line key={entity.id} x1={geometry.props.x1} y1={geometry.props.y1} x2={geometry.props.x2} y2={geometry.props.y2} stroke={strokeC} fill="none" strokeWidth={strokeW} style={style} />;
                        if (geometry.type === 'polyline') return <polyline key={entity.id} points={geometry.props.points} fill="none" stroke={strokeC} strokeWidth={strokeW} style={style} />;
                        if (geometry.type === 'path') return <path key={entity.id} d={geometry.props.d} fill="none" stroke={strokeC} strokeWidth={strokeW} style={style} />;
                        if (geometry.type === 'circle') return <ellipse key={entity.id} cx={geometry.props.cx} cy={geometry.props.cy} rx={geometry.props.rx ?? geometry.props.r} ry={geometry.props.ry ?? geometry.props.r} fill="none" stroke={strokeC} strokeWidth={strokeW} style={style} />;
                        return null;
                    })}
                  </g>

                  {/* AI 特征组渲染 */}
                  <g>
                    {aiFeatureGroups.map(group => (
                      group.features.map(feat => {
                        if (group.isVisible === false) return null;
                        const isSelected = selectedAiGroupId === group.id;
                        const isHovered = hoveredFeatureId === feat.id;
                        
                        let color = group.color;
                        if (isHovered) color = '#facc15';
                        else if (isSelected) color = '#ffffff';

                        const strokeW = (uiBase * (isHovered ? 1.25 : isSelected ? 0.9 : 0.6)) / scale;
                        return (
                          <rect
                            key={feat.id}
                            x={feat.minX * imgSize.width}
                            y={feat.minY * imgSize.height}
                            width={(feat.maxX - feat.minX) * imgSize.width}
                            height={(feat.maxY - feat.minY) * imgSize.height}
                            fill="none"
                            stroke={color}
                            strokeWidth={strokeW}
                            style={{ vectorEffect: 'non-scaling-stroke' }}
                          />
                        );
                      })
                    ))}
                  </g>

                  <g>
                    {calibrationData && showCalibration && (
                      <g>
                        <line x1={calibrationData.start.x * imgSize.width} y1={calibrationData.start.y * imgSize.height} x2={calibrationData.end.x * imgSize.width} y2={calibrationData.end.y * imgSize.height} stroke="#fbbf24" fill="none" strokeWidth={getS(0.6)} strokeDasharray={getS(3)} />
                        <circle cx={calibrationData.start.x * imgSize.width} cy={calibrationData.start.y * imgSize.height} r={getR(1.1)} fill="#fbbf24" />
                        <circle cx={calibrationData.end.x * imgSize.width} cy={calibrationData.end.y * imgSize.height} r={getR(1.1)} fill="#fbbf24" />
                      </g>
                    )}

                    {originCanvasPos && (
                      <g transform={`translate(${originCanvasPos.x * imgSize.width}, ${originCanvasPos.y * imgSize.height})`}>
                        <line x1={-getS(25)} y1="0" x2={getS(25)} y2="0" stroke="#f43f5e" strokeWidth={getS(0.4)} />
                        <line x1="0" y1={-getS(25)} x2="0" y2={getS(25)} stroke="#f43f5e" strokeWidth={getS(0.4)} />
                        <circle r={getR(10)} fill="none" stroke="#f43f5e" strokeWidth={getS(0.4)} />
                      </g>
                    )}

                    {/* 实时点吸附指示器 */}
                    {snappedPos && (
                      <circle cx={snappedPos.x * imgSize.width} cy={snappedPos.y * imgSize.height} r={getR(6)} fill="none" stroke="#22c55e" strokeWidth={getS(1.5)} strokeDasharray={getS(3)} className="animate-pulse" />
                    )}

                    {/* 实时交互反馈渲染层 */}
                    {currentPoints.length > 0 && (
                      <g>
                        {(mode === 'box_group' || mode === 'feature') && (
                          <g>
                            {currentPoints.length === 1 && (mousePos || snappedPos) ? (
                                <rect x={Math.min(currentPoints[0].x, (snappedPos || mousePos!).x) * imgSize.width} y={Math.min(currentPoints[0].y, (snappedPos || mousePos!).y) * imgSize.height} width={Math.abs(currentPoints[0].x - (snappedPos || mousePos!).x) * imgSize.width} height={Math.abs(currentPoints[0].y - (snappedPos || mousePos!).y) * imgSize.height} fill="rgba(99, 102, 241, 0.1)" stroke="#6366f1" strokeWidth={getS(0.6)} strokeDasharray={getS(3)} />
                            ) : currentPoints.length === 2 ? (
                                <rect x={Math.min(currentPoints[0].x, currentPoints[1].x) * imgSize.width} y={Math.min(currentPoints[0].y, currentPoints[1].y) * imgSize.height} width={Math.abs(currentPoints[0].x - currentPoints[1].x) * imgSize.width} height={Math.abs(currentPoints[0].y - currentPoints[1].y) * imgSize.height} fill="rgba(99, 102, 241, 0.15)" stroke="#6366f1" strokeWidth={getS(0.8)} strokeDasharray={getS(3)} />
                            ) : null}
                          </g>
                        )}

                        {mode === 'measure' && currentPoints.length === 1 && (mousePos || snappedPos) && (
                          <g>
                            {(() => {
                              const p2 = snappedPos || mousePos!;
                              const dist = getPhysDist(currentPoints[0], p2);
                              return (
                                <>
                                  <line x1={currentPoints[0].x * imgSize.width} y1={currentPoints[0].y * imgSize.height} x2={p2.x * imgSize.width} y2={p2.y * imgSize.height} stroke="#6366f1" strokeWidth={getS(0.6)} strokeDasharray={getS(3)} />
                                  <text 
                                    x={((currentPoints[0].x + p2.x) / 2) * imgSize.width} 
                                    y={((currentPoints[0].y + p2.y) / 2) * imgSize.height} 
                                    fill="white" 
                                    fontSize={getF(10)} 
                                    fontWeight="bold" 
                                    style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1.5) }}
                                  >
                                    {dist.toFixed(2)}{unitLabel}
                                  </text>
                                </>
                              );
                            })()}
                          </g>
                        )}

                        {mode === 'parallel' && (
                          <g>
                            {currentPoints.length >= 2 && (
                                <line x1={currentPoints[0].x * imgSize.width} y1={currentPoints[0].y * imgSize.height} x2={currentPoints[1].x * imgSize.width} y2={currentPoints[1].y * imgSize.height} stroke="#6366f1" strokeWidth={getS(1)} />
                            )}
                            {(currentPoints.length === 3 || (currentPoints.length === 2 && (mousePos || snappedPos))) && (
                              <g>
                                {(() => {
                                    const p3 = currentPoints.length === 3 ? currentPoints[2] : (snappedPos || mousePos!);
                                    const proj = getPerpendicularPoint(p3, currentPoints[0], currentPoints[1]);
                                    const dist = getPhysDist(p3, proj);
                                    return (
                                        <>
                                            <line x1={p3.x * imgSize.width} y1={p3.y * imgSize.height} x2={proj.x * imgSize.width} y2={proj.y * imgSize.height} stroke="#fbbf24" strokeWidth={getS(0.6)} strokeDasharray={`${getS(2)} ${getS(2)}`} />
                                            <text x={p3.x * imgSize.width} y={p3.y * imgSize.height} fill="#fbbf24" fontSize={getF(10)} fontWeight="bold" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1.5) }}>D: {dist.toFixed(2)}{unitLabel}</text>
                                        </>
                                    );
                                })()}
                              </g>
                            )}
                          </g>
                        )}

                        {mode === 'area' && (
                            <g>
                                <path d={getPathData(currentPoints) + (currentPoints.length > 2 ? ' Z' : '')} fill="rgba(99, 102, 241, 0.2)" stroke="#6366f1" strokeWidth={getS(0.8)} strokeDasharray={getS(2)} />
                                {currentPoints.length > 2 && (
                                    <text x={(currentPoints.reduce((s,p)=>s+p.x,0)/currentPoints.length)*imgSize.width} y={(currentPoints.reduce((s,p)=>s+p.y,0)/currentPoints.length)*imgSize.height} fill="white" fontSize={getF(10)} fontWeight="bold" textAnchor="middle" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1.5) }}>{getPolygonArea(currentPoints).toFixed(2)}{unitLabel}²</text>
                                )}
                            </g>
                        )}

                        {mode === 'curve' && (
                            <g>
                                <path d={getCatmullRomPath(currentPoints)} fill="none" stroke="#a855f7" strokeWidth={getS(1.2)} strokeDasharray={`${getS(3)} ${getS(3)}`} />
                                {currentPoints.length > 1 && (
                                    <text x={currentPoints[currentPoints.length-1].x * imgSize.width} y={currentPoints[currentPoints.length-1].y * imgSize.height} fill="white" fontSize={getF(10)} fontWeight="bold" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1.5) }}>{getPolylineLength(currentPoints).toFixed(2)}{unitLabel}</text>
                                )}
                            </g>
                        )}

                        {currentPoints.map((p, i) => (
                          <circle key={`pt-${i}`} cx={p.x * imgSize.width} cy={p.y * imgSize.height} r={getR(1.3)} fill="#6366f1" stroke="white" strokeWidth={getS(0.6)} />
                        ))}
                      </g>
                    )}

                    {showMeasurements && (
                      <g>
                        {measurements.map(m => (
                          <g key={m.id}>
                            <line x1={m.start.x * imgSize.width} y1={m.start.y * imgSize.height} x2={m.end.x * imgSize.width} y2={m.end.y * imgSize.height} stroke="#6366f1" fill="none" strokeWidth={getS(0.8)} strokeLinecap="round" />
                            <text x={(m.start.x + m.end.x)/2 * imgSize.width} y={(m.start.y + m.end.y)/2 * imgSize.height} fill="white" fontSize={getF(10)} fontWeight="bold" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1.5) }}>{getPhysDist(m.start, m.end).toFixed(2)}{unitLabel}</text>
                          </g>
                        ))}
                        {parallelMeasurements.map(pm => {
                          const proj = getPerpendicularPoint(pm.offsetPoint, pm.baseStart, pm.baseEnd);
                          const dist = getPhysDist(pm.offsetPoint, proj);
                          return (
                            <g key={pm.id}>
                              <line x1={pm.baseStart.x * imgSize.width} y1={pm.baseStart.y * imgSize.height} x2={pm.baseEnd.x * imgSize.width} y2={pm.baseEnd.y * imgSize.height} stroke="#6366f1" strokeWidth={getS(1)} />
                              <line x1={pm.offsetPoint.x * imgSize.width} y1={pm.offsetPoint.y * imgSize.height} x2={proj.x * imgSize.width} y2={proj.y * imgSize.height} stroke="#fbbf24" strokeWidth={getS(0.6)} strokeDasharray={`${getS(2)} ${getS(2)}`} />
                              <text x={pm.offsetPoint.x * imgSize.width} y={pm.offsetPoint.y * imgSize.height} fill="#fbbf24" fontSize={getF(10)} fontWeight="bold" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1.5) }}>D: {dist.toFixed(2)}{unitLabel}</text>
                            </g>
                          );
                        })}
                        {areaMeasurements.map(am => (
                          <g key={am.id}>
                            <path d={getPathData(am.points) + ' Z'} fill="rgba(99, 102, 241, 0.15)" stroke="#6366f1" strokeWidth={getS(0.8)} />
                            <text x={(am.points.reduce((s,p)=>s+p.x,0)/am.points.length)*imgSize.width} y={(am.points.reduce((s,p)=>s+p.y,0)/am.points.length)*imgSize.height} fill="white" fontSize={getF(10)} fontWeight="bold" textAnchor="middle" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1.5) }}>{getPolygonArea(am.points).toFixed(2)}{unitLabel}²</text>
                          </g>
                        ))}
                        {curveMeasurements.map(cm => (
                          <g key={cm.id}>
                            <path d={getCatmullRomPath(cm.points)} fill="none" stroke="#a855f7" strokeWidth={getS(1)} />
                            <text x={cm.points[Math.floor(cm.points.length/2)].x * imgSize.width} y={cm.points[Math.floor(cm.points.length/2)].y * imgSize.height} fill="white" fontSize={getF(10)} fontWeight="bold" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: getS(1.5) }}>{getPolylineLength(cm.points).toFixed(2)}{unitLabel}</text>
                          </g>
                        ))}
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