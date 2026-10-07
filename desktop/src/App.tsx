import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp, BookOpenText, Check, ChevronLeft, ChevronRight, Clipboard,
  FilePlus2, FileSearch, FileText, FolderOpen, Highlighter, LoaderCircle,
  LockKeyhole, MessageSquareText, PanelRightClose, PanelRightOpen,
  RotateCcw, Search, Sparkles, Trash2, Upload, X,
} from "lucide-react";
import "./App.css";
import {
  deleteStoredDocument, getStoredDocument, listStoredDocuments, saveDocumentMessages,
  saveStoredDocument, type ChatMessage, type PdfPage, type SearchResult,
  type StoredDocumentSummary,
} from "./documentStore";

type AppStatus = "idle" | "processing" | "ready" | "error";

const stopWords = new Set([
  "acaba", "ama", "ancak", "bana", "belge", "belgenin", "bir", "bu", "da", "daha", "de",
  "diye", "en", "gibi", "hakkında", "hangi", "ile", "ise", "için", "mı", "mi", "mu", "mü",
  "ne", "nedir", "neler", "nasıl", "olan", "olarak", "ve", "veya", "şu", "çok",
]);

function tokenize(value: string) {
  return value.toLocaleLowerCase("tr").normalize("NFKD")
    .replace(/[^a-z0-9çğıöşü\s]/gi, " ").split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

function sentences(value: string) {
  return value.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 30);
}

function makeSummary(pages: PdfPage[]) {
  const rows = pages.flatMap((page) =>
    sentences(page.text).map((text, index) => ({ text, order: page.number * 1000 + index })),
  );
  if (!rows.length) return "Bu PDF’de özetlenebilecek seçilebilir metin bulunamadı.";
  const frequency = new Map<string, number>();
  tokenize(pages.map((page) => page.text).join(" ")).forEach((word) =>
    frequency.set(word, (frequency.get(word) ?? 0) + 1),
  );
  return rows.map((row) => ({
    ...row,
    score: tokenize(row.text).reduce((sum, word) => sum + (frequency.get(word) ?? 0), 0) /
      Math.max(row.text.length, 80),
  })).sort((a, b) => b.score - a.score).slice(0, 3).sort((a, b) => a.order - b.order)
    .map((row) => row.text).join(" ");
}

function topKeywords(pages: PdfPage[]) {
  const frequency = new Map<string, number>();
  tokenize(pages.map((page) => page.text).join(" ")).forEach((word) =>
    frequency.set(word, (frequency.get(word) ?? 0) + 1),
  );
  return [...frequency.entries()].filter(([word]) => word.length > 4)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([word]) => word.charAt(0).toLocaleUpperCase("tr") + word.slice(1));
}

function searchDocument(question: string, pages: PdfPage[]): SearchResult {
  const terms = [...new Set(tokenize(question))];
  const rows = pages.flatMap((page) => sentences(page.text).map((text) => {
    const words = tokenize(text);
    const score = terms.reduce(
      (total, term) => total + words.filter((word) => word.includes(term) || term.includes(word)).length,
      0,
    );
    return { page: page.number, text, score };
  })).sort((a, b) => b.score - a.score);
  const best = rows[0];
  if (!best || best.score === 0) {
    const fallback = pages.find((page) => page.text);
    return {
      answer: "Bu sorunun cevabını belgede güvenilir biçimde bulamadım. Daha belirgin bir ifade veya anahtar kelimeyle tekrar deneyebilirsin.",
      page: fallback?.number ?? 1,
      excerpt: fallback?.text.slice(0, 1200) ?? "",
      terms,
    };
  }
  const supporting = rows.find((row) => row.page === best.page && row.text !== best.text && row.score > 0);
  return {
    answer: [best.text, supporting?.text].filter(Boolean).join(" "),
    page: best.page,
    excerpt: pages.find((page) => page.number === best.page)?.text.slice(0, 1600) ?? best.text,
    terms,
  };
}

async function extractPdf(file: File, onProgress: (current: number, total: number) => void) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: PdfPage[] = [];
  for (let number = 1; number <= document.numPages; number += 1) {
    onProgress(number, document.numPages);
    const page = await document.getPage(number);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ("str" in item ? item.str : ""))
      .join(" ").replace(/\s+/g, " ").trim();
    pages.push({ number, text });
  }
  return pages;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightedText(text: string, terms: string[]) {
  const useful = terms.filter((term) => term.length > 2);
  if (!useful.length) return text;
  const expression = new RegExp(`(${useful.map(escapeRegExp).join("|")})`, "gi");
  return text.split(expression).map((part, index) =>
    useful.some((term) => part.toLocaleLowerCase("tr").includes(term.toLocaleLowerCase("tr")))
      ? <mark key={`${part}-${index}`}>{part}</mark>
      : part,
  );
}

