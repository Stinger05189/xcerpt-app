# 2_Excerpt_Workflows.md

# Xcerpt: Operational Workflows & User Journeys

> **Scope:** Definitive step-by-step documentation of core user workflows, operational sequence diagrams, input modifiers, edge-case handling, and error recovery states.

---

## Flow 1: The Workspace Lifecycle & Workspace Browser

```
[Launch App] ──> [Load app.json] ──> [Hydrate Tabs & Active Workspace]
       │
       ├─ No Open Tabs ─────────> [Auto-Open Workspace Browser Overlay]
       └─ Tabs Present ─────────> [Render Workspace IDE Main Stage]
                                                 │
 [Click Logo / Ctrl+O] <─────────────────────────┘
       │
       ▼
 [Workspace Browser Overlay]
       ├─ Search Query Filter (Matches Name & Root Paths)
       ├─ Sort Mode Toggle (Recent, Name, Most Exports)
       ├─ Card Actions: Inline Rename (Enter/Check), Delete (Trash)
       ├─ "New Workspace" Button ──> [Generate UUID] ──> [Open Empty Session]
       └─ Click Existing Card ─────> [Pack Active] ──> [Flush Disk] ──> [Switch Context]
```

### 1.1. Application Boot & Session Hydration

1. **Cold Boot:** The Electron main process launches. `Bootstrapper.tsx` reads `app.json` via `window.api.loadAppState()`.
2. **Tab Restoration:** Open tab metadata (`openTabs: [{ id, title }]`) and `activeWorkspaceId` are loaded into `AppStore`.
3. **Empty Fallback:** If `app.json` is missing or contains an empty tab array, Xcerpt immediately displays the full-screen `WorkspaceBrowser` overlay.
4. **Active Workspace Hydration:** The active workspace file (`<workspaceId>.json`) is loaded from the OS user data directory:
   - Presets, scanner blacklists, settings, and UI states are unpacked into `WorkspaceStore`.
   - Each root directory in `rootPaths` is dispatched to `window.api.scanDirectory`.

### 1.2. Navigating the Workspace Browser

1. **Summoning:** The user clicks the Xcerpt SVG logo in the top-left title bar or presses the browser shortcut.
2. **Filtering & Sorting:** The user types in the search box to filter by project name or root path. Workspaces can be sorted by _Recent_ (last updated), _Name_ (alphabetical), or _Most Exports_ (combined total + ephemeral exports).
3. **Card Metrics Inspection:** Each workspace card displays:
   - Root path snippets with truncation.
   - Lifetime metric badges: **Full Exports** and **Ephemeral Exports**.
   - Relative modification timestamp (e.g., `12m ago`, `3d ago`) and total included file counts.
4. **Inline Renaming:** Clicking the edit icon toggles an inline input. Hitting `Enter` or clicking the check icon calls `window.api.renameWorkspace(id, newName)`. If the edited workspace is currently loaded, the title bar tab title updates in real time.
5. **Session Deletion:** Clicking the trash icon triggers a confirmation prompt. On approval, `window.api.deleteWorkspace(id)` removes the file from disk, strips the tab from `openTabs` if open, and recalculates the active tab.

### 1.3. Multi-Workspace Tab Operations

- **Tab Switching:** Clicking any tab in the TitleBar triggers the Single Re-hydrating Store context switch: the current workspace is flushed to disk, the incoming session is unpacked, and root directories are scanned.
- **Drag Reordering:** Tabs feature native HTML5 drag-and-drop (`draggable={true}`). Users can drag tabs horizontally; on drop, `reorderWorkspaceTabs(draggedId, targetId)` updates tab order and records an undoable command.
- **Closing Tabs:** Clicking `X` removes the tab. If the active tab is closed, Xcerpt automatically focuses the previous tab or summons the Workspace Browser if no tabs remain.

---

## Flow 2: Multi-Root Ingestion & Missing Directory Recovery

```
 [Click "+ Add Root"] ──> [OS Directory Dialog] ──> [window.api.scanDirectory]
                                                           │
                      ┌────────────────────────────────────┴────────────────────────────────────┐
                      ▼                                                                         ▼
             Directory Exists                                                          Directory Missing
                      │                                                                         │
       [Add to rootPaths & rawTrees]                                            [Add to missingRoots Set]
       [Inherit .gitignore & Rules]                                             [Render AlertTriangle Tab]
       [Update activeTab View]                                                  [Render Relocation Stage]
                                                                                                │
                                                                                    [Click "Locate Directory"]
                                                                                                │
                                                                                    [Select New Folder Path]
                                                                                                │
                                                                                    [relocateRootPath Action]
                                                                                    [Preserve All Rules & Skips]
```

