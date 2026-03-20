# 0_Excerpt_Overview.md

## The Vision

**Xcerpt** is a premium, desktop-based Context Staging Environment designed specifically for developers who integrate AI models (ChatGPT, Claude, Gemini, etc.) into their daily workflows.

The process of feeding an LLM context from a large codebase is traditionally fraught with friction: token limits force tedious copy-pasting, directory structures are lost in translation, and 1,000-line files consume massive amounts of context when only 50 lines are actually relevant.

Xcerpt solves this by acting as an intelligent middle-layer. It allows developers to visually curate files from multiple project roots, surgically "compress" large files by skipping irrelevant code blocks without losing their structural integrity, and seamlessly drag-and-drop the optimized results directly into their AI chat interfaces.

## Core Value Propositions

1. **Frictionless LLM Integration:** Eliminate the need to manually zip files or copy-paste text. Curate your context visually and drag the final optimized package straight from Xcerpt into your browser.
2. **Context Compression:** Save thousands of tokens and improve AI focus. Visually skip or "ghost" unneeded functions within large files while preserving the file's outer structure.
3. **Automated Chunking:** Effortlessly bypass chat application file limits (e.g., 10-file upload caps) with automated export chunking.
4. **Research & Multi-Project Capabilities:** Load up your main project alongside documentation directories and reference codebases in a single workspace.

## Key Features

- **The "Save-As" Workspace:** Open the app and start working immediately in an "Untitled Workspace." No forced saving until you decide to persist your configuration as a `.xcerpt` file.
- **Multi-Root Tabbed Interface:** Manage multiple directory roots (e.g., `Frontend`, `Backend`, `Docs`) within a single unified workspace.
- **Unified File Tree:** A highly performant file tree that displays _all_ files. Excluded files are visually dimmed rather than hidden, allowing you to instantly understand what is and isn't included in your export.
- **Monaco-Powered Compression Engine:** A built-in code editor (powered by the same engine as VS Code) lets you highlight code blocks and mark them to be skipped or ghosted.
- **Smart Export & `ExportedFileTree.md`:** Xcerpt dynamically generates a highly optimized markdown representation of your project structure, annotating which files were loaded and which were ignored, giving the AI perfect spatial awareness of your codebase.
