"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp, BookOpenText, Check, ChevronLeft, ChevronRight, FileText,
  Highlighter, MessageSquareText, MoreHorizontal, PanelLeft, Plus, Search,
  Sparkles, Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type PdfPage = { number: number; text: string };
type SearchResult = { answer: string; page: number; excerpt: string };

const demoPages: PdfPage[] = [
  { number: 1, text: "HİZMET SÖZLEŞMESİ İşbu sözleşme müşteri ile hizmet veren arasındaki çalışma şartlarını düzenler. Taraflar görev kapsamı, ücretlendirme ve teslim koşullarında anlaşmıştır." },
  { number: 2, text: "Hizmet veren, görevlerini özenle ve belirlenen takvime uygun biçimde yerine getirir. Müşteri gerekli bilgi ve belgeleri zamanında sağlar." },
  { number: 3, text: "Taraflar çalışma sırasında öğrendikleri ticari ve kişisel bilgileri gizli tutar. Gizlilik yükümlülüğü sözleşmenin sona ermesinden sonra da devam eder." },
  { number: 4, text: "4. Sözleşmenin Süresi İşbu sözleşme imza tarihinden itibaren bir yıl süreyle geçerlidir. Taraflardan herhangi biri, sürenin bitiminden en az 30 gün önce yazılı bildirimde bulunmadığı takdirde sözleşme aynı koşullarla bir yıl daha uzar. Taraflardan her biri 30 gün önceden yazılı bildirimde bulunarak sözleşmeyi feshedebilir." },
];

const quickQuestions = [
  "Belgenin ana konusu nedir?",
  "Önemli tarih ve süreleri bul",
  "Tarafların yükümlülükleri neler?",
];

const history = [
  { title: "Hizmet Sözleşmesi", meta: "4 sayfa · bugün", active: true },
  { title: "2025 Faaliyet Raporu", meta: "48 sayfa · dün" },
  { title: "Proje Teknik Şartname", meta: "24 sayfa · 2 gün önce" },
];

const stopWords = new Set([
  "acaba", "ama", "ancak", "bana", "belge", "belgenin", "bir", "bu", "da", "daha", "de",
  "diye", "en", "gibi", "hakkında", "hangi", "ile", "ise", "için", "mı", "mi", "mu", "mü",
  "ne", "nedir", "neler", "nasıl", "olan", "olarak", "ve", "veya", "şu", "çok",
]);