### 2.1. Ingesting Multiple Roots

1. In the sub-header above the File Tree, the user clicks `+ Add Root`.
2. The native OS directory picker opens via `window.api.selectDirectory()`.
3. Upon selection, `addRootPath(path)` scans the folder, inherits any root `.gitignore` files, and adds the root to `rootPaths`.
4. Sub-tabs appear in the sub-header. Clicking a sub-tab sets `activeTab`, switching the File Tree view to that root.
5. Sub-tabs can be reordered via drag-and-drop or right-clicked to reveal the folder in the native OS file explorer (`window.api.showItemInFolder`).

### 2.2. Relocating Missing Roots

If an external drive is unmounted or a directory is renamed while Xcerpt is closed:

1. On boot, `window.api.scanDirectory` encounters an `ENOENT` error and returns `{ node, rules: [], treeOnly: [], isMissing: true }`.
2. `WorkspaceStore` adds the path to the `missingRoots` Set.
3. The root sub-tab displays a pulsing red `AlertTriangle` icon.
4. Clicking the sub-tab opens the **Directory Not Found** fallback screen in the Main Stage, displaying the original path.
5. The user clicks **Locate Directory** and selects the new path via the OS dialog.
6. `relocateRootPath(oldPath, newPath)` swaps the root key in `rootPaths` and `rawTrees`, reapplies all existing exclusions and Monaco skip blocks, and rescans the new directory without data loss.

---

## Flow 3: Unified File Tree Curation & Marquee Selection

```
 [FileTree Container]
       │
       ├─ Local Search Input ───────────────> [Fuzzy Branch Pruning]
       ├─ EyeOff / LayoutTemplate Toggles ──> [Hide Excluded / Hide Tree-Only]
       ├─ ChevronsUpDown / ChevronsDownUp ──> [Expand All / Collapse All]
       │
 [Pointer Down on Row] ──────────────────────> [Initiate 1D Math Marquee]
       │                                                 │
       ├─ Shift: Add Range                               ▼
       ├─ Alt: Subtract Range                [Pointer Move / RAF Scroll]
       ├─ Ctrl/Cmd: Toggle Pattern                       │
       └─ Plain Click: Replace Selection                 ▼
                                             [Calculate offsetY / ROW_HEIGHT]
                                             [Update selectedFiles Set]
                                             [Render Selection Brush Box]
                                                         │
                                             [Pointer Up: Commit Selection]
                                                         │
                                   ┌─────────────────────┴─────────────────────┐
                                   ▼                                           ▼
                            Single File Click                           Multi-Row Selection
                                   │                                           │
                        [Set activeFile in Editor]                  [Display Stats Bottom Bar]
                                                                    [Enable A/S/D Keyboard Rules]
```

### 3.1. Selection Modes & Modifiers

- **Plain Click:** Clears existing selections and selects the target row. If the target is a file, it opens in the Context Editor. If a folder, clicking the chevron toggles expansion.
- **Ctrl / Cmd + Click:** Toggles individual file or folder selection without affecting other selections.
- **Shift + Click / Drag:** Extends the selection range from the initial anchor row to the current cursor position.
- **Alt + Click / Drag:** Subtracts the swept range from the active selection.

### 3.2. 1D Mathematical Marquee Brushing

1. The user presses the primary mouse button over any row (outside the expand chevron).
2. `handleRowPointerDown` establishes `dragStateRef.current = { startIndex, mode }`.
3. As the pointer moves, `handlePointerMove` calculates `offsetY` and projects the cursor to the nearest linear index (`Math.floor(offsetY / ROW_HEIGHT)`).
4. A virtual selection brush (`<div className="absolute ...">`) renders over the rows.
5. If the cursor moves within 40px of the top or bottom viewport edge, a 60fps `requestAnimationFrame` loop auto-scrolls the container by 15px per frame and updates selections continuously.
6. On pointer up, listeners detach and the selection is committed.

### 3.3. Keyboard-Driven Curation Rules

When one or more files are selected, the user presses single-key shortcuts:

- **`A` (Include):** Removes target paths from exclusions and tree-only rules. Files are included in context exports.
- **`S` (Tree-Only):** Marks target paths as tree-only (`[-]`). Files appear in `ExportedFileTree.md` for spatial context, but their contents are omitted from export chunks. Rows highlight with accent italics.
- **`D` (Exclude):** Adds target paths to `excludes`. Files are dimmed to 40% opacity (or hidden entirely if "Hide Excluded" is active) and omitted from exports.
- **`Esc`:** Clears the active selection.
- **`Ctrl/Cmd + A`:** Selects all currently visible rows in the virtualized tree.

