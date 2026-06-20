<div align="center">

# Markdown Editor

**A minimal, fast and elegant Markdown editor — built with Electron.**

Write in Markdown, see the result instantly, and export to PDF. No clutter, no distractions.

[![Download latest](https://img.shields.io/github/v/release/SpsProjectNet/markdowneditor?label=download&sort=semver&color=success)](https://github.com/SpsProjectNet/markdowneditor/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)](#installation)
[![Built with Electron](https://img.shields.io/badge/built%20with-Electron-47848F.svg?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Languages](https://img.shields.io/badge/i18n-11%20languages-orange.svg)](#localization)

### [Download the latest version](https://github.com/SpsProjectNet/markdowneditor/releases/latest)

</div>

---

## Features

- **Live preview** — write Markdown on one side, see the rendered result on the other.
- **Editable preview (WYSIWYG)** — edit the rendered document directly; changes are converted back to clean Markdown.
- **Formatting toolbar** — headings (H1–H3), bold, italic, lists, quotes, inline code, links, images, videos and emojis — all one click away.
- **Multi-tab** — open and work on several files at once, one tab per document.
- **Save, Undo / Redo & Revert** — full control over your edits, with unsaved-changes protection on close.
- **Print & Export to PDF** — turn any document into a clean, print-ready PDF.
- **Media insertion** — quickly embed images, videos and emojis.
- **File associations** — open `.md`, `.markdown` and `.txt` files straight from your file manager ("Open with").
- **Session restore** — reopens the files you had open last time.
- **11 languages** — automatic system-language detection with a manual switcher.
- **Update notifications** — get notified inside the app when a new version is available.
- **Cross-platform** — native builds for Windows, macOS and Linux.

---

## Installation

### Download a ready-made build

Grab the latest installer for your operating system from the
[**latest release**](https://github.com/SpsProjectNet/markdowneditor/releases/latest):

| Platform | Format |
|----------|--------|
| Windows  | `.exe` (NSIS installer) |
| macOS    | `.dmg` |
| Linux    | `.AppImage` / `.deb` |

> macOS builds are not code-signed, so Gatekeeper may show a warning on first launch.
> Right-click the app and choose **Open** to run it the first time.

---

## Getting started (from source)

Requirements: [Node.js](https://nodejs.org/) 20+ and npm.

```bash
# Clone the repository
git clone https://github.com/SpsProjectNet/markdowneditor.git
cd markdowneditor

# Install dependencies
npm install

# Launch the app
npm start
```

---

## Build

Create distributable installers with [electron-builder](https://www.electron.build/):

```bash
npm run dist:win     # Windows  (.exe)
npm run dist:mac     # macOS    (.dmg)
npm run dist:linux   # Linux    (.AppImage, .deb)
npm run pack         # Unpacked build (no installer — quick test)
```

The output is generated in the `dist/` folder.

---

## Usage

1. **Open** a Markdown file (or start typing right away).
2. Toggle **Source** to switch between the preview-only view and the split editor/preview view.
3. Use the **formatting toolbar** or write Markdown by hand — both stay in sync.
4. **Save** to write back to the original file, or **Export to PDF** to share it.
5. Open multiple files: each one gets its own **tab**.

---

## Localization

Available in **11 languages**, with automatic detection of your system language
and a manual switcher in the toolbar:

English, Italiano, Español, Deutsch, Français, Português, Русский, Türkçe, Ελληνικά, العربية, 中文

Translations live in the [`locales/`](locales/) folder — contributions for new languages are very welcome!

---

## Tech stack

- [**Electron**](https://www.electronjs.org/) — cross-platform desktop runtime
- [**marked**](https://marked.js.org/) — Markdown to HTML rendering
- [**turndown**](https://github.com/mixmark-io/turndown) — HTML to Markdown conversion
- [**electron-builder**](https://www.electron.build/) — packaging & distribution

---

## Contributing

Contributions are welcome! Please note that **every change goes through a Pull Request
that must be reviewed and approved** before it is merged — no changes are pushed
directly to `main`.

Read the [**Contributing guide**](CONTRIBUTING.md) for the full workflow.

---

## License

Released under the [**MIT License**](LICENSE).

---

<div align="center">

### Made by [SpsProject.net](https://spsproject.net)

A project by **Cristian Segattini**

<br/>

**SpsProject.net**

[![Facebook](https://img.shields.io/badge/Facebook-1877F2?logo=facebook&logoColor=white)](https://www.facebook.com/SpsProject.Net)
[![Instagram](https://img.shields.io/badge/Instagram-E4405F?logo=instagram&logoColor=white)](https://www.instagram.com/spsproject)
[![X](https://img.shields.io/badge/X-000000?logo=x&logoColor=white)](https://x.com/SpsProject_Net)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?logo=linkedin&logoColor=white)](https://www.linkedin.com/company/spsproject.net)

**Cristian Segattini**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/cristian-segattini/)

<sub>© 2026 SpsProject.net — All rights reserved.</sub>

</div>
