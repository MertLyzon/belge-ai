import { useMemo, useRef, useState } from "react";
import {
  ArrowUp, BookOpenText, ChevronLeft, ChevronRight, FilePlus2, FileText,
  FolderOpen, Highlighter, LoaderCircle, LockKeyhole, MessageSquareText,
  Search, Sparkles, Upload, X,
} from "lucide-react";
import "./App.css";

type PdfPage = { number: number; text: string };
type SearchResult = { answer: string; page: number; excerpt: string };

const demoPages: PdfPage[] = [
  { number: 1, text: "HİZMET SÖZLEŞMESİ İşbu sözleşme müşteri ile hizmet veren arasındaki çalışma şartlarını düzenler. Taraflar görev kapsamı, ücretlendirme ve teslim koşullarında anlaşmıştır." },
  { number: 2, text: "Hizmet veren, görevlerini özenle ve belirlenen takvime uygun biçimde yerine getirir. Müşteri gerekli bilgi ve belgeleri zamanında sağlar." },
  { number: 3, text: "Taraflar çalışma sırasında öğrendikleri ticari ve kişisel bilgileri gizli tutar. Gizlilik yükümlülüğü sözleşmenin sona ermesinden sonra da devam eder." },
  { number: 4, text: "4. Sözleşmenin Süresi İşbu sözleşme imza tarihinden itibaren bir yıl süreyle geçerlidir. Taraflardan herhangi biri, sürenin bitiminden en az 30 gün önce yazılı bildirimde bulunmadığı takdirde sözleşme aynı koşullarla bir yıl daha uzar. Taraflardan her biri 30 gün önceden yazılı bildirimde bulunarak sözleşmeyi feshedebilir." },
];

const stopWords = new Set([
  "acaba", "ama", "ancak", "bana", "belge", "belgenin", "bir", "bu", "da", "daha", "de",
  "diye", "en", "gibi", "hakkında", "hangi", "ile", "ise", "için", "mı", "mi", "mu", "mü",
  "ne", "nedir", "neler", "nasıl", "olan", "olarak", "ve", "veya", "şu", "çok",
]);

function tokenize(value: string) {
  return value.toLocaleLowerCase("tr").normalize("NFKD").replace(/[^a-z0-9çğıöşü\s]/gi, " ").split(/\s+/).filter((word) => word.length > 2 && !stopWords.has(word));
}

function sentences(value: string) {
  return value.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 30);
}

function makeSummary(pages: PdfPage[]) {
  const rows = pages.flatMap((page) => sentences(page.text).map((text, index) => ({ text, index })));
  if (!rows.length) return "Bu PDF’de seçilebilir metin bulunamadı. Belge taranmış bir görüntü olabilir.";
  const frequency = new Map<string, number>();
  tokenize(pages.map((page) => page.text).join(" ")).forEach((word) => frequency.set(word, (frequency.get(word) ?? 0) + 1));
  return rows.map((row) => ({ ...row, score: tokenize(row.text).reduce((sum, word) => sum + (frequency.get(word) ?? 0), 0) / Math.max(row.text.length, 80) }))
    .sort((a, b) => b.score - a.score).slice(0, 3).sort((a, b) => a.index - b.index).map((row) => row.text).join(" ");
}

function topKeywords(pages: PdfPage[]) {
  const frequency = new Map<string, number>();
  tokenize(pages.map((page) => page.text).join(" ")).forEach((word) => frequency.set(word, (frequency.get(word) ?? 0) + 1));
  return [...frequency.entries()].filter(([word]) => word.length > 4).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([word]) => word.charAt(0).toLocaleUpperCase("tr") + word.slice(1));
}

function searchDocument(question: string, pages: PdfPage[]): SearchResult {
  const query = tokenize(question);
  const rows = pages.flatMap((page) => sentences(page.text).map((text) => {
    const words = tokenize(text);
    const score = query.reduce((total, term) => total + words.filter((word) => word.includes(term) || term.includes(word)).length, 0);
    return { page: page.number, text, score };
  })).sort((a, b) => b.score - a.score);
  const best = rows[0];
  if (!best || best.score === 0) return { answer: "Bu sorunun cevabını belgede güvenilir biçimde bulamadım. Başka anahtar kelimelerle tekrar deneyebilirsin.", page: 1, excerpt: pages[0]?.text.slice(0, 600) ?? "" };
  const second = rows.find((row) => row.page === best.page && row.text !== best.text && row.score > 0);
  return { answer: [best.text, second?.text].filter(Boolean).join(" "), page: best.page, excerpt: best.text };
}

async function extractPdf(file: File): Promise<PdfPage[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: PdfPage[] = [];
  for (let number = 1; number <= document.numPages; number += 1) {
    const page = await document.getPage(number);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ").replace(/\s+/g, " ").trim();
    pages.push({ number, text });
  }
  return pages;
}

