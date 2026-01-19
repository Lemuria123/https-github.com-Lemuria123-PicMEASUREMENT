
import React from 'react';
import { Layers, X, Info } from 'lucide-react';
import { Button } from './Button';
import { DxfMatchSettings } from '../types';

interface DxfMatchSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: DxfMatchSettings;
  onSettingsChange: (newSettings: DxfMatchSettings) => void;
}

export const DxfMatchSettingsModal: React.FC<DxfMatchSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSettingsChange
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-2xl w-[420px] space-y-5 relative animate-in zoom-in-95 duration-200">
        <button 
          onClick={onClose} 
          className="absolute top-3 right-3 text-slate-500 hover:text-white transition-colors"
        >
          <X size={18}/>
        </button>
        
        <div className="flex items-center gap-2 text-emerald-400 border-b border-slate-800 pb-3">
          <Layers size={20} />
          <h3 className="font-bold text-sm tracking-wide uppercase">Match Tolerance Settings</h3>
        </div>

        <div className="space-y-5">
          {/* Geometry Tolerance */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <label className="font-bold">Geometry Tolerance</label>
              <span className="font-mono text-white">{settings.geometryTolerance.toFixed(2)} units</span>
            </div>
            <input 
              type="range" 
              min="0.01" 
              max="5.0" 
              step="0.05" 
              value={settings.geometryTolerance} 
              onChange={(e) => onSettingsChange({ ...settings, geometryTolerance: parseFloat(e.target.value) })} 
              className="w-full accent-emerald-500" 
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              <span className="text-emerald-500">Effect:</span> Find items with slight size variations (e.g. 10.0 vs 10.1).<br/>
              <span className="text-amber-500">Risk:</span> Too high may mis-match different parts (e.g. M6 vs M8 holes).
            </p>
          </div>

          {/* Position Fuzziness */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <label className="font-bold">Position Sensitivity</label>
              <span className="font-mono text-white">{Math.round(settings.positionFuzziness * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0.2" 
              max="10.0" 
              step="0.1" 
              value={settings.positionFuzziness} 
              onChange={(e) => onSettingsChange({ ...settings, positionFuzziness: parseFloat(e.target.value) })} 
              className="w-full accent-emerald-500" 
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              <span className="text-emerald-500">Effect:</span> Find parts with layout drift/distortion.<br/>
              <span className="text-amber-500">Risk:</span> Too high may mis-assign entities to neighboring groups.
            </p>
          </div>

          {/* Angle Tolerance */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <label className="font-bold">Angle Tolerance</label>
              <span className="font-mono text-white">{settings.angleTolerance.toFixed(1)}°</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="45" 
              step="0.5" 
              value={settings.angleTolerance} 
              onChange={(e) => onSettingsChange({ ...settings, angleTolerance: parseFloat(e.target.value) })} 
              className="w-full accent-emerald-500" 
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              <span className="text-emerald-500">Effect:</span> Allows rotation error between seed and target.<br/>
              <span className="text-amber-500">Risk:</span> Higher compute time; may cause double matching on symmetrical parts.
            </p>
          </div>

          {/* Spacing Threshold */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <label className="font-bold">Spacing Threshold</label>
              <span className="font-mono text-white">{settings.minMatchDistance.toFixed(2)} units</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="10.0" 
              step="0.1" 
              value={settings.minMatchDistance} 
              onChange={(e) => onSettingsChange({ ...settings, minMatchDistance: parseFloat(e.target.value) })} 
              className="w-full accent-emerald-500" 
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              <span className="text-emerald-500 font-bold">Effect:</span> Prevents duplicate identification in blurry or distorted drawings.<br/>
              <span className="text-slate-200">Logic:</span> New matches within this distance of an existing match's center will be automatically ignored.
            </p>
          </div>
        </div>

        <div className="bg-emerald-500/5 border border-emerald-500/10 p-2 rounded text-[9px] text-slate-400 leading-tight flex gap-2">
          <Info size={12} className="shrink-0 text-emerald-500" />
          Baseline defaults: Geo=0.5, Pos=100%, Angle=1.0, Space=0. Increase these ONLY for distorted drawings.
        </div>

        <Button variant="primary" className="w-full bg-emerald-600" onClick={onClose}>Apply Parameters</Button>
      </div>
    </div>
  );
};
