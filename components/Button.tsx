
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: React.ReactNode;
  active?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  icon, 
  className = '', 
  active = false,
  ...props 
}) => {
  // 恢复为 11px 的标准工业字体
  const baseStyles = "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-black text-[11px] uppercase tracking-widest transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap overflow-hidden leading-none";
  
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm border border-indigo-400/20",
    secondary: "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shadow-sm",
    danger: "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30",
    ghost: "bg-transparent hover:bg-white/5 text-slate-400 hover:text-white"
  };

  const activeStyle = active ? "ring-1 ring-indigo-400/50 bg-indigo-500/10 border-indigo-500/40 text-indigo-300" : "";

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${activeStyle} ${className}`}
      {...props}
    >
      {icon && <span className="flex items-center justify-center shrink-0">{icon}</span>}
      <span className="flex items-center">{children}</span>
    </button>
  );
};
