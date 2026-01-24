
import React, { useState, useEffect, useRef } from 'react';
import { Check, Save, RefreshCw, ChevronDown, ChevronRight, Scale, Ruler, Layers, ScanFace, Database, Eye, EyeOff, Rows, Pentagon, Spline, Crosshair, Loader2, Zap, Download } from 'lucide-react';
import { Button } from '../Button';
import { MeasurementToolsPanelProps } from './MeasurementToolsPanel';
import { DxfAnalysisPanel, DxfAnalysisPanelProps } from './DxfAnalysisPanel';
import { AiAnalysisPanel, AiAnalysisPanelProps } from './AiAnalysisPanel';
import { WeldSequencePanel } from './WeldSequencePanel';
import { AppMode, CalibrationData } from '../../types';
import { WeldLogoIcon } from '../Icons';

export interface SidebarProps extends 
  MeasurementToolsPanelProps, 
  DxfAnalysisPanelProps, 
  AiAnalysisPanelProps {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  resetApp: () => void;
  canFinish: boolean;
  finishShape: () => void;
  saveProject: () => void;
  loadProject: (file: File) => void;
  // Weld Sequence props
  hoveredSequenceNum: number | null;
  setHoveredSequenceNum: (n: number | null) => void;
  selectedWeldPointId: string | null;
  setSelectedWeldPointId: (id: string | null) => void;
  setMatchStatus: (status: any) => void;
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  showVisibility?: boolean;
  isVisible?: boolean;
  onToggleVisibility?: () => void;
  accent?: string;
}

const Section: React.FC<SectionProps> = ({ title, icon, isOpen, onToggle, children, showVisibility, isVisible, onToggleVisibility, accent }) => (
  <div className={`flex flex-col transition-all duration-300 ${isOpen ? 'flex-1 min-h-0' : 'flex-initial border-b border-slate-900'}`}>
    <div className={`flex items-center px-4 py-2.5 hover:bg-white/5 transition-colors cursor-pointer group ${isOpen ? `bg-slate-900/40 border-l-2 ${accent || 'border-indigo-500'}` : 'border-l-2 border-transparent'}`} onClick={onToggle}>
      <span className={`shrink-0 ${isOpen ? (accent ? 'text-emerald-400' : 'text-indigo-400') : 'text-slate-500'}`}>{icon}</span>
      <span className={`ml-3 text-[11px] font-black uppercase tracking-widest leading-none flex-1 truncate min-w-0 ${isOpen ? 'text-white' : 'text-slate-400'}`}>
        {title}
      </span>
      {showVisibility && (
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleVisibility?.(); }} 
          className="shrink-0 text-slate-500 hover:text-indigo-400 transition-colors p-1 mx-2"
        >
          {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      )}
      {isOpen ? <ChevronDown size={14} className="text-slate-700 shrink-0" /> : <ChevronRight size={14} className="text-slate-700 shrink-0" />}
    </div>
    {isOpen && (
      <div className="flex-1 min-h-0 px-4 pt-3 pb-4 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-1 duration-300">
        {children}
      </div>
    )}
  </div>
);