function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("Hizmet_Sozlesmesi.pdf");
  const [pages, setPages] = useState<PdfPage[]>(demoPages);
  const [summary, setSummary] = useState(makeSummary(demoPages));
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("Sözleşme bir yıl geçerlidir. Taraflardan biri 30 gün önceden yazılı bildirimde bulunmazsa aynı koşullarla bir yıl daha uzar.");
  const [sourcePage, setSourcePage] = useState(4);
  const [sourceExcerpt, setSourceExcerpt] = useState(demoPages[3].text);
  const [status, setStatus] = useState<"ready" | "processing" | "error">("ready");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const tags = useMemo(() => topKeywords(pages), [pages]);
  const wordCount = useMemo(() => pages.reduce((sum, page) => sum + tokenize(page.text).length, 0), [pages]);

  async function openPdf(file?: File) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Lütfen PDF biçiminde bir belge seç.");
      setStatus("error");
      return;
    }
    setFileName(file.name);
    setStatus("processing");
    setError("");
    try {
      const extracted = await extractPdf(file);
      const firstReadable = extracted.find((page) => page.text.length > 15);
      if (!firstReadable) throw new Error("Bu PDF’de seçilebilir metin bulunamadı. OCR uygulanmış başka bir belge deneyebilirsin.");
      setPages(extracted);
      setSummary(makeSummary(extracted));
      setAnswer(`${extracted.length} sayfalık belge hazır. Aşağıdaki alandan belge hakkında soru sorabilirsin.`);
      setSourcePage(firstReadable.number);
      setSourceExcerpt(firstReadable.text.slice(0, 800));
      setStatus("ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "PDF işlenirken bir hata oluştu.");
      setStatus("error");
    }
  }

  function ask(value = question) {
    const clean = value.trim();
    if (!clean || status !== "ready") return;
    setQuestion(clean);
    const result = searchDocument(clean, pages);
    setAnswer(result.answer);
    setSourcePage(result.page);
    setSourceExcerpt(result.excerpt);
  }

  function changePage(next: number) {
    const page = pages.find((item) => item.number === next);
    if (!page) return;
    setSourcePage(next);
    setSourceExcerpt(page.text.slice(0, 800));
  }

  return (
    <div className="app-shell" onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); void openPdf(event.dataTransfer.files[0]); }}>
      {dragging && <div className="drop-overlay"><Upload size={34} /><strong>PDF’yi buraya bırak</strong><span>Belge yalnızca bu bilgisayarda işlenecek</span></div>}

      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><BookOpenText size={18} /></span><div><strong>belge.ai</strong><small>Yerel belge asistanı</small></div></div>
        <button className="primary-button" onClick={() => inputRef.current?.click()}><FilePlus2 size={17} /> Yeni belge aç</button>
        <label className="search"><Search size={15} /><input placeholder="Belgelerde ara" /></label>

        <div className="section-label">SON KULLANILANLAR</div>
        <button className="document-item active"><FileText size={16} /><span><strong>{fileName.replace(/\.pdf$/i, "")}</strong><small>{pages.length} sayfa · şimdi</small></span></button>
        <button className="document-item"><FileText size={16} /><span><strong>2025 Faaliyet Raporu</strong><small>48 sayfa · dün</small></span></button>
        <button className="document-item"><FileText size={16} /><span><strong>Teknik Şartname</strong><small>24 sayfa · 2 gün önce</small></span></button>

        <div className="privacy-card"><LockKeyhole size={17} /><div><strong>Tamamen yerel</strong><p>Belgeler ve sorular bu bilgisayardan dışarı çıkmaz.</p></div></div>
      </aside>

      <main className="workspace">
        <header className="document-header">
          <div><h1>{fileName}</h1><p>{pages.length} sayfa · {wordCount.toLocaleString("tr-TR")} kelime</p></div>
          <span className={`status ${status}`}><i />{status === "processing" ? "PDF işleniyor" : status === "error" ? "İşleme hatası" : "Analiz hazır"}</span>
        </header>

        <div className="conversation">
          {error && <div className="error-banner"><span>{error}</span><button onClick={() => setError("")}><X size={15} /></button></div>}
          <section className="response-block"><span className="response-icon violet"><Sparkles size={17} /></span><div><h2>Belge özeti</h2><p>{summary}</p><div className="tags">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div></section>

          <section className="suggestions"><small>SORABİLECEKLERİN</small><div>
            {["Belgenin ana konusu nedir?", "Önemli tarih ve süreleri bul", "Tarafların yükümlülükleri neler?"].map((item) => <button key={item} onClick={() => ask(item)}>{item}</button>)}
          </div></section>

          <section className="response-block answer"><span className="response-icon"><MessageSquareText size={17} /></span><div><h2>Yanıt</h2>{status === "processing" ? <p className="loading"><LoaderCircle size={17} className="spinner" /> Belge okunuyor…</p> : <p>{answer}</p>}<button className="source-chip" onClick={() => changePage(sourcePage)}><Highlighter size={14} /> Sayfa {sourcePage} · Kaynağı göster</button></div></section>

          <div className="composer"><textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); ask(); } }} placeholder="Bu belge hakkında bir şey sor…" rows={2} /><div><span>Yanıtlar yalnızca açık PDF’den çıkarılır</span><button disabled={!question.trim() || status !== "ready"} onClick={() => ask()}><ArrowUp size={17} /></button></div></div>
        </div>
      </main>

      <aside className="source-panel">
        <div className="source-title"><div><span>Kaynak belge</span><small>Metin görünümü</small></div><button onClick={() => inputRef.current?.click()}><FolderOpen size={15} /> Değiştir</button></div>
        <article className="paper"><header><strong>{fileName.toUpperCase()}</strong><span>{String(sourcePage).padStart(2, "0")}</span></header><p>{sourceExcerpt || "Bu sayfada seçilebilir metin bulunamadı."}</p><footer><button disabled={sourcePage <= 1} onClick={() => changePage(sourcePage - 1)}><ChevronLeft size={16} /></button><span>{sourcePage} / {pages.length}</span><button disabled={sourcePage >= pages.length} onClick={() => changePage(sourcePage + 1)}><ChevronRight size={16} /></button></footer></article>
        <p className="local-note"><LockKeyhole size={13} /> PDF içeriği bellekte tutulur ve uygulama kapanınca silinir.</p>
      </aside>

      <input ref={inputRef} className="file-input" type="file" accept="application/pdf,.pdf" onChange={(event) => void openPdf(event.target.files?.[0])} />
    </div>
  );
}

export default App;
