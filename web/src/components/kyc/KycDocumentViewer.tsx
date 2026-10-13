"use client";

import { useState, useRef, useEffect } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  Download,
  ExternalLink,
  RefreshCw,
  FileText,
  AlertCircle,
  Eye,
  Loader2,
} from "lucide-react";

interface KycDocumentViewerProps {
  url: string | null | undefined;
  title?: string;
  documentType?: string;
  className?: string;
  compact?: boolean;
  onOpenFullscreen?: () => void;
}

export default function KycDocumentViewer({
  url,
  title = "Document Preview",
  documentType,
  className = "",
  compact = false,
  onOpenFullscreen,
}: KycDocumentViewerProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const isPdf = Boolean(
    url && (url.toLowerCase().endsWith(".pdf") || url.toLowerCase().includes(".pdf?"))
  );

  // Reset transform when url changes
  useEffect(() => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
    setIsLoading(true);
    setHasError(false);
  }, [url]);

  if (!url) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-6 rounded-xl border border-dashed border-white/10 bg-[#161822]/60 text-gray-500 text-xs text-center ${className}`}
      >
        <FileText className="w-8 h-8 mb-2 opacity-40 text-gray-400" />
        <span>No document uploaded</span>
      </div>
    );
  }

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3.5));
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const next = Math.max(prev - 0.25, 0.75);
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const downloadUrl = url.includes("?") ? `${url}&download=1` : `${url}?download=1`;

  // Compact Thumbnail View (e.g. for table or preview pills)
  if (compact) {
    return (
      <div
        className={`relative group rounded-lg overflow-hidden border border-white/10 bg-[#121218] flex items-center justify-center cursor-pointer transition-all hover:border-[#00A070]/60 ${className}`}
        onClick={onOpenFullscreen}
      >
        {isPdf ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-2 text-rose-400 bg-rose-500/5">
            <FileText className="w-6 h-6 mb-1" />
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-rose-300">
              PDF Doc
            </span>
          </div>
        ) : (
          <>
            <img
              src={url}
              alt={title}
              className="w-full h-full object-cover"
              onError={() => setHasError(true)}
            />
            {hasError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#121218] text-amber-400 p-1 text-center">
                <AlertCircle className="w-4 h-4 mb-0.5" />
                <span className="text-[8px] font-mono">Preview N/A</span>
              </div>
            )}
          </>
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <Eye className="w-4 h-4 text-white" />
        </div>
      </div>
    );
  }

  // Full Interactive Viewer
  return (
    <>
      <div
        className={`flex flex-col rounded-2xl overflow-hidden border border-white/10 bg-[#12141D] shadow-xl ${className}`}
      >
        {/* Toolbar Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#181B26] border-b border-white/5 select-none gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide uppercase bg-white/5 text-gray-300 border border-white/5">
              {isPdf ? "PDF" : "IMAGE"}
            </span>
            <span className="text-xs font-semibold text-white truncate" title={title}>
              {title}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {!isPdf && (
              <>
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={scale <= 0.75}
                  title="Zoom Out (-)"
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-mono text-gray-400 w-9 text-center">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={scale >= 3.5}
                  title="Zoom In (+)"
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleRotate}
                  title="Rotate 90° Clockwise"
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                {(scale !== 1 || rotation !== 0 || position.x !== 0 || position.y !== 0) && (
                  <button
                    type="button"
                    onClick={handleReset}
                    title="Reset Zoom & Rotation"
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
                <div className="w-[1px] h-4 bg-white/10 mx-0.5" />
              </>
            )}

            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              title="Full Screen Inspection"
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              title="Open in new window"
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <a
              href={downloadUrl}
              download
              title="Download original file"
              className="p-1.5 rounded-lg bg-[#00A070]/20 hover:bg-[#00A070]/30 text-[#00A070] border border-[#00A070]/30 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Viewport Area */}
        <div
          className="relative w-full h-[50vh] min-h-[280px] sm:h-[440px] lg:h-[500px] max-h-[580px] bg-[#0A0C12] overflow-hidden flex items-center justify-center select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
        >
          {/* PDF Viewer */}
          {isPdf ? (
            <div className="w-full h-full flex flex-col relative">
              <iframe
                src={`${url}#toolbar=1&navpanes=0`}
                className="w-full h-full border-none bg-white rounded-b-xl"
                title={title}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setHasError(true);
                }}
              />
              <div className="absolute bottom-2 right-2 bg-black/80 px-2.5 py-1 rounded-md text-[10px] text-gray-300 backdrop-blur-xs flex items-center gap-2 border border-white/10 pointer-events-auto">
                <span className="font-mono">PDF Document</span>
                <a
                  href={downloadUrl}
                  download
                  className="text-[#00A070] hover:underline flex items-center gap-0.5"
                >
                  <Download className="w-3 h-3" /> Download
                </a>
              </div>
            </div>
          ) : (
            /* Image Viewer */
            <div
              className="w-full h-full flex items-center justify-center p-4 transition-transform duration-75"
              style={{
                transform: `translate(${position.x}px, ${position.y}px)`,
              }}
            >
              {isLoading && !hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0A0C12] z-10">
                  <Loader2 className="w-6 h-6 animate-spin text-[#00A070]" />
                </div>
              )}
              <img
                src={url}
                alt={title}
                draggable={false}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setHasError(true);
                }}
                className="max-w-full max-h-[460px] object-contain rounded transition-all duration-150 select-none shadow-2xl pointer-events-none"
                style={{
                  transform: `scale(${scale}) rotate(${rotation}deg)`,
                }}
              />
            </div>
          )}

          {/* Error Fallback Card */}
          {hasError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0F111A] text-center p-6 gap-3 z-20">
              <AlertCircle className="w-10 h-10 text-amber-400" />
              <div>
                <p className="text-sm font-semibold text-white">Document Preview Unavailable</p>
                <p className="text-xs text-gray-400 mt-1 max-w-sm">
                  The document could not be previewed directly in the browser. You can securely download or open the original document in a separate tab.
                </p>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white flex items-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open in New Tab
                </a>
                <a
                  href={downloadUrl}
                  download
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#00A070] hover:bg-[#00b880] text-white flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Download File
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Inspection Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-md animate-in fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-[#141722] border-b border-white/10 select-none">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-[#00A070]/20 text-[#00A070] border border-[#00A070]/30">
                {documentType || (isPdf ? "PDF DOCUMENT" : "IDENTITY DOCUMENT")}
              </span>
              <div>
                <h3 className="text-sm font-bold text-white">{title}</h3>
                <span className="text-[11px] text-gray-400 font-mono">
                  High-Resolution Document Inspection Mode
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isPdf && (
                <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10 mr-2">
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    disabled={scale <= 0.75}
                    className="p-2 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white disabled:opacity-30"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono text-gray-300 w-12 text-center">
                    {Math.round(scale * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    disabled={scale >= 4}
                    className="p-2 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white disabled:opacity-30"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleRotate}
                    className="p-2 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white"
                    title="Rotate 90°"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="p-2 rounded-lg hover:bg-white/10 text-amber-400 hover:text-amber-300"
                    title="Reset View"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              )}

              <a
                href={downloadUrl}
                download
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-[#00A070] hover:bg-[#00b880] text-white flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-4 h-4" /> Download
              </a>

              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"
                title="Exit Fullscreen (Esc)"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Fullscreen Content Area */}
          <div
            className="flex-1 w-full h-full bg-[#08090D] overflow-hidden flex items-center justify-center relative select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
          >
            {isPdf ? (
              <iframe
                src={`${url}#toolbar=1`}
                className="w-full h-full border-none bg-white"
                title={title}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center p-8"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px)`,
                }}
              >
                <img
                  src={url}
                  alt={title}
                  draggable={false}
                  className="max-w-full max-h-[85vh] object-contain select-none pointer-events-none drop-shadow-2xl"
                  style={{
                    transform: `scale(${scale}) rotate(${rotation}deg)`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
