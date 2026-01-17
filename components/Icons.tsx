
import React from 'react';

export const WeldLogoIcon: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = "" }) => {
  const laserDuration = 1.25; // 1.25 seconds per loop
  const durStr = `${laserDuration}s`;
  
  // Particle Configuration
  const numParticles = 10;
  const totalTailDelay = 0.18; // Increased from 0.12 (50% more length)
  const step = totalTailDelay / numParticles;

  // We generate an array for the 10 particles
  const particles = Array.from({ length: numParticles }, (_, i) => {
    const index = i + 1;
    const delay = index * step;
    
    // Calculate radius to go from 0.5 (head) to 0.2 (tail) for a slimmer profile
    // Formula: start - (i * (total_reduction / (count - 1)))
    const radius = (0.5 - (i * (0.3 / (numParticles - 1)))).toFixed(2);
    
    return {
      id: index,
      // Particles must follow BEHIND: begin = -(duration - delay)
      begin: `-${(laserDuration - delay).toFixed(3)}s`,
      radius,
      // Opacity fades from 0.7 to 0.05
      opacity: (0.7 - (i * 0.065)).toFixed(2),
      // Color shifts from bright yellow to amber
      color: i < 4 ? "#fef08a" : i < 7 ? "#fcd34d" : "#fbbf24"
    };
  });

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 48 48" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      <defs>
        {/* Intense Glow Filter for the laser focal point */}
        <filter id="laserGlow" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* The Infinity Path definition */}
        <path 
          id="infinityPath" 
          d="M24 24C18 16 10 16 10 24C10 32 18 32 24 24C30 16 38 16 38 24C38 32 30 32 24 24Z" 
        />
      </defs>

      {/* 1. Outer Frame (Measurement ROI) */}
      <g className="text-slate-700">
        <path d="M10 4H4V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M38 4H44V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 44H4V38" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M38 44H44V38" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* 2. Galvanometer Field (The Scanning Area) - High contrast dark background */}
      <circle cx="24" cy="24" r="19" fill="#020617" stroke="#1e293b" strokeWidth="1" />
      
      {/* 3. Subtle Reference Trace */}
      <use href="#infinityPath" stroke="#0f172a" strokeWidth="0.5" fill="none" />

      {/* 4. Smooth 10-Particle Yellow Tail */}
      {particles.map((p) => (
        <circle key={p.id} r={p.radius} fill={p.color} opacity={p.opacity}>
          <animateMotion dur={durStr} repeatCount="indefinite" rotate="auto" begin={p.begin}>
            <mpath href="#infinityPath" />
          </animateMotion>
        </circle>
      ))}

      {/* 5. The Active Laser Focal Point (Red Dot) */}
      <circle r="1.1" fill="#ef4444" filter="url(#laserGlow)">
        <animateMotion dur={durStr} repeatCount="indefinite" rotate="auto">
          <mpath href="#infinityPath" />
        </animateMotion>
        <animate 
          attributeName="opacity" 
          values="0.9;1;0.9" 
          dur="0.15s" 
          repeatCount="indefinite" 
        />
      </circle>
      
      {/* High-intensity White Core */}
      <circle r="0.4" fill="white">
        <animateMotion dur={durStr} repeatCount="indefinite" rotate="auto">
          <mpath href="#infinityPath" />
        </animateMotion>
      </circle>
    </svg>
  );
};