### 3.4. Context Menu & Hold-to-Confirm Blacklisting

Right-clicking any selected file or folder opens a context menu via `createPortal`:

- Quick access to Include, Tree-Only, Exclude, and OS Reveal (`Shift+Alt+R`).
- If folders are selected: **Expand Selected** and **Collapse Selected**.
- **Blacklist Folder Name:** A destructive action to exclude a directory name across all presets. To prevent accidental clicks, it uses a custom **Hold-to-Confirm** button. The user must hold the mouse button down for 500ms while a red fill bar animates before the rule commits to `pendingBlacklist`.

---

## Flow 4: Context Compression via Monaco Skip Blocks

```
 [Select File in Tree] ──> [Load Content & Signatures] ──> [Mount Monaco Editor]
                                                                  │
                         ┌────────────────────────────────────────┴────────────────────────────────────────┐
                         ▼                                                                                 ▼
                  Text / Code File                                                                    Binary / Image
                         │                                                                                 │
       [Run Drift Reconciliation Check]                                                          [Mount ImageViewer]
       [Load draftCompressions State]                                                            [Read Base64 via IPC]
                         │
     [User Highlights Code Lines 50-120]
     [Press Ctrl/Cmd + Backspace]
                         │
     [Consolidate Overlapping Ranges]
     [Push Skip Rule with Line Signatures]
     [Render Monaco Line Decorations & Ruler Marks]
     [Derived isDirty Evaluates to true]
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
   [Click "Save Skips"]           [Click "Discard"]
         │                               │
   [Commit to WorkspaceStore]     [Reset draftCompressions]
   [Flag isStale: true]           [Clear Unsaved Skips]
   [Schedule Background Build]
```

### 4.1. Defining Skip Blocks

1. The user clicks a code file in the File Tree. The right-hand pane mounts `ContextEditor.tsx`.
2. The user highlights lines 45 through 120 (e.g., internal helper functions or large static fixtures).
3. The user presses `Ctrl/Cmd + Backspace` (or right-clicks and selects _Skip Block_).
4. Monaco registers the skip:
   - Captures `startLine`, `endLine`, `lineCount`, and the exact text content of line 45 (`signature`).
   - Merges contiguous or overlapping selections into a single rule.
5. The editor updates line decorations: the skipped block dims with red background tinting and strikethrough styling, while yellow indicator bars render on the Monaco overview scrollbar.
6. The toolbar calculates the dirty state and shows:
   `14.2 KB (350 L) → 6.1 KB (120 L) [Save Skips] [Discard]`.
7. The user clicks **Save Skips**, committing the rules to `WorkspaceStore`.

### 4.2. Un-Skipping Blocks

- **Granular Un-Skip:** The user places their cursor anywhere inside a skipped region, right-clicks, and selects _Un-Skip Block_.
- **Clear All:** Clicking **Clear All** in the editor toolbar purges all skip markers for the active file.

### 4.3. View Modes

- **Preview Output:** Toggling _Preview Output_ renders the code as it will appear in the export chunk, replacing skipped lines with `// ... [Skipped N lines] ...`.
- **Render MD / Edit Raw:** When viewing Markdown files (`.md`, `.mdx`), users can toggle between the raw text Monaco editor and a rendered view powered by `react-markdown` and `remark-gfm`.
- **Image Preview:** Binary images (`.png`, `.jpg`, `.svg`, `.webp`, `.ico`) bypass the Monaco editor and render in `ImageViewer` using base64 data fetched via IPC.

### 4.4. External Drift Reconciliation

If a file is modified externally while Xcerpt is running:

1. The file watcher fires a `change` event.
2. `ContextEditor` reloads the file content from disk.
3. For each existing skip rule, the engine checks whether `lines[comp.startLine - 1] === comp.signature`.
4. If an external edit inserted or removed lines above the skip block, the signature will have shifted. The drift reconciler scans outward up to $\pm 50$ lines.
5. When the signature is found, `startLine` and `endLine` update to match the new offset, preserving the user's skip selections across external Git pulls and branch switches.

---

## Flow 5: Ephemeral Quick Exports

