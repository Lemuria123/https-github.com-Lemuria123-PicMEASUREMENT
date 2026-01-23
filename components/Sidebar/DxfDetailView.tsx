
import React from 'react';
import { ChevronLeft, Trash2, Check, Palette } from 'lucide-react';
import { Button } from '../Button';
import { DxfEntity, DxfComponent } from '../../types';

interface DxfDetailViewProps {
  inspectComponentId: string | null;
  dxfComponents: DxfComponent[];
  currentInspectedEntities: DxfEntity[];
  currentInspectedChildGroups: DxfComponent[];
  selectedComponentId: string | null;
  setSelectedComponentId: (id: string | null) => void;
  setHoveredComponentId: (id: string | null) => void;
  setHoveredEntityId: (id: string | null) => void;
  selectedInsideEntityIds: Set<string>;
  toggleEntityInSelection: (id: string) => void;
  handleRemoveSingleEntity: (id: string) => void;
  handleRemoveChildGroup: (id: string) => void;
  handleMoveSelectionToNewGroup: () => void;
  setInspectComponentId: (id: string | null) => void;
  setAnalysisTab: (tab: any) => void;
  inspectMatchesParentId: string | null;
}

export const DxfDetailView: React.FC<DxfDetailViewProps> = ({
  inspectComponentId,
  dxfComponents,
  currentInspectedEntities,
  currentInspectedChildGroups,
  selectedComponentId,
  setSelectedComponentId,
  setHoveredComponentId,
  setHoveredEntityId,
  selectedInsideEntityIds,
  toggleEntityInSelection,
  handleRemoveSingleEntity,
  handleRemoveChildGroup,
  handleMoveSelectionToNewGroup,
  setInspectComponentId,
  setAnalysisTab,
  inspectMatchesParentId
}) => {
  const inspectedComp = dxfComponents.find(c => c.id === inspectComponentId);
  const totalItems = currentInspectedEntities.length + currentInspectedChildGroups.length;

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-2 animate-in fade-in zoom-in-95">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5">
        <button 
          onClick={() => { 
            if (inspectMatchesParentId) { setAnalysisTab('matches'); setInspectComponentId(null); } 
            else { setAnalysisTab('components'); setInspectComponentId(null); } 
          }} 
          className="p-1 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-lg"
        >
          <ChevronLeft size={14}/>
        </button>
        <div className="flex-1 truncate">
          <h3 className="text-[10px] font-black text-white truncate uppercase tracking-tight">
            {inspectedComp?.name} <span className="text-slate-500 ml-1">({totalItems} ITEMS)</span>
          </h3>
        </div>
      </div>
      <div className="flex-1 min-h-0 bg-slate-950/40 rounded-xl border border-slate-800 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto scrollbar-none hide-scrollbar py-0.5">
          {currentInspectedChildGroups.map((g) => (
            <div 
              key={g.id} 
              className={`flex items-center gap-3 px-3 py-1.5 border-b border-slate-800/30 hover:bg-white/5 cursor-pointer group ${selectedComponentId === g.id ? 'bg-indigo-500/10' : ''}`} 
              onMouseEnter={() => setHoveredComponentId(g.id)} 
              onMouseLeave={() => setHoveredComponentId(null)} 
              onClick={() => setSelectedComponentId(g.id)} 
            >
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
              <div className="flex-1 min-w-0 flex justify-between items-center">
                <span className="text-[10px] font-bold truncate text-slate-200">{g.name}</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleRemoveChildGroup(g.id); }} 
                  className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-500/10 rounded transition-all"
                >
                  <Trash2 size={11}/>
                </button>
              </div>
            </div>
          ))}
          {currentInspectedEntities.map((ent) => {
            const isSel = selectedInsideEntityIds.has(ent.id);
            return (
              <div 
                key={ent.id} 
                className={`flex items-center gap-3 px-3 py-1 border-b border-slate-800/30 hover:bg-white/5 cursor-pointer group ${isSel ? 'bg-emerald-500/5' : ''}`} 
                onClick={() => toggleEntityInSelection(ent.id)} 
                onMouseEnter={() => setHoveredEntityId(ent.id)} 
                onMouseLeave={() => setHoveredEntityId(null)}
              >
                <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 transition-all ${isSel ? 'bg-emerald-500 border-emerald-400' : 'border-slate-700'}`}>
                  {isSel && <Check size={8} className="text-white"/>}
                </div>
                <span className="text-[9px] font-mono text-slate-500 font-black uppercase">{ent.type}</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleRemoveSingleEntity(ent.id); }} 
                  className="ml-auto opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-500/10 rounded"
                >
                  <Trash2 size={11}/>
                </button>
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="h-11 shrink-0 pt-1">
        <Button 
          variant="primary" 
          className={`h-9 w-full transition-all duration-300 ${selectedInsideEntityIds.size === 0 ? 'opacity-30 pointer-events-none grayscale' : 'opacity-100'}`} 
          icon={<Palette size={14}/>} 
          onClick={handleMoveSelectionToNewGroup}
          disabled={selectedInsideEntityIds.size === 0}
        >
          Split Selection
        </Button>
      </div>
    </div>
  );
};