function recentDate(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return `Bugün ${date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const messageId = useRef(0);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [pages, setPages] = useState<PdfPage[]>([]);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sourcePage, setSourcePage] = useState(1);
  const [sourceExcerpt, setSourceExcerpt] = useState("");
  const [sourceTerms, setSourceTerms] = useState<string[]>([]);
  const [status, setStatus] = useState<AppStatus>("idle");
  const [processingLabel, setProcessingLabel] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [documentSearch, setDocumentSearch] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [recentDocuments, setRecentDocuments] = useState<StoredDocumentSummary[]>([]);
  const [libraryReady, setLibraryReady] = useState(false);

  const hasDocument = pages.length > 0;
  const summary = useMemo(() => (hasDocument ? makeSummary(pages) : ""), [hasDocument, pages]);
  const tags = useMemo(() => topKeywords(pages), [pages]);
  const wordCount = useMemo(() => pages.reduce((sum, page) => sum + tokenize(page.text).length, 0), [pages]);
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 220));
  const searchMatches = useMemo(() => {
    const clean = documentSearch.trim().toLocaleLowerCase("tr");
    if (!clean) return [];
    return pages.filter((page) => page.text.toLocaleLowerCase("tr").includes(clean)).slice(0, 6);
  }, [documentSearch, pages]);

  useEffect(() => {
    void refreshLibrary();
  }, []);

  useEffect(() => {
    function onKeyboard(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase("tr") === "o") {
        event.preventDefault();
        inputRef.current?.click();
      }
      if (event.key === "Escape") setSourceOpen(false);
    }
    window.addEventListener("keydown", onKeyboard);
    return () => window.removeEventListener("keydown", onKeyboard);
  }, []);

  useEffect(() => {
    conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isAnswering]);

  async function refreshLibrary() {
    try {
      setRecentDocuments(await listStoredDocuments());
    } catch {
      setError("Yerel belge geçmişi yüklenemedi. Yeni PDF açmaya devam edebilirsin.");
    } finally {
      setLibraryReady(true);
    }
  }

  function showLoadedDocument(document: {
    id: string;
    name: string;
    size: number;
    pages: PdfPage[];
    messages: ChatMessage[];
  }) {
    const firstReadable = document.pages.find((page) => page.text.length > 15) ?? document.pages[0];
    setActiveDocumentId(document.id);
    setFileName(document.name);
    setFileSize(document.size);
    setPages(document.pages);
    setMessages(document.messages);
    messageId.current = document.messages.reduce((largest, message) => Math.max(largest, message.id), 0);
    setSourcePage(firstReadable?.number ?? 1);
    setSourceExcerpt(firstReadable?.text.slice(0, 1600) ?? "");
    setSourceTerms([]);
    setDocumentSearch("");
    setSourceOpen(false);
    setError("");
    setStatus("ready");
    setProcessingLabel("");
  }

  async function openStoredDocument(id: string) {
    if (id === activeDocumentId || status === "processing") return;
    setError("");
    try {
      const document = await getStoredDocument(id);
      if (!document) throw new Error("Belge yerel kütüphanede bulunamadı.");
      showLoadedDocument(document);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Belge kütüphaneden açılamadı.");
    }
  }

  async function removeStoredDocument(id: string) {
    try {
      await deleteStoredDocument(id);
      if (id === activeDocumentId) setActiveDocumentId(null);
      await refreshLibrary();
    } catch {
      setError("Belge yerel kütüphaneden silinemedi.");
    }
  }

  async function openPdf(file?: File) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Bu dosya PDF biçiminde değil. Lütfen bir PDF seç.");
      setStatus("error");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("PDF 50 MB sınırını aşıyor. Daha küçük bir dosya seç.");
      setStatus("error");
      return;
    }
    setFileName(file.name);
    setFileSize(file.size);
    setStatus("processing");
    setProcessingLabel("PDF hazırlanıyor…");
    setError("");
    setMessages([]);
    setActiveDocumentId(null);
    setPages([]);
    setSourceExcerpt("");
    setSourceTerms([]);
    setDocumentSearch("");
    setSourceOpen(false);
    try {
      const extracted = await extractPdf(file, (current, total) =>
        setProcessingLabel(`${current} / ${total}. sayfa okunuyor`),
      );
      const firstReadable = extracted.find((page) => page.text.length > 15);
      if (!firstReadable) {
        throw new Error("Bu PDF’de seçilebilir metin bulunamadı. Belge taranmışsa önce OCR uygulanmış bir kopya kullanabilirsin.");
      }
      setPages(extracted);
      setSourcePage(firstReadable.number);
      setSourceExcerpt(firstReadable.text.slice(0, 1600));
      setSourceTerms([]);
      setStatus("ready");
      setProcessingLabel("");
      const documentId = `${file.name}:${file.size}:${file.lastModified}`;
      const previousDocument = await getStoredDocument(documentId).catch(() => undefined);
      const document = {
        id: documentId,
        name: file.name,
        size: file.size,
        savedAt: Date.now(),
        pages: extracted,
        messages: previousDocument?.messages ?? [],
      };
      try {
        await saveStoredDocument(document);
        setActiveDocumentId(document.id);
        setMessages(document.messages);
        messageId.current = document.messages.reduce((largest, message) => Math.max(largest, message.id), 0);
        await refreshLibrary();
      } catch {
        setError("Belge açıldı ancak yerel kütüphaneye kaydedilemedi.");
      }
    } catch (caught) {
      setPages([]);
      setError(caught instanceof Error ? caught.message : "PDF işlenirken beklenmeyen bir hata oluştu.");
      setStatus("error");
      setProcessingLabel("");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function ask(value = question) {
    const clean = value.trim();
    if (!clean || status !== "ready" || isAnswering) return;
    setQuestion("");
    setIsAnswering(true);
    await new Promise((resolve) => window.setTimeout(resolve, 260));
    const result = searchDocument(clean, pages);
    messageId.current += 1;
    const nextMessage = { id: messageId.current, question: clean, ...result };
    setMessages((current) => {
      const nextMessages = [...current, nextMessage];
      if (activeDocumentId) {
        void saveDocumentMessages(activeDocumentId, nextMessages).then(refreshLibrary).catch(() => {
          setError("Sohbet geçmişi yerel kütüphaneye kaydedilemedi.");
        });
      }
      return nextMessages;
    });
    setSourcePage(result.page);
    setSourceExcerpt(result.excerpt);
    setSourceTerms(result.terms);
    setIsAnswering(false);
  }

  function showSource(pageNumber: number, excerpt?: string, terms: string[] = []) {
    const page = pages.find((item) => item.number === pageNumber);
    if (!page) return;
    setSourcePage(pageNumber);
    setSourceExcerpt(excerpt || page.text.slice(0, 1600));
    setSourceTerms(terms);
    setSourceOpen(true);
  }

  function changePage(next: number) {
    showSource(next, undefined, documentSearch ? tokenize(documentSearch) : []);
  }

  async function copyAnswer(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.answer);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setError("Yanıt panoya kopyalanamadı.");
    }
  }

  function clearConversation() {
    setMessages([]);
    if (activeDocumentId) {
      void saveDocumentMessages(activeDocumentId, []).then(refreshLibrary).catch(() => {
        setError("Sohbet geçmişi temizlendi ancak yerel kütüphane güncellenemedi.");
      });
    }
  }

  const suggestionItems = [
    "Belgenin ana konusu nedir?",
    "Önemli tarih ve süreleri bul",
    "Tarafların yükümlülükleri neler?",
  ];

  return (
    <div className={`app-shell ${sourceOpen ? "source-visible" : "source-hidden"}`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
      onDrop={(event) => { event.preventDefault(); setDragging(false); void openPdf(event.dataTransfer.files[0]); }}>
      {dragging && <div className="drop-overlay"><span className="drop-icon"><Upload size={28} /></span><strong>PDF’yi buraya bırak</strong><span>Dosya yalnızca bu cihazda işlenecek</span></div>}

      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><BookOpenText size={18} /></span><div><strong>belge.ai</strong><small>Yerel belge asistanı</small></div></div>
        <button className="primary-button" onClick={() => inputRef.current?.click()}><FilePlus2 size={17} /> PDF aç <kbd>⌘O</kbd></button>

        <div className={`search-wrap ${documentSearch ? "active" : ""}`}>
          <label className="search"><Search size={15} /><input value={documentSearch} onChange={(event) => setDocumentSearch(event.target.value)} placeholder={hasDocument ? "Belgede ara" : "Önce bir PDF aç"} disabled={!hasDocument} />{documentSearch && <button onClick={() => setDocumentSearch("")} aria-label="Aramayı temizle"><X size={13} /></button>}</label>
          {documentSearch && <div className="search-results"><small>{searchMatches.length ? `${searchMatches.length} sayfa bulundu` : "Eşleşme bulunamadı"}</small>{searchMatches.map((page) => <button key={page.number} onClick={() => showSource(page.number, undefined, tokenize(documentSearch))}><span>Sayfa {page.number}</span><p>{page.text.slice(0, 90)}…</p></button>)}</div>}
        </div>

        <div className="section-label">AÇIK BELGE</div>
        {hasDocument || status === "processing" ? <button className="document-item active" onClick={() => setSourceOpen(true)}><FileText size={16} /><span><strong>{fileName.replace(/\.pdf$/i, "")}</strong><small>{status === "processing" ? processingLabel : `${pages.length} sayfa · ${(fileSize / 1024 / 1024).toFixed(1)} MB`}</small></span></button> : <div className="no-document"><FileSearch size={18} /><span>Henüz belge açılmadı</span></div>}
        <div className="section-label library-label"><span>SON BELGELER</span>{recentDocuments.length > 0 && <small>{recentDocuments.length}</small>}</div>
        <div className="recent-list">
          {!libraryReady && <div className="no-document"><LoaderCircle size={16} className="spinner" /><span>Kütüphane yükleniyor</span></div>}
          {libraryReady && recentDocuments.length === 0 && <div className="no-document compact"><FileText size={16} /><span>Açtığın belgeler burada görünür</span></div>}
          {recentDocuments.slice(0, 6).map((document) => <div className={`recent-row ${document.id === activeDocumentId ? "active" : ""}`} key={document.id}>
            <button className="recent-document" onClick={() => void openStoredDocument(document.id)} disabled={status === "processing"}>
              <FileText size={15} />
              <span><strong>{document.name.replace(/\.pdf$/i, "")}</strong><small>{document.pageCount} sayfa · {recentDate(document.savedAt)}</small></span>
            </button>
            <button className="delete-document" onClick={() => void removeStoredDocument(document.id)} title="Kütüphaneden kaldır" aria-label={`${document.name} belgesini kütüphaneden kaldır`}><Trash2 size={13} /></button>
          </div>)}
        </div>
        <div className="privacy-card"><LockKeyhole size={17} /><div><strong>Tamamen yerel</strong><p>Belgeler ve sorular cihazından dışarı çıkmaz.</p></div></div>
      </aside>

      <main className="workspace">
        <header className="document-header">
          <div className="header-copy"><h1>{hasDocument || status === "processing" ? fileName : "Yeni çalışma"}</h1><p>{hasDocument ? `${pages.length} sayfa · ${wordCount.toLocaleString("tr-TR")} kelime · ~${readingMinutes} dk okuma` : "PDF’lerini güvenle incele ve içeriğe dayalı yanıtlar al"}</p></div>
          <div className="header-actions">
            {messages.length > 0 && <button className="icon-button" onClick={clearConversation} title="Sohbeti temizle"><RotateCcw size={15} /></button>}
            {hasDocument && <button className="panel-toggle" onClick={() => setSourceOpen((open) => !open)}>{sourceOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />} Kaynak</button>}
            <span className={`status ${status}`}>{status === "processing" && <LoaderCircle size={12} className="spinner" />}{status !== "processing" && <i />}{status === "processing" ? processingLabel : status === "error" ? "Belge açılamadı" : status === "ready" ? "Analiz hazır" : "Belge bekleniyor"}</span>
          </div>
        </header>

        <div className="conversation" ref={conversationRef}>
          {error && <div className="error-banner" role="alert"><div><strong>Bir sorun oluştu</strong><span>{error}</span></div><button onClick={() => { setError(""); setStatus(hasDocument ? "ready" : "idle"); }} aria-label="Hatayı kapat"><X size={15} /></button></div>}

          {!hasDocument && status !== "processing" && <section className="empty-state"><div className="empty-visual"><BookOpenText size={30} /></div><span className="eyebrow">YEREL PDF ASİSTANI</span><h2>Belgeni aç, aradığın bilgiyi saniyeler içinde bul.</h2><p>Özet çıkar, sorular sor ve her yanıtın dayandığı sayfayı anında görüntüle.</p><button onClick={() => inputRef.current?.click()}><FolderOpen size={17} /> PDF seç</button><small>PDF · En fazla 50 MB · İnternet bağlantısı gerekmez</small></section>}
          {status === "processing" && <section className="processing-card"><div className="processing-orbit"><LoaderCircle size={25} className="spinner" /></div><div><h2>Belge hazırlanıyor</h2><p>{processingLabel}</p></div></section>}

          {hasDocument && <>
            <section className="summary-card"><div className="summary-heading"><span className="response-icon violet"><Sparkles size={17} /></span><div><small>OTOMATİK ÖZET</small><h2>Belgenin kısa özeti</h2></div></div><p>{summary}</p><div className="tags">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div></section>
            {messages.length === 0 && <section className="suggestions"><small>HIZLI BAŞLANGIÇ</small><h3>Bu belgeye ne sormak istersin?</h3><div>{suggestionItems.map((item) => <button key={item} onClick={() => void ask(item)}>{item}<ArrowUp size={13} /></button>)}</div></section>}
            <div className="message-list">
              {messages.map((message) => <article className="message-pair" key={message.id}><div className="user-message"><span>{message.question}</span></div><div className="assistant-message"><span className="response-icon"><MessageSquareText size={17} /></span><div className="answer-copy"><div className="answer-heading"><h2>Belge yanıtı</h2><button onClick={() => void copyAnswer(message)} title="Yanıtı kopyala">{copiedId === message.id ? <Check size={14} /> : <Clipboard size={14} />}</button></div><p>{message.answer}</p><button className="source-chip" onClick={() => showSource(message.page, message.excerpt, message.terms)}><Highlighter size={14} /> Sayfa {message.page} · Kaynağı aç</button></div></div></article>)}
              {isAnswering && <div className="assistant-message thinking"><span className="response-icon"><LoaderCircle size={17} className="spinner" /></span><div><h2>Belgede aranıyor</h2><span><i /><i /><i /></span></div></div>}
            </div>
            <div className="composer"><textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void ask(); } }} placeholder="Bu belge hakkında bir şey sor…" rows={2} disabled={isAnswering} /><div><span>Enter ile gönder · Shift + Enter ile yeni satır</span><button aria-label="Soruyu gönder" disabled={!question.trim() || status !== "ready" || isAnswering} onClick={() => void ask()}><ArrowUp size={17} /></button></div></div>
          </>}
        </div>
      </main>

      {sourceOpen && <button className="panel-backdrop" aria-label="Kaynak panelini kapat" onClick={() => setSourceOpen(false)} />}
      <aside className={`source-panel ${sourceOpen ? "open" : ""}`}>
        <div className="source-title"><div><span>Kaynak belge</span><small>Sayfa metni · yalnızca yerel</small></div><div className="source-actions"><button onClick={() => inputRef.current?.click()}><FolderOpen size={15} /> Değiştir</button><button className="close-source" onClick={() => setSourceOpen(false)} aria-label="Kaynak panelini kapat"><X size={15} /></button></div></div>
        {hasDocument ? <article className="paper"><header><strong>{fileName.toUpperCase()}</strong><span>{String(sourcePage).padStart(2, "0")}</span></header><p>{sourceExcerpt ? highlightedText(sourceExcerpt, sourceTerms) : "Bu sayfada seçilebilir metin bulunamadı."}</p><footer><button disabled={sourcePage <= 1} onClick={() => changePage(sourcePage - 1)} aria-label="Önceki sayfa"><ChevronLeft size={16} /></button><span>Sayfa {sourcePage} / {pages.length}</span><button disabled={sourcePage >= pages.length} onClick={() => changePage(sourcePage + 1)} aria-label="Sonraki sayfa"><ChevronRight size={16} /></button></footer></article> : <div className="source-empty"><FileText size={24} /><p>Kaynak metni görmek için bir PDF aç.</p></div>}
        <p className="local-note"><LockKeyhole size={13} /> İçerik yalnızca bu cihazdaki yerel kütüphanede saklanır.</p>
      </aside>

      <input ref={inputRef} className="file-input" type="file" accept="application/pdf,.pdf" onChange={(event) => void openPdf(event.target.files?.[0])} />
    </div>
  );
}

export default App;
