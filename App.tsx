
import React, { useState } from 'react';
import DesignApp from './apps/design-app/DesignApp';
import { WeldLogoIcon } from './components/Icons';
import { Ruler, Zap, Terminal, ExternalLink } from 'lucide-react';

type ProjectType = 'NONE' | 'DESIGN' | 'WELD';

export default function App() {
  const [activeProject, setActiveProject] = useState<ProjectType>('NONE');

  if (activeProject === 'DESIGN') {
    return (
      <div className="relative h-screen">
        <button 
          onClick={() => setActiveProject('NONE')}
          className="fixed bottom-4 right-4 z-[100] bg-slate-800/80 hover:bg-slate-700 text-slate-300 p-2 rounded-full border border-slate-700 backdrop-blur transition-all"
          title="Back to Gateway"
        >
          <Terminal size={18} />
        </button>
        <DesignApp />
      </div>
    );
  }

  if (activeProject === 'WELD') {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <WeldLogoIcon size={120} className="mb-8 opacity-20" />
        <h2 className="text-2xl font-bold text-white mb-2">Weld Station Debugger</h2>
        <p className="mb-8 text-slate-500">Initializing production environment components...</p>
        <button 
          onClick={() => setActiveProject('NONE')}
          className="px-6 py-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
        >
          Back to Gateway
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#1e293b_0%,transparent_100%)] opacity-20" />
      
      <div className="relative z-10 text-center mb-16 space-y-4">
        <WeldLogoIcon size={80} className="mx-auto mb-6" />
        <h1 className="text-5xl font-black text-white tracking-tighter">MARK & WELD <span className="text-indigo-500">OS</span></h1>
        <p className="text-slate-500 max-w-md mx-auto">Integrated Industrial Vision & Motion Control Suite</p>
      </div>

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl w-full">
        {/* Design App Card */}
        <button 
          onClick={() => setActiveProject('DESIGN')}
          className="group relative bg-slate-900 border border-slate-800 p-8 rounded-3xl text-left hover:border-indigo-500/50 transition-all duration-500 hover:shadow-[0_0_50px_-12px_rgba(79,70,229,0.5)]"
        >
          <div className="mb-6 p-4 bg-indigo-500/10 rounded-2xl w-fit group-hover:scale-110 transition-transform">
            <Ruler className="text-indigo-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Measurement & Design</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            Image calibration, DXF analysis, and AI feature search for precision manufacturing setup.
          </p>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-widest">
            Launch Application <ExternalLink size={14} />
          </div>
        </button>

        {/* Weld App Card */}
        <button 
          onClick={() => setActiveProject('WELD')}
          className="group relative bg-slate-900 border border-slate-800 p-8 rounded-3xl text-left hover:border-emerald-500/50 transition-all duration-500 hover:shadow-[0_0_50px_-12px_rgba(16,185,129,0.5)]"
        >
          <div className="mb-6 p-4 bg-emerald-500/10 rounded-2xl w-fit group-hover:scale-110 transition-transform">
            <Zap className="text-emerald-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Weld Station Debug</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            Production-side motion calibration, laser path simulation, and real-time coordinate validation.
          </p>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-widest">
            Coming Soon <ExternalLink size={14} className="opacity-50" />
          </div>
          {/* Status Badge */}
          <div className="absolute top-6 right-6 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] text-emerald-500 font-bold">
            ALPHA
          </div>
        </button>
      </div>

      <div className="mt-20 text-slate-600 text-[10px] uppercase tracking-widest font-bold">
        Engineered for Industrial Excellence • v2.0-MONO
      </div>
    </div>
  );
}
