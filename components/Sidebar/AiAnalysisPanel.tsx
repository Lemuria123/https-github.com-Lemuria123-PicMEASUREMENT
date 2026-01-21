
import React from 'react';
import { ScanFace, Settings, Check, ChevronLeft, Trash2, Target, Loader2, Search, Download } from 'lucide-react';
import { Button } from '../Button';
import { AiFeatureGroup, AppMode, Point } from '../../types';

export interface AiAnalysisPanelProps {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  setCurrentPoints: (pts: Point[]) => void;
  setShowAiSettings: (show: boolean) => void;
  topLevelAiGroups: AiFeatureGroup[];
  aiFeatureGroups: AiFeatureGroup[];
  selectedAiGroupId: string | null;
  setSelectedAiGroupId: (id: string | null) => void;
  inspectAiMatchesParentId: string | null;
  setInspectAiMatchesParentId: (id: string | null) => void;
  currentMatchedAiGroups: AiFeatureGroup[];
  setHoveredFeatureId: (id: string | null) => void;
  updateAiGroupColor: (id: string, color: string) => void;
  updateAiGroupProperty: (id: string, prop: any, val: boolean) => void;
  deleteAiGroup: (id: string) => void;
  isSearchingFeatures: boolean;
  performFeatureSearch: () => void;
  getLogicCoords: (p: any) => any;
  exportCSV: () => void;
}

