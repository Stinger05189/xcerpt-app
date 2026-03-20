# 2_Excerpt_Workflows.md

This document defines the exact step-by-step user journeys for the application's core functions.

## Flow 1: The Workspace Lifecycle

1. **Launch:** The user opens Xcerpt and is greeted by a clean Welcome Screen featuring "Recent Workspaces" and "New Workspace."
2. **Initialization:** Clicking "New Workspace" immediately drops the user into the main UI. The title bar reads _Untitled Workspace_.
3. **Adding Roots:** The user clicks "+ Add Root Path" and selects their local frontend repository. A tab appears at the top. They click it again to add a local documentation folder.
4. **Persistence:** After configuring their filters and compressions, the user hits `Ctrl+S` (Save As). A system dialog prompts them to save a `frontend_task.xcerpt` file anywhere on their machine.

## Flow 2: Curation & The Unified Tree

1. **Viewing the Tree:** The Main Stage displays the file tree for the active Root Path Tab.
2. **Fuzzy Searching:** The user types "Auth" in the tree's local search bar. The tree instantly filters to show only files/folders containing "Auth". _(Note: This does not affect the export, only the UI view)._
3. **Applying Rules:** The user sees a `node_modules` folder. They uncheck the box next to it.
4. **Visual Feedback:** The `node_modules` folder and all its children instantly dim to 50% opacity.
5. **Rule Inspection:** The user hovers over the dimmed `node_modules` folder. A tooltip appears: _"Excluded by rule: `node_modules/`"_. This rule is also now visible and toggleable in the Sidebar "Rules" tab.

## Flow 3: Context Compression (The Magic Workflow)

1. **Selection:** The user clicks `App.tsx` in the Unified Tree.
2. **Editor Split:** A right-hand pane opens containing the Monaco Editor, displaying the code with syntax highlighting.
3. **Marking a Skip:** The user highlights lines 10 through 150 (a massive, irrelevant UI component). They right-click and select **"Skip Block"**.
4. **Visual Folding:** The code from lines 10-150 collapses into a stylish, inline UI pill that reads `[ ... Skipped 140 lines ... ]`.
5. **Previewing:** The user toggles a "Preview Output" switch at the top of the editor. The view changes to a read-only text file showing exactly what the AI will see:
   ```typescript
   // ... [Skipped: 140 lines] ...
   export function relevantFunction() { ... }
   ```

## Flow 4: Export Staging, Chunking, & Drag-and-Drop

1. **Initiate Export:** The user clicks the prominent "Stage Export" button.
2. **Staging Panel:** The Main Stage shifts to a "Flat List Preview" showing all files queued for export.
3. **Applying Chunk Limits:** Knowing Claude/ChatGPT has a file limit, the user sets the "Max Files per Msg" input to `10`.
4. **Batch Generation:** The UI instantly divides the 25 curated files into three visual blocks: **Chunk 1** (10 files), **Chunk 2** (10 files), and **Chunk 3** (5 files).
5. **Drag to Chat:** Next to "Chunk 1", there is a draggable Package Icon. The user clicks and drags this icon completely outside the Xcerpt window and drops it directly into their browser's ChatGPT text area.
6. **Under the Hood:** On the `dragstart` event, Xcerpt instantly writes those 10 specific files (applying all compressions and the `ExportedFileTree.md`) to a hidden OS temp folder and hands the temp paths to the OS drag-and-drop API.
