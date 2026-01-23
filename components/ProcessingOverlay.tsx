
import React from 'react';
import { Loader2 } from 'lucide-react';

interface ProcessingOverlayProps {
  isVisible: boolean;
  title: string;
  subtitle?: string;
}

export const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({ isVisible, title, subtitle }) => {
  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
      <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
      <p className="text-lg font-bold text-white uppercase tracking-tighter">{title}</p>
      {subtitle && <p className="text-slate-400 text-xs mt-1">{subtitle}</p>}
    </div>
  );
};
