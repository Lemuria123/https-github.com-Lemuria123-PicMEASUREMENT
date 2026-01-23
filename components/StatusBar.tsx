
import React from 'react';
import { Crosshair, Target, RotateCw } from 'lucide-react';

interface StatusBarProps {
  coords: { x: number; y: number } | null;
  hoveredInfo: {
    name: string;
    x: number;
    y: number;
    r: number;
    color: string;
  } | null;
  originalFileName: string | null;
}

export const StatusBar: React.FC<StatusBarProps> = ({ coords, hoveredInfo, originalFileName }) => {
  return (
    <div className="h-10 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-4 shrink-0 z-30">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-slate-500">
          <Crosshair size={14} className="text-indigo-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Cursor</span>
        </div>
        {coords ? (
          <div className="flex gap-3 font-mono text-[11px]">
            <div className="flex gap-1"><span className="text-slate-500">X:</span><span className="text-white w-[60px]">{coords.x.toFixed(3)}</span></div>
            <div className="flex gap-1"><span className="text-slate-500">Y:</span><span className="text-white w-[60px]">{coords.y.toFixed(3)}</span></div>
          </div>
        ) : (
          <span className="text-[10px] text-slate-600 italic">Outside active area</span>
        )}
      </div>

      <div className="flex items-center gap-6">
        {hoveredInfo && (
          <div className="flex items-center gap-4 animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center gap-2">
              <Target size={14} style={{ color: hoveredInfo.color }} />
              <span className="text-[10px] font-bold text-white uppercase truncate max-w-[120px]">{hoveredInfo.name}</span>
            </div>
            <div className="flex gap-3 font-mono text-[11px] bg-white/5 px-2 py-0.5 rounded border border-white/10">
              <div className="flex gap-1"><span className="text-slate-500">X:</span><span className="text-emerald-400">{hoveredInfo.x.toFixed(3)}</span></div>
              <div className="flex gap-1"><span className="text-slate-500">Y:</span><span className="text-emerald-400">{hoveredInfo.y.toFixed(3)}</span></div>
              <div className="flex gap-1 items-center ml-1">
                <RotateCw size={10} className="text-amber-400" />
                <span className="text-amber-400">{hoveredInfo.r.toFixed(1)}°</span>
              </div>
            </div>
          </div>
        )}
        <div className="text-[10px] font-black text-slate-700 select-none uppercase tracking-[0.2em]">
          {originalFileName || "NO PROJECT"}
        </div>
      </div>
    </div>
  );
};
