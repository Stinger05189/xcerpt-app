# Project Conventions & Architecture

> **[IMMUTABLE AI DIRECTIVE]**
> **DO NOT MODIFY THIS INSTRUCTION BLOCK.**
> This file serves as the living architectural "brain" for this specific project. It contains the source of truth for the tech stack, naming conventions, structural constraints, and learned lessons.
>
> **Your Responsibilities:**
>
> 1. **Read First:** Reference this file during Phase 1 (Triangulation) of every session to ensure your proposed strategy aligns with established patterns.
> 2. **Maintain & Rewrite:** During the `[END SESSION]` teardown protocol, you are expected to rewrite, append, or reorganize the sections _below_ this block. If we establish a new architectural rule, encounter a recurring bug, or solidify a naming convention, you must add it here so it is not forgotten in future sessions.
> 3. **Keep it Dense:** Remove outdated patterns. Keep descriptions concise and technical.

---

## 1. Tech Stack & Environment

- **Primary Language:** TypeScript (Strict Mode)
- **Core Frameworks:** Electron (Desktop App Shell), Node.js (Main Process), React 18+ (Renderer Process)
- **Build Tooling:** Vite
- **State Management:** Zustand (Global State), LocalStorage (Temporary Workspace persistence)
- **Styling / UI Tooling:** Tailwind CSS (Utility-first), Lucide React (Icons)
- **Specialized Libraries:** `@monaco-editor/react` (Code Compression UI), `chokidar` (File Watching), `ignore` / `micromatch` (Glob Filtering)

## 2. Architectural Boundaries & Data Flow

- **Separation of Concerns (Main vs. Renderer):**
  - **Main Process (Node.js):** Handles all OS-level operations (File System scanning with `chokidar`, disk I/O, writing exports, OS drag-and-drop APIs).
  - **Renderer Process (React):** Handles UI, state management, and visual rule filtering. _Never directly accesses the `fs` module._
- **IPC Bridge (`preload.cjs`):** All communication between React and Node must pass through typed asynchronous `ipcRenderer.invoke` calls exposed on the `window.api` object.
- **Data Mutation:** State is managed via Zustand. State updates must be immutable. Complex nested updates should use structured setter functions within the store.

## 3. Formatting & Naming Conventions

- **File Structure:** Feature-based grouping within `src/` (e.g., `src/components`, `src/store`, `src/ipc`, `src/utils`).
- **Casing Rules:**
  - Files (Components/Views): `PascalCase.tsx`
  - Files (Utils/Stores/Hooks): `camelCase.ts`
  - Interfaces/Types: `PascalCase` (Do not prefix with 'I').
  - Variables/Functions: `camelCase`.
- **Styling:** Use Tailwind utility classes directly in `className`. For complex conditional classes, use template literals or a library like `clsx`/`tailwind-merge`. Dark mode is the primary target.

## 4. Execution Patterns & 'Gotchas'

- **Stable Relative Paths (CRITICAL):** To prevent the selection/scroll reset bugs present in the legacy Python application, React `key` props and Zustand state identifiers (e.g., `selectedFiles`, `expandedFolders`) MUST use the file's Stable Relative Path from the project root (e.g., `src/components/Button.tsx`). Never use array indexes or volatile UI IDs.
- **Visual State Filtering:** Excluded files must NOT be removed from the DOM/Tree data structure. Instead, the Renderer applies an "excluded" status flag, and the UI responds by rendering the item with opacity (dimmed) and a disabled state.
- **Context Compression Coordinates:** Skip markers in Monaco must be mapped to specific line numbers (`startLine`, `endLine`) relative to the original file, saved immutably in the workspace state under the specific file's relative path.
