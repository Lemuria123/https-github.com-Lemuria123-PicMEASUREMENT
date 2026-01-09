
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Scale, Ruler, Rows, Pentagon, Spline, Loader2, Target, Download, Plus, Crosshair, RotateCcw, Keyboard, MousePointer2 } from 'lucide-react';
import { Button } from './components/Button';
import { ImageCanvas } from './components/ImageCanvas';
import { Point, LineSegment, ParallelMeasurement, AreaMeasurement, CurveMeasurement, CalibrationData, AppMode, SolderPoint } from './types';
import DxfParser from 'dxf-parser';

export default function App() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [mode, setMode] = useState<AppMode>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [originalFileName, setOriginalFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Real-time tracking states for Header
  const [mouseNormPos, setMouseNormPos] = useState<Point | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<SolderPoint | null>(null);

  // Raw Data from DXF
  const [rawDxfData, setRawDxfData] = useState<{
    circles: any[],
    lines: any[],
    defaultCenterX: number,
    defaultCenterY: number,
    minX: number,
    maxX: number,
    maxY: number,
    totalW: number,
    totalH: number,
    padding: number
  } | null>(null);

  // Origin State (in CAD space coordinates)
  const [manualOriginCAD, setManualOriginCAD] = useState<{x: number, y: number} | null>(null);

  // Filter Settings
  const [minDiameter, setMinDiameter] = useState<number>(0.5);
  const [maxDiameter, setMaxDiameter] = useState<number>(5.0);
  const [excludeCrosshairs, setExcludeCrosshairs] = useState(true);

  // State for Calibration
  const [calibrationData, setCalibrationData] = useState<CalibrationData | null>(null);

  // Measurements State
  const [measurements, setMeasurements] = useState<LineSegment[]>([]);
  const [parallelMeasurements, setParallelMeasurements] = useState<ParallelMeasurement[]>([]);
  const [areaMeasurements, setAreaMeasurements] = useState<AreaMeasurement[]>([]);
  const [curveMeasurements, setCurveMeasurements] = useState<CurveMeasurement[]>([]);

  // Keyboard fine-tuning for origin
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!rawDxfData) return;
      if (document.activeElement?.tagName === 'INPUT') return;
      
      const step = rawDxfData.totalW * 0.0005; 
      const currentX = manualOriginCAD ? manualOriginCAD.x : rawDxfData.defaultCenterX;
      const currentY = manualOriginCAD ? manualOriginCAD.y : rawDxfData.defaultCenterY;

      let nextX = currentX;
      let nextY = currentY;
      let moved = false;

      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') { nextY += step; moved = true; }
      if (key === 's' || key === 'arrowdown') { nextY -= step; moved = true; }
      if (key === 'a' || key === 'arrowleft') { nextX -= step; moved = true; }
      if (key === 'd' || key === 'arrowright') { nextX += step; moved = true; }

      if (moved) {
        e.preventDefault();
        setManualOriginCAD({ x: nextX, y: nextY });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rawDxfData, manualOriginCAD]);

  const solderPoints = useMemo(() => {
    if (!rawDxfData) return [];
    const { circles, lines, defaultCenterX, defaultCenterY, minX, maxY, totalW, totalH, padding } = rawDxfData;
    const currentOriginX = manualOriginCAD ? manualOriginCAD.x : defaultCenterX;
    const currentOriginY = manualOriginCAD ? manualOriginCAD.y : defaultCenterY;
    
    const detected: SolderPoint[] = [];
    let idCounter = 1;

    circles.forEach(circle => {
      const diameter = circle.radius * 2;
      if (diameter < minDiameter || diameter > maxDiameter) return;

      if (excludeCrosshairs) {
        let intersectingLines = 0;
        const cx = circle.center.x;
        const cy = circle.center.y;
        const r = circle.radius;
        lines.forEach(line => {
          const x1 = line.vertices[0].x;
          const y1 = line.vertices[0].y;
          const x2 = line.vertices[1].x;
          const y2 = line.vertices[1].y;
          const lineLenSq = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
          if (lineLenSq === 0) return;
          const t = Math.max(0, Math.min(1, ((cx - x1) * (x2 - x1) + (cy - y1) * (y2 - y1)) / lineLenSq));
          const projX = x1 + t * (x2 - x1);
          const projY = y1 + t * (y2 - y1);
          const distToCenter = Math.sqrt(Math.pow(cx - projX, 2) + Math.pow(cy - projY, 2));
          if (distToCenter < r * 0.2) {
            const segLen = Math.sqrt(lineLenSq);
            if (segLen > r * 0.8) intersectingLines++;
          }
        });
        if (intersectingLines >= 2) return;
      }

      const canvasX = (circle.center.x - (minX - padding)) / totalW;
      const canvasY = ((maxY + padding) - circle.center.y) / totalH;

      detected.push({ id: idCounter++, x: circle.center.x - currentOriginX, y: circle.center.y - currentOriginY, canvasX, canvasY });
    });

    return detected;
  }, [rawDxfData, minDiameter, maxDiameter, excludeCrosshairs, manualOriginCAD]);

  const originCanvasPos = useMemo(() => {
    if (!rawDxfData) return null;
    const { defaultCenterX, defaultCenterY, minX, maxY, totalW, totalH, padding } = rawDxfData;
    const targetX = manualOriginCAD ? manualOriginCAD.x : defaultCenterX;
    const targetY = manualOriginCAD ? manualOriginCAD.y : defaultCenterY;
    
    return {
      x: (targetX - (minX - padding)) / totalW,
      y: ((maxY + padding) - targetY) / totalH
    };
  }, [rawDxfData, manualOriginCAD]);

  const parseDXFToSVG = (dxfString: string) => {
    const parser = new DxfParser();
    try {
      const dxf = parser.parseSync(dxfString);
      if (!dxf || !dxf.entities || dxf.entities.length === 0) return null;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const updateBounds = (x: number, y: number) => {
        if (isNaN(x) || isNaN(y)) return;
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      };

      const circles: any[] = [];
      const lines: any[] = [];

      dxf.entities.forEach((entity: any) => {
        if (entity.type === 'LINE') {
          updateBounds(entity.vertices[0].x, entity.vertices[0].y);
          updateBounds(entity.vertices[1].x, entity.vertices[1].y);
          lines.push(entity);
        } else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
          entity.vertices.forEach((v: any) => updateBounds(v.x, v.y));
        } else if (entity.type === 'CIRCLE' || entity.type === 'ARC') {
          updateBounds(entity.center.x - entity.radius, entity.center.y - entity.radius);
          updateBounds(entity.center.x + entity.radius, entity.center.y + entity.radius);
          if (entity.type === 'CIRCLE') circles.push(entity);
        }
      });

      if (minX === Infinity) return null;

      const width = maxX - minX;
      const height = maxY - minY;
      const defaultCenterX = (minX + maxX) / 2;
      const defaultCenterY = (minY + maxY) / 2;
      const padding = Math.max(width, height) * 0.05 || 10;
      const totalW = width + padding * 2;
      const totalH = height + padding * 2;
      
      const svgViewBoxX = minX - padding;
      const svgViewBoxY = -maxY - padding;
      const strokeWidth = (totalW + totalH) / 1000;

      setRawDxfData({ circles, lines, defaultCenterX, defaultCenterY, minX, maxX, maxY, totalW, totalH, padding });
      setManualOriginCAD(null);

      let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${svgViewBoxX} ${svgViewBoxY} ${totalW} ${totalH}" width="1000" height="${(1000 * totalH / totalW).toFixed(0)}" preserveAspectRatio="xMidYMid meet" style="background: #1a1c1e;">`;
      dxf.entities.forEach((entity: any) => {
        const color = "#00ffff";
        if (entity.type === 'LINE') {
          svgContent += `<line x1="${entity.vertices[0].x}" y1="${-entity.vertices[0].y}" x2="${entity.vertices[1].x}" y2="${-entity.vertices[1].y}" stroke="${color}" stroke-width="${strokeWidth}" />`;
        } else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
          const pts = entity.vertices.map((v: any) => `${v.x},${-v.y}`).join(' ');
          svgContent += `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" />`;
        } else if (entity.type === 'CIRCLE') {
          svgContent += `<circle cx="${entity.center.x}" cy="${-entity.center.y}" r="${entity.radius}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" />`;
        }
      });
      svgContent += `</svg>`;
      
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      return { 
        url: URL.createObjectURL(blob), 
        autoCalibration: { 
          start: { x: padding/totalW, y: 0.5 }, 
          end: { x: (width+padding)/totalW, y: 0.5 }, 
          realWorldDistance: width, unit: 'mm' 
        } 
      };
    } catch (e) { return null; }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    const fileName = file.name;
    setOriginalFileName(fileName);
    setMeasurements([]); setParallelMeasurements([]); setAreaMeasurements([]); setCurveMeasurements([]);

    if (fileName.toLowerCase().endsWith('.dxf')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = parseDXFToSVG(e.target?.result as string);
        if (result) {
          setImageSrc(result.url);
          setCalibrationData(result.autoCalibration);
          setMode('solder');
        }
        setIsProcessing(false);
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageSrc(e.target?.result as string);
        setRawDxfData(null); setCalibrationData(null); setMode('calibrate');
        setIsProcessing(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetAll = () => {
    setImageSrc(null); setMode('upload'); setOriginalFileName(null);
    setRawDxfData(null); setManualOriginCAD(null); setCalibrationData(null);
  };

  const exportSolderPointsCSV = () => {
    if (solderPoints.length === 0) return;
    let csvContent = "ID,X,Y,Z,R,P,Y,Type\n";
    solderPoints.forEach(p => {
      csvContent += `${p.id},${p.x.toFixed(4)},${p.y.toFixed(4)},0,0,0,0,0\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const fileName = originalFileName ? originalFileName.split('.')[0] : 'workspace';
    link.setAttribute("download", `${fileName}_points.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const currentCursorPhys = useMemo(() => {
    if (!mouseNormPos || !rawDxfData) return null;
    const { minX, maxY, totalW, totalH, padding, defaultCenterX, defaultCenterY } = rawDxfData;
    const targetX = manualOriginCAD ? manualOriginCAD.x : defaultCenterX;
    const targetY = manualOriginCAD ? manualOriginCAD.y : defaultCenterY;
    const cadX = mouseNormPos.x * totalW + (minX - padding);
    const cadY = (maxY + padding) - mouseNormPos.y * totalH;
    return { x: cadX - targetX, y: cadY - targetY };
  }, [mouseNormPos, rawDxfData, manualOriginCAD]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row text-slate-200 overflow-hidden">
      <input ref={fileInputRef} type="file" accept="image/*,.dxf" onChange={handleFileUpload} className="hidden" />

      {/* COMPACT SIDEBAR */}
      <div className="w-full md:w-72 bg-slate-900 border-r border-slate-800 flex flex-col z-10 shadow-xl overflow-y-auto">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
          <h1 className="font-bold text-sm text-white tracking-tight">MetricMate</h1>
          <button onClick={resetAll} className="text-[10px] text-slate-500 hover:text-white transition-colors uppercase font-bold tracking-tighter">RESET</button>
        </div>

        <div className="p-3 space-y-3">
          {/* Main Action Group */}
          <div className="flex flex-col gap-2">
            <Button variant="primary" className="w-full text-[11px] h-8 font-bold" icon={<Plus size={14} />} onClick={() => fileInputRef.current?.click()}>
              IMPORT FILE
            </Button>
            
            {/* Minimal Calibration Status */}
            <div className={`px-2 py-1.5 rounded-lg border flex items-center justify-between ${calibrationData ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
              <div className="flex items-center gap-2">
                <Scale size={12} className={calibrationData ? 'text-emerald-400' : 'text-amber-400'} />
                <span className="text-[10px] font-bold uppercase tracking-wide">Calibration</span>
              </div>
              {calibrationData && <span className="text-[10px] text-emerald-400 font-mono">1u:{calibrationData.realWorldDistance.toFixed(1)}{calibrationData.unit}</span>}
            </div>
          </div>

          {/* DXF Origin Quick Settings */}
          {rawDxfData && (
            <div className="p-2 bg-slate-850 rounded-lg border border-slate-700/50 space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Global Origin</span>
                {manualOriginCAD && (
                  <button onClick={() => setManualOriginCAD(null)} className="text-[9px] text-indigo-400 hover:text-white flex items-center gap-1"><RotateCcw size={10} />Reset</button>
                )}
              </div>
              <Button variant="secondary" active={mode === 'origin'} onClick={() => setMode('origin')} className="w-full h-7 text-[10px]" icon={<Crosshair size={12}/>}>
                {mode === 'origin' ? 'PICK ON CANVAS' : 'SET MANUAL ORIGIN'}
              </Button>
              <div className="flex items-center justify-center gap-2 text-[9px] text-slate-500 font-medium">
                <Keyboard size={10} /> <span>Use WASD or Arrows to nudge</span>
              </div>
            </div>
          )}

          {/* Auto Point Detection (Compact) */}
          {mode === 'solder' && rawDxfData && (
            <div className="p-2 bg-indigo-500/5 border border-indigo-500/20 rounded-lg space-y-2 animate-in slide-in-from-top-1">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Detection</span>
                <span className="text-[10px] font-mono font-bold text-indigo-400">Found: {solderPoints.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className="text-[9px] text-slate-500 block mb-0.5">Min D (mm)</span>
                  <input type="number" step="0.1" value={minDiameter} onChange={e => setMinDiameter(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-[10px] text-white outline-none focus:border-indigo-500" />
                </label>
                <label>
                  <span className="text-[9px] text-slate-500 block mb-0.5">Max D (mm)</span>
                  <input type="number" step="0.1" value={maxDiameter} onChange={e => setMaxDiameter(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-[10px] text-white outline-none focus:border-indigo-500" />
                </label>
              </div>
              <label className="flex items-center gap-2 cursor-pointer py-1">
                <input type="checkbox" checked={excludeCrosshairs} onChange={e => setExcludeCrosshairs(e.target.checked)} className="w-3 h-3 rounded border-slate-700 bg-slate-800 text-indigo-600" />
                <span className="text-[10px] text-slate-400">Exclude Crosshairs</span>
              </label>
              <Button onClick={exportSolderPointsCSV} variant="primary" className="w-full text-[10px] h-7" icon={<Download size={12}/>}>
                CSV EXPORT
              </Button>
            </div>
          )}

          {/* Toolbox (Compact Grid) */}
          <div className="space-y-1.5">
            <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1">Toolbox</h3>
            <div className="grid grid-cols-2 gap-1.5 pb-4">
              <Button variant="secondary" className="h-8 text-[10px] px-1" active={mode === 'measure'} onClick={() => setMode('measure')} disabled={!calibrationData}><Ruler size={12} /> Distance</Button>
              <Button variant="secondary" className="h-8 text-[10px] px-1" active={mode === 'parallel'} onClick={() => setMode('parallel')} disabled={!calibrationData}><Rows size={12} className="rotate-90" /> Parallel</Button>
              <Button variant="secondary" className="h-8 text-[10px] px-1" active={mode === 'area'} onClick={() => setMode('area')} disabled={!calibrationData}><Pentagon size={12} /> Area</Button>
              <Button variant="secondary" className="h-8 text-[10px] px-1" active={mode === 'curve'} onClick={() => setMode('curve')} disabled={!calibrationData}><Spline size={12} /> Curve</Button>
              <Button variant="secondary" className="h-8 text-[10px] col-span-2" active={mode === 'solder'} onClick={() => setMode('solder')} disabled={!rawDxfData}><Target size={12} /> Auto Point Detect</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col">
        {/* GLOBAL TOP STATUS BAR */}
        <div className="h-14 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex items-center px-4 justify-between z-10 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
             <div className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-400 uppercase tracking-widest shrink-0">
               {mode.toUpperCase()}
             </div>
             <span className="text-xs text-slate-500 font-mono truncate max-w-[150px]">{originalFileName}</span>
             
             {/* Live Cursor Info Section */}
             {mouseNormPos && (
               <>
                 <div className="h-6 w-px bg-slate-800 ml-2 hidden sm:block"></div>
                 <div className="hidden sm:flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                    <div className="flex items-center gap-1.5 text-indigo-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                      <span className="text-[9px] font-bold uppercase tracking-tight">Tracking</span>
                    </div>
                    <div className="flex gap-3 font-mono text-[11px] font-bold text-slate-300">
                      {currentCursorPhys ? (
                        <>
                          <span className="bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50">X: {currentCursorPhys.x.toFixed(4)}</span>
                          <span className="bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50">Y: {currentCursorPhys.y.toFixed(4)}</span>
                        </>
                      ) : (
                        <span className="text-slate-600 italic px-2">Outside Drawing</span>
                      )}
                    </div>
                 </div>
               </>
             )}
          </div>

          <div className="flex items-center gap-4">
            {/* Hovered Point Info (Top Priority Visibility) */}
            {hoveredPoint && (
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-lg animate-in slide-in-from-right-4 duration-300 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                <Target size={14} className="text-emerald-400" />
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-tight mr-1">Point #{hoveredPoint.id}</span>
                <div className="flex gap-3 font-mono text-xs font-black text-emerald-200">
                  <span>X: {hoveredPoint.x.toFixed(4)}</span>
                  <span>Y: {hoveredPoint.y.toFixed(4)}</span>
                </div>
              </div>
            )}
            
            {mode === 'origin' && (
              <div className="text-[10px] text-emerald-400 flex items-center gap-2 animate-pulse font-bold uppercase tracking-widest hidden lg:flex">
                <MousePointer2 size={12} /> Click to Set (0,0)
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 p-6 relative bg-slate-950 flex items-center justify-center overflow-hidden">
          {isProcessing && (
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
              <Loader2 className="animate-spin text-indigo-400 mb-4" size={48} />
              <p className="text-indigo-200 font-medium tracking-widest uppercase text-xs">Processing...</p>
            </div>
          )}
          <ImageCanvas
            src={imageSrc}
            mode={mode}
            calibrationData={calibrationData}
            measurements={measurements}
            parallelMeasurements={parallelMeasurements}
            areaMeasurements={areaMeasurements}
            curveMeasurements={curveMeasurements}
            currentPoints={[]}
            onPointClick={(p) => {
              if (mode === 'origin' && rawDxfData) {
                const { minX, maxY, totalW, totalH, padding } = rawDxfData;
                const newCADX = p.x * totalW + (minX - padding);
                const newCADY = (maxY + padding) - p.y * totalH;
                setManualOriginCAD({ x: newCADX, y: newCADY });
              }
            }}
            onDeleteMeasurement={(id) => setMeasurements(m => m.filter(x => x.id !== id))}
            onDeleteParallelMeasurement={(id) => setParallelMeasurements(m => m.filter(x => x.id !== id))}
            onDeleteAreaMeasurement={(id) => setAreaMeasurements(m => m.filter(x => x.id !== id))}
            onDeleteCurveMeasurement={(id) => setCurveMeasurements(m => m.filter(x => x.id !== id))}
            solderPoints={mode === 'solder' ? solderPoints : []}
            originCanvasPos={originCanvasPos}
            rawDxfData={rawDxfData}
            manualOriginCAD={manualOriginCAD}
            onMousePositionChange={setMouseNormPos}
            onHoverPointChange={setHoveredPoint}
          />
        </div>
      </div>
    </div>
  );
}
