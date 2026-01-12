
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Scale, Ruler, Rows, Pentagon, Spline, Loader2, Target, Download, Plus, Crosshair, Check, X, Keyboard, Eye, EyeOff } from 'lucide-react';
import { Button } from './components/Button';
import { ImageCanvas } from './components/ImageCanvas';
import { Point, LineSegment, ParallelMeasurement, AreaMeasurement, CurveMeasurement, CalibrationData, AppMode, SolderPoint, ViewTransform } from './types';
import DxfParser from 'dxf-parser';

const UNIT_CONVERSIONS: Record<string, number> = {
  'mm': 1,
  'cm': 10,
  'm': 1000,
  'in': 25.4,
  'ft': 304.8,
  'yd': 914.4
};

export default function App() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [mode, setMode] = useState<AppMode>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [originalFileName, setOriginalFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [mouseNormPos, setMouseNormPos] = useState<Point | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<SolderPoint | null>(null);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [imgDimensions, setImgDimensions] = useState<{width: number, height: number} | null>(null);
  const [viewTransform, setViewTransform] = useState<ViewTransform | null>(null);

  // State Containers
  const [calibrationData, setCalibrationData] = useState<CalibrationData | null>(null);
  const [measurements, setMeasurements] = useState<LineSegment[]>([]);
  const [parallelMeasurements, setParallelMeasurements] = useState<ParallelMeasurement[]>([]);
  const [areaMeasurements, setAreaMeasurements] = useState<AreaMeasurement[]>([]);
  const [curveMeasurements, setCurveMeasurements] = useState<CurveMeasurement[]>([]);
  const [rawDxfData, setRawDxfData] = useState<any | null>(null);
  const [manualOriginCAD, setManualOriginCAD] = useState<{x: number, y: number} | null>(null);

  // Dialog State
  const [dialogUnit, setDialogUnit] = useState<string>('mm');

  // Visibility State
  const [showCalibration, setShowCalibration] = useState(true);
  const [showMeasurements, setShowMeasurements] = useState(true);

  // --- LOCAL STORAGE PERSISTENCE ---
  const saveStateToLocal = () => {
     if (!originalFileName) return;
     const state = {
        fileName: originalFileName,
        manualOriginCAD,
        viewTransform,
        // Optional: could save calibration too if needed
     };
     localStorage.setItem('metricmate_last_session', JSON.stringify(state));
  };

  useEffect(() => {
     const t = setTimeout(saveStateToLocal, 500);
     return () => clearTimeout(t);
  }, [originalFileName, manualOriginCAD, viewTransform]);


  // Clear current drawing points when switching modes
  useEffect(() => {
    setCurrentPoints([]);
    setDialogUnit('mm'); // Reset dialog unit on mode change
  }, [mode]);

  // --- HELPER: CALCULATE SCALE (Units per Pixel) ---
  const getScaleInfo = () => {
      if (!imgDimensions) return null;
      
      if (rawDxfData) {
          // DXF is unitless (or implicitly mm/in). We render into a viewport.
          // We assume the unit is whatever the DXF was (e.g. mm).
          // If the user changes unit via calibrationData update, we need to respect that ratio.
          // However, for DXF raw mode, we usually rely on 'mm'. 
          // If calibrationData is set (even for DXF), we use it.
          // But rawDxfData is used for "solder points" which are fixed in CAD space.
          
          return {
              mmPerPxX: rawDxfData.totalW / imgDimensions.width,
              mmPerPxY: rawDxfData.totalH / imgDimensions.height,
              totalWidthMM: rawDxfData.totalW,
              totalHeightMM: rawDxfData.totalH,
              isDxf: true
          };
      }

      if (calibrationData) {
          const cDx = (calibrationData.start.x - calibrationData.end.x) * imgDimensions.width;
          const cDy = (calibrationData.start.y - calibrationData.end.y) * imgDimensions.height;
          const distPx = Math.sqrt(cDx*cDx + cDy*cDy);
          const unitPerPx = distPx > 0 ? calibrationData.realWorldDistance / distPx : 0;
          return {
              mmPerPxX: unitPerPx, // Actually "Unit per Px"
              mmPerPxY: unitPerPx,
              totalWidthMM: imgDimensions.width * unitPerPx,
              totalHeightMM: imgDimensions.height * unitPerPx,
              isDxf: false
          };
      }
      return null;
  };

  const changeGlobalUnit = (newUnit: string) => {
    if (!calibrationData) return;
    const oldUnit = calibrationData.unit;
    // Convert current distance to mm, then to new unit
    const mmValue = calibrationData.realWorldDistance * (UNIT_CONVERSIONS[oldUnit] || 1);
    const newValue = mmValue / (UNIT_CONVERSIONS[newUnit] || 1);
    
    setCalibrationData({
      ...calibrationData,
      realWorldDistance: newValue,
      unit: newUnit
    });
  };

  const finishShape = () => {
    if (currentPoints.length < 1) return;
    
    if (mode === 'measure' && currentPoints.length === 2) {
         setMeasurements(prev => [...prev, { id: crypto.randomUUID(), start: currentPoints[0], end: currentPoints[1] }]);
         setCurrentPoints([]);
    } else if (mode === 'parallel' && currentPoints.length === 3) {
        setParallelMeasurements(prev => [...prev, { 
          id: crypto.randomUUID(), 
          baseStart: currentPoints[0], 
          baseEnd: currentPoints[1], 
          offsetPoint: currentPoints[2] 
        }]);
        setCurrentPoints([]);
    } else if (mode === 'area' && currentPoints.length > 2) {
        setAreaMeasurements(prev => [...prev, { id: crypto.randomUUID(), points: currentPoints }]);
        setCurrentPoints([]);
    } else if (mode === 'curve' && currentPoints.length > 1) {
        setCurveMeasurements(prev => [...prev, { id: crypto.randomUUID(), points: currentPoints }]);
        setCurrentPoints([]);
    } else if (mode === 'origin' && currentPoints.length === 1) {
        // COMMIT ORIGIN
        const p = currentPoints[0];
        const scaleInfo = getScaleInfo();
        
        if (scaleInfo) {
            if (scaleInfo.isDxf && rawDxfData) {
                const { minX, maxY, totalW, totalH, padding } = rawDxfData;
                const cadX = p.x * totalW + (minX - padding);
                const cadY = (maxY + padding) - p.y * totalH;
                setManualOriginCAD({ x: cadX, y: cadY });
                setMode('solder');
            } else {
                // Image Mode Origin
                // Use current unit scale
                const absX = p.x * scaleInfo.totalWidthMM;
                const absY = p.y * scaleInfo.totalHeightMM;
                setManualOriginCAD({ x: absX, y: absY });
                setMode('measure'); 
            }
        }
        setCurrentPoints([]);
    }
  };

  // Keyboard Fine-Tuning & Confirm
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
       if (e.key === 'Enter') {
         // If calibration dialog is open (2 points in calibrate mode), don't trigger finishShape directly via Enter
         // unless we are focused on the input (handled there).
         if (mode === 'calibrate' && currentPoints.length === 2) return;

         const readyToFinish = 
            (mode === 'measure' && currentPoints.length === 2) ||
            (mode === 'parallel' && currentPoints.length === 3) ||
            (mode === 'area' && currentPoints.length > 2) ||
            (mode === 'curve' && currentPoints.length > 1) ||
            (mode === 'origin' && currentPoints.length === 1);
            
         if (readyToFinish) {
            e.preventDefault();
            finishShape();
            return;
         }
       }

       if (!imgDimensions || currentPoints.length === 0) return;
       const allowedModes: AppMode[] = ['calibrate', 'measure', 'parallel', 'area', 'curve', 'origin'];
       if (!allowedModes.includes(mode)) return;
       if (document.activeElement?.tagName === 'INPUT') return;
       if (document.activeElement?.tagName === 'SELECT') return;

       if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
         e.preventDefault();
         
         let stepX = 0;
         let stepY = 0;
         const targetUnit = e.shiftKey ? 0.1 : 0.01; // unit

         const scaleInfo = getScaleInfo();

         if (scaleInfo) {
             // Convert target unit to normalized percentage
             stepX = (targetUnit / scaleInfo.mmPerPxX) / imgDimensions.width;
             stepY = (targetUnit / scaleInfo.mmPerPxY) / imgDimensions.height;
         } else {
             // Fallback to pixels
             const px = e.shiftKey ? 10 : 1;
             stepX = px / imgDimensions.width;
             stepY = px / imgDimensions.height;
         }

         setCurrentPoints(prev => {
            if (prev.length === 0) return prev;
            const lastIdx = prev.length - 1;
            const p = { ...prev[lastIdx] };
            
            switch (e.key) {
               case 'ArrowUp': p.y -= stepY; break;
               case 'ArrowDown': p.y += stepY; break;
               case 'ArrowLeft': p.x -= stepX; break;
               case 'ArrowRight': p.x += stepX; break;
            }
            p.x = Math.max(0, Math.min(1, p.x));
            p.y = Math.max(0, Math.min(1, p.y));
            const newPoints = [...prev];
            newPoints[lastIdx] = p;
            return newPoints;
         });
       }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imgDimensions, currentPoints, mode, rawDxfData, calibrationData]);


  const handleCalibrationSubmit = (value: string) => {
      const dist = parseFloat(value);
      if (!isNaN(dist) && dist > 0) {
        setCalibrationData({
          start: currentPoints[0],
          end: currentPoints[1],
          realWorldDistance: dist,
          unit: dialogUnit
        });
        setMode('measure'); 
        setCurrentPoints([]); 
      } else {
        alert("Please enter a valid number (e.g., 10.5)");
      }
  };

  const handlePointClick = (p: Point) => {
    if (mode === 'upload') return;

    // --- 1. ORIGIN SETTING ---
    if (mode === 'origin') {
        if (rawDxfData || calibrationData) {
            if (currentPoints.length < 1) {
                setCurrentPoints([p]);
            }
        } else {
            alert("Please calibrate the image first.");
            setMode('calibrate');
        }
        return;
    }

    // --- 2. CALIBRATION ---
    if (mode === 'calibrate') {
      if (currentPoints.length < 2) {
         setCurrentPoints(prev => [...prev, p]);
      }
      return;
    }

    // --- 3. MEASUREMENT TOOLS ---
    const nextPoints = [...currentPoints, p];
    if (mode === 'measure') {
      if (currentPoints.length < 2) setCurrentPoints(nextPoints);
      return;
    }
    if (mode === 'parallel') {
      if (currentPoints.length < 3) setCurrentPoints(nextPoints);
      return;
    }
    setCurrentPoints(nextPoints);
  };

  const solderPoints = useMemo(() => {
    if (!rawDxfData) return [];
    const { circles, defaultCenterX, defaultCenterY, minX, maxY, totalW, totalH, padding } = rawDxfData;
    const curX = manualOriginCAD ? manualOriginCAD.x : defaultCenterX;
    const curY = manualOriginCAD ? manualOriginCAD.y : defaultCenterY;
    let id = 1;
    return circles.map((c: any) => ({
      id: id++,
      x: c.center.x - curX,
      y: c.center.y - curY,
      canvasX: (c.center.x - (minX - padding)) / totalW,
      canvasY: ((maxY + padding) - c.center.y) / totalH
    }));
  }, [rawDxfData, manualOriginCAD]);

  const originCanvasPos = useMemo(() => {
    // 1. DXF Mode
    if (rawDxfData) {
        const { defaultCenterX, defaultCenterY, minX, maxY, totalW, totalH, padding } = rawDxfData;
        const tx = manualOriginCAD ? manualOriginCAD.x : defaultCenterX;
        const ty = manualOriginCAD ? manualOriginCAD.y : defaultCenterY;
        return { x: (tx - (minX - padding)) / totalW, y: ((maxY + padding) - ty) / totalH };
    }
    // 2. Image Mode (requires calibration)
    if (calibrationData && manualOriginCAD && imgDimensions) {
        const scaleInfo = getScaleInfo();
        if (scaleInfo) {
            return {
                x: manualOriginCAD.x / scaleInfo.totalWidthMM,
                y: manualOriginCAD.y / scaleInfo.totalHeightMM
            };
        }
    }
    return null;
  }, [rawDxfData, manualOriginCAD, calibrationData, imgDimensions]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    setIsProcessing(true); setOriginalFileName(file.name);
    
    setMeasurements([]); setParallelMeasurements([]); setAreaMeasurements([]); setCurveMeasurements([]);
    setManualOriginCAD(null);
    setCalibrationData(null);
    setViewTransform(null);

    try {
        const stored = localStorage.getItem('metricmate_last_session');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.fileName === file.name) {
                if (parsed.manualOriginCAD) setManualOriginCAD(parsed.manualOriginCAD);
                if (parsed.viewTransform) setViewTransform(parsed.viewTransform);
            }
        }
    } catch (e) { console.error("Failed to load session", e); }


    if (file.name.toLowerCase().endsWith('.dxf')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parser = new DxfParser();
          const dxf = parser.parseSync(e.target?.result as string);
          if (dxf) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            const circles: any[] = [];
            dxf.entities.forEach((entity: any) => {
              if (entity.type === 'LINE') {
                entity.vertices.forEach((v: any) => {
                  minX = Math.min(minX, v.x); minY = Math.min(minY, v.y);
                  maxX = Math.max(maxX, v.x); maxY = Math.max(maxY, v.y);
                });
              } else if (entity.type === 'CIRCLE') {
                minX = Math.min(minX, entity.center.x - entity.radius); minY = Math.min(minY, entity.center.y - entity.radius);
                maxX = Math.max(maxX, entity.center.x + entity.radius); maxY = Math.max(maxY, entity.center.y + entity.radius);
                circles.push(entity);
              }
            });
            const width = maxX - minX; const height = maxY - minY;
            const padding = Math.max(width, height) * 0.05 || 10;
            const totalW = width + padding * 2; const totalH = height + padding * 2;
            setRawDxfData({ circles, defaultCenterX: (minX + maxX) / 2, defaultCenterY: (minY + maxY) / 2, minX, maxX, maxY, totalW, totalH, padding });
            
            let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX - padding} ${-maxY - padding} ${totalW} ${totalH}" width="1000" style="background: #111;">`;
            dxf.entities.forEach((entity: any) => {
              if (entity.type === 'LINE') svg += `<line x1="${entity.vertices[0].x}" y1="${-entity.vertices[0].y}" x2="${entity.vertices[1].x}" y2="${-entity.vertices[1].y}" stroke="#00ffff" stroke-width="${totalW/1000}" />`;
              else if (entity.type === 'CIRCLE') svg += `<circle cx="${entity.center.x}" cy="${-entity.center.y}" r="${entity.radius}" fill="none" stroke="#00ffff" stroke-width="${totalW/1000}" />`;
            });
            svg += `</svg>`;
            setImageSrc(URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })));
            
            setCalibrationData({ start: { x: padding/totalW, y: 0.5 }, end: { x: (width+padding)/totalW, y: 0.5 }, realWorldDistance: width, unit: 'mm' });
            setMode('solder');
          }
        } catch(err) { console.error(err); alert("Failed to parse DXF"); }
        setIsProcessing(false);
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageSrc(e.target?.result as string);
        setRawDxfData(null);
        setMode('calibrate');
        setIsProcessing(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const exportCSV = () => {
    let csvContent = "";
    
    if (rawDxfData) {
        if (solderPoints.length === 0) return;
        csvContent = "ID,X,Y,Z\n";
        solderPoints.forEach(p => { csvContent += `${p.id},${p.x.toFixed(4)},${p.y.toFixed(4)},0\n`; });
    } else if (calibrationData && manualOriginCAD) {
        csvContent = `Type,X (${calibrationData.unit}),Y (${calibrationData.unit})\n`;
        csvContent += `Origin,${manualOriginCAD.x.toFixed(4)},${manualOriginCAD.y.toFixed(4)}\n`;
    } else {
        alert("Nothing to export. Please calibrate and set an origin.");
        return;
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${originalFileName?.split('.')[0] || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canFinish = (mode === 'measure' && currentPoints.length === 2) ||
                    (mode === 'parallel' && currentPoints.length === 3) ||
                    (mode === 'area' && currentPoints.length > 2) ||
                    (mode === 'curve' && currentPoints.length > 1) ||
                    (mode === 'origin' && currentPoints.length === 1);

  const getLogicCoords = (p: Point) => {
      // 1. DXF
      if (rawDxfData) {
        const { minX, maxY, totalW, totalH, padding, defaultCenterX, defaultCenterY } = rawDxfData;
        const absX = (p.x * totalW) + (minX - padding);
        const absY = (maxY + padding) - (p.y * totalH);
        const ox = manualOriginCAD ? manualOriginCAD.x : defaultCenterX;
        const oy = manualOriginCAD ? manualOriginCAD.y : defaultCenterY;
        return { x: absX - ox, y: absY - oy, isCad: true, absX, absY };
      } 
      
      // 2. Image (Calibrated)
      if (calibrationData) {
          const scaleInfo = getScaleInfo();
          if (scaleInfo) {
              const absX = p.x * scaleInfo.totalWidthMM;
              const absY = p.y * scaleInfo.totalHeightMM;
              
              if (manualOriginCAD) {
                  return { 
                      x: absX - manualOriginCAD.x, 
                      y: absY - manualOriginCAD.y, 
                      isCad: false 
                  };
              }
              return { 
                  x: absX, 
                  y: absY,
                  isCad: false 
              };
          }
      }
      return null;
  };

  const displayCoords = useMemo(() => {
    if (!mouseNormPos) return null;
    return getLogicCoords(mouseNormPos);
  }, [mouseNormPos, calibrationData, rawDxfData, manualOriginCAD, imgDimensions]);

  const activePointCoords = useMemo(() => {
     if (currentPoints.length === 0) return null;
     const lastP = currentPoints[currentPoints.length - 1];
     return getLogicCoords(lastP);
  }, [currentPoints, calibrationData, rawDxfData, manualOriginCAD, imgDimensions]);

  const originDelta = useMemo(() => {
      if (mode !== 'origin' || currentPoints.length === 0) return null;
      const newP = activePointCoords;
      if (newP) {
          return { dx: newP.x, dy: newP.y };
      }
      return null;
  }, [mode, currentPoints, activePointCoords]);


  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row text-slate-200 overflow-hidden font-sans">
      <input ref={fileInputRef} type="file" accept="image/*,.dxf" onChange={handleFileUpload} className="hidden" />

      {/* SIDEBAR */}
      <div className="w-full md:w-72 bg-slate-900 border-r border-slate-800 flex flex-col z-10 shadow-xl overflow-y-auto shrink-0">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
          <h1 className="font-bold text-sm text-white tracking-tight flex items-center gap-2"><Scale className="text-indigo-400" size={16}/> MetricMate</h1>
          <button onClick={() => {setImageSrc(null); setMode('upload');}} className="text-[9px] text-slate-500 hover:text-red-400 font-bold uppercase transition-colors">RESET</button>
        </div>

        <div className="p-3 space-y-4">
          <Button variant="primary" className="w-full text-[11px] h-9 font-bold tracking-wider" icon={<Plus size={14} />} onClick={() => fileInputRef.current?.click()}>IMPORT FILE</Button>
          
          <div className={`px-3 py-2 rounded-xl border flex flex-col gap-1 ${calibrationData ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Calibration</span>
              <button 
                onClick={() => setShowCalibration(!showCalibration)} 
                className="text-slate-500 hover:text-indigo-400 transition-colors" 
                title={showCalibration ? "Hide Calibration" : "Show Calibration"}
              >
                 {showCalibration ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>
            {calibrationData ? (
                <div className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-lg border border-slate-800">
                    <span className="font-mono text-emerald-400 text-sm flex-1">{calibrationData.realWorldDistance.toFixed(2)}</span>
                    <select 
                      value={calibrationData.unit} 
                      onChange={(e) => changeGlobalUnit(e.target.value)}
                      className="bg-slate-800 text-xs text-white border border-slate-700 rounded px-1 py-0.5 outline-none focus:border-emerald-500"
                    >
                        {Object.keys(UNIT_CONVERSIONS).map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                </div>
            ) : (
                <div className="text-[10px] text-slate-500 italic px-1">No calibration set</div>
            )}
            <Button variant="ghost" active={mode === 'calibrate'} onClick={() => setMode('calibrate')} className="h-7 text-[9px] mt-2 border border-slate-700/50" icon={<Scale size={12}/>}>MANUAL CALIBRATE</Button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Tools</h3>
                <button 
                    onClick={() => setShowMeasurements(!showMeasurements)} 
                    className="text-slate-500 hover:text-indigo-400 transition-colors" 
                    title={showMeasurements ? "Hide Measurements" : "Show Measurements"}
                >
                    {showMeasurements ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" className="h-9 text-[10px]" active={mode === 'measure'} onClick={() => setMode('measure')} disabled={!calibrationData} title="Measure direct distance"><Ruler size={14} /> Distance</Button>
              <Button variant="secondary" className="h-9 text-[10px]" active={mode === 'parallel'} onClick={() => setMode('parallel')} disabled={!calibrationData} title="Measure parallel gap"><Rows size={14} className="rotate-90" /> Parallel</Button>
              <Button variant="secondary" className="h-9 text-[10px]" active={mode === 'area'} onClick={() => setMode('area')} disabled={!calibrationData} title="Measure polygon area"><Pentagon size={14} /> Area</Button>
              <Button variant="secondary" className="h-9 text-[10px]" active={mode === 'curve'} onClick={() => setMode('curve')} disabled={!calibrationData} title="Measure path length"><Spline size={14} /> Curve</Button>
              
              <Button variant="secondary" active={mode === 'origin'} onClick={() => setMode('origin')} disabled={!calibrationData && !rawDxfData} className="col-span-1 h-9 text-[10px]" title="Set Coordinate Origin"><Crosshair size={14}/> Set Origin</Button>
              <Button variant="secondary" onClick={exportCSV} disabled={(!calibrationData || !manualOriginCAD) && (!rawDxfData)} className="col-span-1 h-9 text-[10px]" title="Export Points/Origin"><Download size={14}/> Export CSV</Button>
              
              {rawDxfData && <Button variant="secondary" className="h-9 text-[10px] col-span-2" active={mode === 'solder'} onClick={() => setMode('solder')} disabled={!rawDxfData} title="View DXF solder pads"><Target size={14} /> DXF Solder Detect</Button>}
            </div>
          </div>

          {canFinish && (
            <Button variant="primary" className="h-9 text-[11px] w-full bg-emerald-600 shadow-emerald-500/20" onClick={finishShape} icon={<Check size={16}/>}>CONFIRM (ENTER)</Button>
          )}

          {currentPoints.length > 0 && (
             <div className="px-1 pt-2 border-t border-slate-800/50">
               <div className="flex items-center gap-2 text-[9px] text-slate-500 bg-slate-800/50 p-2 rounded">
                  <Keyboard size={12} />
                  <span>Use arrow keys to fine-tune. Shift+Arrow for 0.1 units.</span>
               </div>
             </div>
          )}
        </div>
      </div>

      {/* VIEWPORT */}
      <div className="flex-1 relative flex flex-col">
        <div className="h-14 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex items-center px-4 justify-between z-10 gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">MODE: {mode}</div>
            
            {displayCoords && !activePointCoords && (
               <div className="flex gap-4 font-mono text-[11px] text-slate-400">
                  <span className="bg-slate-800/50 px-2 py-0.5 rounded">X: {displayCoords.x.toFixed(2)}</span>
                  <span className="bg-slate-800/50 px-2 py-0.5 rounded">Y: {displayCoords.y.toFixed(2)}</span>
                  {displayCoords.isCad && <span className="text-[9px] self-center text-slate-500 uppercase tracking-wider">CAD</span>}
               </div>
            )}

            {activePointCoords && mode !== 'origin' && (
                <div className="flex gap-4 font-mono text-[11px] text-emerald-400 bg-emerald-950/30 px-3 py-1 rounded border border-emerald-500/30">
                  <span className="font-bold text-[9px] text-emerald-500 uppercase tracking-wider self-center">Selected:</span>
                  <span>X: {activePointCoords.x.toFixed(2)}</span>
                  <span>Y: {activePointCoords.y.toFixed(2)}</span>
               </div>
            )}

            {originDelta && (
                <div className="flex gap-4 font-mono text-[11px] text-amber-400 bg-amber-950/30 px-3 py-1 rounded border border-amber-500/30 animate-pulse">
                  <span className="font-bold text-[9px] text-amber-500 uppercase tracking-wider self-center">New Origin Offset:</span>
                  <span>dX: {originDelta.dx.toFixed(2)}</span>
                  <span>dY: {originDelta.dy.toFixed(2)}</span>
               </div>
            )}
          </div>

          {hoveredPoint && (
             <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-lg">
               <span className="text-[10px] font-bold text-emerald-400">ID# {hoveredPoint.id}</span>
               <span className="text-[11px] font-mono text-emerald-200">({hoveredPoint.x.toFixed(2)}, {hoveredPoint.y.toFixed(2)})</span>
             </div>
          )}
        </div>

        <div className="flex-1 p-6 relative bg-slate-950 flex items-center justify-center overflow-hidden">
          {isProcessing && (
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
              <Loader2 className="animate-spin text-indigo-400 mb-2" size={48} />
              <p className="text-xs text-indigo-300 font-bold uppercase tracking-widest">Processing...</p>
            </div>
          )}

          {/* CUSTOM CALIBRATION DIALOG - IMPROVED UI */}
          {mode === 'calibrate' && currentPoints.length === 2 && (
             <div className="absolute top-8 z-50 bg-slate-900/95 backdrop-blur-md border border-indigo-500/50 p-4 rounded-xl shadow-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-4 w-80">
                <div className="flex flex-col gap-2">
                   <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Known Distance</label>
                   <div className="flex gap-2">
                       <input 
                          autoFocus
                          id="calibration-input"
                          type="number" 
                          step="0.1"
                          placeholder="Length"
                          className="flex-1 h-10 bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-lg px-3 text-sm text-white outline-none transition-all placeholder:text-slate-600"
                          onKeyDown={(e) => {
                             if (e.key === 'Enter') handleCalibrationSubmit(e.currentTarget.value);
                             if (e.key === 'Escape') setCurrentPoints([]);
                          }}
                       />
                       <select 
                          className="h-10 bg-slate-950 border border-slate-700 rounded-lg px-3 text-sm text-white outline-none focus:border-indigo-500"
                          value={dialogUnit}
                          onChange={(e) => setDialogUnit(e.target.value)}
                       >
                          {Object.keys(UNIT_CONVERSIONS).map(u => <option key={u} value={u}>{u}</option>)}
                       </select>
                   </div>
                </div>
                <div className="flex gap-2 mt-1">
                    <Button 
                      variant="primary" 
                      className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-500" 
                      onClick={() => {
                         const input = document.getElementById('calibration-input') as HTMLInputElement;
                         handleCalibrationSubmit(input.value);
                      }}
                    >
                      <Check size={20} />
                    </Button>
                    <Button 
                      variant="secondary" 
                      className="flex-1 h-10" 
                      onClick={() => setCurrentPoints([])}
                    >
                      <X size={20} />
                    </Button>
                </div>
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
            currentPoints={currentPoints}
            onPointClick={handlePointClick}
            onDeleteMeasurement={(id) => setMeasurements(m => m.filter(x => x.id !== id))}
            solderPoints={(mode === 'solder' || mode === 'origin') ? solderPoints : []}
            originCanvasPos={originCanvasPos}
            onMousePositionChange={setMouseNormPos}
            onHoverPointChange={setHoveredPoint}
            onDimensionsChange={(w, h) => setImgDimensions({width: w, height: h})}
            initialTransform={viewTransform}
            onViewChange={setViewTransform}
            showCalibration={showCalibration}
            showMeasurements={showMeasurements}
          />
        </div>
      </div>
    </div>
  );
}
