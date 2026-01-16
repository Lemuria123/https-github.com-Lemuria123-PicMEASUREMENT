
import React from 'react';
import { Settings, X } from 'lucide-react';
import { Button } from './Button';

interface AiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: {
    resolution: number;
    quality: number;
    threshold: number;
  };
  onSettingsChange: (newSettings: any) => void;
}

export const AiSettingsModal: React.FC<AiSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSettingsChange
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-2xl w-80 space-y-5 relative">
        <button 
          onClick={onClose} 
          className="absolute top-3 right-3 text-slate-500 hover:text-white transition-colors"
        >
          <X size={18}/>
        </button>
        <div className="flex items-center gap-2 text-violet-400 border-b border-slate-800 pb-3">
          <Settings size={20} />
          <h3 className="font-bold text-sm tracking-wide uppercase">AI Search Settings</h3>
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <label>Resolution</label>
              <span className="font-mono text-white">{settings.resolution}px</span>
            </div>
            <input 
              type="range" 
              min="400" 
              max="2000" 
              step="100" 
              value={settings.resolution} 
              onChange={(e) => onSettingsChange({ ...settings, resolution: parseInt(e.target.value) })} 
              className="w-full accent-violet-500" 
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <label>Quality</label>
              <span className="font-mono text-white">{settings.quality}</span>
            </div>
            <input 
              type="range" 
              min="0.1" 
              max="1.0" 
              step="0.1" 
              value={settings.quality} 
              onChange={(e) => onSettingsChange({ ...settings, quality: parseFloat(e.target.value) })} 
              className="w-full accent-violet-500" 
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <label>Similarity Threshold</label>
              <span className="font-mono text-white">{Math.round(settings.threshold * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0.5" 
              max="1.0" 
              step="0.05" 
              value={settings.threshold} 
              onChange={(e) => onSettingsChange({ ...settings, threshold: parseFloat(e.target.value) })} 
              className="w-full accent-violet-500" 
            />
          </div>
        </div>
        <Button variant="primary" className="w-full bg-violet-600" onClick={onClose}>Save & Close</Button>
      </div>
    </div>
  );
};