```
 [Paint Files in Tree] ──> [Selection Stats Bottom Bar Activates]
                                          │
                     ┌────────────────────┴────────────────────┐
                     ▼                                         ▼
            [Fast Byte Heuristic]                     [Debounced Exact Tiktoken]
            ~6,250 Tokens (Fast Path)                 6,412 Tokens (Exact BPE)
                     │
             [Click "Package Context"]
                     │
             [window.api.stageEphemeralExport]
             - Collects selected files & skips
             - Generates partial ExportedFileTree.md
             - Writes flat files to os.tmpdir()/xcerpt_ephemeral_*
                     │
             [Button Transforms into Draggable Pill]
                     │
             [Drag Pill into Browser AI Chat]
                     │
             [Auto-Log Entry in Preset History Tab]
```

### 5.1. Live Selection Stats

1. The user paints 5 files in the File Tree.
2. The bottom stats bar becomes active, displaying:
   `5 Files Selected | 28.4 KB | 6,412 Tokens`.
3. During active brushing, token counts display as an approximation (`~6,250 Tokens`).
4. Once cursor movement settles for 300ms, an effect dispatches file paths to `window.api.calculateTokens`, displaying the exact `cl100k_base` BPE count alongside a completed lightning icon.

### 5.2. Packaging and Dragging Ephemeral Payloads

1. The user clicks **Package Context** (or **Zap**).
2. The UI enters a loading state (`Packaging Context...`).
3. `generateEphemeralPayload` traverses the active tree, collecting the selected files, their skip markers, and generating a targeted `ExportedFileTree.md` that maps only the selected files.
4. `window.api.stageEphemeralExport` synchronously writes the files to a unique temporary directory in `os.tmpdir()`.
5. The button transforms into a draggable handle: **Drag Context Package**.
6. The user clicks and drags the button into their web browser (ChatGPT, Claude, Gemini).
7. On drag start, the action is logged to the active preset's **History** tab (recording timestamp, file count, total size, tokens, and file paths).

### 5.3. Restoring Past Ephemeral Selections

1. In the left Sidebar, the user selects the **History** tab.
2. Hovering over any past export card opens a flyout listing all files included in that package.
3. The user can click the **MousePointer** icon on the card to immediately re-select those exact files in the active File Tree.
4. Alternatively, clicking **Package Context** on the history card generates a fresh payload directly from that historical snapshot.

---

## Flow 6: Workspace Export Staging & Batch Chunking

```
 [Click "Configure" in Header] ──> [Open ExportStage View]
                                          │
        ┌─────────────────────────────────┼─────────────────────────────────┐
        ▼                                 ▼                                 ▼
 [Batch Size Slider]            [Single File Toggle]             [Sortable File Table]
 Adjust limit (2 - 50)          Merge to context.md              Click Headers to Sort
 Or select "Unlimited"                                           Drag Column Dividers
        │                                                                   │
        └─────────────────────────────────┬─────────────────────────────────┘
                                          ▼
                         [Debounced Auto-Build Pipeline]
                         - Flags isStale: true
                         - Waits 1500ms debounce
                         - Calls generateExportPayload()
                         - Writes chunks to os.tmpdir()/xcerpt_export_*
                                          │
                         [Chunk Drag Buttons Render in Header]
                                          │
                         [Drag Chunk 1 / Chunk 2 into Browser]
```

### 6.1. Export Configuration

1. In the MainStage header, the user clicks **Configure**. The view switches from the Context Editor to `ExportStage.tsx`.
2. The user adjusts export parameters:
   - **Batch Size Limit Slider:** Adjusts maximum files per chunk (2 to 50 files) to comply with AI chat upload limits, or check **Unlimited** to export all files in a single chunk.
   - **Merge into single context.md:** Checkbox that directs the export engine to combine the tree markdown and all included source files into a single `context.md` file using markdown code fences.

### 6.2. Interactive Chunk Inspection Table

The Export Stage displays each chunk as an independent panel with a structured data table:

- **Columns:** _File Name_, _Exported As_, _Size (KB)_, _Skips_, and _Exports_ (lifetime frequency).
- **Sorting:** Clicking any header sorts files by original path, flat exported filename, size, skip count, or export frequency.
- **Resizing:** Dragging divider handles adjusts column widths using `<colgroup>` with `table-layout: fixed`.
- **Symbol Highlighting:** Path symbols (`/`, `_`, `.`, `-`) highlight in the theme accent color for visual clarity.

### 6.3. Previewing the LLM File Tree

- Clicking **Preview Markdown** opens a full-screen overlay showing `ExportedFileTree.md`.
- Displays the directory hierarchy with single-child collapsed paths, tree-only `[-]` annotations, `[X skips]` badges, and extension override mapping notes.

### 6.4. Full Workspace Drag-and-Drop

