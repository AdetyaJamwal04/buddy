import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'accent';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] select-none';

    const variants = {
      primary: 'bg-emerald-500 text-black hover:bg-emerald-400 font-semibold shadow-sm',
      secondary: 'bg-[#1C2028] text-[#F3F4F6] hover:bg-[#252B36] border border-[#282D37]',
      outline: 'bg-transparent text-[#F3F4F6] border border-[#333A48] hover:bg-[#1C2028]',
      ghost: 'bg-transparent text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#1C2028]',
      destructive: 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25',
      accent: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 font-semibold',
    };

    const sizes = {
      sm: 'h-9 px-3 text-xs gap-1.5',
      md: 'h-11 px-4 text-sm gap-2',
      lg: 'h-13 px-6 text-base font-semibold gap-2.5',
      icon: 'h-11 w-11 p-0 shrink-0',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
