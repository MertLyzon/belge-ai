import type { PdfPage, SearchResult } from "./documentStore";

const stopWords = new Set([
  "acaba", "ama", "ancak", "bana", "belge", "belgenin", "bir", "bu", "da", "daha", "de",
  "diye", "en", "gibi", "hakkinda", "hangi", "ile", "ise", "icin", "mi", "mu", "ne", "nedir",
  "neler", "nasil", "olan", "olarak", "ve", "veya", "su", "cok", "the", "this", "that", "and",
  "are", "what", "which", "about", "document", "please", "tell", "does", "from", "with",
]);

const concepts: Record<string, string[]> = {
  identity: ["ad", "adi", "isim", "ismini", "kim", "kime", "ait", "name", "named", "owner", "candidate"],
  summary: ["icerik", "icerigi", "konu", "ozet", "anlat", "hakkinda", "content", "summary", "about", "overview", "profile"],
  experience: ["deneyim", "deneyimi", "tecrube", "calisti", "calismis", "kariyer", "is", "experience", "employment", "work", "career", "professional"],
  education: ["egitim", "okul", "universite", "mezun", "bolum", "education", "university", "college", "degree", "academic"],
  skills: ["beceri", "becerileri", "yetenek", "uzmanlik", "teknoloji", "skills", "skill", "competencies", "technologies", "technical"],
  contact: ["iletisim", "telefon", "email", "eposta", "adres", "contact", "phone", "mail", "linkedin"],
  date: ["tarih", "sure", "zaman", "gun", "hafta", "ay", "yil", "basla", "bitis", "date", "duration", "day", "week", "month", "year", "start", "end"],
  obligation: ["yukumluluk", "sorumluluk", "gorev", "taahhut", "zorunlu", "obligation", "responsibility", "duty", "commitment", "required"],
};

const cvHeadingAliases: Record<string, string[]> = {
  profile: ["profile", "summary", "objective", "about me", "professional summary", "profil", "hakkimda", "kariyer hedefi"],
  experience: ["experience", "work experience", "employment", "employment history", "professional experience", "deneyim", "is deneyimi", "tecrube"],
  education: ["education", "academic background", "qualifications", "egitim", "egitim bilgileri"],
  skills: ["skills", "technical skills", "competencies", "expertise", "technologies", "beceriler", "yetenekler", "teknik beceriler"],
  contact: ["contact", "contact information", "personal details", "iletisim", "iletisim bilgileri"],
  languages: ["languages", "language", "diller", "yabanci diller"],
  certificates: ["certifications", "certificates", "courses", "sertifikalar", "sertifika"],
  projects: ["projects", "selected projects", "projeler"],
};

const allCvHeadings = Object.values(cvHeadingAliases).flat();
const roleWords = [
  "developer", "engineer", "analyst", "manager", "specialist", "consultant", "designer", "intern",
  "director", "assistant", "student", "software", "data", "business", "muhendis", "uzman", "stajyer",
  "yonetici", "gelistirici", "ogrenci",
];

export function normalize(value: string) {
  return value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i").replace(/[^a-z0-9@.+\s-]/g, " ").replace(/\s+/g, " ").trim();
}

export function queryTerms(value: string) {
  const normalized = normalize(value);
  const terms = new Set(normalized.split(/\s+/).filter((word) => word.length > 2 && !stopWords.has(word)));
  for (const words of Object.values(concepts)) {
    if (words.some((word) => normalized.includes(normalize(word)))) words.forEach((word) => terms.add(normalize(word)));
  }
  return [...terms];
}

function isTurkishQuestion(question: string) {
  return /[çğıöşü]/i.test(question) || /\b(bu|kim|kime|nedir|neler|hangi|icerik|içerik|egitim|eğitim|deneyim|beceri|iletisim|iletişim|ait)\b/i.test(question);
}

function pageLines(page: PdfPage) {
  if (page.lines?.length) return page.lines.filter(Boolean);
  return page.text.split(/\n|(?<=[.!?])\s+|\s*[•●▪]\s*/).map((line) => line.trim()).filter(Boolean);
}

