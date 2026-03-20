# 3_Excerpt_Implementation.md

This is the phased, strict execution plan. **Do not proceed to a subsequent phase until the Validation Criteria of the current phase are entirely met.**

## Phase 0: Project Initialization (Manual Boilerplate)

_Because AI tools struggle with initial complex environment scaffolding, this step is performed manually by the user, who then feeds the resulting configuration files back to the AI._

- **Action:**
  1. Run `npm create vite@latest xcerpt-app -- --template react-ts` (or an equivalent Electron-Vite boilerplate).
  2. Install core dependencies: `electron`, `tailwindcss`, `zustand`, `lucide-react` (icons), `chokidar`, `ignore`.
  3. Configure `main.js`, `preload.js`, and Vite for Electron.
  4. Provide the AI with `package.json`, `vite.config.ts`, `main.js`, and `preload.js`.
- **Validation:** Running `npm run dev` successfully opens an Electron window displaying a basic React "Hello World".

## Phase 1: Shell Architecture & IPC State

- **Action:**
  - Implement the global layout using Tailwind CSS (Sidebar, Main Stage, Tabs).
  - Set up the Zustand store (`useWorkspaceStore`) supporting the "Untitled" state.
  - Establish the IPC Bridge. Create typed endpoints in `preload.js` for pinging the Main process.
- **Validation:** The UI renders correctly. Clicking a mock "Add Root" button updates the Zustand state, and the UI reacts by rendering a new Tab.

## Phase 2: File System & The Unified Tree

- **Action:**
  - **Main Process:** Implement `chokidar` to scan a directory and send a nested JSON tree to the Renderer.
  - **Renderer:** Build the recursive React Tree component.
  - Integrate the `ignore` library. Map checkboxes in the tree to an `exclusions` array in Zustand.
- **Validation:** Pointing the app at a local folder renders the tree instantly. Unchecking a folder adds it to the exclude list and visually dims it in the UI. Expanding folders and scrolling survives React re-renders (using stable relative paths as keys).

## Phase 3: The Context Compression Engine

- **Action:**
  - Install `@monaco-editor/react`.
  - Implement the split-pane layout for the editor.
  - Capture user text selections. Create a context menu or floating toolbar to add `{ startLine, endLine }` coordinates to the Zustand `compressions` state.
  - Use Monaco's `deltaDecorations` API to visually fold and style the skipped lines.
- **Validation:** Selecting lines and clicking "Skip" visually collapses the code in the editor. The skipped coordinates are accurately saved in the global state object for that specific file.

## Phase 4: Export Engine & Chunking Logic

- **Action:**
  - **Main Process:** Write the logic to create a temporary directory.
  - Implement the file reader/writer that splices out skipped lines based on the compression coordinates.
  - Generate the optimized `ExportedFileTree.md` based on the final payload.
  - **Renderer:** Build the "Flat List Preview" UI. Implement the logic to divide the flattened file array into chunks based on a `maxFiles` integer.
- **Validation:** Clicking "Export" successfully creates a temporary folder on the OS containing the correctly modified files, the `.md` tree, and groups them accurately into chunk subfolders.

## Phase 5: Native Drag & Drop & Final Polish

- **Action:**
  - Connect the UI "draggable icon" to Electron's `webContents.startDrag({ file: tempPath })` API via `preload.js`.
  - Integrate `tiktoken` in a Web Worker or the Main process to calculate and stream token estimates to the Sidebar Stats tab.
  - Implement fuzzy search overlays.
  - Finalize Dark/Light theme toggle.
- **Validation:** A user can drag a "Chunk" icon from the React UI directly to their desktop or a web browser, and the OS successfully copies the temporary files. Token counts update dynamically as files are checked/unchecked.
