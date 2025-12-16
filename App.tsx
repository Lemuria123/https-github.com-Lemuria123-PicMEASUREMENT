import React, { useState, useCallback } from 'react';
import { Upload, Scale, Ruler, Trash2, ArrowLeft, Download, Rows } from 'lucide-react';
import { Button } from './components/Button';
import { ImageCanvas } from './components/ImageCanvas';
import { Point, LineSegment, ParallelMeasurement, CalibrationData, AppMode } from './types';

export default function App() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [mode, setMode] = useState<AppMode>('upload');
  
  // State for Calibration
  const [calibrationPoints, setCalibrationPoints] = useState<Point[]>([]);
  const [calibrationData, setCalibrationData] = useState<CalibrationData | null>(null);
  const [tempCalDistance, setTempCalDistance] = useState<string>('10');
  const [tempCalUnit, setTempCalUnit] = useState<string>('mm');
  const [showCalibrationInput, setShowCalibrationInput] = useState(false);

  // State for Measurement
  const [measurePoints, setMeasurePoints] = useState<Point[]>([]);
  const [measurements, setMeasurements] = useState<LineSegment[]>([]);

  // State for Parallel Measurement
  const [parallelPoints, setParallelPoints] = useState<Point[]>([]);
  const [parallelMeasurements, setParallelMeasurements] = useState<ParallelMeasurement[]>([]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageSrc(e.target?.result as string);
        setMode('calibrate');
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePointClick = (p: Point) => {
    if (mode === 'calibrate') {
      if (calibrationData) return;
      
      const newPoints = [...calibrationPoints, p];
      setCalibrationPoints(newPoints);

      if (newPoints.length === 2) {
        setShowCalibrationInput(true);
      }
    } else if (mode === 'measure') {
      if (!calibrationData) {
        alert("Please calibrate the image first.");
        setMode('calibrate');
        return;
      }

      const newPoints = [...measurePoints, p];
      setMeasurePoints(newPoints);

      if (newPoints.length === 2) {
        const newMeasurement: LineSegment = {
          id: Date.now().toString(),
          start: newPoints[0],
          end: newPoints[1],
        };
        setMeasurements([...measurements, newMeasurement]);
        setMeasurePoints([]);
      }
    } else if (mode === 'parallel') {
      if (!calibrationData) {
        alert("Please calibrate the image first.");
        setMode('calibrate');
        return;
      }

      const newPoints = [...parallelPoints, p];
      
      // If we have 2 points, the 3rd click defines the offset
      if (parallelPoints.length === 2) {
        const newMeasurement: ParallelMeasurement = {
          id: Date.now().toString(),
          start: parallelPoints[0],
          end: parallelPoints[1],
          offsetPoint: p
        };
        setParallelMeasurements([...parallelMeasurements, newMeasurement]);
        setParallelPoints([]);
      } else {
        setParallelPoints(newPoints);
      }
    }
  };

  const confirmCalibration = () => {
    if (calibrationPoints.length !== 2) return;
    const dist = parseFloat(tempCalDistance);
    if (isNaN(dist) || dist <= 0) {
      alert("Please enter a valid positive distance.");
      return;
    }

    setCalibrationData({
      start: calibrationPoints[0],
      end: calibrationPoints[1],
      realWorldDistance: dist,
      unit: tempCalUnit
    });
    setShowCalibrationInput(false);
    setCalibrationPoints([]);
    setMode('measure');
  };

  const cancelCalibration = () => {
    setCalibrationPoints([]);
    setShowCalibrationInput(false);
  };

  const clearCalibration = () => {
    setCalibrationData(null);
    setCalibrationPoints([]);
    setMeasurePoints([]);
    setMeasurements([]);
    setParallelPoints([]);
    setParallelMeasurements([]);
    setMode('calibrate');
  };

  const deleteMeasurement = (id: string) => {
    setMeasurements(measurements.filter(m => m.id !== id));
  };

  const deleteParallelMeasurement = (id: string) => {
    setParallelMeasurements(parallelMeasurements.filter(m => m.id !== id));
  };

  const resetAll = () => {
    setImageSrc(null);
    setMode('upload');
    setCalibrationData(null);
    setCalibrationPoints([]);
    setMeasurePoints([]);
    setMeasurements([]);
    setParallelPoints([]);
    setParallelMeasurements([]);
    setShowCalibrationInput(false);
  };

  // Render Upload Screen
  if (!imageSrc || mode === 'upload') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-12 rounded-2xl shadow-2xl">
          <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-400">
            <Upload size={40} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">MetricMate</h1>
          <p className="text-slate-400 mb-8">Upload an image to start measuring distances.</p>
          
          <label className="block w-full">
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleFileUpload}
              className="hidden" 
            />
            <div className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-3">
              <Upload size={20} />
              Select Image
            </div>
          </label>
        </div>
      </div>
    );
  }

  // Determine active points based on mode
  const getCurrentPoints = () => {
    if (mode === 'calibrate') return calibrationPoints;
    if (mode === 'measure') return measurePoints;
    if (mode === 'parallel') return parallelPoints;
    return [];
  };

  // Render Main Workspace
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row text-slate-200 overflow-hidden">
      
      {/* Sidebar Controls */}
      <div className="w-full md:w-80 bg-slate-900 border-r border-slate-800 flex flex-col z-10 shadow-xl">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h1 className="font-bold text-lg text-white tracking-wide">MetricMate</h1>
          <button onClick={resetAll} className="text-xs text-slate-500 hover:text-white transition-colors">NEW PROJECT</button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-8">
          
          {/* Status Card */}
          <div className={`p-4 rounded-xl border ${calibrationData ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
            <div className="flex items-center gap-3 mb-2">
              {calibrationData ? <Scale className="text-emerald-400" size={20} /> : <Scale className="text-amber-400" size={20} />}
              <span className={`font-medium ${calibrationData ? 'text-emerald-400' : 'text-amber-400'}`}>
                {calibrationData ? 'Calibrated' : 'Calibration Needed'}
              </span>
            </div>
            {calibrationData ? (
              <div className="text-sm text-slate-400">
                1 unit ≈ <span className="text-slate-200 font-mono">{calibrationData.realWorldDistance} {calibrationData.unit}</span>
                <button onClick={clearCalibration} className="block mt-2 text-xs text-indigo-400 hover:text-indigo-300 underline">Recalibrate</button>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Select two points on a known object (like a ruler or coin) to set the scale.</p>
            )}
          </div>

          {/* Mode Switching */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tools</h3>
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="secondary" 
                active={mode === 'calibrate'} 
                onClick={() => setMode('calibrate')}
                disabled={!!calibrationData}
                className={mode === 'calibrate' ? '!bg-amber-500/10 !text-amber-400 !border-amber-500/50' : ''}
              >
                <Scale size={18} />
                Calibrate
              </Button>
              <Button 
                variant="secondary" 
                active={mode === 'measure'} 
                onClick={() => setMode('measure')}
                disabled={!calibrationData}
                className={mode === 'measure' ? '!bg-indigo-500/10 !text-indigo-400 !border-indigo-500/50' : ''}
              >
                <Ruler size={18} />
                Distance
              </Button>
              <Button 
                variant="secondary" 
                active={mode === 'parallel'} 
                onClick={() => setMode('parallel')}
                disabled={!calibrationData}
                className={`col-span-2 ${mode === 'parallel' ? '!bg-purple-500/10 !text-purple-400 !border-purple-500/50' : ''}`}
              >
                <Rows size={18} className="rotate-90" />
                Parallel Width
              </Button>
            </div>
          </div>

          {/* Measurements List */}
          {(measurements.length > 0 || parallelMeasurements.length > 0) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Measurements</h3>
                <span className="text-xs text-slate-600">{measurements.length + parallelMeasurements.length} total</span>
              </div>
              
              <div className="space-y-2">
                {measurements.map((m, idx) => (
                  <div key={m.id} className="group flex items-center justify-between bg-slate-800/50 hover:bg-slate-800 p-3 rounded-lg border border-slate-700/50 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold">
                        D{idx + 1}
                      </div>
                      <span className="text-sm text-slate-300">
                        Distance
                      </span>
                    </div>
                    <button onClick={() => deleteMeasurement(m.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                
                {parallelMeasurements.map((m, idx) => (
                  <div key={m.id} className="group flex items-center justify-between bg-slate-800/50 hover:bg-slate-800 p-3 rounded-lg border border-slate-700/50 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">
                        P{idx + 1}
                      </div>
                      <span className="text-sm text-slate-300">
                        Parallel Width
                      </span>
                    </div>
                    <button onClick={() => deleteParallelMeasurement(m.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <Button 
                variant="ghost" 
                className="w-full text-xs text-red-400 hover:text-red-300 hover:bg-red-900/10 mt-2"
                onClick={() => {
                  setMeasurements([]);
                  setParallelMeasurements([]);
                }}
              >
                Clear All
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Stage */}
      <div className="flex-1 relative flex flex-col">
        {/* Toolbar Header */}
        <div className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex items-center px-6 justify-between z-10">
          <div className="flex items-center gap-4">
             <span className="text-sm font-medium text-slate-400">Current Mode:</span>
             <span className={`text-sm font-bold px-3 py-1 rounded-full border 
               ${mode === 'calibrate' ? 'border-amber-500/30 text-amber-400 bg-amber-500/10' : 
                 mode === 'measure' ? 'border-indigo-500/30 text-indigo-400 bg-indigo-500/10' : 
                 mode === 'parallel' ? 'border-purple-500/30 text-purple-400 bg-purple-500/10' : ''
               }`}>
               {mode === 'calibrate' ? 'CALIBRATION' : mode === 'measure' ? 'DISTANCE' : 'PARALLEL WIDTH'}
             </span>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 p-6 overflow-hidden relative bg-slate-950 flex items-center justify-center">
          <ImageCanvas
            src={imageSrc}
            mode={mode}
            calibrationData={calibrationData}
            measurements={measurements}
            parallelMeasurements={parallelMeasurements}
            currentPoints={getCurrentPoints()}
            onPointClick={handlePointClick}
            onDeleteMeasurement={deleteMeasurement}
            onDeleteParallelMeasurement={deleteParallelMeasurement}
          />

          {/* Calibration Input Modal */}
          {showCalibrationInput && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-sm w-full animate-in fade-in zoom-in duration-200">
                <h3 className="text-xl font-bold text-white mb-4">Set Reference Distance</h3>
                <p className="text-slate-400 text-sm mb-6">
                  Enter the real-world distance between the two points you selected.
                </p>
                
                <div className="flex gap-3 mb-6">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Distance</label>
                    <input
                      type="number"
                      value={tempCalDistance}
                      onChange={(e) => setTempCalDistance(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="e.g. 10"
                      autoFocus
                    />
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unit</label>
                    <select 
                      value={tempCalUnit}
                      onChange={(e) => setTempCalUnit(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                      <option value="in">in</option>
                      <option value="ft">ft</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="secondary" onClick={cancelCalibration} className="flex-1">Cancel</Button>
                  <Button variant="primary" onClick={confirmCalibration} className="flex-1">Set Scale</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}