"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Eraser } from "lucide-react";

export type SignaturePadHandle = {
  isEmpty: () => boolean;
  toPngFile: (fileName: string) => Promise<File | null>;
};

type Props = {
  onChange?: (hasStroke: boolean) => void;
};

/**
 * Firma dibujada a mano sobre un <canvas>. Usa pointer events (unifica mouse, dedo y
 * lápiz) y touch-action:none para que trazar no haga scroll de la página en celular.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad({ onChange }, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);

  useImperativeHandle(ref, () => ({
    isEmpty: () => !hasStroke,
    async toPngFile(fileName: string) {
      const canvas = canvasRef.current;
      if (!canvas || !hasStroke) return null;
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return null;
      return new File([blob], fileName, { type: "image/png" });
    },
  }));

  function getContext() {
    const canvas = canvasRef.current;
    return canvas?.getContext("2d") ?? null;
  }

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = getContext();
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const { x, y } = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = getContext();
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasStroke) {
      setHasStroke(true);
      onChange?.(true);
    }
  }

  function handlePointerUp() {
    drawingRef.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = getContext();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
    onChange?.(false);
  }

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-slate-200 bg-white">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="h-40 w-full touch-none rounded-md"
          style={{ touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-center text-xs font-medium text-slate-500">Gerente de Sucursal</p>
        <button
          type="button"
          onClick={clear}
          disabled={!hasStroke}
          className="flex items-center gap-1 text-xs text-slate-500 underline disabled:opacity-40"
        >
          <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
          Borrar firma
        </button>
      </div>
    </div>
  );
});
