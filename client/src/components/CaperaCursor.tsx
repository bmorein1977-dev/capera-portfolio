import { useCaperaCursorContext } from '@/contexts/CaperaCursorContext';
import caperaGraphic from '@assets/Capera graphic_1758717285658.png';

export function CaperaCursor() {
  const { isLoading, mousePosition } = useCaperaCursorContext();

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
        className="w-full h-full object-contain capera-spin-clockwise"
        draggable={false}
      />
    </div>
  );
}