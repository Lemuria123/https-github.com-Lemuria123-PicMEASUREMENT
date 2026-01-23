
import React from 'react';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { DxfComponent } from '../../types';

interface DxfMatchViewProps {
  inspectMatchesParentId: string | null;
  dxfComponents: DxfComponent[];
  currentMatchedGroups: DxfComponent[];
  selectedComponentId: string | null;
  setSelectedComponentId: (id: string | null) => void;
  setHoveredComponentId: (id: string | null) => void;
  confirmDeleteComponent: (id: string) => void;
  updateComponentProperty: (id: string, prop: any, val: boolean) => void;
  setInspectComponentId: (id: string | null) => void;
  setInspectMatchesParentId: (id: string | null) => void;
  setAnalysisTab: (tab: any) => void;
}

export const DxfMatchView: React.FC<DxfMatchViewProps> = ({
  inspectMatchesParentId,
  dxfComponents,
  currentMatchedGroups,
  selectedComponentId,
  setSelectedComponentId,
  setHoveredComponentId,
  confirmDeleteComponent,
  updateComponentProperty,
  setInspectComponentId,
  setInspectMatchesParentId,
  setAnalysisTab
}) => {
  const parentComp = dxfComponents.find(c => c.id === inspectMatchesParentId);

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-2 animate-in fade-in">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5">
        <button 
          onClick={() => { setAnalysisTab('components'); setInspectMatchesParentId(null); }} 
          className="p-1 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-lg"
        >
          <ChevronLeft size={14}/>
        </button>
        <h3 className="text-[10px] font-black text-white uppercase truncate">
          {parentComp?.name} <span className="text-slate-500 ml-1">({currentMatchedGroups.length} MATCHES)</span>
        </h3>
      </div>
      <div className="flex-1 min-h-0 space-y-1.5 overflow-y-auto scrollbar-none hide-scrollbar py-0.5">
        {currentMatchedGroups.map(match => (
          <div 
            key={match.id} 
            onClick={() => setSelectedComponentId(match.id)} 
            onMouseEnter={() => setHoveredComponentId(match.id)} 
            onMouseLeave={() => setHoveredComponentId(null)} 
            className={`px-3 py-2 rounded-xl border cursor-pointer transition-all group flex flex-col gap-1.5 ${
              selectedComponentId === match.id 
                ? 'bg-indigo-500/10 border-indigo-500/40 shadow-sm' 
                : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-200 uppercase tracking-tight">{match.name}</span>
              <button 
                onClick={(e) => { e.stopPropagation(); confirmDeleteComponent(match.id); }} 
                className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
              >
                <Trash2 size={12}/>
              </button>
            </div>
            <div className="flex justify-between items-center border-t border-slate-800/40 pt-1.5">
              <span 
                onClick={(e) => { e.stopPropagation(); setInspectComponentId(match.id); setAnalysisTab('detail'); }} 
                className="text-[10px] text-slate-500 font-black hover:text-indigo-400 uppercase transition-colors whitespace-nowrap"
              >
                {match.entityIds.length} ITEMS
              </span>
              <div className="flex gap-1">
                <button 
                  onClick={(e) => { e.stopPropagation(); updateComponentProperty(match.id, 'isWeld', !match.isWeld); }} 
                  className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest ${match.isWeld ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-600'}`}
                >
                  WELD
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); updateComponentProperty(match.id, 'isMark', !match.isMark); }} 
                  className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest ${match.isMark ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-600'}`}
                >
                  MARK
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
