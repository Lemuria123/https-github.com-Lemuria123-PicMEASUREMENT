
import React from 'react';
import { BoxSelect, ChevronLeft, Trash2, Palette, MousePointer2, Pentagon, Download, Search, Settings, XCircle, Target, X, Check, Layers } from 'lucide-react';
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
  confirmDeleteComponent: (id: string) => void;
  deleteAllMatches: (parentId: string) => void;
  confirmDeleteAllMatches: (parentId: string) => void;
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
  setShowDxfSettings: (show: boolean) => void;
  dxfSearchROI: Point[];
  setDxfSearchROI: (pts: Point[]) => void;
}

export const DxfAnalysisPanel: React.FC<DxfAnalysisPanelProps> = ({
  mode, setMode, setCurrentPoints, analysisTab, setAnalysisTab, topLevelComponents, dxfComponents, selectedComponentId, setSelectedComponentId, selectedObjectGroupKey, setSelectedObjectGroupKey, inspectComponentId, setInspectComponentId, inspectMatchesParentId, setInspectMatchesParentId, selectedInsideEntityIds, toggleEntityInSelection, setHoveredEntityId, setHoveredComponentId, setHoveredObjectGroupKey, entitySizeGroups, createAutoGroup, handleAutoMatch, updateComponentProperty, updateComponentColor, confirmDeleteComponent, confirmDeleteAllMatches, handleMoveSelectionToNewGroup, handleRemoveSingleEntity, handleRemoveChildGroup, currentInspectedEntities, currentInspectedChildGroups, currentMatchedGroups, isProcessing, manualOriginCAD, rawDxfData, exportCSV, setShowDxfSettings, dxfSearchROI, setDxfSearchROI
}) => {
  if (analysisTab === 'detail' && inspectComponentId) {
    const inspectedComp = dxfComponents.find(c => c.id === inspectComponentId);
    return (
      <div className="flex-1 flex flex-col min-h-0 space-y-2 animate-in fade-in zoom-in-95">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5">
          <button onClick={() => { if (inspectMatchesParentId) { setAnalysisTab('matches'); setInspectComponentId(null); } else { setAnalysisTab('components'); setInspectComponentId(null); } }} className="p-1 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-lg"><ChevronLeft size={14}/></button>
          <div className="flex-1 truncate"><h3 className="text-[10px] font-black text-white truncate uppercase tracking-tight">{inspectedComp?.name}</h3></div>
        </div>
        <div className="flex-1 min-h-0 bg-slate-950/40 rounded-xl border border-slate-800 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto scrollbar-none hide-scrollbar py-0.5">
            {currentInspectedChildGroups.map((g) => (
              <div key={g.id} className={`flex items-center gap-3 px-3 py-1.5 border-b border-slate-800/30 hover:bg-white/5 cursor-pointer group ${selectedComponentId === g.id ? 'bg-indigo-500/10' : ''}`} onMouseEnter={() => setHoveredComponentId(g.id)} onMouseLeave={() => setHoveredComponentId(null)} onClick={() => setSelectedComponentId(g.id)} >
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                <div className="flex-1 min-w-0 flex justify-between items-center"><span className="text-[10px] font-bold truncate text-slate-200">{g.name}</span><button onClick={(e) => { e.stopPropagation(); handleRemoveChildGroup(g.id); }} className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-500/10 rounded transition-all"><Trash2 size={11}/></button></div>
              </div>
            ))}
            {currentInspectedEntities.map((ent) => {
              const isSel = selectedInsideEntityIds.has(ent.id);
              return (
                <div key={ent.id} className={`flex items-center gap-3 px-3 py-1 border-b border-slate-800/30 hover:bg-white/5 cursor-pointer group ${isSel ? 'bg-emerald-500/5' : ''}`} onClick={() => toggleEntityInSelection(ent.id)} onMouseEnter={() => setHoveredEntityId(ent.id)} onMouseLeave={() => setHoveredEntityId(null)}>
                  <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 transition-all ${isSel ? 'bg-emerald-500 border-emerald-400' : 'border-slate-700'}`}>{isSel && <Check size={8} className="text-white"/>}</div>
                  <span className="text-[9px] font-mono text-slate-500 font-black uppercase">{ent.type}</span>
                  <button onClick={(e) => { e.stopPropagation(); handleRemoveSingleEntity(ent.id); }} className="ml-auto opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-500/10 rounded"><Trash2 size={11}/></button>
                </div>
              );
            })}
          </div>
        </div>
        {selectedInsideEntityIds.size > 0 && <Button variant="primary" className="h-9 w-full" icon={<Palette size={14}/>} onClick={handleMoveSelectionToNewGroup}>Split Selection</Button>}
      </div>
    );
  }

  if (analysisTab === 'matches' && inspectMatchesParentId) {
    return (
      <div className="flex-1 flex flex-col min-h-0 space-y-2 animate-in fade-in">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5">
          <button onClick={() => { setAnalysisTab('components'); setInspectMatchesParentId(null); }} className="p-1 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-lg"><ChevronLeft size={14}/></button>
          <h3 className="text-[10px] font-black text-white uppercase truncate">Auto Matches</h3>
        </div>
        <div className="flex-1 min-h-0 space-y-1.5 overflow-y-auto scrollbar-none hide-scrollbar py-0.5">
          {currentMatchedGroups.map(match => (
            <div key={match.id} onClick={() => setSelectedComponentId(match.id)} onMouseEnter={() => setHoveredComponentId(match.id)} onMouseLeave={() => setHoveredComponentId(null)} className={`px-3 py-2 rounded-xl border cursor-pointer transition-all group flex flex-col gap-1.5 ${selectedComponentId === match.id ? 'bg-indigo-500/10 border-indigo-500/40' : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'}`}>
              <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-slate-200 uppercase tracking-tight">{match.name}</span><button onClick={(e) => { e.stopPropagation(); confirmDeleteComponent(match.id); }} className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 size={12}/></button></div>
              <div className="flex justify-between items-center border-t border-slate-800/40 pt-1.5"><span onClick={(e) => { e.stopPropagation(); setInspectComponentId(match.id); setAnalysisTab('detail'); }} className="text-[10px] text-slate-500 font-black hover:text-indigo-400 uppercase transition-colors whitespace-nowrap">{match.entityIds.length} ITEMS</span><div className="flex gap-1"><button onClick={(e) => { e.stopPropagation(); updateComponentProperty(match.id, 'isWeld', !match.isWeld); }} className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest ${match.isWeld ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-600'}`}>WELD</button><button onClick={(e) => { e.stopPropagation(); updateComponentProperty(match.id, 'isMark', !match.isMark); }} className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest ${match.isMark ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-600'}`}>MARK</button></div></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hasSearchROI = dxfSearchROI && dxfSearchROI.length === 2;

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-2.5 animate-in fade-in">
      <div className="flex justify-between items-center bg-slate-900/60 p-0.5 rounded-xl border border-slate-800">
        <button onClick={() => setShowDxfSettings(true)} className="p-1 text-slate-500 hover:text-emerald-400 transition-colors rounded-lg ml-0.5"><Settings size={14} /></button>
        <div className="flex gap-0.5 bg-slate-950 p-0.5 rounded-lg border border-slate-800/50">
          <button onClick={() => { setAnalysisTab('objects'); setSelectedComponentId(null); }} className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${analysisTab === 'objects' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Entities</button>
          <button onClick={() => { setAnalysisTab('components'); setSelectedObjectGroupKey(null); }} className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${analysisTab === 'components' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Groups</button>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-slate-950/20 rounded-xl border border-slate-900/50 overflow-y-auto scrollbar-none hide-scrollbar shadow-inner">
        {analysisTab === 'objects' ? (
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
                    <button onClick={(e) => { e.stopPropagation(); createAutoGroup(g.key, 'weld'); }} className="px-2 py-1 rounded text-[8px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white uppercase transition-all shadow-sm active:scale-95">WELD</button>
                    <button onClick={(e) => { e.stopPropagation(); createAutoGroup(g.key, 'mark'); }} className="px-2 py-1 rounded text-[8px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500 hover:text-white uppercase transition-all shadow-sm active:scale-95">MARK</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1.5 p-1.5">
            {topLevelComponents.length === 0 ? (
              <div className="text-center py-12 opacity-20 flex flex-col items-center gap-2">
                <Layers size={24}/>
                <span className="text-[9px] font-black uppercase tracking-[0.2em]">No Definitions</span>
              </div>
            ) : (
              topLevelComponents.map((comp) => {
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
                      <button onClick={(e) => { e.stopPropagation(); confirmDeleteComponent(comp.id); }} className="text-slate-600 hover:text-red-400 p-1 rounded-lg hover:bg-red-500/10 transition-all"><Trash2 size={12}/></button>
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-800/60 pt-1.5">
                      <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
                        <span onClick={(e) => { e.stopPropagation(); setInspectComponentId(comp.id); setAnalysisTab('detail'); }} className="text-[10px] text-slate-500 font-black hover:text-slate-200 uppercase transition-colors whitespace-nowrap">{(comp.childGroupIds?.length || 0) + comp.entityIds.length} ITM</span>
                        {matchCount > 0 && (
                          <div className="flex items-center gap-1.5 bg-indigo-500/5 border border-indigo-500/20 rounded-lg px-1.5 py-0.5">
                            <span onClick={(e) => { e.stopPropagation(); setInspectMatchesParentId(comp.id); setAnalysisTab('matches'); }} className="text-[9px] text-indigo-400 font-black uppercase cursor-pointer hover:text-indigo-300">MCH:{matchCount}</span>
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
              })
            }
          </div>
        )}
      </div>

      <div className="space-y-2 shrink-0 pt-1">
        <div className="grid grid-cols-2 gap-2">
          <Button variant={mode === 'box_rect' ? 'primary' : 'secondary'} className="h-9" icon={<MousePointer2 size={13}/>} onClick={() => { if (mode === 'box_rect') setCurrentPoints([]); setMode(mode === 'box_rect' ? 'dxf_analysis' : 'box_rect'); }}>{mode === 'box_rect' ? 'CANCEL' : 'RECT'}</Button>
          <Button variant={mode === 'box_poly' ? 'primary' : 'secondary'} className="h-9" icon={<Pentagon size={13}/>} onClick={() => { if (mode === 'box_poly') setCurrentPoints([]); setMode(mode === 'box_poly' ? 'dxf_analysis' : 'box_poly'); }}>{mode === 'box_poly' ? 'CANCEL' : 'POLY'}</Button>
        </div>
        
        <div className="flex gap-2 items-stretch">
          <Button variant="secondary" className={`flex-1 h-10 ${selectedComponentId ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20' : 'opacity-40'}`} icon={<Search size={14} className={isProcessing ? "animate-spin" : ""}/>} disabled={!selectedComponentId || isProcessing} onClick={handleAutoMatch}>{isProcessing ? "FINDING..." : "FIND"}</Button>
          <Button variant={mode === 'box_find_roi' ? 'primary' : (hasSearchROI ? 'primary' : 'secondary')} className={`w-12 h-10 shrink-0 ${hasSearchROI && mode !== 'box_find_roi' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : ''}`} onClick={() => { if (mode === 'box_find_roi') { setCurrentPoints([]); setMode('dxf_analysis'); } else if (hasSearchROI) { setDxfSearchROI([]); } else { setMode('box_find_roi'); } }}>{hasSearchROI && mode !== 'box_find_roi' ? <X size={16}/> : <Target size={16}/>}</Button>
        </div>

        <Button variant="ghost" className="w-full h-9 text-slate-600 border border-slate-900/50 hover:text-slate-300" icon={<Download size={13}/>} onClick={exportCSV}>EXPORT CSV</Button>
      </div>
    </div>
  );
};