export const Sidebar: React.FC<SidebarProps> = (props) => {
  const { 
    mode, setMode, resetApp, canFinish, finishShape, saveProject, loadProject, exportCSV,
    calibrationData, showCalibration, setShowCalibration, showMeasurements, setShowMeasurements,
    hasRawDxfData, hasImageSrc, hoveredSequenceNum, setHoveredSequenceNum, selectedWeldPointId, setSelectedWeldPointId,
    dxfComponents, updateComponentProperty, setMatchStatus, setHoveredComponentId
  } = props;
  
  const reloadInputRef = useRef<HTMLInputElement>(null);
  const [activeSection, setActiveSection] = useState<string | null>('tools');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && canFinish) {
        e.preventDefault();
        finishShape();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canFinish, finishShape]);

  useEffect(() => {
    if (mode === 'calibrate') setActiveSection('calibration');
    else if (mode === 'weld_sequence') setActiveSection('weld_sequence');
    else if (['dxf_analysis', 'box_rect', 'box_poly', 'box_find_roi', 'manual_weld'].includes(mode)) setActiveSection('dxf');
    else if (['feature_analysis', 'feature'].includes(mode)) setActiveSection('ai');
    else if (['measure', 'parallel', 'area', 'curve', 'origin'].includes(mode)) setActiveSection('tools');
  }, [mode]);

  const toggleSection = (id: string) => setActiveSection(prev => prev === id ? null : id);

  return (
    <div className="w-full md:w-[340px] bg-slate-950 border-r border-slate-900 flex flex-col z-10 shadow-2xl overflow-hidden shrink-0 h-full text-slate-200">
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      
      <div className="px-5 py-4 border-b border-slate-900 flex items-center justify-between bg-slate-900/30 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2.5">
          <WeldLogoIcon className="text-indigo-500" size={20}/>
          <span className="font-black text-[12px] text-white tracking-tighter uppercase leading-none">Mark & Weld</span>
        </div>
        <button onClick={resetApp} className="text-[9px] text-slate-500 hover:text-red-400 font-bold uppercase transition-colors">Reset</button>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden hide-scrollbar">
        <Section 
          title="Calibration" 
          icon={<Scale size={15} />} 
          isOpen={activeSection === 'calibration'}
          onToggle={() => toggleSection('calibration')}
          showVisibility={true}
          isVisible={showCalibration}
          onToggleVisibility={() => setShowCalibration(!showCalibration)}
        >
          <div className="space-y-3">
            <div className={`p-3 rounded-xl border border-slate-800 bg-slate-900/60 transition-all ${calibrationData ? 'ring-1 ring-emerald-500/10' : ''}`}>
              {calibrationData ? (
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Active Scale</span>
                    <span className="font-mono text-emerald-400 text-base font-black leading-none">{calibrationData.realWorldDistance.toFixed(2)} <span className="text-[10px] text-slate-600 ml-0.5">{calibrationData.unit}</span></span>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                </div>
              ) : (
                <div className="py-1 text-[10px] text-slate-600 italic font-medium leading-relaxed">No calibration set.</div>
              )}
            </div>
            <Button variant="secondary" active={mode === 'calibrate'} onClick={() => setMode('calibrate')} className="w-full h-10" icon={<Scale size={14}/>}>Manual Calibrate</Button>
          </div>
        </Section>

        <Section 
          title="Measurement" 
          icon={<Ruler size={15} />} 
          isOpen={activeSection === 'tools'}
          onToggle={() => toggleSection('tools')}
          showVisibility={true}
          isVisible={showMeasurements}
          onToggleVisibility={() => setShowMeasurements(!showMeasurements)}
        >
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="secondary" className="h-10" active={mode === 'measure'} onClick={() => setMode('measure')} disabled={!calibrationData} icon={<Ruler size={14} />}>Distance</Button>
            <Button variant="secondary" className="h-10" active={mode === 'parallel'} onClick={() => setMode('parallel')} disabled={!calibrationData} icon={<Rows size={14} className="rotate-90" />}>Parallel</Button>
            <Button variant="secondary" className="h-10" active={mode === 'area'} onClick={() => setMode('area')} disabled={!calibrationData} icon={<Pentagon size={14} />}>Area</Button>
            <Button variant="secondary" className="h-10" active={mode === 'curve'} onClick={() => setMode('curve')} disabled={!calibrationData} icon={<Spline size={14} />}>Curve</Button>
            <Button variant="secondary" active={mode === 'origin'} onClick={() => setMode('origin')} disabled={!calibrationData && !hasRawDxfData} className="h-10 w-full col-span-2" icon={<Crosshair size={14}/>}>Set Origin</Button>
          </div>
        </Section>

        {hasRawDxfData && (
          <>
            <Section 
              title="DXF Analysis" 
              icon={<Layers size={15} />} 
              isOpen={activeSection === 'dxf'}
              onToggle={() => {
                  toggleSection('dxf');
                  if (activeSection !== 'dxf') setMode('dxf_analysis');
              }}
            >
              <DxfAnalysisPanel {...props} />
            </Section>

            <Section 
              title="Weld Sequence" 
              icon={<Zap size={15} />} 
              isOpen={activeSection === 'weld_sequence'}
              accent="border-emerald-500"
              onToggle={() => {
                  toggleSection('weld_sequence');
                  if (activeSection !== 'weld_sequence') setMode('weld_sequence');
              }}
            >
              <WeldSequencePanel 
                dxfComponents={dxfComponents}
                updateComponentProperty={updateComponentProperty}
                selectedWeldPointId={selectedWeldPointId}
                setSelectedWeldPointId={setSelectedWeldPointId}
                hoveredSequenceNum={hoveredSequenceNum}
                setHoveredSequenceNum={setHoveredSequenceNum}
                setHoveredComponentId={setHoveredComponentId}
                setMatchStatus={setMatchStatus}
              />
            </Section>
          </>
        )}

        {hasImageSrc && !hasRawDxfData && (
          <Section 
            title="AI Feature" 
            icon={<ScanFace size={15} />} 
            isOpen={activeSection === 'ai'}
            onToggle={() => {
                toggleSection('ai');
                if (activeSection !== 'ai') setMode('feature_analysis');
            }}
          >
            <AiAnalysisPanel {...props} />
          </Section>
        )}

        <Section 
          title="Project Data" 
          icon={<Database size={15} />} 
          isOpen={activeSection === 'system'}
          onToggle={() => toggleSection('system')}
        >
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="secondary" className="h-10" icon={<Save size={14}/>} onClick={saveProject}>SAVE</Button>
              <Button variant="secondary" className="h-10" icon={<RefreshCw size={14}/>} onClick={() => reloadInputRef.current?.click()}>RELOAD</Button>
            </div>
            <Button variant="primary" className="h-11 w-full bg-emerald-600 hover:bg-emerald-500 font-black tracking-[0.1em]" icon={<Download size={16}/>} onClick={exportCSV}>EXPORT CSV DATA</Button>
            <input type="file" ref={reloadInputRef} accept=".json" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) loadProject(file); e.target.value = ''; }} />
          </div>
        </Section>
      </div>

      <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
        <button 
          disabled={!canFinish}
          onClick={finishShape} 
          className={`
            relative group h-11 w-full flex items-center justify-center gap-2.5 rounded-xl font-black text-[12px] uppercase tracking-[0.15em] transition-all duration-300
            ${canFinish 
              ? 'bg-emerald-600 text-white shadow-md border border-emerald-400/40 hover:bg-emerald-500 active:translate-y-0.5' 
              : 'bg-slate-800/40 text-slate-600 border border-slate-800 cursor-not-allowed opacity-60'
            }
          `}
        >
          {canFinish ? (
            <>
              <Check size={18} strokeWidth={3} className="animate-in zoom-in duration-300" />
              <span>Confirm (Enter)</span>
              <div className="absolute inset-0 overflow-hidden rounded-xl">
                <div className="absolute top-0 -left-[100%] h-full w-[50%] bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[25deg] group-hover:left-[100%] transition-all duration-700" />
              </div>
            </>
          ) : (
            <>
              <Loader2 size={14} className="text-slate-700 animate-spin-slow" />
              <span className="tracking-widest">Waiting for input...</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
