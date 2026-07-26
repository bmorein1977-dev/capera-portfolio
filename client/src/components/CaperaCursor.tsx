import { useCaperaCursorContext } from '@/contexts/CaperaCursorContext';
import { CaperaCrest } from '@/components/icons/CaperaCrest';

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
      <CaperaCrest className="w-full h-full" />
    </div>
  );
}