import { useState } from 'react';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  /**
   * 'wide' = horizontal full logo (icon + STEMmantra text) — for sidebar, login
   * 'icon' = just the icon square — for compact places, favicon-ish
   */
  variant?: 'wide' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  white?: boolean;
}

/**
 * Drop your logo at:
 *   public/logo.png       (wide horizontal — icon + STEMmantra text)
 *   public/logo-icon.png  (optional square-only icon)
 */
const wideHeights = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-14',
  xl: 'h-20',
};

const iconSizes = {
  sm: 'w-9 h-9',
  md: 'w-11 h-11',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
};

export default function Logo({
  className,
  variant = 'wide',
  size = 'md',
  white = false,
}: Props) {
  const [errored, setErrored] = useState(false);

  if (variant === 'wide') {
    if (errored) {
      return (
        <div className={cn('flex items-center gap-3', className)}>
          <div
            className={cn(
              'rounded-2xl flex items-center justify-center shadow-lg shrink-0',
              iconSizes[size],
              white
                ? 'bg-white/20 backdrop-blur-sm'
                : 'bg-gradient-to-br from-brand-orange-light to-brand-orange'
            )}
          >
            <Package
              className={cn(
                size === 'sm' && 'w-5 h-5',
                size === 'md' && 'w-6 h-6',
                size === 'lg' && 'w-7 h-7',
                size === 'xl' && 'w-10 h-10',
                'text-white'
              )}
            />
          </div>
          <div>
            <p
              className={cn(
                'font-display font-bold leading-tight',
                size === 'sm' && 'text-base',
                size === 'md' && 'text-lg',
                size === 'lg' && 'text-xl',
                size === 'xl' && 'text-3xl',
                white && 'text-white'
              )}
            >
              STEMmantra
            </p>
            <p
              className={cn(
                'leading-tight',
                size === 'sm' && 'text-[10px]',
                size === 'md' && 'text-xs',
                size === 'lg' && 'text-sm',
                size === 'xl' && 'text-base',
                white ? 'text-white/80' : 'text-brand-choco-soft'
              )}
            >
              A Step Towards Innovation
            </p>
          </div>
        </div>
      );
    }

    return (
      <img
        src="/logo.png"
        alt="STEMmantra — A Step Towards Innovation"
        className={cn(
          'object-contain w-auto',
          wideHeights[size],
          white && 'brightness-0 invert',
          className
        )}
        onError={() => setErrored(true)}
      />
    );
  }

  // Icon-only variant
  if (errored) {
    return (
      <div
        className={cn(
          'rounded-2xl flex items-center justify-center shadow-lg shrink-0',
          iconSizes[size],
          white
            ? 'bg-white/20 backdrop-blur-sm'
            : 'bg-gradient-to-br from-brand-orange-light to-brand-orange',
          className
        )}
      >
        <Package
          className={cn(
            size === 'sm' && 'w-5 h-5',
            size === 'md' && 'w-6 h-6',
            size === 'lg' && 'w-7 h-7',
            size === 'xl' && 'w-10 h-10',
            'text-white'
          )}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-2xl overflow-hidden shrink-0 flex items-center justify-center p-1.5',
        iconSizes[size],
        white ? 'bg-white/20 backdrop-blur-sm' : 'bg-white shadow-lg',
        className
      )}
    >
      <img
        src="/logo-icon.png"
        alt="STEMmantra"
        className="w-full h-full object-contain"
        onError={(e) => {
          // Try logo.png as fallback
          const img = e.currentTarget;
          if (!img.src.endsWith('logo.png')) img.src = '/logo.png';
          else setErrored(true);
        }}
      />
    </div>
  );
}
