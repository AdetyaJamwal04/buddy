import React from 'react';
import { cn } from './Button';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'pr' | 'outline' | 'muted';
}

export const Badge: React.FC<BadgeProps> = ({ 
  className, 
  variant = 'default', 
  ...props 
}) => {
  const variants = {
    default: 'bg-[#1F242E] text-[#D1D5DB] border border-[#2E3544]',
    success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    pr: 'bg-amber-400/20 text-amber-300 border border-amber-400/40 font-semibold tracking-wide',
    outline: 'bg-transparent text-[#9CA3AF] border border-[#374151]',
    muted: 'bg-[#15181F] text-[#9CA3AF] border border-transparent',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium leading-normal select-none',
        variants[variant],
        className
      )}
      {...props}
    />
  );
};