function documentText(pages: PdfPage[]) {
  return normalize(pages.map((page) => page.text).join(" "));
}

function looksLikeCv(pages: PdfPage[]) {
  const text = documentText(pages);
  const signals = [
    /\b(curriculum vitae|resume|cv)\b/, /\b(work |professional )?experience\b/, /\beducation\b/,
    /\bskills\b/, /\bemployment\b/, /\b(deneyim|egitim|beceriler|ozgecmis)\b/,
    /@[a-z0-9.-]+\.[a-z]{2,}/,
  ];
  return signals.filter((signal) => signal.test(text)).length >= 3;
}

export function suggestedQuestions(pages: PdfPage[]) {
  return looksLikeCv(pages)
    ? ["Bu CV kime ait?", "Adayın deneyimleri neler?", "Hangi becerilere sahip?"]
    : ["Bu belgenin içeriği ne?", "Belgedeki önemli bilgileri çıkar", "Önemli tarih ve süreleri bul"];
}

function intentFor(question: string, isCv: boolean) {
  const text = normalize(question);
  const has = (key: keyof typeof concepts) => concepts[key].some((word) => text.includes(normalize(word)));
  if (isCv && (/\b(kime ait|whose|who is|ad[ıi] ne|ismi ne)\b/.test(text) || (has("identity") && /\b(cv|ozgecmis|resume)\b/.test(text)))) return "identity";
  if (isCv && has("contact")) return "contact";
  if (isCv && has("experience")) return "experience";
  if (isCv && has("education")) return "education";
  if (isCv && has("skills")) return "skills";
  if (isCv && (has("summary") || /\b(cv|ozgecmis|resume)\b/.test(text))) return "summary";
  return "generic";
}

function isHeading(line: string) {
  const text = normalize(line).replace(/\s+/g, " ");
  return allCvHeadings.some((heading) => text === normalize(heading));
}

function plausibleName(value: string) {
  const clean = value.replace(/[|•·].*$/, "").replace(/\s+/g, " ").trim();
  const normalized = normalize(clean);
  const words = clean.split(/\s+/);
  if (clean.length < 5 || clean.length > 55 || words.length < 2 || words.length > 4) return undefined;
  if (/[@0-9:/]|\b(cv|resume|curriculum|profile|summary)\b/i.test(clean)) return undefined;
  if (roleWords.some((word) => normalized.split(" ").includes(word))) return undefined;
  if (isHeading(clean)) return undefined;
  const nameLikeWords = words.filter((word) => /^[\p{Lu}][\p{L}'’-]+$/u.test(word) || /^[\p{Lu}]{2,}$/u.test(word));
  return nameLikeWords.length === words.length ? clean : undefined;
}

function extractName(pages: PdfPage[]) {
  const first = pages[0];
  if (!first) return undefined;
  const candidates = [...(first.headings ?? []), ...pageLines(first).slice(0, 14)];
  for (const candidate of candidates) {
    const name = plausibleName(candidate);
    if (name) return name;
  }
  const beginning = first.text.slice(0, 280);
  const titleCase = beginning.match(/(?:^|\s)((?:[A-ZÇĞİÖŞÜ][a-zçğıöşü'’-]+|[A-ZÇĞİÖŞÜ]{2,})(?:\s+(?:[A-ZÇĞİÖŞÜ][a-zçğıöşü'’-]+|[A-ZÇĞİÖŞÜ]{2,})){1,3})/u);
  const fromText = titleCase?.[1] ? plausibleName(titleCase[1]) : undefined;
  if (fromText) return fromText;
  const email = beginning.match(/\b([a-z][a-z0-9]+)[._-]([a-z][a-z0-9]+)@[a-z0-9.-]+\.[a-z]{2,}\b/i);
  return email ? `${email[1]} ${email[2]}`.replace(/\b\w/g, (letter) => letter.toUpperCase()) : undefined;
}

type Section = { key: string; page: number; lines: string[] };

function cvSections(pages: PdfPage[]) {
  const sections: Section[] = [];
  let current: Section | undefined;
  for (const page of pages) {
    for (const line of pageLines(page)) {
      const normalized = normalize(line);
      const key = Object.entries(cvHeadingAliases).find(([, aliases]) =>
        aliases.some((alias) => normalized === normalize(alias)),
      )?.[0];
      if (key) {
        current = { key, page: page.number, lines: [] };
        sections.push(current);
      } else if (current && line.length > 1) {
        current.lines.push(line);
      }
    }
  }
  return sections;
}

function compactSection(section: Section | undefined, maxLines = 5) {
  if (!section) return undefined;
  const useful = section.lines.filter((line) => line.length > 2).slice(0, maxLines);
  if (!useful.length) return undefined;
  return { text: useful.join(" · "), page: section.page };
}

function contactDetails(pages: PdfPage[]) {
  const raw = pages.map((page) => page.text).join("\n");
  const details: string[] = [];
  const email = raw.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0];
  const phone = raw.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]?.trim();
  const linkedIn = raw.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+/i)?.[0];
  if (email) details.push(`e-posta: ${email}`);
  if (phone) details.push(`telefon: ${phone}`);
  if (linkedIn) details.push(`LinkedIn: ${linkedIn}`);
  return details;
}

