import React, { useEffect, useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Cpu, Zap, Target, FileJson, Loader2 } from 'lucide-react';
import { WeldLogoIcon } from './Icons';

interface LandingPageProps {
  onUpload: () => void;
  // Fix: Added onResume to props interface to match usage in DesignApp.tsx
  onResume?: (fileOrConfig: any) => Promise<void> | void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onUpload, onResume }) => {
  const [heroImage, setHeroImage] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(true);

  useEffect(() => {
    async function generateHero() {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [{
              text: "Cinematic, high-tech industrial photography of a precision laser galvanometer welding system. Dark atmospheric factory setting with bright neon blue laser focus point and subtle amber sparks. 16:9, shallow depth of field, 8k resolution, engineering aesthetic."
            }]
          }
        });

        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
              if (part.inlineData) {
                setHeroImage(`data:image/png;base64,${part.inlineData.data}`);
                break;
              }
            }
        }
      } catch (e) {
        console.warn("Hero image generation failed or quota exceeded. Using fallback aesthetic.", e);
      } finally {
        setLoadingImage(false);
      }
    }
    generateHero();
  }, []);

  const features = [
    { icon: <Cpu className="text-indigo-400 w-5 h-5" />, title: "Smart DXF Parsing", desc: "Auto-detect geometric primitives and classify CAD layers with sub-pixel precision." },
    { icon: <Target className="text-emerald-400 w-5 h-5" />, title: "AI Feature Search", desc: "Proprietary vision models to find similar patterns across large industrial scans." },
    { icon: <Zap className="text-amber-400 w-5 h-5" />, title: "Unified Origin", desc: "Easily align CAD coordinates with real-world image features in one workflow." },
    { icon: <FileJson className="text-violet-400 w-5 h-5" />, title: "Pro Data Export", desc: "Generate standardized CSV reports optimized for PLC and CNC integration." }
  ];

  return (
    <div className="relative min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center overflow-hidden font-sans selection:bg-indigo-500/30">
      
      {/* High-End Background System */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:60px_60px] opacity-[0.15]" />
        
        {/* Subtle animated gradient fallback if hero image fails */}
        <div className={`absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 transition-opacity duration-1000 ${heroImage ? 'opacity-0' : 'opacity-100'}`} />

        {heroImage && (
          <div className="absolute inset-0 overflow-hidden">
            <img 
              src={heroImage} 
              className="w-full h-full object-cover opacity-30 scale-110 animate-[pulse_10s_ease-in-out_infinite]" 
              alt="Hero Background" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-slate-950" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-transparent to-slate-950" />
          </div>
        )}
      </div>

      <div className="relative z-10 max-w-5xl w-full px-8 flex flex-col items-center">
        
        {/* Brand Identity - Focused & Symmetrical */}
        <div className="mb-14 flex flex-col items-center space-y-8 animate-in fade-in slide-in-from-top-12 duration-1000">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative p-1 bg-slate-900 rounded-[22px] border border-slate-800 shadow-2xl">
              <WeldLogoIcon size={80} className="rounded-2xl shadow-inner" />
            </div>
          </div>
          
          <div className="text-center space-y-4">
            <h1 className="text-6xl md:text-7xl font-black text-white tracking-tight flex items-center justify-center gap-4">
              MARK <span className="text-indigo-500 font-serif italic translate-y-[-2px]">&</span> WELD
            </h1>
            <div className="h-1 w-24 bg-gradient-to-r from-transparent via-indigo-500 to-transparent mx-auto rounded-full blur-[0.5px]" />
          </div>
          
          <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto font-medium leading-relaxed tracking-wide text-center">
            Precision industrial vision toolset for 
            <br className="hidden md:block" />
            <span className="text-slate-200"> image measurement </span> 
            and <span className="text-slate-200"> CAD logic analysis</span>.
          </p>
        </div>

        {/* Simplified CTA Button - Perfectly Centered Text */}
        <div className="mb-24 animate-in fade-in zoom-in-95 duration-700 delay-500 flex flex-col items-center space-y-12">
          <button 
            onClick={onUpload}
            className="group relative w-full md:w-[540px] h-28 bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-2xl transition-all duration-300 shadow-[0_30px_70px_-15px_rgba(49,46,129,0.7)] hover:shadow-[0_40px_80px_-10px_rgba(79,70,229,0.8)] hover:-translate-y-2 active:scale-95 border-t border-white/20 overflow-hidden"
          >
            {/* Subtle internal shine */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
            
            <div className="flex items-center justify-center h-full w-full">
              <span className="text-2xl font-black tracking-[0.05em] uppercase">START NEW PROJECT</span>
            </div>
          </button>
          
          {/* Enhanced Footer Labels */}
          <div className="flex items-center gap-10 opacity-95">
            <div className="h-px w-20 bg-gradient-to-r from-transparent via-indigo-500/50 to-indigo-500" />
            <span className="text-lg md:text-xl font-mono font-black uppercase tracking-[0.6em] text-slate-100 drop-shadow-lg flex items-center gap-4">
              Support PNG <span className="text-indigo-500 opacity-50">•</span> JPG <span className="text-indigo-500 opacity-50">•</span> DXF
            </span>
            <div className="h-px w-20 bg-gradient-to-l from-transparent via-indigo-500/50 to-indigo-500" />
          </div>
        </div>

        {/* Features Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-700">
          {features.map((f, i) => (
            <div 
              key={i} 
              className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 p-7 rounded-[24px] text-left hover:border-indigo-500/30 hover:bg-slate-900/60 transition-all duration-500 group relative overflow-hidden"
            >
              <div className="mb-6 p-3 bg-slate-800/50 rounded-xl w-fit group-hover:bg-indigo-500/10 group-hover:scale-110 transition-all duration-500">{f.icon}</div>
              <h3 className="text-white text-base font-bold mb-3 tracking-tight group-hover:text-indigo-400 transition-colors">{f.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">{f.desc}</p>
            </div>
          ))}
        </div>

        {loadingImage && (
          <div className="fixed bottom-10 left-10 flex items-center gap-4 bg-slate-900/90 px-6 py-3 rounded-2xl border border-slate-800 text-[10px] text-indigo-400 font-black uppercase tracking-widest shadow-2xl backdrop-blur-lg animate-pulse">
            <Loader2 size={16} className="animate-spin" />
            Initializing System Framework
          </div>
        )}
      </div>
    </div>
  );
};