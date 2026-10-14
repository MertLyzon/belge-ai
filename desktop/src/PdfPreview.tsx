import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { LoaderCircle, TriangleAlert } from "lucide-react";

type PdfPreviewProps = {
  data: ArrayBuffer;
  pageNumber: number;
};

export default function PdfPreview({ data, pageNumber }: PdfPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [width, setWidth] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let disposed = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    setStatus("loading");

    void import("pdfjs-dist").then(async (pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      loadingTask = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) });
      const loadedDocument = await loadingTask.promise;
      if (disposed) {
        await loadingTask.destroy();
        return;
      }
      setDocument(loadedDocument);
    }).catch(() => {
      if (!disposed) setStatus("error");
    });

    return () => {
      disposed = true;
      setDocument(null);
      if (loadingTask) void loadingTask.destroy();
    };
  }, [data]);

  useEffect(() => {
    if (!document || !width || !canvasRef.current) return;
    let renderTask: RenderTask | null = null;
    let cancelled = false;
    setStatus("loading");

    void document.getPage(pageNumber).then((page) => {
      if (cancelled || !canvasRef.current) return;
      const baseViewport = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(2, Math.max(0.35, (width - 24) / baseViewport.width)) });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas context unavailable");
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
      });
      return renderTask.promise;
    }).then(() => {
      if (!cancelled) setStatus("ready");
    }).catch((caught: unknown) => {
      if (!cancelled && !(caught instanceof Error && caught.name === "RenderingCancelledException")) {
        setStatus("error");
      }
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [document, pageNumber, width]);

  return (
    <div className="pdf-preview" ref={containerRef}>
      {status === "loading" && <div className="preview-status"><LoaderCircle className="spinner" size={22} /><span>Sayfa hazırlanıyor…</span></div>}
      {status === "error" && <div className="preview-status error"><TriangleAlert size={22} /><span>PDF sayfası görüntülenemedi. Metin görünümünü kullanabilirsin.</span></div>}
      <canvas ref={canvasRef} className={status === "ready" ? "ready" : ""} />
    </div>
  );
}
