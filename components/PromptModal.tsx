
import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';

interface PromptModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  defaultValue: string;
  onConfirm: (val: string) => void;
  onCancel: () => void;
}

export const PromptModal: React.FC<PromptModalProps> = ({ 
  isOpen, 
  title, 
  description, 
  defaultValue, 
  onConfirm, 
  onCancel 
}) => {
  const [val, setVal] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setVal(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-2xl w-96 space-y-4 animate-in zoom-in-95 fade-in duration-200">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          {description && <p className="text-xs text-slate-400">{description}</p>}
        </div>
        <input 
          ref={inputRef}
          type="text" 
          value={val} 
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.stopPropagation(); onConfirm(val); }
            if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
          }}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 transition-colors"
        />
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" className="flex-1" onClick={() => onConfirm(val)}>Confirm</Button>
        </div>
      </div>
    </div>
  );
};
