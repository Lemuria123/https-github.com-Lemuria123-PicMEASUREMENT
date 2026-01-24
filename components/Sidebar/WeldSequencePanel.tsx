
import React from 'react';
import { Target, Hash, RefreshCw, Trash2, ListOrdered, GripVertical, Search } from 'lucide-react';
import { Button } from '../Button';
import { DxfComponent } from '../../types';

export interface WeldSequencePanelProps {
  weldingQueue: DxfComponent[];
  assignSequence: (id: string) => void;
  resetAllSequences: () => void;
  reorderSequences: () => void;
  selectedComponentId: string | null;
  setSelectedComponentId: (id: string | null) => void;
  setHoveredComponentId: (id: string | null) => void;
}

export const WeldSequencePanel: React.FC<WeldSequencePanelProps> = ({
  weldingQueue,
  assignSequence,
  resetAllSequences,
  reorderSequences,
  selectedComponentId,
  setSelectedComponentId,
  setHoveredComponentId
}) => {
  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-4 animate-in fade-in">
      <div className="flex justify-between items-center px-1 border-b border-slate-800 pb-2">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <ListOrdered size={14} /> Production Queue
        </h3>
        <div className="flex gap-1">
          <button 
            onClick={reorderSequences} 
            className="p-1.5 text-slate-500 hover:text-emerald-400 bg-white/5 rounded-lg transition-colors"
            title="Reorder All"
          >
            <RefreshCw size={13}/>
          </button>
          <button 
            onClick={resetAllSequences} 
            className="p-1.5 text-slate-500 hover:text-red-400 bg-white/5 rounded-lg transition-colors"
            title="Clear All"
          >
            <Trash2 size={13}/>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none hide-scrollbar space-y-1.5 pr-1 py-0.5">
        {weldingQueue.length === 0 ? (
          <div className="py-12 text-center opacity-20 flex flex-col items-center gap-2">
            <Hash size={24}/>
            <span className="text-[9px] font-black uppercase tracking-widest">No Sequences Assigned</span>
            <p className="text-[8px] max-w-[150px] leading-relaxed">Click weld points in the canvas to add them to the queue.</p>
          </div>
        ) : (
          weldingQueue.map((comp) => {
            const isSel = selectedComponentId === comp.id;
            return (
              <div 
                key={comp.id}
                onClick={() => setSelectedComponentId(comp.id)}
                onMouseEnter={() => setHoveredComponentId(comp.id)}
                onMouseLeave={() => setHoveredComponentId(null)}
                className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all duration-200 group ${
                  isSel ? 'bg-indigo-500/10 border-indigo-500/40' : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Badge Index */}
                <div 
                  className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-[10px] text-white shrink-0 shadow-lg"
                  style={{ backgroundColor: comp.color }}
                >
                  S{comp.sequence}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold text-slate-200 truncate uppercase tracking-tight">{comp.name}</div>
                  <div className="text-[8px] text-slate-500 font-mono mt-0.5">
                    X: {comp.centroid.x.toFixed(2)} Y: {comp.centroid.y.toFixed(2)}
                  </div>
                </div>

                <button 
                  onClick={(e) => { e.stopPropagation(); assignSequence(comp.id); }}
                  className="p-1.5 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-2 shrink-0">
        <div className="flex items-center gap-2 text-emerald-400">
          <Search size={12} />
          <span className="text-[9px] font-black uppercase tracking-widest">Active Selector</span>
        </div>
        <p className="text-[9px] text-slate-400 leading-relaxed italic font-medium">
          In this mode, click any <span className="text-emerald-400">Weld</span> point in the canvas to toggle its position in the production sequence.
        </p>
      </div>
    </div>
  );
};
