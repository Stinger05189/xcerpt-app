# conventions.md

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

## 1. Stack & Formatting

- **Stack:** TS (Strict), Electron (Desktop Shell), Node.js (Main Process), React 18+ (Renderer), Vite, Zustand (Global State), LocalStorage (Temp Config), Tailwind CSS v4, Lucide, `@monaco-editor/react`, `chokidar`, `ignore`/`micromatch`.
- **Naming/Structure:** Feature-grouped in `src/`. `PascalCase.tsx` (Components/Views), `camelCase.ts` (Utils/Hooks), `PascalCase` (Types/Interfaces, no 'I' prefix), `camelCase` (Vars/Functions).
- **Styling:** Tailwind utility classes directly via `className` (`clsx`/`tailwind-merge` for conditionals). Dark mode primary.

## 2. Architecture & State (Zustand)

- **IPC Bridge (`preload.cjs`):** Strict separation. React handles UI; Node handles `fs`/OS. React communicates via typed `ipcRenderer.invoke` (`window.api`). Assign global `mainWindow` in Node to prevent variable shadowing in IPC broadcasts.
- **Dual-Store & Hydration:** `AppStore` (Global IDE) vs `WorkspaceStore` (Active Project). Xcerpt uses a _Single Re-hydrating Store_. On tab switch: synchronously save outgoing state to disk, wipe memory to prevent V8 crashes, inject incoming JSON payload, and trigger background `chokidar` rescan.
- **State Identifiers:** React `key` props and Zustand IDs (selected/expanded/excluded) MUST use the file's Stable Relative Path from project root. Never use UI indexes.
- **Performance Constraints:** - Use strict granular selectors (`useStore(s => s.prop)`) in massive trees to prevent render locks.
  - Never trigger individual `setState` in loops; use bulk mutations (e.g., `applyRuleToSelection`).
  - In fast-firing events (drag/marquee), use `useStore.getState()` for early returns to bypass the React queue.
  - Never call synchronous `setState` in the top-level of a `useEffect`.
- **Flat-State Sync Pattern:** To prevent deep selector render locks across the app, nested configuration objects (like `Presets`) must be unpacked into flat Zustand state properties (`includes`, `excludes`) upon activation, and repacked before saving or switching contexts.
- **Session-Bound Snapshots:** Ephemeral session state that must survive workspace tab switches (like "Revert Changes" snapshots) should be hoisted to the global `AppStore` (`workspaceSnapshots`). The `WorkspaceStore` acts as the active consumer.

## 3. Node.js & I/O

- **Chokidar & Filtering:** Watcher will crash on massive roots. Always pass the global blacklist to the `ignored` array (e.g., `node_modules`).
- **Recursive Opts:** Use `fs.readdir({ withFileTypes: true })` and `dirent.isDirectory()` instead of `fs.stat` loops. Pass a single mutable `Context` object down recursive chains instead of array spreading to prevent GC spikes.
- **Control Flow:** Never use `try/catch` `fs.readFile` to check file existence; check the `dirents` array first.
- **Temp Directories:** Use a process-bound directory (`os.tmpdir()/xcerpt_session_<pid>`). Wipe and recreate on payload build instead of generating infinite timestamped folders.
- **Synchronous Local Exports:** When generating local temp files for drag-and-drop payloads, use `fsSync` rather than `await fs.promises`. In a local Electron desktop app, blocking the main thread for 15ms to bypass event-loop starvation from background watchers is drastically superior to waiting 20 seconds in the async microtask queue.
- **Chokidar Windows Glob Fails:** Never use string globs (`**/dir/**`) for Chokidar `ignored` options on Windows. They fail silently. Always pass a Javascript function that splits the path `[\/\\]` and checks against the blacklist to ensure massive directories are dropped instantly, preventing 100% CPU utilization.
- **Chokidar Event Shielding:** Always wrap `fileWatcher.on('all')` inside the `fileWatcher.on('ready')` callback. This prevents massive file trees from flooding the IPC bridge with thousands of initial `add` events, which crashes the React renderer and causes severe memory creep.
- **Anti-Virus Folder Locks:** Never rapidly delete (`fs.rm`) and recreate (`fs.mkdir`) the same temporary directory during payload generation. Windows Defender flags this as ransomware and locks the folder, freezing the app's I/O. Always use unique, timestamped directory names.

