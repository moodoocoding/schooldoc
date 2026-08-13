import { useEffect, useRef } from 'react';
import { Eraser } from 'lucide-react';

interface SignatureCanvasProps {
  onChange: (dataUrl: string | null) => void;
}

export function SignatureCanvas({ onChange }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const hasInkRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const previous = hasInkRef.current ? canvas.toDataURL('image/png') : null;
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      const context = canvas.getContext('2d');
      if (!context) return;
      context.scale(ratio, ratio);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.lineWidth = 3;
      context.strokeStyle = '#0F172A';
      if (previous) {
        const image = new Image();
        image.onload = () => context.drawImage(image, 0, 0, rect.width, rect.height);
        image.src = previous;
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    lastPointRef.current = getPoint(event);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !lastPointRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const point = getPoint(event);
    context.beginPath();
    context.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPointRef.current = point;
    hasInkRef.current = true;
  };

  const finishDrawing = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    const canvas = canvasRef.current;
    onChange(canvas && hasInkRef.current ? canvas.toDataURL('image/png') : null);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    hasInkRef.current = false;
    onChange(null);
  };

  return (
    <div className="space-y-3">
      <div className="relative h-48 rounded-lg border border-dashed border-[#AAB7C4] bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          className="h-full w-full touch-none cursor-crosshair"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrawing}
          onPointerCancel={finishDrawing}
          aria-label="서명 입력 영역"
          aria-describedby="signature-canvas-help"
        >
          서명을 직접 그리는 입력 영역입니다.
        </canvas>
        <div className="pointer-events-none absolute inset-x-5 top-1/2 border-t border-[#DCE3EA]" />
        <div className="pointer-events-none absolute inset-y-5 left-1/2 border-l border-[#DCE3EA]" />
      </div>
      <button
        type="button"
        onClick={clear}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#DCE3EA] bg-white px-4 text-sm font-semibold text-[#334155] hover:bg-[#F6F8FB]"
      >
        <Eraser className="h-4 w-4" />
        다시 쓰기
      </button>
    </div>
  );
}
