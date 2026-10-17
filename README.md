<div align="center">

# VibeMap

**Scan any project folder. Get a plain-language summary and a visual map of your codebase.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/Azzam0707-crypto/Vibemap)](https://github.com/Azzam0707-crypto/Vibemap/releases/latest)
[![Tests](https://img.shields.io/badge/tests-127%20passing-brightgreen.svg)](#testing)
[![Electron](https://img.shields.io/badge/built%20with-Electron-47848F.svg)](https://www.electronjs.org/)

</div>

---

## Overview

VibeMap is a desktop app that points at a project folder, scans its structure, and produces:

- A plain-English explanation of what the project does and how it's organized
- An interactive **Project Map** — a dependency graph of files and folders, laid out automatically with [dagre](https://github.com/dagrejs/dagre)
- Git-aware change tracking across scans
- A history of past scans, so nothing is lost between sessions

No vendor lock-in: bring your own AI provider (endpoint + API key), and VibeMap handles the rest.

## Table of Contents

- [Features](#features)
- [Download](#download)
- [Build from Source](#build-from-source)
- [Usage](#usage)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Testing](#testing)
- [Contributing](#contributing)
- [Built With](#built-with)
- [License](#license)

## Features

| Feature | Description |
|---|---|
| Folder scanning | Walks a project directory, skipping `node_modules`, `.git`, build output, and other noise by default |
| AI summaries | Configurable provider — OpenAI-compatible, Anthropic, Ollama, or any custom endpoint |
| Project Map | Flat, dagre-laid-out dependency graph with curved connectors and zoom controls |
| Git integration | Tracks added/modified/removed files via `git diff` / `git status` |
| Scan history | Revisit previous analyses without re-scanning |
| Secure key storage | API keys encrypted at rest via OS-level secure storage, where available |

## Download

Grab the latest Windows build from [Releases](https://github.com/Azzam0707-crypto/Vibemap/releases/latest):

- **VibeMap Setup — Windows installer** (recommended)
- **VibeMap — portable**, no install needed

Prefer building it yourself? See [Build from Source](#build-from-source).

## Build from Source

```bash
git clone https://github.com/Azzam0707-crypto/Vibemap.git
cd Vibemap
npm install
npm start
```

## Usage

1. Launch the app and select a project folder.
2. VibeMap scans the folder and generates a summary + Project Map.
3. Open Settings to configure your AI provider before the first scan.
4. Re-scan anytime to see what changed since your last pass.

## Configuration

VibeMap needs an AI provider to generate summaries. In **Settings**, set:

- **Endpoint** — any OpenAI-compatible, Anthropic, or Ollama-style API
- **Model** — the model name for that provider
- **API key** — stored encrypted on disk when the OS supports it, with a plaintext fallback and a warning if it doesn't

Example endpoints by provider:

| Provider | Endpoint |
|---|---|
| OpenAI | `https://api.openai.com/v1` |
| Anthropic | `https://api.anthropic.com/v1` |
| Ollama (local) | `http://localhost:11434` |
| Custom / self-hosted | any OpenAI-compatible base URL |

## Architecture

- **Electron** — desktop app shell, with context isolation and a sandboxed renderer
- **jsPlumb Community** — connector/diagram rendering
- **dagre** — automatic graph layout for the Project Map
- **Playwright** — end-to-end test suite (127 tests)

## Testing

```bash
npx playwright test
```

The suite covers scanning, diagramming, provider configuration, security (CSP, XSS, key handling), and UI flows end to end.

## Contributing

Issues and pull requests are welcome. Please run the test suite before submitting changes.

## Built With

VibeMap was built through AI-assisted development — Claude (Anthropic) for planning, review, and iteration, with [opencode](https://opencode.ai) driving implementation in the editor.

## License

[MIT](LICENSE)
