import React, { createContext, useContext, useState, useEffect } from 'react';
import { SectorTheme } from '@shared/schema';

// Helper function to convert hex to HSL format for CSS variables
function hexToHsl(hex: string): string | null {
  try {
    // Remove the hash if present
    hex = hex.replace('#', '');
    
    // Convert hex to RGB
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    
    // Convert to the H S% L% format expected by CSS variables
    const hDeg = Math.round(h * 360);
    const sPercent = Math.round(s * 100);
    const lPercent = Math.round(l * 100);
    
    return `${hDeg} ${sPercent}% ${lPercent}%`;
  } catch (error) {
    console.warn('Failed to convert hex to HSL:', hex, error);
    return null;
  }
}

interface SectorThemeContextType {
  currentTheme: SectorTheme | null;
  setCurrentTheme: (theme: SectorTheme | null) => void;
  isThemeLoading: boolean;
  setIsThemeLoading: (loading: boolean) => void;
  clearTheme: () => void;
}

const SectorThemeContext = createContext<SectorThemeContextType | undefined>(undefined);

export const useSectorTheme = () => {
  const context = useContext(SectorThemeContext);
  if (context === undefined) {
    throw new Error('useSectorTheme must be used within a SectorThemeProvider');
  }
  return context;
};

interface SectorThemeProviderProps {
  children: React.ReactNode;
}

export const SectorThemeProvider: React.FC<SectorThemeProviderProps> = ({ children }) => {
  const [currentTheme, setCurrentThemeState] = useState<SectorTheme | null>(null);
  const [isThemeLoading, setIsThemeLoading] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('capera-sector-theme');
    if (savedTheme) {
      try {
        const theme = JSON.parse(savedTheme) as SectorTheme;
        setCurrentThemeState(theme);
        
        // Apply theme colors to CSS variables
        if (theme.primaryColors && theme.primaryColors.length > 0) {
          const root = document.documentElement;
          // Convert hex colors to HSL format that matches the CSS variable system
          const primaryHsl = hexToHsl(theme.primaryColors[0]);
          if (primaryHsl) {
            root.style.setProperty('--primary', primaryHsl);
          }
          if (theme.primaryColors[1]) {
            const accentHsl = hexToHsl(theme.primaryColors[1]);
            if (accentHsl) {
              root.style.setProperty('--accent', accentHsl);
            }
          }
        }
      } catch (error) {
        console.warn('Failed to parse saved theme:', error);
        localStorage.removeItem('capera-sector-theme');
      }
    }
  }, []);

  const setCurrentTheme = (theme: SectorTheme | null) => {
    setCurrentThemeState(theme);
    
    if (theme) {
      // Save to localStorage
      localStorage.setItem('capera-sector-theme', JSON.stringify(theme));
      
      // Apply theme colors to CSS variables
      if (theme.primaryColors && theme.primaryColors.length > 0) {
        const root = document.documentElement;
        // Convert hex colors to HSL format that matches the CSS variable system
        const primaryHsl = hexToHsl(theme.primaryColors[0]);
        if (primaryHsl) {
          root.style.setProperty('--primary', primaryHsl);
        }
        if (theme.primaryColors[1]) {
          const accentHsl = hexToHsl(theme.primaryColors[1]);
          if (accentHsl) {
            root.style.setProperty('--accent', accentHsl);
          }
        }
      }
    } else {
      // Clear from localStorage
      localStorage.removeItem('capera-sector-theme');
      
      // Reset CSS variables to defaults
      const root = document.documentElement;
      root.style.removeProperty('--primary');
      root.style.removeProperty('--accent');
    }
  };

  const clearTheme = () => {
    setCurrentTheme(null);
  };

  const value = {
    currentTheme,
    setCurrentTheme,
    isThemeLoading,
    setIsThemeLoading,
    clearTheme,
  };

  return (
    <SectorThemeContext.Provider value={value}>
      {children}
    </SectorThemeContext.Provider>
  );
};