import React from 'react';
import { cn } from './Button';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, elevated = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl transition-all duration-150',
          elevated 
            ? 'bg-[#181C23] border border-[#2B313E] shadow-lg shadow-black/40' 
            : 'bg-[#14171D] border border-[#222733]',
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = 'Card';
