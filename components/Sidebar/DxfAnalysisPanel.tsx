import React from 'react';
import { Layers, Check, BoxSelect, ChevronLeft, Trash2, Palette, MousePointer2, Grid, Download, Search } from 'lucide-react';
import { Button } from '../Button';
import { DxfComponent, DxfEntity, AppMode, Point } from '../../types';

export interface DxfAnalysisPanelProps {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  setCurrentPoints: (pts: Point[]) => void;
  analysisTab: 'objects' | 'components' | 'detail' | 'matches';
  setAnalysisTab: (tab: any) => void;
  topLevelComponents: DxfComponent[];
  dxfComponents: DxfComponent[];
  dxfEntities: DxfEntity[];
  selectedComponentId: string | null;
  setSelectedComponentId: (id: string | null) => void;
  selectedObjectGroupKey: string | null;
  setSelectedObjectGroupKey: (key: string | null) => void;
  inspectComponentId: string | null;
  setInspectComponentId: (id: string | null) => void;
  inspectMatchesParentId: string | null;
  setInspectMatchesParentId: (id: string | null) => void;
  selectedInsideEntityIds: Set<string>;
  toggleEntityInSelection: (id: string) => void;
  setHoveredEntityId: (id: string | null) => void;
  setHoveredComponentId: (id: string | null) => void;
  setHoveredObjectGroupKey: (key: string | null) => void;
  entitySizeGroups: any[];
  createAutoGroup: (key: string, type: 'weld' | 'mark') => void;
  handleAutoMatch: () => void;
  updateComponentProperty: (id: string, prop: any, val: boolean) => void;
  updateComponentColor: (id: string, color: string) => void;
  deleteComponent: (id: string) => void;
  handleMoveSelectionToNewGroup: () => void;
  handleRemoveSingleEntity: (id: string) => void;
  handleRemoveChildGroup: (id: string) => void;
  currentInspectedEntities: DxfEntity[];
  currentInspectedChildGroups: DxfComponent[];
  currentMatchedGroups: DxfComponent[];
  isProcessing: boolean;
  manualOriginCAD: { x: number; y: number } | null;
  rawDxfData: any;
  exportCSV: () => void;
}

