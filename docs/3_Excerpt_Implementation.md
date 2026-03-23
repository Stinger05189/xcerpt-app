# 3_Excerpt_Implementation.md

This is the phased, strict execution plan. **Do not proceed to a subsequent phase until the Validation Criteria of the current phase are entirely met.**

## [COMPLETED] Epoch 1: Foundation & Curation Engine

_Previously executed phases (0-5) established the core application._

- **Phase 0 & 1:** Electron/Vite/React scaffolding, IPC bridge, and base Zustand setup.
- **Phase 2:** Node.js recursive file scanning, `chokidar` integration, and the Unified Visual Tree.
- **Phase 3:** Monaco Editor integration and the Context Compression (Skip Block) engine.
- **Phase 4 & 5:** Background payload staging, intelligent markdown tree generation, chunk limitation UI, and native OS Drag-and-Drop capability.

---

## [COMPLETED] Epoch 2: The Multi-Workspace IDE Environment

_Previously executed phases (6-8) established session persistence and workspace management._

- **Phase 6:** Auto-Save Serialization & AppStore Foundation.
- **Phase 7:** UI Header Consolidation & Multi-Workspace Tabbing.
- **Phase 8:** The Workspace Browser & Metadata Querying.

---

## [ACTIVE] Epoch 3: Advanced Workflows & Customization

### Phase 9: Selection Stats & Ephemeral Quick Exports

- **Action:**
  - **Root Path Context Menu:** Add a right-click "Reveal in OS" context menu specifically for the Root Path sub-tabs in the Main Stage.
  - **Selection Stats:** Introduce a fixed bottom bar in the `FileTree` component that displays live metrics strictly for the _current selection_ (Selection Size, Disc Size, Estimated Tokens using a fast byte-to-token heuristic).
  - **Explicit Quick Export:** Add an explicit "Generate Quick Export" button to the tree's bottom bar.
  - **Ephemeral Payload Engine:** Wiring the Quick Export button to a new Node.js IPC handler that generates a process-bound, temporary payload _only_ for the selected files, entirely bypassing the background chunking engine used for full workspace exports.
- **Validation:** User paints a selection of 5 files, views the estimated token count at the bottom of the tree, clicks "Generate Quick Export", waits <1s, and can instantly drag the resulting pill into a chat interface.

### Phase 10: Workspace Presets & Sidebar Overhaul

- **Action:**
  - **Schema Migration:** Refactor the `WorkspacePayload` schema to introduce `presets`. Move `exclusions`, `treeOnly`, `compressions`, and `inclusions` out of the global workspace root and into individual Preset objects.
  - **Sidebar Restructure:** Overhaul the left sidebar to support Preset CRUD operations (Create, Rename, Delete, Save).
  - **Compartmentalization:** Clearly separate the UI for Workspace Global Rules (Hard Blacklists, Global Stats) from Preset-Specific Rules (Tree-Only lists, Exclusions, History).
  - **History Tracking:** Implement an "Export History" specifically for ephemeral quick exports (tracking date, file count, size, tokens) allowing instant re-selection of previous ephemeral payloads.
- **Validation:** User can create a "Frontend Context" preset and a "Backend Context" preset within the same Workspace, each maintaining completely independent visual exclusions and skipped code blocks.

### Phase 11: Global Application Configuration & Theming

- **Action:**
  - **AppConfig Persistence:** Create a new `config.json` schema managed by the `AppStore` that operates entirely agnostic of workspaces.
  - **Theme Engine:** Map UI colors, fonts (size/family), and application scale to CSS variables injected at the `:root` level.
  - **Settings UI:** Build a global Settings modal/view to allow users to modify Background colors, Foreground/Text colors, Accent colors, Selection states, and global keyboard shortcuts.
- **Validation:** Modifying the Accent Color in the global settings instantly updates all active UI highlights (buttons, active tabs, Monaco editor margins) across the entire application without requiring a reload.

### Phase 12: Extension Overrides

- **Action:**
  - **Override Dictionary:** Add an `extensionOverrides` mapping object (e.g., `{ ".uproject": ".json" }`) to the global `AppConfig`.
  - **Settings UI:** Build a dropdown/editable input interface in the settings for users to define and manage custom extension overrides.
  - **Export Engine Integration:** Modify `exportEngine.ts` to dynamically rename files matching these extensions during the flattening process.
  - **Markdown Annotation:** Crucially, update the `ExportedFileTree.md` generation logic to explicitly annotate renamed files in the LLM prompt (e.g., `MyGame.uproject (Exported as MyGame.json)`).
- **Validation:** Dragging a `.uproject` file to a browser chat uploads it as a `.json` file, and the AI correctly identifies it as the `.uproject` file based on the `ExportedFileTree.md` legend.