export const AiAnalysisPanel: React.FC<AiAnalysisPanelProps> = ({
  mode,
  setMode,
  setCurrentPoints,
  setShowAiSettings,
  topLevelAiGroups,
  aiFeatureGroups,
  selectedAiGroupId,
  setSelectedAiGroupId,
  inspectAiMatchesParentId,
  setInspectAiMatchesParentId,
  currentMatchedAiGroups,
  setHoveredFeatureId,
  updateAiGroupColor,
  updateAiGroupProperty,
  deleteAiGroup,
  isSearchingFeatures,
  performFeatureSearch,
  getLogicCoords,
  exportCSV
}) => {
  if (inspectAiMatchesParentId) {
    const parentGroup = aiFeatureGroups.find(g => g.id === inspectAiMatchesParentId);
    return (
      <div className="space-y-3 animate-in fade-in slide-in-from-left-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button onClick={() => { setInspectAiMatchesParentId(null); setSelectedAiGroupId(null); setHoveredFeatureId(null); }} className="p-1 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-lg"><ChevronLeft size={16}/></button>
          <div className="flex-1 truncate">
            <h3 className="text-[10px] font-black text-white uppercase truncate tracking-tight">
              {parentGroup?.name} <span className="text-slate-500 ml-1">({currentMatchedAiGroups.length} MATCHES)</span>
            </h3>
          </div>
        </div>
        <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
          {currentMatchedAiGroups.map(match => {
            const feat = match.features[0];
            const centerPoint = { x: (feat.minX + feat.maxX) / 2, y: (feat.minY + feat.maxY) / 2 };
            const coords = getLogicCoords(centerPoint);
            return (
              <div key={match.id} onClick={() => setSelectedAiGroupId(match.id)} onMouseEnter={() => setHoveredFeatureId(match.features[0].id)} onMouseLeave={() => setHoveredFeatureId(null)} className={`p-2 rounded border cursor-pointer transition-all group flex flex-col gap-2 ${selectedAiGroupId === match.id ? 'bg-violet-500/10 border-violet-500/50' : 'bg-slate-800/20 border-slate-800 hover:bg-slate-800/40'}`}>
                <div className="flex justify-between items-center"><span className={`text-[10px] font-bold ${selectedAiGroupId === match.id ? 'text-white' : 'text-slate-300'}`}>{match.name}</span><button onClick={(e) => { e.stopPropagation(); deleteAiGroup(match.id); }} className="opacity-0 group-hover:opacity-100 p-1 text-red-500 transition-opacity"><Trash2 size={10}/></button></div>
                <div className="flex justify-between items-center">{coords ? (<div className="flex gap-2 text-[9px] font-mono"><span className="text-violet-300/80 bg-violet-500/10 px-1 rounded">X:{coords.x.toFixed(2)}</span><span className="text-violet-300/80 bg-violet-500/10 px-1 rounded">Y:{coords.y.toFixed(2)}</span></div>) : <span className="text-[8px] text-slate-600 italic font-bold">NO ORIGIN</span>}<div className="flex gap-1.5"><button onClick={(e) => { e.stopPropagation(); updateAiGroupProperty(match.id, 'isWeld', !match.isWeld); }} className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition-colors ${match.isWeld ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-500'}`}>WELD</button><button onClick={(e) => { e.stopPropagation(); updateAiGroupProperty(match.id, 'isMark', !match.isMark); }} className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition-colors ${match.isMark ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-500'}`}>MARK</button></div></div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-in fade-in">
      <div className="flex justify-between items-center px-1 border-b border-slate-800 pb-1.5">
        <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Definitions</h3>
        <button onClick={() => setShowAiSettings(true)} className="text-slate-500 hover:text-violet-400 transition-colors"><Settings size={14} /></button>
      </div>

      <div className="bg-slate-900/80 rounded-lg p-1 min-h-[160px] border border-slate-800 overflow-y-auto max-h-[300px] scrollbar-thin">
        {topLevelAiGroups.length === 0 ? <div className="text-center py-10 opacity-30 flex flex-col items-center gap-1 font-bold text-slate-500"><ScanFace size={20}/><span className="text-[9px] uppercase tracking-widest">No Features Set</span></div> : 
          topLevelAiGroups.map(group => {
            const isSel = selectedAiGroupId === group.id;
            const matchCount = aiFeatureGroups.filter(g => g.parentGroupId === group.id).length;
            const feat = group.features[0];
            const centerPoint = { x: (feat.minX + feat.maxX) / 2, y: (feat.minY + feat.maxY) / 2 };
            const coords = getLogicCoords(centerPoint);
            return (
              <div key={group.id} onClick={() => setSelectedAiGroupId(group.id)} onMouseEnter={() => setHoveredFeatureId(group.features[0].id)} onMouseLeave={() => setHoveredFeatureId(null)} className={`p-2 rounded border cursor-pointer flex flex-col gap-2 transition-all ${isSel ? 'bg-violet-500/10 border-violet-500/50' : 'bg-slate-800/30 border-slate-800 hover:border-slate-600'}`}>
                <div className="flex justify-between items-center gap-2"><div className="flex items-center gap-2 truncate"><input type="color" value={group.color} onChange={(e) => updateAiGroupColor(group.id, e.target.value)} className="w-3 h-3 rounded cursor-pointer border-0 bg-transparent shrink-0" onClick={e => e.stopPropagation()} /><span className={`font-bold text-[10px] truncate ${isSel ? 'text-white' : 'text-slate-400'}`}>{group.name}</span></div><button onClick={(e) => { e.stopPropagation(); deleteAiGroup(group.id); }} className="text-slate-600 hover:text-red-400 shrink-0 p-0.5"><Trash2 size={10}/></button></div>
                {coords && (<div className="flex gap-3 text-[8px] font-mono border-t border-slate-800/30 pt-1.5 opacity-60"><div className="flex gap-1"><span className="text-slate-500 uppercase">X:</span><span className="text-violet-300 font-bold">{coords.x.toFixed(2)}</span></div><div className="flex gap-1"><span className="text-slate-500 uppercase">Y:</span><span className="text-violet-300 font-bold">{coords.y.toFixed(2)}</span></div></div>)}
                <div className="flex justify-between items-center border-t border-slate-800/50 pt-1"><div className="flex items-center gap-1.5">{matchCount > 0 && <span onClick={(e) => { e.stopPropagation(); setInspectAiMatchesParentId(group.id); setSelectedAiGroupId(null); }} className="text-[8px] text-violet-400 font-black hover:text-violet-300 px-1 py-0.5 bg-violet-500/10 rounded border border-violet-500/20 uppercase transition-colors">{matchCount} MATCHES</span>}</div><div className="flex gap-1.5 shrink-0"><button onClick={(e) => { e.stopPropagation(); updateAiGroupProperty(group.id, 'isWeld', !group.isWeld); }} className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition-colors ${group.isWeld ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-500'}`}>WELD</button><button onClick={(e) => { e.stopPropagation(); updateAiGroupProperty(group.id, 'isMark', !group.isMark); }} className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition-colors ${group.isMark ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-500'}`}>MARK</button></div></div>
              </div>
            );
          })
        }
      </div>

      <div className="space-y-2 pt-2 border-t border-slate-800">
        <Button variant={mode === 'feature' ? 'primary' : 'secondary'} className="w-full h-8 text-[9px] bg-violet-600 font-black uppercase tracking-widest" icon={<Target size={12}/>} onClick={() => { if (mode === 'feature') setCurrentPoints([]); setMode(mode === 'feature' ? 'feature_analysis' : 'feature'); }}>{mode === 'feature' ? 'Cancel' : 'Define Area'}</Button>
        <Button variant="secondary" className={`w-full h-9 text-[10px] font-black uppercase tracking-widest ${selectedAiGroupId ? 'bg-violet-600/10 text-violet-400 border-violet-500/30' : 'opacity-60'}`} icon={isSearchingFeatures ? <Loader2 className="animate-spin" size={14}/> : <Search size={14}/>} disabled={!selectedAiGroupId || isSearchingFeatures} onClick={performFeatureSearch}>{isSearchingFeatures ? "Analyzing..." : "Find Similar"}</Button>
        <Button variant="ghost" className="w-full h-8 text-[10px] font-bold text-slate-500 border border-slate-800/50" icon={<Download size={14}/>} onClick={exportCSV}>Export CSV</Button>
      </div>
    </div>
  );
};