function naturalList(items: string[], conjunction: string) {
  if (items.length < 2) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ${conjunction} ${items[items.length - 1]}`;
}

function cvAnswer(question: string, pages: PdfPage[]): SearchResult | undefined {
  const intent = intentFor(question, true);
  if (intent === "generic") return undefined;
  const turkish = isTurkishQuestion(question);
  const name = extractName(pages);
  const sections = cvSections(pages);
  const get = (key: string) => compactSection(sections.find((section) => section.key === key));
  const firstPage = pages[0]?.number ?? 1;
  const excerpt = (page: number) => pages.find((item) => item.number === page)?.text.slice(0, 1800) ?? "";
  const result = (answer: string, page = firstPage): SearchResult => ({
    answer, page, excerpt: excerpt(page), terms: queryTerms(question), kind: "direct",
  });

  if (intent === "identity") {
    if (name) return result(turkish ? `Bu CV ${name} adlı adaya ait görünüyor.` : `This CV appears to belong to ${name}.`);
    return result(turkish ? "CV’de adayın adını güvenilir biçimde ayırt edemedim." : "I couldn't reliably identify the candidate's name.");
  }
  if (intent === "contact") {
    const details = contactDetails(pages);
    if (details.length) return result(turkish ? `CV’de bulunan iletişim bilgileri: ${details.join(" · ")}.` : `Contact details found in the CV: ${details.join(" · ")}.`);
  }
  if (["experience", "education", "skills"].includes(intent)) {
    const section = get(intent);
    if (section) {
      const labels: Record<string, [string, string]> = {
        experience: ["İş deneyimi", "Work experience"], education: ["Eğitim", "Education"], skills: ["Beceriler", "Skills"],
      };
      return result(`${turkish ? labels[intent][0] : labels[intent][1]}: ${section.text}`, section.page);
    }
  }
  if (intent === "summary") {
    const available = [
      get("profile") && (turkish ? "profili" : "profile"),
      get("experience") && (turkish ? "iş deneyimi" : "work experience"),
      get("education") && (turkish ? "eğitimi" : "education"),
      get("skills") && (turkish ? "becerileri" : "skills"),
      contactDetails(pages).length && (turkish ? "iletişim bilgileri" : "contact details"),
    ].filter(Boolean) as string[];
    if (turkish) {
      return result(`Bu belge${name ? ` ${name} adlı adaya ait` : ""} bir özgeçmiş. ${available.length ? `Adayın ${naturalList(available, "ve")} hakkında bilgi içeriyor.` : "Adayın mesleki geçmişi ve nitelikleri hakkında bilgi içeriyor."}`);
    }
    return result(`This document is a résumé${name ? ` for ${name}` : ""}. It contains information about ${available.length ? naturalList(available, "and") : "the candidate's professional background and qualifications"}.`);
  }
  return undefined;
}

function chunks(pages: PdfPage[]) {
  return pages.flatMap((page) => {
    const lines = pageLines(page);
    if (lines.length > 1) {
      return lines.flatMap((line, index) => {
        const next = lines[index + 1];
        return [{ page: page.number, text: line }, ...(next && line.length < 90 ? [{ page: page.number, text: `${line}: ${next}` }] : [])];
      });
    }
    return page.text.split(/(?<=[.!?])\s+/).map((text) => ({ page: page.number, text }));
  }).filter((row) => row.text.trim().length > 12);
}

function matchScore(text: string, terms: string[]) {
  const words = normalize(text).split(/\s+/);
  return terms.reduce((score, term) => score + words.reduce((inner, word) => {
    if (word === term) return inner + 4;
    if (term.length >= 5 && (word.startsWith(term) || term.startsWith(word))) return inner + 2;
    return inner;
  }, 0), 0);
}

function extractiveAnswer(question: string, pages: PdfPage[]): SearchResult {
  const terms = queryTerms(question);
  const ranked = chunks(pages).map((row) => ({ ...row, score: matchScore(row.text, terms) }))
    .sort((a, b) => b.score - a.score || b.text.length - a.text.length);
  const best = ranked[0];
  if (!best || best.score === 0) {
    const fallback = pages.find((page) => page.text);
    return {
      answer: isTurkishQuestion(question)
        ? "Bu bilgi belgede açıkça yer almıyor veya soruyu mevcut metinle güvenilir biçimde eşleştiremedim. Kişi, bölüm ya da konu adını belirterek tekrar deneyebilirsin."
        : "I couldn't reliably match that question to the document. Try including a person, section, or topic name.",
      page: fallback?.number ?? 1, excerpt: fallback?.text.slice(0, 1200) ?? "", terms, kind: "not-found",
    };
  }
  const support = ranked.find((row) => row.page === best.page && row.text !== best.text && row.score > 0);
  return {
    answer: [best.text, support?.text].filter(Boolean).join(" "),
    page: best.page,
    excerpt: pages.find((page) => page.number === best.page)?.text.slice(0, 1800) ?? best.text,
    terms,
    kind: "extractive",
  };
}

function summaryAnswer(question: string, pages: PdfPage[]): SearchResult {
  const rows = chunks(pages).filter((row) => row.text.length >= 35 && !isHeading(row.text));
  const frequency = new Map<string, number>();
  for (const word of normalize(pages.map((page) => page.text).join(" ")).split(/\s+/)) {
    if (word.length > 3 && !stopWords.has(word)) frequency.set(word, (frequency.get(word) ?? 0) + 1);
  }
  const selected = rows.map((row, order) => ({
    ...row,
    order,
    score: normalize(row.text).split(/\s+/).reduce((sum, word) => sum + (frequency.get(word) ?? 0), 0) /
      Math.max(8, normalize(row.text).split(/\s+/).length),
  })).sort((a, b) => b.score - a.score).slice(0, 3).sort((a, b) => a.order - b.order);
  const first = selected[0] ?? rows[0];
  const answer = selected.map((row) => row.text).join(" ");
  if (!first || !answer) return extractiveAnswer(question, pages);
  return {
    answer,
    page: first.page,
    excerpt: pages.find((page) => page.number === first.page)?.text.slice(0, 1800) ?? answer,
    terms: queryTerms(question),
    kind: "direct",
  };
}

export function answerQuestion(question: string, pages: PdfPage[]): SearchResult {
  if (looksLikeCv(pages)) {
    const direct = cvAnswer(question, pages);
    if (direct) return direct;
  }
  const normalizedQuestion = normalize(question);
  if (concepts.summary.some((term) => normalizedQuestion.includes(normalize(term))) ||
      /\b(ana fikir|onemli bilgi|nelerden bahsed|main idea|key points)\b/.test(normalizedQuestion)) {
    return summaryAnswer(question, pages);
  }
  return extractiveAnswer(question, pages);
}
