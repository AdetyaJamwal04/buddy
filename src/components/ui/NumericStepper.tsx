import React, { useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from './Button';
import { sound } from '../../utils/audio';

interface NumericStepperProps {
  value: number;
  onChange: (val: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unitLabel?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const NumericStepper: React.FC<NumericStepperProps> = ({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
  unitLabel,
  disabled = false,
  size = 'md',
  className,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  const timerRef = useRef<number | null>(null);
  const valueRef = useRef(value);

  // Keep valueRef updated with latest prop value
  valueRef.current = value;

  const handleStep = (delta: number) => {
    if (disabled) return;
    sound.triggerHaptic([10]);
    const current = valueRef.current;
    const next = Math.max(min, Math.min(max, Math.round((current + delta) * 10) / 10));
    valueRef.current = next;
    onChange(next);
  };

  const startHold = (delta: number) => {
    handleStep(delta);
    timerRef.current = window.setTimeout(() => {
      const interval = window.setInterval(() => {
        handleStep(delta);
      }, 120);
      timerRef.current = interval;
    }, 350);
  };

  const stopHold = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, Math.round(parsed * 10) / 10));
      onChange(clamped);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputBlur();
    }
  };

  const sizeStyles = {
    sm: {
      btn: 'w-7 h-7 rounded-md text-xs',
      text: 'text-xs min-w-[3rem]',
      height: 'h-8',
    },
    md: {
      btn: 'w-9 h-9 rounded-lg text-sm',
      text: 'text-sm min-w-[3.75rem]',
      height: 'h-10',
    },
    lg: {
      btn: 'w-11 h-11 rounded-xl text-base',
      text: 'text-base min-w-[4.5rem]',
      height: 'h-12',
    },
  }[size];

  return (
    <div className={cn('inline-flex items-center bg-[#0F1217] border border-[#232834] rounded-xl p-0.5 select-none', sizeStyles.height, className)}>
      <button
        type="button"
        onPointerDown={() => startHold(-step)}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        disabled={disabled || value <= min}
        className={cn(
          'flex items-center justify-center text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#1E232E] active:bg-[#262D3B] disabled:opacity-30 disabled:pointer-events-none transition-colors touch-manipulation',
          sizeStyles.btn
        )}
        aria-label="Decrease value"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>

      <div className={cn('flex items-center justify-center px-1 text-center font-numeric font-semibold text-[#F3F4F6]', sizeStyles.text)}>
        {isEditing ? (
          <input
            type="number"
            inputMode="decimal"
            step={step}
            value={editValue}
            autoFocus
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-center text-[#F3F4F6] focus:outline-none p-0"
          />
        ) : (
          <span 
            onClick={() => {
              if (!disabled) {
                setEditValue(value.toString());
                setIsEditing(true);
              }
            }}
            className="cursor-pointer hover:text-emerald-400 transition-colors py-1"
          >
            {value}
            {unitLabel && <span className="text-[10px] text-[#9CA3AF] font-normal ml-0.5">{unitLabel}</span>}
          </span>
        )}
      </div>

      <button
        type="button"
        onPointerDown={() => startHold(step)}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        disabled={disabled || value >= max}
        className={cn(
          'flex items-center justify-center text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#1E232E] active:bg-[#262D3B] disabled:opacity-30 disabled:pointer-events-none transition-colors touch-manipulation',
          sizeStyles.btn
        )}
        aria-label="Increase value"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