## 4. UI & Shell

- **Visual Filtering:** Excluded items are NOT removed from the DOM. Apply an "excluded" status flag for `opacity: 0.5` and a disabled state.
- **Frameless Window (`frame: false`):** Apply `WebkitAppRegion: 'drag'` to the layout container. Apply `'no-drag'` ONLY to interactive leaf nodes (buttons/tabs) and use padding on the parent to expose the drag region.
- **Native Drag-and-Drop:** Chat UI interfaces reject folder drops. `webContents.startDrag` must receive an array of absolute file paths representing a flattened chunk.
- **Modal Overlays & Frameless Windows:** When implementing full-screen overlays (like the Workspace Browser), do not hide or unmount the `TitleBar`. Instead, apply `opacity-30 pointer-events-none` to the specific background UI containers, ensuring the right-aligned OS window controls (Minimize, Maximize, Close) remain accessible and functional at all times.
- **Layout Stability (Anti-Popping):** UI elements that appear conditionally based on fast-firing interactions (like tree selections) must remain permanently mounted in the DOM. Use `opacity-0 pointer-events-none` to simulate removal. This prevents Cumulative Layout Shift (CLS) and keeps interactive targets stable under the cursor.
- **Responsive Split Panes:** Standard viewport breakpoints (`sm`, `md`) are invalid for internal UI panes whose widths change dynamically. Use Tailwind container queries (`@container`, `@[240px]:inline`) to gracefully degrade or hide text labels inside resizable or narrow flex items.
- **Global Hotkey Guards:** Any global keyboard listener (e.g., `Tab` to open sidebar, `A/S/D` for tree rules) must include a strict early return `if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA')` to prevent overriding standard typing behaviors.
- **Virtualization & Fixed Positioning (CSS Transforms):** Virtualization relies on `transform: translateY(px)` to move rows. In CSS, `transform` instantly creates a new containing block, completely breaking `position: fixed` relative to the viewport. Any context menu or fixed overlay triggered from inside a virtualized list MUST use `createPortal(..., document.body)` to escape the transformed container.
- **Tick-Independent Dragging:** For rapid, 60fps continuous selections (like marquee brushing), never rely on `onMouseEnter` or `onMouseOver`. Tick dependency drops frames when the mouse moves fast. Always use mathematical 1D indexing based on pointer coordinates (`Math.floor(offsetY / ROW_HEIGHT)`).
- **Virtualization Stale Closures:** When calculating array ranges over a virtualized, `memo`'d list, never rely on closure variables passed down during the initial mount. Always read the current layout array from a mutable `useRef` to prevent mapping indices against ghost arrays (e.g., clicking on a file above a newly expanded folder).

## 5. Monaco Editor

- **Compression Coordinates:** Skip markers (`startLine`, `endLine`) map to the file's relative path in workspace state.
- **Drift Management:** Because of external edits, line numbers are volatile. Store the exact string `signature` of the target line in state and auto-heal coordinates on load if offsets are detected.
- **Lifecycle & Syncing:** Force React wrapper remount via `key={activeFile}` to prevent stale closures. Before applying `decorationsCollectionRef.current.set()`, verify `editor.getModel()?.getValue() === reactContent` to prevent mapping to empty space.
- **Styling constraints:** Standard CSS only (e.g., `.monaco-skip-line`). Tailwind utility classes with special characters (`/`, `[`) break Monaco's virtual DOM parser.
- **Strict Mode:** Harmless `Uncaught (in promise) {type: 'cancelation'}` errors during double-mounts can be ignored.

## 6. React Strict Mode & ESLint