function tokenize(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .normalize("NFKD")
    .replace(/[^a-z0-9çğıöşü\s]/gi, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

function sentences(value: string) {
  return value
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 35);
}

function makeSummary(pages: PdfPage[]) {
  const allSentences = pages.flatMap((page) => sentences(page.text).map((text, index) => ({ text, index })));
  if (!allSentences.length) return "Bu PDF’de seçilebilir metin bulunamadı. Belge taranmış bir görüntü olabilir.";
  const frequency = new Map<string, number>();
  tokenize(pages.map((page) => page.text).join(" ")).forEach((word) => frequency.set(word, (frequency.get(word) ?? 0) + 1));
  return allSentences
    .map((item) => ({ ...item, score: tokenize(item.text).reduce((sum, word) => sum + (frequency.get(word) ?? 0), 0) / Math.max(item.text.length, 80) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.text)
    .join(" ");
}

function topKeywords(pages: PdfPage[]) {
  const frequency = new Map<string, number>();
  tokenize(pages.map((page) => page.text).join(" ")).forEach((word) => frequency.set(word, (frequency.get(word) ?? 0) + 1));
  return [...frequency.entries()]
    .filter(([word]) => word.length > 4)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word.charAt(0).toLocaleUpperCase("tr") + word.slice(1));
}

function searchDocument(question: string, pages: PdfPage[]): SearchResult {
  const query = tokenize(question);
  const candidates = pages.flatMap((page) => sentences(page.text).map((text) => {
    const words = tokenize(text);
    const matches = query.reduce((score, term) => score + words.filter((word) => word.includes(term) || term.includes(word)).length, 0);
    return { page: page.number, text, score: matches + (query.length && query.every((term) => text.toLocaleLowerCase("tr").includes(term)) ? 3 : 0) };
  }));
  const best = candidates.sort((a, b) => b.score - a.score)[0];
  if (!best || best.score === 0) {
    return { answer: "Bu sorunun cevabını belgede güvenilir biçimde bulamadım. Farklı anahtar kelimelerle yeniden sorabilirsin.", page: 1, excerpt: pages[0]?.text.slice(0, 340) ?? "" };
  }
  const related = candidates.filter((item) => item.page === best.page && item.text !== best.text && item.score > 0).slice(0, 1);
  const answer = [best, ...related].map((item) => item.text).join(" ");
  return { answer, page: best.page, excerpt: best.text };
}

async function extractPdf(file: File): Promise<PdfPage[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: PdfPage[] = [];
  for (let number = 1; number <= document.numPages; number += 1) {
    const page = await document.getPage(number);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push({ number, text });
  }
  return pages;
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("Hizmet_Sozlesmesi.pdf");
  const [pages, setPages] = useState<PdfPage[]>(demoPages);
  const [summary, setSummary] = useState(makeSummary(demoPages));
  const [tags, setTags] = useState(topKeywords(demoPages));
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("Sözleşme bir yıl geçerlidir. Taraflardan biri 30 gün önceden yazılı bildirimde bulunmazsa aynı koşullarla bir yıl daha uzar.");
  const [sourcePage, setSourcePage] = useState(4);
  const [sourceExcerpt, setSourceExcerpt] = useState(demoPages[3].text);
  const [status, setStatus] = useState<"ready" | "processing" | "error">("ready");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function chooseFile(file?: File) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLocaleLowerCase("tr").endsWith(".pdf")) {
      setError("Lütfen PDF biçiminde bir belge seçin.");
      setStatus("error");
      return;
    }
    setFileName(file.name);
    setStatus("processing");
    setError("");
    setLoading(true);
    setAnswer("");
    try {
      const extracted = await extractPdf(file);
      const readable = extracted.filter((page) => page.text.length > 15);
      if (!readable.length) throw new Error("Bu PDF’de seçilebilir metin bulunamadı. OCR uygulanmış başka bir PDF deneyin.");
      setPages(extracted);
      setSummary(makeSummary(extracted));
      setTags(topKeywords(extracted));
      setSourcePage(readable[0].number);
      setSourceExcerpt(readable[0].text.slice(0, 700));
      setAnswer(`${extracted.length} sayfalık belge işlendi. Artık belge içeriği hakkında soru sorabilirsin.`);
      setStatus("ready");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "PDF işlenirken beklenmeyen bir hata oluştu.");
      setAnswer("Belge işlenemedi. Metin içeren farklı bir PDF ile yeniden deneyin.");
    } finally {
      setLoading(false);
    }
  }

  function runQuestion(value = question) {
    const clean = value.trim();
    if (!clean || status !== "ready") return null;
    setQuestion(clean);
    setLoading(true);
    const result = searchDocument(clean, pages);
    window.setTimeout(() => {
      setAnswer(result.answer);
      setSourcePage(result.page);
      setSourceExcerpt(result.excerpt);
      setLoading(false);
    }, 450);
    return result;
  }

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "ask_document",
      title: "Belgeye soru sor",
      description: "Açık PDF belge içinde arama yapar ve görünür yanıtı gerçek sayfa kaynağıyla günceller.",
      inputSchema: {
        type: "object",
        properties: { question: { type: "string", minLength: 2 } },
        required: ["question"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      async execute(input: unknown) {
        const value = (input as { question?: unknown })?.question;
        if (typeof value !== "string" || value.trim().length < 2) throw new Error("Geçerli bir soru gerekli.");
        const clean = value.trim();
        const result = searchDocument(clean, pages);
        setQuestion(clean);
        setAnswer(result.answer);
        setSourcePage(result.page);
        setSourceExcerpt(result.excerpt);
        return { answer: result.answer, sourcePage: result.page };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [pages]);

  const currentPage = pages.find((page) => page.number === sourcePage) ?? pages[0];
  const totalWords = pages.reduce((sum, page) => sum + tokenize(page.text).length, 0);

  return (
    <main className="min-h-screen bg-[#08090c] text-[#f5f5f2]">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/8 bg-[#08090c]/90 px-4 backdrop-blur-xl md:px-7">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl border border-[#d7ff4f]/25 bg-[#d7ff4f]/10 text-[#d7ff4f]"><BookOpenText className="size-[18px]" /></div>
          <div><p className="font-semibold leading-none tracking-[-0.03em]">belge.ai</p><p className="mt-1 text-[11px] text-white/35">Kaynaklı belge asistanı</p></div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs text-white/45 sm:flex"><span className={`size-1.5 rounded-full ${status === "error" ? "bg-red-400" : "bg-[#d7ff4f] shadow-[0_0_10px_#d7ff4f]"}`} />{status === "processing" ? "PDF işleniyor" : status === "error" ? "İşleme hatası" : "Tarayıcıda hazır"}</span>
          <Button variant="ghost" size="icon" className="text-white/55 hover:bg-white/5 hover:text-white"><MoreHorizontal /><span className="sr-only">Diğer seçenekler</span></Button>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1600px] grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
        <aside className="hidden border-r border-white/8 p-4 lg:flex lg:flex-col">
          <Button onClick={() => inputRef.current?.click()} className="h-11 justify-start rounded-xl bg-[#d7ff4f] text-[#121407] hover:bg-[#e4ff7d]"><Plus /> Yeni belge</Button>
          <label className="relative mt-5"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" /><input className="h-10 w-full rounded-xl border border-white/8 bg-white/[0.025] pl-9 pr-3 text-sm outline-none placeholder:text-white/25 focus:border-white/20" placeholder="Belgelerde ara" /></label>
          <p className="mb-2 mt-7 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/25">Belgelerim</p>
          <div className="space-y-1">{history.map((item, index) => <button key={item.title} className={`w-full rounded-xl px-3 py-3 text-left transition ${index === 0 ? "bg-white/[0.07]" : "hover:bg-white/[0.035]"}`}><span className="flex items-center gap-2.5 text-sm text-white/80"><FileText className={`size-4 ${index === 0 ? "text-[#d7ff4f]" : "text-white/30"}`} /><span className="truncate">{index === 0 ? fileName.replace(/\.pdf$/i, "") : item.title}</span></span><span className="ml-[26px] mt-1 block text-[11px] text-white/28">{index === 0 ? `${pages.length} sayfa · şimdi` : item.meta}</span></button>)}</div>
          <div className="mt-auto rounded-2xl border border-white/8 bg-gradient-to-br from-white/[0.04] to-transparent p-4">
            <div className="mb-3 flex items-center justify-between text-xs"><span className="text-white/55">Belge analizi</span><span className="text-[#d7ff4f]">%100 yerel</span></div>
            <Progress value={status === "processing" ? 55 : status === "ready" ? 100 : 15} className="h-1.5 bg-white/8 [&>div]:bg-[#d7ff4f]" />
            <p className="mt-3 text-[11px] leading-4 text-white/30">Dosyan cihazından çıkmadan metin ve kaynak araması yapılır.</p>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col">
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3 md:px-7">
            <div className="flex min-w-0 items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden"><PanelLeft /><span className="sr-only">Belge menüsünü aç</span></Button><div className="min-w-0"><p className="truncate text-sm font-medium">{fileName}</p><p className="mt-0.5 text-[11px] text-white/30">{pages.length} sayfa · {totalWords.toLocaleString("tr-TR")} kelime · {status === "ready" ? "Analiz hazır" : "İşleniyor"}</p></div></div>
            <div className="flex items-center gap-2 text-xs text-white/35"><Check className="size-3.5 text-[#d7ff4f]" /><span className="hidden sm:inline">Cihazda işlendi</span></div>
          </div>

          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 md:px-7 md:py-10">
            {error && <div role="alert" className="mb-6 rounded-xl border border-red-400/20 bg-red-400/8 px-4 py-3 text-sm text-red-200">{error}</div>}
            <div className="mb-7 flex items-start gap-4"><div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#986cff]/15 text-[#a989ff]"><Sparkles className="size-[17px]" /></div><div className="min-w-0"><p className="mb-2 text-sm font-medium">Belge özeti</p><p className="max-w-2xl text-[15px] leading-7 text-white/58">{summary}</p><div className="mt-4 flex flex-wrap gap-2">{tags.map((tag) => <span key={tag} className="rounded-full border border-white/8 bg-white/[0.025] px-3 py-1.5 text-xs text-white/45">{tag}</span>)}</div></div></div>
            <div className="ml-0 border-t border-white/8 pt-7 md:ml-[52px]"><p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-white/25">Sorulabilecekler</p><div className="flex flex-wrap gap-2">{quickQuestions.map((item) => <button key={item} onClick={() => runQuestion(item)} className="rounded-xl border border-white/8 bg-white/[0.025] px-3.5 py-2.5 text-left text-sm text-white/58 transition hover:border-[#d7ff4f]/25 hover:bg-[#d7ff4f]/5 hover:text-white">{item}</button>)}</div></div>
            <div className="mt-10 flex items-start gap-4"><div className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/8 bg-white/[0.04] text-white/55"><MessageSquareText className="size-[17px]" /></div><div className="min-w-0 flex-1"><p className="mb-2 text-sm font-medium">Yanıt</p>{loading ? <div className="space-y-2 py-2"><div className="h-3 w-full animate-pulse rounded bg-white/8" /><div className="h-3 w-5/6 animate-pulse rounded bg-white/8" /><div className="h-3 w-2/3 animate-pulse rounded bg-white/8" /></div> : <p className="text-[15px] leading-7 text-white/65">{answer}</p>}{!loading && status === "ready" && <button onClick={() => setSourcePage(sourcePage)} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#a989ff]/20 bg-[#a989ff]/8 px-3 py-2 text-xs text-[#c5b3ff] hover:bg-[#a989ff]/12"><Highlighter className="size-3.5" /> Sayfa {sourcePage} · Gerçek kaynak</button>}</div></div>
            <div className="mt-auto pt-10"><div className="rounded-2xl border border-white/10 bg-[#0f1015] p-2 shadow-[0_24px_80px_rgba(0,0,0,0.35)] focus-within:border-white/20"><textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); runQuestion(); } }} rows={2} placeholder="Bu belge hakkında bir şey sor..." className="max-h-36 min-h-14 w-full resize-none bg-transparent px-3 py-2 text-[15px] outline-none placeholder:text-white/22" /><div className="flex items-center justify-between px-1 pb-1"><span className="px-2 text-[11px] text-white/22">Yanıtlar yalnızca yüklediğin PDF’den çıkarılır</span><Button onClick={() => runQuestion()} size="icon" disabled={!question.trim() || loading || status !== "ready"} className="rounded-xl bg-[#d7ff4f] text-[#121407] hover:bg-[#e4ff7d]"><ArrowUp /><span className="sr-only">Soruyu gönder</span></Button></div></div></div>
          </div>
        </section>

        <aside className="hidden border-l border-white/8 bg-white/[0.012] p-5 lg:block">
          <div className="flex items-center justify-between"><p className="text-sm font-medium">Kaynak belge</p><span className="rounded-md bg-[#d7ff4f]/10 px-2 py-1 text-[10px] font-medium text-[#d7ff4f]">SAYFA {sourcePage} / {pages.length}</span></div>
          <button onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void chooseFile(event.dataTransfer.files[0]); }} className={`mt-5 w-full rounded-2xl border border-dashed p-4 text-left transition ${dragging ? "border-[#d7ff4f]/60 bg-[#d7ff4f]/8" : "border-white/10 bg-white/[0.025] hover:border-white/20"}`}><span className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-white/5 text-white/45"><Upload className="size-4" /></span><span><span className="block text-xs font-medium text-white/65">PDF’i değiştir</span><span className="mt-1 block text-[10px] text-white/25">Sürükle veya bilgisayardan seç</span></span></span></button>
          <div className="mt-5 flex min-h-[430px] flex-col overflow-hidden rounded-2xl border border-white/8 bg-[#efeee8] p-6 text-[#24231f] shadow-2xl">
            <div className="mb-5 flex items-center justify-between border-b border-black/10 pb-4"><span className="max-w-[190px] truncate text-[9px] font-bold tracking-[0.12em]">{fileName.toLocaleUpperCase("tr")}</span><span className="text-[9px] text-black/40">{String(sourcePage).padStart(2, "0")}</span></div>
            <p className="font-serif text-[10px] leading-[1.85] text-black/65">{sourceExcerpt || currentPage?.text || "Bu sayfada seçilebilir metin bulunamadı."}</p>
            <div className="mt-auto flex items-center justify-between border-t border-black/10 pt-4"><button disabled={sourcePage <= 1} onClick={() => { const next = Math.max(1, sourcePage - 1); setSourcePage(next); setSourceExcerpt(pages.find((page) => page.number === next)?.text.slice(0, 700) ?? ""); }} className="rounded-lg p-2 text-black/45 hover:bg-black/5 disabled:opacity-20"><ChevronLeft className="size-4" /><span className="sr-only">Önceki sayfa</span></button><span className="text-[9px] text-black/35">{sourcePage} / {pages.length}</span><button disabled={sourcePage >= pages.length} onClick={() => { const next = Math.min(pages.length, sourcePage + 1); setSourcePage(next); setSourceExcerpt(pages.find((page) => page.number === next)?.text.slice(0, 700) ?? ""); }} className="rounded-lg p-2 text-black/45 hover:bg-black/5 disabled:opacity-20"><ChevronRight className="size-4" /><span className="sr-only">Sonraki sayfa</span></button></div>
          </div>
        </aside>
      </div>
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => void chooseFile(event.target.files?.[0])} />
    </main>
  );
}
