<div align="center">

# Markdown Editor

**A minimal, fast and elegant Markdown editor — built with Electron.**

Write in Markdown, see the result instantly, and export to PDF. No clutter, no distractions.

[![Download latest](https://img.shields.io/github/v/release/SpsProjectNet/markdowneditor?label=download&sort=semver&color=success)](https://spsprojectnet.github.io/MarkDownEditor/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)](#installation)
[![Built with Electron](https://img.shields.io/badge/built%20with-Electron-47848F.svg?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Languages](https://img.shields.io/badge/i18n-11%20languages-orange.svg)](#localization)

### [Download the latest version](https://spsprojectnet.github.io/MarkDownEditor/)

</div>

---

## Features

- **Live preview** — write Markdown on one side, see the rendered result on the other.
- **Editable preview (WYSIWYG)** — edit the rendered document directly; changes are converted back to clean Markdown.
- **Formatting toolbar** — headings (H1–H3), bold, italic, lists, quotes, inline code, links, images, videos and emojis — all one click away.
- **Multi-tab** — open and work on several files at once, one tab per document.
- **Split view** — drag a tab to the left or right edge (or use the split button) to view and edit two documents side by side.
- **Tab context menu** — right-click a tab to close others, close tabs to the right or left, or close them all.
- **Save, Undo / Redo & Revert** — full control over your edits, with unsaved-changes protection on close.
- **Print & Export to PDF** — turn any document into a clean, print-ready PDF.
- **Clickable links** — click a link to another Markdown file to open it in a tab; external pages ask for confirmation before opening in your browser.
- **Media insertion** — quickly embed images, videos and emojis.
- **File associations** — open `.md`, `.markdown` and `.txt` files straight from your file manager ("Open with").
- **Session restore** — reopens the files you had open last time.
- **11 languages** — automatic system-language detection with a manual switcher.
- **Update notifications** — a popup lets you know as soon as a new version is available, with a one-click link to download it.
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

### "Unknown publisher" / security warning

The installers are **not code-signed**, so Windows and macOS show a security
warning the first time you run them. The warning means the system cannot verify
*who* published the file — it does **not** mean the file is harmful.

Every installer is built automatically by
[GitHub Actions](.github/workflows/release.yml) from the source in this
repository, and each release records the exact commit it was built from. If you
would rather not bypass the warning at all, you can
[build the app yourself from source](#getting-started-from-source).

You only need to go through these steps **once per version**.

#### Windows — Microsoft Defender SmartScreen

1. Run `MarkdownEditor.Setup.<version>.exe`.
2. A blue window appears: **"Windows protected your PC"**.
3. Click **More info** — an extra line appears, showing *Publisher: Unknown publisher*.
4. Click **Run anyway** to start the installer.

If the **Run anyway** button is missing, your organisation may enforce SmartScreen
by policy; in that case ask your administrator, or build from source instead.

Reference: [Microsoft Defender SmartScreen](https://learn.microsoft.com/en-us/windows/security/operating-system-security/virus-and-threat-protection/microsoft-defender-smartscreen/)

#### macOS — Gatekeeper

Open the `.dmg` and drag **MarkdownEditor** into your *Applications* folder, then
follow the steps for your macOS version. Apple removed the old Control-click
shortcut in macOS 15, so the two paths differ.

**macOS 15 (Sequoia) and later**

1. Open the app from *Applications*. macOS blocks it and shows a warning — click **Done**.
2. Open *System Settings* → *Privacy & Security* and scroll down to the **Security** section.
3. Next to the message about MarkdownEditor being blocked, click **Open Anyway**, then confirm with **Open** and enter your password.
   The button only appears for about an hour after step 1 — if it is gone, just repeat step 1.

**macOS 14 (Sonoma) and earlier**

1. Control-click (right-click) the app in *Applications* and choose **Open**.
2. Click **Open** in the dialog to confirm.

References: [Safely open apps on your Mac](https://support.apple.com/en-us/102445) —
[Open a Mac app from an unknown developer](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unknown-developer-mh40616/mac) —
[Apple's note on the Sequoia change](https://developer.apple.com/news/?id=saqachfa)

#### Linux — no warning

Nothing to bypass. Make the AppImage executable and run it:

```bash
chmod +x MarkdownEditor-*.AppImage
./MarkdownEditor-*.AppImage
```

Or install the Debian package:

```bash
sudo dpkg -i markdown-editor_<version>_amd64.deb
```

> Removing these warnings requires a paid code-signing certificate (and, on macOS,
> a yearly Apple Developer subscription), which this project does not currently use.

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
6. **Work side by side**: drag a tab to the left or right edge (or click the split button next to the language menu) to open two documents at once. Right-click a tab for quick close actions.

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
