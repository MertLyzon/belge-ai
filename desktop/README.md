# belge.ai Desktop

PDF dosyalarini cihazdan disari cikarmadan inceleyen yerel Tauri uygulamasi.

## Development

```bash
npm install
npm run tauri dev
```

## macOS build

```bash
npm run tauri build
```

The macOS application is generated under `src-tauri/target/release/bundle/macos/`.

## Windows installer

The Windows installer is built on a Windows runner with GitHub Actions:

1. Push the repository to GitHub.
2. Open **Actions > Windows uygulamasini derle > Run workflow**.
3. Download the `belge-ai-windows-x86_64` artifact when the job finishes.
4. Extract and run `BelgeAI_*_x64-setup.exe` on Windows 10 or Windows 11.

Pushing a version tag such as `v0.1.0` also starts this build automatically.
PDF processing stays on the local device and does not require an API key.
