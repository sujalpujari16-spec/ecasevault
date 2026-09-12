import React from 'react';
import { Shield, Star } from 'lucide-react';

interface EmblemProps {
  className?: string;
  size?: number;
  embossed?: boolean;
  variant?: 'color' | 'dark' | 'gold' | 'silver' | 'stone';
  showBackground?: boolean;
}

export const MaharashtraPoliceEmblem: React.FC<EmblemProps> = ({
  className = '',
  size = 120,
  variant = 'color',
  showBackground = true,
}) => {
  const isGold = variant === 'gold';
  const isDark = variant === 'dark';
  const isSilver = variant === 'silver';
  const isStone = variant === 'stone';

  const primaryNavy = '#092557';
  const strokeColor = isGold ? '#b45309' : isDark ? '#1e293b' : isSilver ? '#475569' : isStone ? '#78716c' : primaryNavy;
  const fill = isGold ? '#ca8a04' : isDark ? '#1e293b' : isSilver ? '#64748b' : isStone ? '#8a8275' : primaryNavy;
  
  const bgFill = showBackground 
    ? (isStone ? '#e5e2da' : isDark ? '#f4f3ee' : '#ffffff')
    : 'transparent';

  return (
    <div 
      className={`relative inline-flex items-center justify-center select-none rounded-full overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: bgFill, border: showBackground ? `2px solid ${strokeColor}` : 'none' }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <Shield 
          size={size * 0.75} 
          color={strokeColor} 
          fill={fill}
          strokeWidth={1.5}
        />
      </div>
      <div className="absolute inset-0 flex items-center justify-center pb-[10%]">
        <Star 
          size={size * 0.35} 
          color="#ffffff" 
          fill="#ffffff"
          strokeWidth={1}
        />
      </div>
    </div>
  );
};
