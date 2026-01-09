
import React, { useRef, useState, useEffect } from 'react';
import { Point, LineSegment, ParallelMeasurement, AreaMeasurement, CurveMeasurement, CalibrationData, SolderPoint } from '../types';
import { ZoomIn, ZoomOut, RotateCcw, MousePointer2 } from 'lucide-react';

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
  onFinishShape?: () => void;
  onDeleteMeasurement: (id: string) => void;
  onDeleteParallelMeasurement?: (id: string) => void;
  onDeleteAreaMeasurement?: (id: string) => void;
  onDeleteCurveMeasurement?: (id: string) => void;
  solderPoints?: SolderPoint[];
  originCanvasPos?: Point | null;
  // New props for real-time coordinate calculation
  rawDxfData?: any;
  manualOriginCAD?: {x: number, y: number} | null;
}

export const ImageCanvas: React.FC<ImageCanvasProps> = ({
  src,
  mode,
  onPointClick,
  solderPoints = [],
  originCanvasPos,
  rawDxfData,
  manualOriginCAD
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredPointId, setHoveredPointId] = useState<number | null>(null);
  const [mouseNormPos, setMouseNormPos] = useState<Point | null>(null);
  
  // Track image dimensions to maintain aspect ratio in SVG overlay
  const [imgSize, setImgSize] = useState({ width: 1, height: 1 });

  useEffect(() => {
    setScale(1); setPosition({ x: 0, y: 0 });
  }, [src]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth && naturalHeight) {
      setImgSize({ width: naturalWidth, height: naturalHeight });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    const newScale = Math.min(Math.max(0.1, scale * (1 + delta)), 100); 
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;
    const scaleRatio = newScale / scale;
    setPosition({
      x: cursorX - (cursorX - position.x) * scaleRatio,
      y: cursorY - (cursorY - position.y) * scaleRatio
    });
    setScale(newScale);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    } 
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }

    // Track mouse position for coordinate display
    if (imgRef.current) {
      const rect = imgRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
        setMouseNormPos({ x, y });
      } else {
        setMouseNormPos(null);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDragging) { setIsDragging(false); return; }
    
    if (e.button === 0 && imgRef.current) {
      const rect = imgRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
        onPointClick({ x, y });
      }
    }
  };

  const handleMouseLeave = () => {
    setMouseNormPos(null);
  };

  // UI scale for markers to keep them crisp regardless of image resolution
  const uiBase = Math.min(imgSize.width, imgSize.height) / 500;

  // Real-time physical coordinate calculation
  const getPhysicalCoords = () => {
    if (!mouseNormPos || !rawDxfData) return null;
    const { minX, maxY, totalW, totalH, padding, defaultCenterX, defaultCenterY } = rawDxfData;
    const targetX = manualOriginCAD ? manualOriginCAD.x : defaultCenterX;
    const targetY = manualOriginCAD ? manualOriginCAD.y : defaultCenterY;

    const cadX = mouseNormPos.x * totalW + (minX - padding);
    const cadY = (maxY + padding) - mouseNormPos.y * totalH;

    return {
      x: cadX - targetX,
      y: cadY - targetY
    };
  };

  const currentPhysCoords = getPhysicalCoords();

  return (
    <div className="relative w-full h-full bg-slate-900/40 rounded-2xl overflow-hidden border border-slate-800 shadow-inner group">
      {mode === 'origin' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none bg-indigo-600/90 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
          <MousePointer2 size={12} /> CLICK DRAWING TO SET ORIGIN
        </div>
      )}

      {/* Floating Coordinate Status Bar */}
      {mouseNormPos && (
        <div className="absolute top-4 left-4 z-30 pointer-events-none bg-slate-950/80 backdrop-blur-md border border-slate-700/50 px-3 py-1.5 rounded-lg flex flex-col gap-0.5 shadow-xl transition-opacity duration-200">
          <div className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Live Coordinates</div>
          <div className="flex gap-4 font-mono text-xs font-bold text-indigo-400">
            {currentPhysCoords ? (
              <>
                <span>X: {currentPhysCoords.x.toFixed(4)} mm</span>
                <span>Y: {currentPhysCoords.y.toFixed(4)} mm</span>
              </>
            ) : (
              <>
                <span>X: {(mouseNormPos.x * 100).toFixed(2)}%</span>
                <span>Y: {(mouseNormPos.y * 100).toFixed(2)}%</span>
              </>
            )}
          </div>
        </div>
      )}

      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-2">
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-xl p-1.5 flex flex-col gap-1.5 shadow-2xl">
          <button onClick={() => setScale(s => Math.min(s * 1.3, 100))} className="p-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all" title="Zoom In"><ZoomIn size={22} /></button>
          <button onClick={() => setScale(s => Math.max(s / 1.3, 0.1))} className="p-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all" title="Zoom Out"><ZoomOut size={22} /></button>
          <div className="h-px bg-slate-700/50 mx-2"></div>
          <button onClick={() => { setScale(1); setPosition({x:0,y:0}); }} className="p-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all" title="Reset Camera"><RotateCcw size={22} /></button>
        </div>
      </div>

      <div 
        ref={containerRef} 
        className={`w-full h-full overflow-hidden outline-none ${isDragging ? 'cursor-grabbing' : mode === 'origin' ? 'cursor-crosshair' : 'cursor-default'}`} 
        onWheel={handleWheel} 
        onMouseDown={handleMouseDown} 
        onMouseMove={handleMouseMove} 
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        tabIndex={0}
      >
        <div 
          className="origin-top-left w-full h-full flex items-center justify-center pointer-events-none" 
          style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, transition: isDragging ? 'none' : 'transform 0.1s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        >
          {src && (
            <div className="relative inline-block shadow-2xl pointer-events-auto">
              <img 
                ref={imgRef} 
                src={src} 
                onLoad={handleImageLoad}
                alt="Workspace" 
                className="max-w-[none] max-h-[85vh] block object-contain pointer-events-none select-none" 
              />
              {/* Overlay SVG */}
              <svg 
                className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" 
                viewBox={`0 0 ${imgSize.width} ${imgSize.height}`} 
                preserveAspectRatio="xMidYMid meet"
                shapeRendering="geometricPrecision"
              >
                {/* COORDINATE ORIGIN */}
                {originCanvasPos && (
                  <g transform={`translate(${originCanvasPos.x * imgSize.width}, ${originCanvasPos.y * imgSize.height})`}>
                    <line x1={-15 * uiBase} y1="0" x2={15 * uiBase} y2="0" stroke="#818cf8" strokeWidth={0.8 * uiBase} strokeLinecap="round" />
                    <line x1="0" y1={-15 * uiBase} x2="0" y2={15 * uiBase} stroke="#818cf8" strokeWidth={0.8 * uiBase} strokeLinecap="round" />
                    <circle r={5 * uiBase} fill="none" stroke="#818cf8" strokeWidth={0.5 * uiBase} />
                    <text 
                      dy={18 * uiBase} 
                      textAnchor="middle" 
                      fill="#818cf8" 
                      fontSize={10 * uiBase} 
                      fontWeight="600" 
                      style={{ filter: 'drop-shadow(0 0 1px black)', letterSpacing: '0.02em' }}
                    >ORIGIN (0,0)</text>
                  </g>
                )}

                {/* Solder Points markers: Tiny diameter 0.1 design */}
                {solderPoints.map(p => {
                  const isHovered = hoveredPointId === p.id;
                  return (
                    <g 
                      key={p.id} 
                      transform={`translate(${p.canvasX * imgSize.width}, ${p.canvasY * imgSize.height})`}
                      onMouseEnter={() => setHoveredPointId(p.id)}
                      onMouseLeave={() => setHoveredPointId(null)}
                      className="cursor-pointer pointer-events-auto"
                    >
                      {/* Detection Circle (Larger target area) */}
                      <circle r={2 * uiBase} fill="transparent" />
                      
                      {/* Visual Dot: Radius 0.05 * uiBase = Diameter 0.1 * uiBase */}
                      <circle r={0.05 * uiBase} fill="#22c55e" stroke="white" strokeWidth={0.02 * uiBase} />
                      
                      {/* ID Label */}
                      <text 
                        dy={-1.5 * uiBase} 
                        textAnchor="middle" 
                        fill="#22c55e" 
                        fontSize={3.5 * uiBase} 
                        fontWeight="bold" 
                        style={{ filter: 'drop-shadow(0 0 1px black)' }}
                      >
                        {p.id}
                      </text>

                      {/* Coordinate Tooltip for detected points */}
                      {isHovered && (
                        <g transform={`translate(0, ${5 * uiBase})`}>
                          <rect 
                            x={-15 * uiBase} 
                            y={0} 
                            width={30 * uiBase} 
                            height={8 * uiBase} 
                            rx={1 * uiBase} 
                            fill="rgba(15, 23, 42, 0.9)" 
                            stroke="#22c55e" 
                            strokeWidth={0.2 * uiBase}
                          />
                          <text 
                            y={5 * uiBase} 
                            textAnchor="middle" 
                            fill="white" 
                            fontSize={3.5 * uiBase} 
                            fontWeight="bold" 
                            fontFamily="monospace"
                          >
                            X:{p.x.toFixed(2)} Y:{p.y.toFixed(2)}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {mode === 'origin' && (
                  <rect 
                    width={imgSize.width} height={imgSize.height} 
                    fill="rgba(99, 102, 241, 0.05)" 
                    stroke="#6366f1" 
                    strokeWidth={2 * uiBase} 
                    strokeDasharray={`${5 * uiBase},${5 * uiBase}`} 
                    className="animate-pulse"
                  />
                )}
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
