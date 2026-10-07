# belge.ai Desktop

PDF dosyalarini cihazdan disari cikarmadan inceleyen yerel Tauri uygulamasi.

## Development

```bash
npm install
npm run tauri dev
```

## Desktop installers

Windows and macOS installers are built with GitHub Actions:

1. Push a version tag such as `v0.3.0`, or run **Actions > Masaustu uygulamalarini derle > Run workflow**.
2. Download `belge-ai-windows-x64` for the Windows 10/11 NSIS installer.
3. Download `belge-ai-macos-aarch64` for the Apple Silicon macOS DMG.

The application is unsigned, so Windows SmartScreen or macOS Gatekeeper may show a warning.

## Local macOS build

```bash
npm run tauri build
```

The macOS application is generated under `src-tauri/target/release/bundle/macos/`.
PDF processing stays on the local device and does not require an API key.
Extracted text and conversations are stored in the app's local IndexedDB library and can be removed individually.
