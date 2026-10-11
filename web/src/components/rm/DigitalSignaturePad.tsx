"use client";

import { useRef, useState, useEffect } from "react";
import { PenTool, CheckCircle2, RotateCcw, ShieldCheck } from "lucide-react";

interface DigitalSignaturePadProps {
  value?: string | null;
  onChange?: (base64: string) => void;
  disabled?: boolean;
  partyLabel?: string;
  isReadOnly?: boolean;
  signedAt?: string | Date | null;
  signerUid?: number | null;
}

export function DigitalSignaturePad({
  value,
  onChange,
  disabled = false,
  partyLabel = "Signatory",
  isReadOnly = false,
  signedAt,
  signerUid,
}: DigitalSignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPadOpen, setIsPadOpen] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [currentSignature, setCurrentSignature] = useState<string | null>(value || null);

  useEffect(() => {
    setCurrentSignature(value || null);
  }, [value]);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Use high DPI for crisp signature
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.strokeStyle = "#0F172A";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Draw light guidance lines
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, rect.width, rect.height);
  };

  useEffect(() => {
    if (isPadOpen) {
      setTimeout(initCanvas, 50);
    }
  }, [isPadOpen]);

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || isReadOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore pointer release error
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
  };

  const handleDone = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) {
      setIsPadOpen(false);
      return;
    }
    const dataUrl = canvas.toDataURL("image/png");
    setCurrentSignature(dataUrl);
    setIsPadOpen(false);
    if (onChange) {
      onChange(dataUrl);
    }
  };

  const handleReSign = () => {
    if (disabled || isReadOnly) return;
    setCurrentSignature(null);
    setHasDrawn(false);
    setIsPadOpen(true);
  };

  // State 1: Active Drawing Canvas
  if (isPadOpen && !isReadOnly && !disabled) {
    return (
      <div className="w-full my-3 animate-in fade-in zoom-in-95 duration-150">
        <div className="relative rounded-lg border-2 border-[#0284c7] bg-white p-3 shadow-md">
          {/* Subtle horizontal guideline in background */}
          <div className="text-[11px] text-gray-400 font-mono mb-1 flex items-center justify-between">
            <span>Draw signature inside the box</span>
            <span className="text-[#0284c7] font-semibold">{partyLabel}</span>
          </div>

          <div className="relative border border-dashed border-gray-300 rounded bg-[#FAFAFA] overflow-hidden touch-none select-none">
            {/* Guide lines background */}
            <div className="absolute inset-x-4 top-1/2 border-b border-gray-200 pointer-events-none" />
            <div className="absolute inset-x-4 top-3/4 border-b border-gray-200/60 pointer-events-none" />

            <canvas
              ref={canvasRef}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              className="w-full h-36 cursor-crosshair block relative z-10"
              style={{ touchAction: "none" }}
            />
          </div>

          <div className="mt-2.5 flex items-center justify-between">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline px-2 py-1"
            >
              Clear
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPadOpen(false)}
                className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDone}
                disabled={!hasDrawn}
                className="px-4 py-1.5 rounded-md bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-40 text-white text-xs font-bold shadow-sm transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // State 2: Already Signed (Displaying Signature + Verified Seal)
  if (currentSignature) {
    return (
      <div className="w-full my-2">
        <div className="relative rounded-lg border border-dashed border-sky-300 bg-white p-3 shadow-sm min-h-[120px] flex flex-col justify-between overflow-hidden">
          {/* Signature Image */}
          <div className="flex items-center justify-center py-2 h-24">
            <img
              src={currentSignature}
              alt="Digital Signature"
              className="max-h-full max-w-[85%] object-contain filter contrast-125"
            />
          </div>

          {/* Stamp / Seal in bottom right (matching screenshot 4) */}
          <div className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5 shadow-sm">
            <div className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold text-[9px] shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <span className="text-[10px] font-bold text-sky-700 uppercase tracking-tight font-sans">
              VERIFIED
            </span>
          </div>

          {/* Bottom Bar: Re-sign & Timestamps */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-[11px]">
            {!isReadOnly && !disabled ? (
              <button
                type="button"
                onClick={handleReSign}
                className="text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-1 text-[11px]"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Re-sign</span>
              </button>
            ) : (
              <span className="text-gray-400 text-[10px]">Signed & Locked</span>
            )}

            {signedAt && (
              <span className="text-[10px] text-gray-500 font-mono">
                {new Date(signedAt).toLocaleDateString()} {new Date(signedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // State 3: Unsigned - "Click here to sign." Box (matching screenshot 3)
  return (
    <div className="w-full my-2">
      <button
        type="button"
        disabled={disabled || isReadOnly}
        onClick={() => setIsPadOpen(true)}
        className={`w-full h-16 rounded-lg border border-sky-300 bg-white hover:border-sky-500 hover:shadow-md transition-all flex items-center justify-center gap-3 relative overflow-hidden select-none group ${
          disabled || isReadOnly ? "opacity-60 cursor-not-allowed bg-gray-50 border-gray-200" : "cursor-pointer"
        }`}
      >
        {/* Subtle grid pattern background matching screenshot 3 */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, #0284c7 1px, transparent 1px), linear-gradient(to bottom, #0284c7 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        <div className="flex items-center gap-2 relative z-10 text-sky-600 group-hover:text-sky-700 font-medium">
          <div className="w-7 h-7 rounded-full bg-sky-50 flex items-center justify-center border border-sky-200 group-hover:scale-105 transition-transform">
            <PenTool className="w-4 h-4 text-sky-600" />
          </div>
          <span className="text-sm font-semibold tracking-wide">
            {disabled || isReadOnly ? "Awaiting Signature" : "Click here to sign."}
          </span>
        </div>
      </button>
    </div>
  );
}
