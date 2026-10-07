# belge.ai

Local-first, privacy-focused PDF document assistant. `belge.ai` extracts PDF text on-device, answers questions from the document and links every answer to its source page.

![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)

## Highlights

- Native Windows and macOS desktop application built with Tauri
- Page-by-page PDF extraction with PDF.js
- Local summaries, keyword analysis and document search
- Answers linked to the original source page
- Conversation history with copyable answers
- Responsive source panel with highlighted search terms
- Processing progress, clear empty states and practical error messages
- Drag-and-drop and native file selection
- No uploads, accounts or API keys required
- Local document library keeps extracted text and conversations available between sessions

## Project structure

```text
desktop/       Tauri + React desktop application
app/           Original web prototype
components/    Web prototype UI primitives
```

## Run the desktop app

Requirements: Node.js 22+, Rust and the platform-specific Tauri prerequisites.

```bash
cd desktop
npm install
npm run tauri dev
```

Create a production application bundle:

```bash
cd desktop
npm run tauri build
```

## Current search model

The current version is deliberately API-free. It ranks sentences using normalized query terms and returns extractive answers from the best matching page. This keeps the first release fast, private and fully offline.

## Roadmap

- [x] Native desktop application
- [x] Page-based PDF extraction
- [x] Local search with real source pages
- [x] Persistent local document library
- [ ] Embedding-based semantic search
- [ ] Optional local LLM through Ollama
- [ ] Optional OpenAI-powered RAG mode
- [ ] Signed macOS and Windows installers

## License

MIT
