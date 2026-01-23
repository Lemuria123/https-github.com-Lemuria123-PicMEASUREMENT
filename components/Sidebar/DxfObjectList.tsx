
import React from 'react';
import { DxfEntityType } from '../../types';

interface DxfObjectListProps {
  entitySizeGroups: any[];
  selectedObjectGroupKey: string | null;
  setSelectedObjectGroupKey: (key: string | null) => void;
  setHoveredObjectGroupKey: (key: string | null) => void;
  createAutoGroup: (key: string, type: 'weld' | 'mark') => void;
}

export const DxfObjectList: React.FC<DxfObjectListProps> = ({
  entitySizeGroups,
  selectedObjectGroupKey,
  setSelectedObjectGroupKey,
  setHoveredObjectGroupKey,
  createAutoGroup
}) => {
  return (
    <div className="space-y-1.5 p-1.5">
      {entitySizeGroups.map(g => {
        const isSelected = selectedObjectGroupKey === g.key;
        return (
          <div 
            key={g.key} 
            onClick={() => setSelectedObjectGroupKey(g.key === selectedObjectGroupKey ? null : g.key)} 
            onMouseEnter={() => setHoveredObjectGroupKey(g.key)} 
            onMouseLeave={() => setHoveredObjectGroupKey(null)} 
            className={`relative flex justify-between items-center px-3 py-1.5 rounded-xl border cursor-pointer transition-all duration-200 group/item overflow-hidden ${
              isSelected 
                ? 'bg-indigo-500/10 border-indigo-500/40 shadow-sm' 
                : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            {isSelected && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-indigo-500" />}
            
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="px-1 py-0.5 rounded bg-indigo-500/5 border border-indigo-500/10 font-mono text-[9px] text-indigo-400 font-black uppercase leading-none tracking-tight">
                  {g.label.split(' ')[0]}
                </span>
                <span className="font-mono text-[9px] text-slate-500 font-black uppercase leading-none opacity-60">
                  {g.label.split(' ')[1]}
                </span>
              </div>
              <span className="text-[11px] font-black text-slate-200 uppercase tracking-tight">
                {g.count} Entities
              </span>
            </div>

            <div className="opacity-0 group-hover/item:opacity-100 flex gap-1 transition-all shrink-0 ml-4">
              <button 
                onClick={(e) => { e.stopPropagation(); createAutoGroup(g.key, 'weld'); }} 
                className="px-2 py-1 rounded text-[8px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white uppercase transition-all shadow-sm active:scale-95"
              >
                WELD
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); createAutoGroup(g.key, 'mark'); }} 
                className="px-2 py-1 rounded text-[8px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500 hover:text-white uppercase transition-all shadow-sm active:scale-95"
              >
                MARK
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