export const DxfAnalysisPanel: React.FC<DxfAnalysisPanelProps> = ({
  mode,
  setMode,
  setCurrentPoints,
  analysisTab,
  setAnalysisTab,
  topLevelComponents,
  dxfComponents,
  dxfEntities,
  selectedComponentId,
  setSelectedComponentId,
  selectedObjectGroupKey,
  setSelectedObjectGroupKey,
  inspectComponentId,
  setInspectComponentId,
  inspectMatchesParentId,
  setInspectMatchesParentId,
  selectedInsideEntityIds,
  toggleEntityInSelection,
  setHoveredEntityId,
  setHoveredComponentId,
  setHoveredObjectGroupKey,
  entitySizeGroups,
  createAutoGroup,
  handleAutoMatch,
  updateComponentProperty,
  updateComponentColor,
  deleteComponent,
  handleMoveSelectionToNewGroup,
  handleRemoveSingleEntity,
  handleRemoveChildGroup,
  currentInspectedEntities,
  currentInspectedChildGroups,
  currentMatchedGroups,
  isProcessing,
  manualOriginCAD,
  rawDxfData,
  exportCSV
}) => {
  if (analysisTab === 'detail' && inspectComponentId) {
    const inspectedComp = dxfComponents.find(c => c.id === inspectComponentId);
    return (
      <div className="space-y-3 animate-in fade-in zoom-in-95">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button onClick={() => { 
              if (inspectMatchesParentId) { setAnalysisTab('matches'); setInspectComponentId(null); } 
              else { setAnalysisTab('components'); setInspectComponentId(null); }
          }} className="p-1 text-slate-500 hover:text-white transition-colors"><ChevronLeft size={16}/></button>
          <div className="flex-1 truncate">
            <h3 className="text-xs font-bold text-white truncate">{inspectedComp?.name}</h3>
            <span className="text-[9px] text-slate-500 uppercase">{(inspectedComp?.childGroupIds?.length || 0) + currentInspectedEntities.length} Total Items</span>
          </div>
        </div>
        <div className="bg-slate-950/40 rounded-lg border border-slate-800 overflow-hidden max-h-[400px] flex flex-col shadow-inner">
          <div className="flex-1 overflow-y-auto scrollbar-none">
            {currentInspectedChildGroups.map((g) => (
              <div 
                key={g.id} 
                className={`flex items-center gap-2 px-3 py-2 border-b border-slate-800/50 hover:bg-white/5 transition-colors cursor-pointer group bg-indigo-500/5 ${selectedComponentId === g.id ? 'bg-white/10 ring-1 ring-white/20' : ''}`}
                onMouseEnter={() => setHoveredComponentId(g.id)}
                onMouseLeave={() => setHoveredComponentId(null)}
                onClick={() => setSelectedComponentId(g.id)} 
              >
                <div className="w-3 h-3 rounded-full flex items-center justify-center shrink-0 shadow-sm" style={{ backgroundColor: g.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className={`text-[10px] font-bold truncate ${selectedComponentId === g.id ? 'text-white' : 'text-indigo-300'}`}>{g.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); handleRemoveChildGroup(g.id); }} className="hidden group-hover:block p-1 text-red-500 hover:bg-red-500/10 rounded transition-all"><Trash2 size={10}/></button>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="text-[8px] text-slate-500 uppercase tracking-tighter">{g.parentGroupId ? 'MATCH' : 'SUB-GROUP'}</div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setInspectComponentId(g.id); }}
                      className="text-[8px] bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white px-1.5 py-0.5 rounded border border-slate-700 transition-colors font-bold uppercase"
                    >
                      {g.entityIds.length} ENTITIES
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {currentInspectedEntities.map((ent) => {
              const isSel = selectedInsideEntityIds.has(ent.id);
              const ox = manualOriginCAD ? manualOriginCAD.x : (rawDxfData?.defaultCenterX || 0);
              const oy = manualOriginCAD ? manualOriginCAD.y : (rawDxfData?.defaultCenterY || 0);
              const cx = (ent.minX + ent.maxX) / 2 - ox;
              const cy = (ent.minY + ent.maxY) / 2 - oy;
              return (
                <div key={ent.id} className={`flex items-center gap-2 px-3 py-2 border-b border-slate-800/50 hover:bg-white/5 transition-colors cursor-pointer group ${isSel ? 'bg-indigo-500/10' : ''}`} onClick={() => toggleEntityInSelection(ent.id)} onMouseEnter={() => setHoveredEntityId(ent.id)} onMouseLeave={() => setHoveredEntityId(null)}>
                  <div className={`w-3 h-3 rounded border flex items-center justify-center transition-all ${isSel ? 'bg-indigo-500 border-indigo-400' : 'border-slate-700'}`}>{isSel && <Check size={8} className="text-white"/>}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center"><span className="text-[10px] font-mono text-slate-300">{ent.type}</span><button onClick={(e) => { e.stopPropagation(); handleRemoveSingleEntity(ent.id); }} className="hidden group-hover:block p-1 text-red-500 hover:bg-red-500/10 rounded transition-all"><Trash2 size={10}/></button></div>
                    <div className="text-[9px] text-slate-500 font-mono truncate">X:{cx.toFixed(2)} Y:{cy.toFixed(2)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {selectedInsideEntityIds.size > 0 && <Button variant="primary" className="h-8 text-[10px] w-full bg-indigo-600/50" icon={<Palette size={12}/>} onClick={handleMoveSelectionToNewGroup}>Split Selected to New Group</Button>}
      </div>
    );
  }

  if (analysisTab === 'matches' && inspectMatchesParentId) {
    return (
      <div className="space-y-3 animate-in fade-in slide-in-from-left-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button onClick={() => { setAnalysisTab('components'); setInspectMatchesParentId(null); }} className="p-1 text-slate-500 hover:text-white transition-colors"><ChevronLeft size={16}/></button>
          <div className="flex-1 truncate"><h3 className="text-xs font-bold text-white truncate">{dxfComponents.find(c => c.id === inspectMatchesParentId)?.name} Matches</h3></div>
        </div>
        <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin">
          {currentMatchedGroups.map(match => (
            <div 
              key={match.id} 
              onClick={() => setSelectedComponentId(match.id)} 
              onMouseEnter={() => setHoveredComponentId(match.id)}
              onMouseLeave={() => setHoveredComponentId(null)}
              className={`p-2 rounded border cursor-pointer transition-all group flex flex-col gap-2 ${selectedComponentId === match.id ? 'bg-indigo-500/10 border-indigo-500/50' : 'bg-slate-800/20 border-slate-800 hover:bg-slate-800/40'}`}
            >
              <div className="flex justify-between items-center">
                <span className={`text-[11px] font-bold ${selectedComponentId === match.id ? 'text-white' : 'text-slate-300'}`}>{match.name}</span>
                <button onClick={(e) => { e.stopPropagation(); deleteComponent(match.id); }} className="opacity-0 group-hover:opacity-100 p-1 text-red-500"><Trash2 size={10}/></button>
              </div>
              <div className="flex justify-between items-center">
                <span onClick={(e) => { e.stopPropagation(); setInspectComponentId(match.id); setAnalysisTab('detail'); }} className="text-[9px] text-slate-500 uppercase font-bold hover:text-white hover:bg-slate-700/50 rounded self-start px-1">{match.entityIds.length} ITEMS</span>
                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); updateComponentProperty(match.id, 'isWeld', !match.isWeld); }} className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${match.isWeld ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-500 hover:bg-slate-600'}`}>WELD</button>
                    <button onClick={(e) => { e.stopPropagation(); updateComponentProperty(match.id, 'isMark', !match.isMark); }} className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${match.isMark ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-500 hover:bg-slate-600'}`}>MARK</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
      <div className="flex items-center justify-between bg-emerald-950/20 p-2 rounded-lg border border-emerald-500/20">
        <div className="flex items-center gap-2"><Layers className="text-emerald-400" size={16} /><span className="text-xs font-bold text-emerald-100">DXF Analysis</span></div>
        <Button variant="ghost" onClick={() => {
          setCurrentPoints([]);
          setMode('measure');
        }} className="h-6 text-[9px] px-2 hover:bg-emerald-500/20">
          <span className="flex items-center gap-1"><Check size={11} strokeWidth={2.5} /><span>DONE</span></span>
        </Button>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-center px-1 border-b border-slate-800 pb-2">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase">Entities</h3>
          <div className="flex gap-1">
            <button onClick={() => { setAnalysisTab('objects'); setSelectedComponentId(null); }} className={`p-1 rounded ${analysisTab === 'objects' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}><BoxSelect size={12}/></button>
            <button onClick={() => { setAnalysisTab('components'); setSelectedObjectGroupKey(null); }} className={`p-1 rounded ${analysisTab === 'components' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}><Layers size={12}/></button>
          </div>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-1 min-h-[200px] border border-slate-800 overflow-y-auto max-h-[350px] scrollbar-thin">
          {analysisTab === 'objects' ? (
            <div className="space-y-1 p-1">
              {entitySizeGroups.map(g => (
                <div 
                  key={g.key} 
                  onClick={() => setSelectedObjectGroupKey(g.key === selectedObjectGroupKey ? null : g.key)} 
                  onMouseEnter={() => setHoveredObjectGroupKey(g.key)}
                  onMouseLeave={() => setHoveredObjectGroupKey(null)}
                  className={`flex justify-between items-center p-2 rounded border cursor-pointer transition-all group/item ${selectedObjectGroupKey === g.key ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-slate-800/30 border-slate-800 hover:border-slate-700'}`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className={`font-mono whitespace-nowrap ${selectedObjectGroupKey === g.key ? 'text-cyan-400' : 'text-slate-400'}`}>
                      {g.label}
                    </span>
                    <span className={`font-bold ${selectedObjectGroupKey === g.key ? 'text-cyan-300' : 'text-emerald-400'}`}>
                      {g.count}
                    </span>
                  </div>
                  <div className="opacity-0 group-hover/item:opacity-100 flex gap-1 transition-all shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); createAutoGroup(g.key, 'weld'); }} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-900/50 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20">WELD</button>
                    <button onClick={(e) => { e.stopPropagation(); createAutoGroup(g.key, 'mark'); }} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-900/50 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20">MARK</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2 p-1">
              {topLevelComponents.length === 0 ? <div className="text-center py-8 opacity-50 flex flex-col items-center gap-2 font-bold"><BoxSelect size={24}/><span className="text-[10px]">NO GROUPS</span></div> : 
                topLevelComponents.map((comp) => {
                  const matchCount = dxfComponents.filter(c => c.parentGroupId === comp.id).length;
                  const isSel = selectedComponentId === comp.id;
                  return (
                    <div 
                      key={comp.id} 
                      onClick={() => setSelectedComponentId(comp.id)} 
                      onMouseEnter={() => setHoveredComponentId(comp.id)}
                      onMouseLeave={() => setHoveredComponentId(null)}
                      className={`p-2 rounded border cursor-pointer flex flex-col gap-2 transition-all ${isSel ? 'bg-indigo-500/10 border-indigo-500/50 ring-1 ring-indigo-500/20 shadow-lg' : 'bg-slate-800/30 border-slate-800 hover:border-slate-600'}`}
                    >
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <input type="color" value={comp.color} onChange={(e) => updateComponentColor(comp.id, e.target.value)} className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent shrink-0" onClick={e => e.stopPropagation()} />
                          <span className={`font-bold truncate ${isSel ? 'text-white' : 'text-slate-400'}`}>{comp.name}</span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); deleteComponent(comp.id); }} className="text-slate-600 hover:text-red-400 shrink-0"><Trash2 size={12}/></button>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-800/50 pt-1">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <span onClick={(e) => { e.stopPropagation(); setInspectComponentId(comp.id); setAnalysisTab('detail'); }} className="text-[9px] text-slate-500 uppercase hover:text-white font-bold shrink-0 px-1 hover:bg-slate-700/50 rounded transition-colors duration-150">{(comp.childGroupIds?.length || 0) + comp.entityIds.length} ITEMS</span>
                          {matchCount > 0 && <span onClick={(e) => { e.stopPropagation(); setInspectMatchesParentId(comp.id); setAnalysisTab('matches'); }} className="text-[9px] text-indigo-400 font-bold hover:text-indigo-300 shrink-0 truncate border-l border-slate-800 pl-1.5 hover:bg-indigo-500/10 rounded">MATCHES ({matchCount})</span>}
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={(e) => { e.stopPropagation(); updateComponentProperty(comp.id, 'isWeld', !comp.isWeld); }} className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${comp.isWeld ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-500 hover:bg-slate-600'}`}>WELD</button>
                          <button onClick={(e) => { e.stopPropagation(); updateComponentProperty(comp.id, 'isMark', !comp.isMark); }} className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${comp.isMark ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-500 hover:bg-slate-600'}`}>MARK</button>
                        </div>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          )}
        </div>
      </div>
      <div className="space-y-2 pt-2 border-t border-slate-800">
        <div className="grid grid-cols-2 gap-2">
          <Button 
            variant={mode === 'box_group' ? 'primary' : 'secondary'} 
            className="h-9 text-[11px]" 
            icon={<MousePointer2 size={14}/>} 
            onClick={() => {
              if (mode === 'box_group') setCurrentPoints([]);
              setMode(mode === 'box_group' ? 'dxf_analysis' : 'box_group');
            }}
          >
            {mode === 'box_group' ? 'Cancel' : 'Select'}
          </Button>
          <Button 
            variant="secondary" 
            className="h-9 text-[11px]" 
            icon={<Search size={14}/>} 
            disabled={!selectedComponentId || isProcessing} 
            onClick={handleAutoMatch}
          >
            Find
          </Button>
        </div>
        <Button 
          variant="secondary" 
          className="w-full h-9 text-[11px] font-bold text-slate-300 hover:text-white border-slate-700/50 shadow-none" 
          icon={<Download size={14}/>} 
          onClick={exportCSV}
        >
          Export CSV
        </Button>
      </div>
    </div>
  );
};