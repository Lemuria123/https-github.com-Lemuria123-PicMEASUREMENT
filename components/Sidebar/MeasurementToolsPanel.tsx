
import React from 'react';
import { Plus, Scale, Eye, EyeOff, Ruler, Rows, Pentagon, Spline, Crosshair, Download, Layers, ScanFace } from 'lucide-react';
import { Button } from '../Button';
import { CalibrationData, AppMode } from '../../types';
import { UNIT_CONVERSIONS } from '../../constants';

export interface MeasurementToolsPanelProps {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  calibrationData: CalibrationData | null;
  showCalibration: boolean;
  setShowCalibration: (show: boolean) => void;
  showMeasurements: boolean;
  setShowMeasurements: (show: boolean) => void;
  changeGlobalUnit: (unit: string) => void;
  onImportClick: () => void;
  exportCSV: () => void;
  hasRawDxfData: boolean;
  hasImageSrc: boolean;
  manualOriginCAD: { x: number; y: number } | null;
}

export const MeasurementToolsPanel: React.FC<MeasurementToolsPanelProps> = ({
  mode,
  setMode,
  calibrationData,
  showCalibration,
  setShowCalibration,
  showMeasurements,
  setShowMeasurements,
  changeGlobalUnit,
  onImportClick,
  exportCSV,
  hasRawDxfData,
  hasImageSrc,
  manualOriginCAD
}) => {
  return (
    <div className="space-y-4 animate-in fade-in">
      <Button variant="primary" className="w-full text-[11px] h-9 font-bold tracking-wider" icon={<Plus size={14} />} onClick={onImportClick}>IMPORT FILE</Button>
      
      <div className={`px-3 py-2 rounded-xl border flex flex-col gap-1 ${calibrationData ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[9px] font-bold text-slate-500 uppercase">Calibration</span>
          <button onClick={() => setShowCalibration(!showCalibration)} className="text-slate-500 hover:text-indigo-400">
            {showCalibration ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        </div>
        {calibrationData ? (
          <div className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-lg border border-slate-800">
            <span className="font-mono text-emerald-400 text-sm flex-1">{calibrationData.realWorldDistance.toFixed(2)}</span>
            <select 
              value={calibrationData.unit} 
              onChange={(e) => changeGlobalUnit(e.target.value)} 
              className="bg-slate-800 text-xs border border-slate-700 rounded px-1 py-0.5 outline-none"
            >
              {Object.keys(UNIT_CONVERSIONS).map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        ) : <div className="text-[10px] text-slate-500 italic px-1">No calibration set</div>}
        <Button variant="ghost" active={mode === 'calibrate'} onClick={() => setMode('calibrate')} className="h-7 text-[9px] mt-2 border border-slate-700/50" icon={<Scale size={12}/>}>MANUAL CALIBRATE</Button>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase">Active Tools</h3>
          <button onClick={() => setShowMeasurements(!showMeasurements)} className="text-slate-500 hover:text-indigo-400">
            {showMeasurements ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" className="h-9 text-[10px]" active={mode === 'measure'} onClick={() => setMode('measure')} disabled={!calibrationData}><Ruler size={14} /> Distance</Button>
          <Button variant="secondary" className="h-9 text-[10px]" active={mode === 'parallel'} onClick={() => setMode('parallel')} disabled={!calibrationData}><Rows size={14} className="rotate-90" /> Parallel</Button>
          <Button variant="secondary" className="h-9 text-[10px]" active={mode === 'area'} onClick={() => setMode('area')} disabled={!calibrationData}><Pentagon size={14} /> Area</Button>
          <Button variant="secondary" className="h-9 text-[10px]" active={mode === 'curve'} onClick={() => setMode('curve')} disabled={!calibrationData}><Spline size={14} /> Curve</Button>
          <Button variant="secondary" active={mode === 'origin'} onClick={() => setMode('origin')} disabled={!calibrationData && !hasRawDxfData} className="col-span-1 h-9 text-[10px]"><Crosshair size={14}/> Set Origin</Button>
          <Button variant="secondary" onClick={exportCSV} disabled={(!calibrationData || !manualOriginCAD) && (!hasRawDxfData)} className="col-span-1 h-9 text-[10px]"><Download size={14}/> Export CSV</Button>
        </div>
      </div>

      {(hasRawDxfData || hasImageSrc) && (
        <div className="space-y-2 pt-2 border-t border-slate-800 mt-2">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase">Analysis Tools</h3>
          {hasRawDxfData ? (
            <Button variant="secondary" className={`h-9 text-[10px] w-full ${mode === 'dxf_analysis' ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/50' : ''}`} active={mode === 'dxf_analysis'} onClick={() => setMode('dxf_analysis')}><Layers size={14} /> DXF Analysis</Button>
          ) : (
            <Button variant="secondary" className={`h-9 text-[10px] w-full ${mode === 'feature_analysis' ? 'bg-violet-600/20 text-violet-400 border-violet-500/50' : ''}`} active={mode === 'feature_analysis'} onClick={() => setMode('feature_analysis')} disabled={!hasImageSrc}><ScanFace size={14} /> Feature Search (AI)</Button>
          )}
        </div>
      )}
    </div>
  );
};
