import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Point, LineSegment, ParallelMeasurement, AreaMeasurement, CurveMeasurement, CalibrationData, ViewTransform, RenderableDxfEntity, RenderableAiFeature } from '../types';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { getMmPerPixel } from '../utils/geometry';
import { DxfLayer, AiLayer, MeasurementLayer } from './CanvasLayers';
import { InteractionLayer } from './InteractionLayer';

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
}

export const ImageCanvas: React.FC<ImageCanvasProps> = ({
  src, mode, calibrationData, measurements, parallelMeasurements = [], areaMeasurements = [],
  curveMeasurements = [], currentPoints, onPointClick, dxfOverlayEntities = [],
  aiOverlayEntities = [],
  onMousePositionChange, onDimensionsChange, initialTransform, onViewChange,
  showCalibration = true, showMeasurements = true, originCanvasPos,
  hoveredMarker
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null); 
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
                    
                    {/* TRANSIENT INTERACTION LAYER */}
                    <InteractionLayer 
                      mode={mode} 
                      currentPoints={currentPoints} 
                      mousePos={mousePos} 
                      snappedPos={snappedPos} 
                      imgSize={imgSize} 
                      mmPerPixel={mmPerPixel} 
                      unitLabel={unitLabel} 
                      getS={getS} 
                      getF={getF} 
                      getR={getR} 
                    />

                    {calibrationData && showCalibration && (
                      <g><line x1={calibrationData.start.x * imgSize.width} y1={calibrationData.start.y * imgSize.height} x2={calibrationData.end.x * imgSize.width} y2={calibrationData.end.y * imgSize.height} stroke="#fbbf24" fill="none" strokeWidth={getS(0.6)} strokeDasharray={getS(3)} /><circle cx={calibrationData.start.x * imgSize.width} cy={calibrationData.start.y * imgSize.height} r={getR(1.1)} fill="#fbbf24" /><circle cx={calibrationData.end.x * imgSize.width} cy={calibrationData.end.y * imgSize.height} r={getR(1.1)} fill="#fbbf24" /></g>
                    )}
                    {originCanvasPos && (
                      <g transform={`translate(${originCanvasPos.x * imgSize.width}, ${originCanvasPos.y * imgSize.height})`}><line x1={-getS(25)} y1="0" x2={getS(25)} y2="0" stroke="#f43f5e" strokeWidth={getS(0.4)} /><line x1="0" y1={-getS(25)} x2="0" y2={getS(25)} stroke="#f43f5e" strokeWidth={getS(0.4)} /><circle r={getR(10)} fill="none" stroke="#f43f5e" strokeWidth={getS(0.4)} /></g>
                    )}
                    {snappedPos && (<circle cx={snappedPos.x * imgSize.width} cy={snappedPos.y * imgSize.height} r={getR(6)} fill="none" stroke="#22c55e" strokeWidth={getS(1.5)} strokeDasharray={getS(3)} className="animate-pulse" />)}
                    
                    {hoveredMarker && (
                        <g transform={`translate(${hoveredMarker.x * imgSize.width}, ${hoveredMarker.y * imgSize.height})`} pointerEvents="none">
                            <line x1={-getS(20)} y1="0" x2={getS(20)} y2="0" stroke="black" strokeWidth={getS(2.5)} strokeOpacity="0.5" />
                            <line x1="0" y1={-getS(20)} x2="0" y2={getS(20)} stroke="black" strokeWidth={getS(2.5)} strokeOpacity="0.5" />
                            <line x1={-getS(20)} y1="0" x2={getS(20)} y2="0" stroke={hoveredMarker.color} strokeWidth={getS(1.2)} />
                            <line x1="0" y1={-getS(20)} x2="0" y2={getS(20)} stroke={hoveredMarker.color} strokeWidth={getS(1.2)} />
                            <circle r={getR(4)} fill="none" stroke="black" strokeWidth={getS(2.5)} strokeOpacity="0.5" />
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