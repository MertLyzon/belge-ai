# belge.ai Desktop

PDF dosyalarini cihazdan disari cikarmadan inceleyen yerel Tauri uygulamasi.

## Development

```bash
npm install
npm run tauri dev
```

## Desktop installers

Windows and macOS installers are built with GitHub Actions:

1. Push a version tag such as `v0.5.1`, or run **Actions > Masaustu uygulamalarini derle > Run workflow**.
2. Download `belge-ai-windows-x64` for the Windows 10/11 NSIS installer.
3. Download `belge-ai-macos-aarch64` for the Apple Silicon macOS DMG.

The Windows installer is unsigned, so Windows SmartScreen may show a warning. The macOS app uses a valid ad-hoc bundle signature; because it is not Apple-notarized yet, macOS may still require approval from **System Settings > Privacy & Security** on first launch.

## Local macOS build

```bash
npm run tauri build
```

The macOS application is generated under `src-tauri/target/release/bundle/macos/`.
PDF processing stays on the local device and does not require an API key.
Original PDFs, extracted text and conversations are stored in the app's local IndexedDB library and can be removed individually.

## Local chat engine

The offline answer engine recognizes Turkish and English question intent. For CVs it can directly answer questions about the candidate, experience, education, skills and contact details. PDF lines and section headings are preserved during extraction so answers stay grounded in the source layout.

Run the deterministic chat regression checks with:

```bash
npm run test:chat
```
