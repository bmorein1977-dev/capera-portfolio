import { createContext, useContext, useEffect, useState } from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';

interface MousePosition {
  x: number;
  y: number;
}

interface CaperaCursorContextType {
  isLoading: boolean;
  mousePosition: MousePosition;
}

const CaperaCursorContext = createContext<CaperaCursorContextType | undefined>(undefined);

export function CaperaCursorProvider({ children }: { children: React.ReactNode }) {
  const [mousePosition, setMousePosition] = useState<MousePosition>({ x: 0, y: 0 });
  
  // Use TanStack Query's global loading state detection
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const isLoading = isFetching > 0 || isMutating > 0;

  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    if (isLoading) {
      document.addEventListener('mousemove', updateMousePosition);
      document.body.classList.add('capera-cursor');
    } else {
      document.removeEventListener('mousemove', updateMousePosition);
      document.body.classList.remove('capera-cursor');
    }

    return () => {
      document.removeEventListener('mousemove', updateMousePosition);
      document.body.classList.remove('capera-cursor');
    };
  }, [isLoading]);

  return (
    <CaperaCursorContext.Provider value={{ isLoading, mousePosition }}>
      {children}
    </CaperaCursorContext.Provider>
  );
}

export function useCaperaCursorContext() {
  const context = useContext(CaperaCursorContext);
  if (context === undefined) {
    throw new Error('useCaperaCursorContext must be used within a CaperaCursorProvider');
  }
  return context;
}