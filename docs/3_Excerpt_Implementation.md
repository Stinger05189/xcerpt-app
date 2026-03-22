# 3_Excerpt_Implementation.md

This is the phased, strict execution plan. **Do not proceed to a subsequent phase until the Validation Criteria of the current phase are entirely met.**

## [COMPLETED] Epoch 1: Foundation & Curation Engine

_Previously executed phases (0-5) established the core application._

- **Phase 0 & 1:** Electron/Vite/React scaffolding, IPC bridge, and base Zustand setup.
- **Phase 2:** Node.js recursive file scanning, `chokidar` integration, and the Unified Visual Tree.
- **Phase 3:** Monaco Editor integration and the Context Compression (Skip Block) engine.
- **Phase 4 & 5:** Background payload staging, intelligent markdown tree generation, chunk limitation UI, and native OS Drag-and-Drop capability.

---

## [ACTIVE] Epoch 2: The Multi-Workspace IDE Environment

### Phase 6: Auto-Save Serialization & AppStore Foundation

- **Action:**
  - Establish the `AppStore` (Zustand) to manage global IDE state (active workspace ID, loaded workspaces).
  - Define the `XcerptWorkspace` serialization schema.
  - Create the IPC endpoints for reading/writing JSON payload strings to the OS `AppData/Roaming/Xcerpt/Sessions/` directory.
  - Implement a debounced middleware or `useEffect` in React that automatically serializes the active `WorkspaceStore` state to disk whenever critical data changes.
- **Validation:** Creating rules or compressions in the UI writes a `.json` file to the OS AppData folder. Closing and reopening the application restores the exact state of that specific workspace automatically.

### Phase 7: UI Header Consolidation & Multi-Workspace Tabbing

- **Action:**
  - Overhaul `TitleBar.tsx` to act as the primary navigation header.
  - Convert the top-left Xcerpt logo into an interactive "Home" button.
  - Implement Global Workspace Tabs in the Title Bar.
  - Wire the tabs to the `AppStore`. Clicking a tab must swap the active `WorkspaceStore` ID, thereby entirely replacing the Main Stage context.
- **Validation:** The user can open Workspace A, define rules, click `+` to open Workspace B, define different rules, and instantly swap between them via the top tabs without losing state in either.

### Phase 8: The Workspace Browser & Metadata Querying

- **Action:**
  - Create a full-screen or large modal overlay triggered by the Home logo.
  - **Main Process:** Create an IPC endpoint `getWorkspaceMetadata()` that lightly reads all JSON files in the Sessions directory and returns only the `metadata` blocks.
  - **Renderer:** Build the browser UI allowing users to search/filter their history based on `rootPaths` (e.g., querying for "UE_Projects"), sorting by `updatedAt`.
  - Add "Rename Workspace" and "Delete Workspace" functionalities to the browser.
- **Validation:** The user clicks the Home button, sees a list of all historical sessions rich with metadata, searches for a specific folder path, and clicks a result to immediately load it into a new Global Workspace Tab.

### Phase 9: Performance Caching & Virtualization

- **Action:**
  - Address the memory footprint of holding multiple 100,000+ file trees in memory simultaneously.
  - Implement logic to selectively purge `rawTrees` from inactive `WorkspaceStores` if memory thresholds are exceeded, forcing a fast background `chokidar` rescan only when the tab is re-focused.
  - Ensure React components belonging to inactive tabs are completely unmounted rather than hidden via CSS `display: none`.
- **Validation:** Opening 5 massive workspaces simultaneously does not crash the application or cause noticeable interaction latency.
