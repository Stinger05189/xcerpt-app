# 2_Excerpt_Workflows.md

This document defines the exact step-by-step user journeys for the application's core functions.

## Flow 1: The Workspace Lifecycle & Browser

1. **Launch & Restore:** The user opens Xcerpt. The app restores the exact multi-workspace tabs open during their last session.
2. **The Home Button:** The user clicks the Xcerpt logo to open the **Workspace Browser**.
3. **Querying:** The user types `UE_Projects` into the search bar.
4. **Metadata Inspection:** The browser filters workspaces. The user opens the desired project.
5. **Implicit Auto-Save:** The user makes changes and closes the application. The state is implicitly persisted to disk.

## Flow 2: Multi-Workspace Context Switching

1. **Simultaneous Environments:** The user is inside the "Frontend Task" workspace tab.
2. **Tab Navigation:** They click the "Backend API" tab located in the consolidated top header.
3. **Instantaneous Swap:** The Main Stage instantly swaps out the active tree and editor.

## Flow 3: Curation & The Unified Tree

1. **Viewing the Tree:** The Main Stage displays the file tree for the active Root Path.
2. **Fuzzy Searching:** The user types "Auth" in the tree's local search bar.
3. **Applying Rules:** The user unchecks a folder. It instantly dims to 50% opacity.

## Flow 4: Context Compression (The Magic Workflow)

1. **Selection:** The user clicks `App.tsx` in the Unified Tree.
2. **Editor Split:** A right-hand pane opens containing the Monaco Editor.
3. **Marking a Skip:** The user highlights lines 10-150 and hits `Ctrl/Cmd + Backspace`.
4. **Visual Folding:** The code collapses into `[ ... Skipped 140 lines ... ]`.

## Flow 5: Workspace Export Staging & Chunking

1. **Initiate Export:** The user clicks "Configure" in the sub-header.
2. **Batch Generation:** The user sets the "Batch Size Limit" slider to `10`. The global export engine builds chunks in the background.
3. **Drag to Chat:** Draggable pill buttons appear. The user drags "Chunk 1" directly into ChatGPT.

## Flow 6: Workspace Presets

1. **Scenario:** The user is inside their "Web App" workspace. They frequently need context for UI bugs, and separately, context for Database migrations.
2. **Creating a Preset:** In the Sidebar, the user clicks `+ New Preset` and names it "DB Context".
3. **Independent Curation:** They exclude the entire `src/components` folder. These exclusions are saved strictly to the "DB Context" preset.
4. **Swapping:** They select "UI Context" from the Preset dropdown. The tree instantly updates, un-dimming the components folder and hiding the database schemas.

## Flow 7: Quick Export (Ephemeral Payload)

1. **Selection:** The user drags their mouse to paint 4 specific files in the tree.
2. **Stats Inspection:** At the bottom of the tree, a panel displays: _4 Files Selected | 24 KB | ~6,000 Tokens_.
3. **Explicit Generation:** The user explicitly clicks the "Stage Selection" button.
4. **Instant Payload:** The Ephemeral Export Engine generates a temporary payload in <1 second. The button transforms into a draggable pill.
5. **Drag & Drop:** The user drags the selection pill into their chat interface. The action is logged to the preset's History tab.

## Flow 8: Global Configs & Extension Overrides

1. **The Issue:** The user's AI chat rejects `.uproject` files due to security filters.
2. **Configuration:** The user opens the Global Application Settings and navigates to "Extension Overrides".
3. **Mapping:** They add a new rule: Map `.uproject` to `.json`.
4. **Result:** During export, `MyGame.uproject` is physically written to the OS temp folder as `MyGame.uproject.json`. The generated `ExportedFileTree.md` explicitly annotates this change so the LLM knows the true file type.
