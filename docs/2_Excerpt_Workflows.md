# 2_Excerpt_Workflows.md

This document defines the exact step-by-step user journeys for the application's core functions, updated for the multi-workspace paradigm.

## Flow 1: The Workspace Lifecycle & Browser

1. **Launch & Restore:** The user opens Xcerpt. The application instantly restores the exact multi-workspace tabs that were open during their last session, preventing the need to manually reopen projects.
2. **The Home Button:** The user clicks the Xcerpt logo in the top-left of the consolidated application header. This opens the **Workspace Browser** overlay.
3. **Querying by Path:** The user is working on several Unreal Engine plugins and wants to find an older context setup. They type `UE_Projects` into the browser's search bar.
4. **Metadata Inspection:** The browser filters the list, displaying workspaces that share that root path. The user identifies the correct workspace by looking at the exposed metadata: _Created 2 weeks ago • 142 Included Files • 12 Total Exports_.
5. **Implicit Auto-Save:** The user opens the workspace, makes a few visual tree exclusions, and closes the application. No save prompt appears. The state is implicitly persisted to disk and will be exactly as they left it upon next launch. They can optionally right-click the workspace tab to "Rename" it for better permanent organization.

## Flow 2: Multi-Workspace Context Switching

1. **Simultaneous Environments:** The user is currently inside the "Frontend Task" workspace. They suddenly need to reference their "Backend API" context setup.
2. **Tab Navigation:** Instead of closing the current project, the user clicks the "Backend API" tab located in the consolidated top header (next to the Home logo and window controls).
3. **Instantaneous Swap:** The Main Stage instantly swaps out the active tree, Monaco editor state, and export staging panel. Memory caching ensures the 100,000+ files in the backend tree do not lock up the React render cycle during the swap.

## Flow 3: Curation & The Unified Tree

1. **Viewing the Tree:** The Main Stage displays the file tree for the active Root Path sub-tab.
2. **Fuzzy Searching:** The user types "Auth" in the tree's local search bar. The tree instantly filters to show only files/folders containing "Auth". _(Note: This does not affect the export, only the UI view)._
3. **Applying Rules:** The user sees a `node_modules` folder. They uncheck the box next to it.
4. **Visual Feedback:** The `node_modules` folder and all its children instantly dim to 50% opacity.
5. **Rule Inspection:** The user hovers over the dimmed `node_modules` folder. A tooltip appears: _"Excluded by rule: `node_modules/`"_. This rule is also now visible and toggleable in the Sidebar "Rules" tab.

## Flow 4: Context Compression (The Magic Workflow)

1. **Selection:** The user clicks `App.tsx` in the Unified Tree.
2. **Editor Split:** A right-hand pane opens containing the Monaco Editor, displaying the code with syntax highlighting.
3. **Marking a Skip:** The user highlights lines 10 through 150 (a massive, irrelevant UI component). They hit `Ctrl/Cmd + Backspace` or use the context menu to select **"Skip Block"**.
4. **Visual Folding:** The code from lines 10-150 collapses into a stylish, inline UI pill that reads `[ ... Skipped 140 lines ... ]`.
5. **Previewing:** The user toggles the "Preview Output" switch above the editor. The view changes to a read-only text file showing exactly what the AI will see:
   ```typescript
   // ... [Skipped 140 lines] ...
   export function relevantFunction() { ... }
   ```

## Flow 5: Export Staging, Chunking, & Drag-and-Drop

1. **Initiate Export:** The user clicks the "Configure" button in the sub-header to open the Export Stage.
2. **Staging Panel:** The right-hand pane shifts to a visual overview showing all files queued for export.
3. **Applying Chunk Limits:** Knowing Claude/ChatGPT has a file limit, the user sets the "Batch Size Limit" slider to `10`.
4. **Batch Generation:** The UI instantly divides the curated files into visual blocks: **Payload Chunk 1** (10 files), **Payload Chunk 2** (10 files). The global export engine automatically builds these in the background to a temporary OS directory.
5. **Drag to Chat:** In the sub-header, draggable pill buttons appear for each chunk. The user clicks and drags "Chunk 1" completely outside the Xcerpt window and drops it directly into their browser's ChatGPT text area.
