import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });

try {
  const { answerQuestion, suggestedQuestions } = await server.ssrLoadModule("/src/chatEngine.ts");
  const pages = [{
    number: 1,
    text: "JANE DOE\nDATA ANALYST\njane.doe@example.com | +44 20 1234 5678\nPROFILE\nData analyst focused on operational reporting.\nEXPERIENCE\nAcme Corp — Data Analyst — 2022–Present\nBuilt dashboards and automated reporting.\nEDUCATION\nUniversity of London — BSc Computer Science\nSKILLS\nPython, SQL, Power BI, Tableau",
    lines: [
      "JANE DOE", "DATA ANALYST", "jane.doe@example.com | +44 20 1234 5678", "PROFILE",
      "Data analyst focused on operational reporting.", "EXPERIENCE", "Acme Corp — Data Analyst — 2022–Present",
      "Built dashboards and automated reporting.", "EDUCATION", "University of London — BSc Computer Science",
      "SKILLS", "Python, SQL, Power BI, Tableau",
    ],
    headings: ["JANE DOE", "DATA ANALYST", "PROFILE", "EXPERIENCE", "EDUCATION", "SKILLS"],
  }];

  assert.match(answerQuestion("CV kime ait?", pages).answer, /JANE DOE/);
  assert.match(answerQuestion("Bu CV’nin içeriği ne?", pages).answer, /özgeçmiş/i);
  assert.match(answerQuestion("Nerede çalışmış?", pages).answer, /Acme Corp/);
  assert.match(answerQuestion("Eğitimi nedir?", pages).answer, /University of London/);
  assert.match(answerQuestion("Hangi becerileri var?", pages).answer, /Python.*SQL.*Power BI/);
  assert.match(answerQuestion("İletişim bilgileri ne?", pages).answer, /jane\.doe@example\.com/);
  assert.deepEqual(suggestedQuestions(pages), ["Bu CV kime ait?", "Adayın deneyimleri neler?", "Hangi becerilere sahip?"]);
  console.log("Chat engine: 7/7 checks passed");
} finally {
  await server.close();
}
