
import React from 'react';
import { Layers, Trash2, XCircle } from 'lucide-react';
import { DxfComponent } from '../../types';

interface DxfGroupListProps {
  topLevelComponents: DxfComponent[];
  dxfComponents: DxfComponent[];
  selectedComponentId: string | null;
  setSelectedComponentId: (id: string | null) => void;
  setHoveredComponentId: (id: string | null) => void;
  updateComponentColor: (id: string, color: string) => void;
  updateComponentProperty: (id: string, prop: any, val: boolean) => void;
  confirmDeleteComponent: (id: string) => void;
  confirmDeleteAllMatches: (parentId: string) => void;
  setInspectComponentId: (id: string | null) => void;
  setInspectMatchesParentId: (id: string | null) => void;
  setAnalysisTab: (tab: any) => void;
}

export const DxfGroupList: React.FC<DxfGroupListProps> = ({
  topLevelComponents,
  dxfComponents,
  selectedComponentId,
  setSelectedComponentId,
  setHoveredComponentId,
  updateComponentColor,
  updateComponentProperty,
  confirmDeleteComponent,
  confirmDeleteAllMatches,
  setInspectComponentId,
  setInspectMatchesParentId,
  setAnalysisTab
}) => {
  if (topLevelComponents.length === 0) {
    return (
      <div className="text-center py-12 opacity-20 flex flex-col items-center gap-2">
        <Layers size={24}/>
        <span className="text-[9px] font-black uppercase tracking-[0.2em]">No Definitions</span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 p-1.5">
      {topLevelComponents.map((comp) => {
        const matchCount = dxfComponents.filter(c => c.parentGroupId === comp.id).length;
        const isSel = selectedComponentId === comp.id;
        return (
          <div 
            key={comp.id} 
            onClick={() => setSelectedComponentId(comp.id)} 
            onMouseEnter={() => setHoveredComponentId(comp.id)} 
            onMouseLeave={() => setHoveredComponentId(null)} 
            className={`relative px-3 py-2 rounded-xl border cursor-pointer flex flex-col gap-1.5 transition-all duration-200 ${
              isSel 
                ? 'bg-indigo-500/10 border-indigo-500/40 shadow-sm' 
                : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            {isSel && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-indigo-500" />}
            
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 min-w-0">
                <input 
                  type="color" 
                  value={comp.color} 
                  onChange={(e) => updateComponentColor(comp.id, e.target.value)} 
                  className="w-3 h-3 rounded-sm cursor-pointer border-0 bg-transparent shrink-0" 
                  onClick={e => e.stopPropagation()} 
                />
                <span className={`font-black text-[11px] truncate uppercase tracking-tight ${isSel ? 'text-white' : 'text-slate-400'}`}>
                  {comp.name}
                </span>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); confirmDeleteComponent(comp.id); }} 
                className="text-slate-600 hover:text-red-400 p-1 rounded-lg hover:bg-red-500/10 transition-all"
              >
                <Trash2 size={12}/>
              </button>
            </div>

            <div className="flex justify-between items-center border-t border-slate-800/60 pt-1.5">
              <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
                <span 
                  onClick={(e) => { e.stopPropagation(); setInspectComponentId(comp.id); setAnalysisTab('detail'); }} 
                  className="text-[10px] text-slate-500 font-black hover:text-slate-200 uppercase transition-colors whitespace-nowrap"
                >
                  {(comp.childGroupIds?.length || 0) + comp.entityIds.length} ITM
                </span>
                {matchCount > 0 && (
                  <div className="flex items-center gap-1.5 bg-indigo-500/5 border border-indigo-500/20 rounded-lg px-1.5 py-0.5">
                    <span 
                      onClick={(e) => { e.stopPropagation(); setInspectMatchesParentId(comp.id); setAnalysisTab('matches'); }} 
                      className="text-[9px] text-indigo-400 font-black uppercase cursor-pointer hover:text-indigo-300"
                    >
                      MCH:{matchCount}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); confirmDeleteAllMatches(comp.id); }} className="text-slate-600 hover:text-red-500"><XCircle size={10} /></button>
                  </div>
                )}
              </div>
              
              <div className="flex gap-1 shrink-0">
                <button onClick={(e) => { e.stopPropagation(); updateComponentProperty(comp.id, 'isWeld', !comp.isWeld); }} className={`px-2 py-1 rounded text-[8px] font-black uppercase transition-all ${comp.isWeld ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-600'}`}>WELD</button>
                <button onClick={(e) => { e.stopPropagation(); updateComponentProperty(comp.id, 'isMark', !comp.isMark); }} className={`px-2 py-1 rounded text-[8px] font-black uppercase transition-all ${comp.isMark ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-600'}`}>MARK</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
