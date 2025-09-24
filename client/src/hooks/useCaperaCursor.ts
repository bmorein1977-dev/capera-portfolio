import { useEffect, useState } from 'react';

interface MousePosition {
  x: number;
  y: number;
}

export function useCaperaCursor() {
  const [isLoading, setIsLoading] = useState(false);
  const [mousePosition, setMousePosition] = useState<MousePosition>({ x: 0, y: 0 });

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

  const showLoadingCursor = () => setIsLoading(true);
  const hideLoadingCursor = () => setIsLoading(false);

  return {
    isLoading,
    mousePosition,
    showLoadingCursor,
    hideLoadingCursor,
  };
}