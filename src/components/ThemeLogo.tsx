import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import logoBlack from '@/assets/formanova-logo-black.png';
import logoWhite from '@/assets/formanova-logo-white.png';

const DARK_THEMES = new Set(['dark', 'cyberpunk', 'retro', 'fashion', 'luxury', 'synthwave', 'neon']);

interface ThemeLogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export function ThemeLogo({ className, width = 234, height = 56 }: ThemeLogoProps) {
  const { theme } = useTheme();
  const isDark = DARK_THEMES.has(theme);

  return (
    <img
      src={isDark ? logoWhite : logoBlack}
      alt="FormaNova"
      className={cn('w-auto object-contain', className)}
      width={width}
      height={height}
    />
  );
}