- Once the background build engine finishes staging (`Syncing Payload...` $\to$ `Ready`), draggable buttons render in the header: **Drag Chunk 1**, **Drag Chunk 2**, etc.
- Dragging Chunk 1 into an AI chat uploads all files in that batch plus `ExportedFileTree.md`.
- Dragging increments the workspace's lifetime `totalExports` and per-file frequency counters.

---

## Flow 7: Global Theming, Scaling, & Extension Overrides

```
 [Click Settings Gear / TitleBar] ──> [Mount SettingsModal Overlay]
                                              │
        ┌─────────────────────────────────────┼─────────────────────────────────────┐
        ▼                                     ▼                                     ▼
 [Colors & Theming]                   [Typography & Scale]                 [Extension Overrides]
 - Color pickers                      - Scale Slider (0.75x - 1.5x)        - Input: .uproject -> .json
 - Updates CSS vars at :root          - Font Size Slider (10px - 18px)     - Click "Add"
 - Instant visual update              - Font Family Text Field             - AppStore marks isStale: true
                                      - webFrame.setZoomFactor called      - Export rewrites flat filenames
```

### 7.1. Dynamic Theming

1. The user clicks the **Settings** gear icon in the title bar (or presses `Esc` to close).
2. Under **Colors & Theming**, the user modifies palette values (Base Background, Panel Background, Hover, Accent, Text Primary, Text Muted, Subtle Border).
3. Changes immediately inject CSS variables (`--theme-*`) into `document.documentElement`, updating the UI instantly without component remounts.

### 7.2. UI Zoom & Font Scaling

- **UI Scale Factor Slider:** Adjusts application zoom from 0.75x to 1.5x. While dragging, values remain local to React state to prevent cursor drift. On mouse up, `webFrame.setZoomFactor` scales the Chromium window.
- **Base Font Size Slider:** Adjusts typography from 10px to 18px, directly updating the Monaco editor and the virtualized File Tree.
- **Font Family Input:** Custom monospace font stacks (e.g., `Fira Code`, `JetBrains Mono`) can be entered and applied application-wide.

### 7.3. Configuring Extension Overrides (File Spoofing)

1. Under **Extension Overrides**, the user enters an original extension (e.g., `.uproject`) and a target extension (e.g., `.json`).
2. Clicking **Add** registers the mapping in `AppConfig.extensionOverrides`.
3. `AppStore` bridges the mutation to `WorkspaceStore`, flagging `isStale: true` to trigger a background payload rebuild.
4. On export, files matching the rule are physically written with the spoofed extension, and `ExportedFileTree.md` records the mapping in its legend for the LLM.

---

## Flow 8: Global Undo/Redo & Cross-Environment Snapping

```
 [User triggers Undo (Ctrl+Z)] ──> [HistoryStore.undo()]
                                           │
                        [Extract Context from Command Head]
                        { workspaceId, activeTab, activePresetId, scrollOffsetY }
                                           │
                        [resolveContext() Protocol]
                        ├─ Target Workspace != Active?
                        │    └─ app.setActiveWorkspace() ──> [Await Disk Hydration]
                        ├─ Target Preset != Active?
                        │    └─ ws.switchPreset() ──> [Tick Pause]
                        ├─ Target Tab != Active?
                        │    └─ ws.setActiveTab() ──> [Tick Pause]
                        └─ Target Scroll != Current?
                             └─ ws.setTargetScrollY() ──> [Snap Tree Scroll]
                                           │
                        [Execute Inverse Command Closure: undo()]
                        [Move Command from undoStack to redoStack]
                        [Mount ToastContainer (Auto-Dismiss 4s)]
```

### 8.1. Command Recording

Any user mutation that alters the workspace state pushes an inverse delta closure to `HistoryStore`:

- Marking files as Included, Tree-Only, or Excluded.
- Adding or removing root paths.
- Expanding or collapsing folders (individual, selective, or bulk).
- Creating, renaming, or deleting presets.
- Adding, updating, or clearing Monaco skip blocks.
- Reordering workspace tabs or root sub-tabs.

### 8.2. Executing Cross-Context Undo/Redo

1. The user presses `Ctrl+Z` (Undo) or `Ctrl+Shift+Z` (Redo).
2. `HistoryStore` inspects the context metadata of the target command.
3. If the command was executed in a different workspace tab, Xcerpt automatically switches to that tab and awaits disk hydration.
4. If a different preset or root directory was active, the engine activates them.
5. `targetScrollY` is restored, snapping the virtualized tree back to the exact pixel coordinate where the original action occurred.
6. The inverse closure executes, reversing the mutation.
7. A toast notification slides in at the bottom-right: `Undid: Marked Excluded [Redo]`. Clicking **Redo** reverses the undo command.
