"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  ZoomIn,
  ZoomOut,
  Highlighter,
  Type,
  Eraser,
  MousePointer2,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Download,
} from "lucide-react";
type Tool = "select" | "highlight" | "text" | "eraser";

interface HighlightAnnotation {
  kind: "highlight";
  id: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

interface TextAnnotation {
  kind: "text";
  id: string;
  page: number;
  x: number;
  y: number;
  value: string;
  color: string;
  fontSize: number;
}

type Annotation = HighlightAnnotation | TextAnnotation;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

interface PdfViewerProps {
  url: string;
  fileName?: string;
}
const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";
let pdfjsLib: any = null;
let pdfjsLoadPromise: Promise<any> | null = null;

function loadPdfJs(): Promise<any> {
  if (pdfjsLib) return Promise.resolve(pdfjsLib);
  if (pdfjsLoadPromise) return pdfjsLoadPromise;

  pdfjsLoadPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject("SSR");
    const existing = (window as any).pdfjsLib;
    if (existing && existing.GlobalWorkerOptions) {
      pdfjsLib = existing;
      return resolve(existing);
    }

    const umdScript = document.createElement("script");
    umdScript.src = `${PDFJS_CDN}/pdf.min.js`;
    umdScript.crossOrigin = "anonymous";
    umdScript.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (!lib) {
        const err = "pdfjsLib not found on window after script load";
        console.error(err);
        pdfjsLoadPromise = null; // reset so next mount retries
        return reject(err);
      }
      try {
        const workerCode = `importScripts('${PDFJS_CDN}/pdf.worker.min.js');`;
        const blob = new Blob([workerCode], { type: "text/javascript" });
        lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
      } catch {
        // Fallback: direct CDN worker (works if served over HTTPS)
        lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
      }
      pdfjsLib = lib;
      resolve(lib);
    };
    umdScript.onerror = (e) => {
      console.error("Failed to load pdf.js from CDN:", e);
      pdfjsLoadPromise = null; // reset so next mount retries
      reject("Failed to load pdf.js CDN script");
    };
    document.head.appendChild(umdScript);
  });
  return pdfjsLoadPromise;
}