- **Purity & Helpers:** Helper functions that rely on impure data sources (e.g., `Date.now()`, `Math.random()`) must be hoisted completely outside of the React component scope to prevent strict ESLint purity violations.
- **Nullish Coalescing in Zustand:** Zustand actions strictly enforce the types defined in their interfaces. When passing optional chains (`obj?.id`), always use nullish coalescing (`?? null`) to prevent `undefined` union type mismatches.
- **Schema Migration Type Safety:** When handling legacy JSON payloads in Zustand hydration, strictly avoid `any` casts. Use `unknown` type intersections (e.g., `payload as unknown as { myLegacyProp?: string }`) to safely parse older schemas without triggering strict ESLint warnings.
- **Defensive Array Mapping:** Always provide a fallback array (`?.myArray || []`) before calling `.map()` on properties derived from parsed JSON payloads to prevent crashes on legacy entries.

## 7. UX, Theming & Data Integrity

- **Explicit over Implicit for Expensive Ephemeral Actions:** Operations that generate physical files on disk strictly for temporary/ephemeral usage (like Quick Selection Exports) must be triggered by an explicit user action (e.g., clicking a "Stage Selection" button). Do not trigger background I/O operations continuously during fast React UI events like marquee drag-selections.
- **Truth in Prompting (Extension Overrides):** Any structural modifications made to files to bypass OS/AI restrictions (such as renaming `.uproject` to `.json`) MUST be explicitly annotated in the generated `ExportedFileTree.md` legend (e.g., `file.uproject (Exported as file.json)`). The LLM's spatial awareness of the _original_ architecture must never be compromised by application-level formatting tricks.
- **Theming Strategy:** Dynamic visual properties (App scale, colors, fonts) are strictly handled via CSS variables (`--color-*`) injected at the `:root` DOM level. The `AppStore` manages the config, but we map values to CSS variables to leverage native browser compositing and avoid expensive inline style recalculation overheads in React.
- **Scale Inputs & Cursor Drift:** When a global layout property (like `zoom` or `scale`) is modified by a range slider, the DOM scales instantly, which causes the input handle to physically move away from the user's cursor mid-drag. To prevent this, bind the `<input type="range">` strictly to local React `useState` and only commit the mutation to the global Zustand store on `onMouseUp`, `onTouchEnd`, and `onKeyUp`.
- **Global Font Scaling vs Tailwind:** Do not apply dynamic `font-size` variables directly to the global `body` or `:root` selector when using Tailwind CSS. Doing so disrupts the `rem`-based scale used by padding, margins, and standard text classes across the layout. Instead, apply dynamic font scaling explicitly and only to the localized components that require readable data scaling (e.g., the Monaco Editor's `options.fontSize` and the `FileTree` scroll container).

## 8. Build, Packaging & Distribution

- **Packaged Asset Resolution (The `file://` Protocol):** When referencing static assets (like images or SVGs) inside React components, ALWAYS use relative paths (e.g., `src="./icon.svg"`). Never use absolute paths (`/icon.svg`). In a packaged Electron app, the frontend is served via the `file://` protocol from `dist/index.html`. An absolute path will instruct Electron to search the root of the user's hard drive (e.g., `C:\icon.svg`), causing the asset to 404.
- **Auto-Updater Security Architecture:** A GitHub Personal Access Token (PAT) is strictly for authorizing the developer's local `electron-builder` pipeline to push drafts to GitHub Releases. The client-facing `electron-updater` package relies entirely on unauthenticated API calls to a public repository to fetch updates. Never embed or distribute a PAT within the application code.
- **Production Environment Hardening:** Always bind `webPreferences.devTools` to `!app.isPackaged` in `main.cjs`. This ensures the Chromium inspector is completely stripped and inaccessible in compiled production binaries.
- **NPM Script Argument Parsing:** When passing flags to underlying packages via NPM scripts (e.g., passing `-p always` to `electron-builder` via `npm run dist`), always use the `--` separator (`npm run dist -- -p always`) to prevent NPM from swallowing the arguments.
