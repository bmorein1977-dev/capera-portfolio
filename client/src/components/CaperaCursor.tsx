import { useCaperaCursor } from '@/hooks/useCaperaCursor';
import caperaGraphic from '@assets/Capera graphic_1758717285658.png';

export function CaperaCursor() {
  const { isLoading, mousePosition } = useCaperaCursor();

  if (!isLoading) return null;

  return (
    <div
      className="capera-cursor-spinner"
      style={{
        left: mousePosition.x,
        top: mousePosition.y,
      }}
    >
      <img 
        src={caperaGraphic} 
        alt="Loading" 
        className="w-full h-full object-contain"
        draggable={false}
      />
    </div>
  );
}

// Export the hook for use in other components
export { useCaperaCursor };