export default function PdfViewer({ url, fileName }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [rotation, setRotation] = useState(0);
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [highlightColor, setHighlightColor] = useState("#FFE066");
  const [textColor, setTextColor] = useState("#1a1a1a");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);


  const [pendingText, setPendingText] = useState<{ x: number; y: number } | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);


  const pdfDocRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  useEffect(() => {
    let cancelled = false;
    const abortCtrl = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const fetchUrl = url.startsWith("/")
          ? `${window.location.origin}${url}`
          : url;

        const res = await fetch(fetchUrl, {
          signal: abortCtrl.signal,
          cache: "no-store",
          headers: { "Pragma": "no-cache", "Cache-Control": "no-cache" },
        });
        if (!res.ok || res.status === 204) {
          throw new Error(`HTTP ${res.status} fetching PDF`);
        }
        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength === 0) {
          throw new Error("PDF returned 0 bytes — try re-uploading the file.");
        }
        if (cancelled) return;
        const lib = await loadPdfJs();
        const loadingTask = lib.getDocument({
          data: new Uint8Array(arrayBuffer),
        });

        const pdf = await loadingTask.promise;
        if (cancelled) return;

        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setCurrentPage(1);
        setLoading(false);
      } catch (err: any) {
        if (!cancelled && err?.name !== "AbortError") {
          console.error("PdfViewer load error:", err);
          setError(err?.message || "Failed to load PDF");
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
      abortCtrl.abort();
    };
  }, [url]);
  useEffect(() => {
    if (!pdfDocRef.current || currentPage < 1 || currentPage > numPages) return;

    let cancelled = false;

    async function renderPage() {
      const pdf = pdfDocRef.current;
      const page = await pdf.getPage(currentPage);
      if (cancelled) return;

      const viewport = page.getViewport({ scale, rotation });
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Cancel any in-flight render
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch { }
      }

      const task = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;

      try {
        await task.promise;
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("Render error:", err);
        }
      }
    }

    renderPage();
    return () => { cancelled = true; };
  }, [currentPage, numPages, scale, rotation]);
  const zoomIn = () => setScale((s) => Math.min(s + 0.2, 3.0));
  const zoomOut = () => setScale((s) => Math.max(s - 0.2, 0.4));
  const zoomReset = () => setScale(1.2);
  const prevPage = () => setCurrentPage((p) => Math.max(p - 1, 1));
  const nextPage = () => setCurrentPage((p) => Math.min(p + 1, numPages));
  const rotate = () => setRotation((r) => (r + 90) % 360);
  const download = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "document.pdf";
    a.click();
  };
  function getRelativePos(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function handleOverlayMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (activeTool === "highlight") {
      const pos = getRelativePos(e);
      setIsDrawing(true);
      setDrawStart(pos);
      setDrawCurrent(pos);
    } else if (activeTool === "text") {
      const pos = getRelativePos(e);
      setPendingText(pos);
      setTimeout(() => textInputRef.current?.focus(), 50);
    } else if (activeTool === "eraser") {
      const pos = getRelativePos(e);
      setAnnotations((prev) =>
        prev.filter((a) => {
          if (a.page !== currentPage) return true;
          if (a.kind === "highlight") {
            return !(pos.x >= a.x && pos.x <= a.x + a.w && pos.y >= a.y && pos.y <= a.y + a.h);
          }
          if (a.kind === "text") {
            return !(pos.x >= a.x && pos.x <= a.x + 150 && pos.y >= a.y - 20 && pos.y <= a.y + 10);
          }
          return true;
        })
      );
    }
  }
  function handleOverlayMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (isDrawing && activeTool === "highlight") {
      setDrawCurrent(getRelativePos(e));
    }
  }
  function handleOverlayMouseUp() {
    if (isDrawing && drawStart && drawCurrent) {
      const x = Math.min(drawStart.x, drawCurrent.x);
      const y = Math.min(drawStart.y, drawCurrent.y);
      const w = Math.abs(drawCurrent.x - drawStart.x);
      const h = Math.abs(drawCurrent.y - drawStart.y);
      if (w > 4 && h > 4) {
        setAnnotations((prev) => [
          ...prev,
          { kind: "highlight", id: uid(), page: currentPage, x, y, w, h, color: highlightColor },
        ]);
      }
    }
    setIsDrawing(false);
    setDrawStart(null);
    setDrawCurrent(null);
  }
  function handleTextSubmit(value: string) {
    if (pendingText && value.trim()) {
      setAnnotations((prev) => [
        ...prev,
        {
          kind: "text", id: uid(), page: currentPage,
          x: pendingText.x, y: pendingText.y,
          value: value.trim(), color: textColor, fontSize: 14,
        },
      ]);
    }
    setPendingText(null);
  }
  const previewRect =
    isDrawing && drawStart && drawCurrent
      ? {
        x: Math.min(drawStart.x, drawCurrent.x),
        y: Math.min(drawStart.y, drawCurrent.y),
        w: Math.abs(drawCurrent.x - drawStart.x),
        h: Math.abs(drawCurrent.y - drawStart.y),
      }
      : null;

  const pageAnnotations = annotations.filter((a) => a.page === currentPage);
  const tbtn = (tool: Tool) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${activeTool === tool
      ? "bg-blue-600 text-white shadow-md shadow-blue-200"
      : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
    }`;

  const ibtn =
    "flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

  const cursorMap: Record<Tool, string> = {
    select: "default",
    highlight: "crosshair",
    text: "text",
    eraser: "pointer",
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white/80 backdrop-blur-sm flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-1 mr-1">
          <button className={tbtn("select")} onClick={() => { setActiveTool("select"); setPendingText(null); }}>
            <MousePointer2 size={14} /> Select
          </button>
          <button className={tbtn("highlight")} onClick={() => { setActiveTool("highlight"); setPendingText(null); }}>
            <Highlighter size={14} /> Highlight
          </button>
          <button className={tbtn("text")} onClick={() => { setActiveTool("text"); setPendingText(null); }}>
            <Type size={14} /> Text
          </button>
          <button className={tbtn("eraser")} onClick={() => { setActiveTool("eraser"); setPendingText(null); }}>
            <Eraser size={14} /> Erase
          </button>
        </div>

        <div className="w-px h-6 bg-gray-200 mx-1" />
        {activeTool === "highlight" && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Color</span>
            {["#FFE066", "#A3E635", "#67E8F9", "#FDA4AF", "#C4B5FD"].map((c) => (
              <button
                key={c}
                onClick={() => setHighlightColor(c)}
                className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer ${highlightColor === c ? "border-gray-800 scale-125" : "border-transparent hover:scale-110"
                  }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
        {activeTool === "text" && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Color</span>
            {["#1a1a1a", "#dc2626", "#2563eb", "#16a34a", "#9333ea"].map((c) => (
              <button
                key={c}
                onClick={() => setTextColor(c)}
                className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer ${textColor === c ? "border-gray-800 scale-125" : "border-transparent hover:scale-110"
                  }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
        <div className="w-px h-6 bg-gray-200 mx-1" />
        <div className="flex items-center gap-1">
          <button className={ibtn} onClick={zoomOut} title="Zoom out"><ZoomOut size={14} /></button>
          <button
            className="px-2 py-1 rounded-md text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 min-w-[52px] text-center cursor-pointer hover:bg-gray-200 transition"
            onClick={zoomReset}
            title="Reset zoom"
          >
            {Math.round(scale * 100)}%
          </button>
          <button className={ibtn} onClick={zoomIn} title="Zoom in"><ZoomIn size={14} /></button>
        </div>
        <div className="w-px h-6 bg-gray-200 mx-1" />
        <button className={ibtn} onClick={rotate} title="Rotate"><RotateCw size={14} /></button>
        <button className={ibtn} onClick={download} title="Download"><Download size={14} /></button>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <button className={ibtn} onClick={prevPage} disabled={currentPage <= 1}><ChevronLeft size={14} /></button>
          <span className="text-xs font-medium text-gray-600 min-w-[70px] text-center">
            {currentPage} / {numPages || "–"}
          </span>
          <button className={ibtn} onClick={nextPage} disabled={currentPage >= numPages}><ChevronRight size={14} /></button>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 overflow-auto bg-gray-100 flex justify-center p-4">
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-500">Loading document…</span>
            </div>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-64">
            <span className="text-sm text-red-500">Failed to load PDF: {error}</span>
          </div>
        )}
        {!loading && !error && numPages > 0 && (
          <div className="relative inline-block shadow-xl rounded-lg overflow-hidden bg-white">
            <canvas ref={canvasRef} />
            <div
              className="absolute inset-0"
              style={{ cursor: cursorMap[activeTool] }}
              onMouseDown={handleOverlayMouseDown}
              onMouseMove={handleOverlayMouseMove}
              onMouseUp={handleOverlayMouseUp}
              onMouseLeave={handleOverlayMouseUp}
            >
              {pageAnnotations
                .filter((a): a is HighlightAnnotation => a.kind === "highlight")
                .map((a) => (
                  <div
                    key={a.id}
                    className="absolute pointer-events-none rounded-sm"
                    style={{
                      left: a.x, top: a.y, width: a.w, height: a.h,
                      backgroundColor: a.color, opacity: 0.35, mixBlendMode: "multiply",
                    }}
                  />
                ))}
              {pageAnnotations
                .filter((a): a is TextAnnotation => a.kind === "text")
                .map((a) => (
                  <div
                    key={a.id}
                    className="absolute pointer-events-none font-semibold drop-shadow-sm"
                    style={{
                      left: a.x, top: a.y - a.fontSize,
                      color: a.color, fontSize: a.fontSize,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.value}
                  </div>
                ))}
              {previewRect && (
                <div
                  className="absolute border-2 border-dashed rounded-sm pointer-events-none"
                  style={{
                    left: previewRect.x, top: previewRect.y,
                    width: previewRect.w, height: previewRect.h,
                    borderColor: highlightColor, backgroundColor: highlightColor,
                    opacity: 0.2,
                  }}
                />
              )}

              {pendingText && (
                <input
                  ref={textInputRef}
                  className="absolute bg-white/90 backdrop-blur border-2 border-blue-500 rounded-md px-2 py-1 text-sm outline-none shadow-lg"
                  style={{ left: pendingText.x, top: pendingText.y, minWidth: 160, color: textColor }}
                  placeholder="Type annotation…"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTextSubmit((e.target as HTMLInputElement).value);
                    else if (e.key === "Escape") setPendingText(null);
                  }}
                  onBlur={(e) => handleTextSubmit(e.target.value)}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
