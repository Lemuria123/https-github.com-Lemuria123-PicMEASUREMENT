
// Fix: Added React to imports to resolve 'Cannot find namespace React'
import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import { UNIT_CONVERSIONS } from '../constants';

interface PromptModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  defaultValue: string;
  defaultUnit?: string;
  showUnitSelector?: boolean;
  hideInput?: boolean; // New: Option to hide the input for simple confirmation
  onConfirm: (val: string, unit?: string) => void;
  onCancel: () => void;
}

export const PromptModal: React.FC<PromptModalProps> = ({ 
  isOpen, 
  title, 
  description, 
  defaultValue, 
  defaultUnit = 'mm',
  showUnitSelector = false,
  hideInput = false,
  onConfirm, 
  onCancel 
}) => {
  const [val, setVal] = useState(defaultValue);
  const [unit, setUnit] = useState(defaultUnit);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setVal(defaultValue);
      setUnit(defaultUnit);
      if (!hideInput) {
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    }
  }, [isOpen, defaultValue, defaultUnit, hideInput]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(val, showUnitSelector ? unit : undefined);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-2xl w-96 space-y-4 animate-in zoom-in-95 fade-in duration-200">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          {description && <p className="text-xs text-slate-400 leading-relaxed">{description}</p>}
        </div>
        
        {!hideInput && (
          <div className="flex gap-2">
            <input 
              ref={inputRef}
              type="text" 
              value={val} 
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.stopPropagation(); handleConfirm(); }
                if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
              }}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 transition-colors"
              placeholder="Enter value..."
            />
            {showUnitSelector && (
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 transition-colors cursor-pointer"
              >
                {Object.keys(UNIT_CONVERSIONS).map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" className="flex-1" onClick={handleConfirm}>
            {hideInput ? 'Confirm' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
};
