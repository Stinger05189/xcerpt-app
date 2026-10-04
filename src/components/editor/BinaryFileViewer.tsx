// src/components/editor/BinaryFileViewer.tsx
import { 
  FileBox, 
  BookOpen, 
  Layers, 
  Box, 
  Archive, 
  Binary, 
  Music, 
  Film, 
  Database,
  ExternalLink,
  FolderSymlink,
  ShieldCheck
} from 'lucide-react';

interface BinaryFileViewerProps {
  absolutePath: string;
  relativePath: string;
}

export function BinaryFileViewer({ absolutePath, relativePath }: BinaryFileViewerProps) {
  const fileName = relativePath.split(/[/\\]/).pop() || relativePath;
  const ext = (fileName.split('.').pop() || '').toLowerCase();

  const getAssetCategory = () => {
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'epub'].includes(ext)) {
      return { label: 'Document / Publication', icon: <BookOpen size={36} className="text-red-400" /> };
    }
    if (['uasset', 'umap', 'ubulk', 'uexp', 'uptnl', 'pak', 'asset', 'unity', 'prefab', 'mat', 'bundle', 'unitypackage', 'pck'].includes(ext)) {
      return { label: 'Game Engine Asset', icon: <Layers size={36} className="text-accent" /> };
    }
    if (['fbx', 'blend', 'blend1', 'glb', 'gltf', 'max', '3ds', 'dae', 'stl', 'step', 'stp', 'dwg'].includes(ext)) {
      return { label: '3D Geometry / Model', icon: <Box size={36} className="text-blue-400" /> };
    }
    if (['zip', 'tar', 'gz', 'bz2', '7z', 'rar', 'xz', 'zst', 'tgz', 'iso', 'dmg'].includes(ext)) {
      return { label: 'Compressed Archive', icon: <Archive size={36} className="text-amber-400" /> };
    }
    if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'].includes(ext)) {
      return { label: 'Audio Stream', icon: <Music size={36} className="text-green-400" /> };
    }
    if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v'].includes(ext)) {
      return { label: 'Video Container', icon: <Film size={36} className="text-purple-400" /> };
    }
    if (['sqlite', 'sqlite3', 'db', 'db3', 's3db', 'mdb', 'ldb'].includes(ext)) {
      return { label: 'Database File', icon: <Database size={36} className="text-emerald-400" /> };
    }
    return { label: 'Binary Executable / Library', icon: <Binary size={36} className="text-text-muted" /> };
  };

  const category = getAssetCategory();

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-bg-base overflow-y-auto select-none">
      <div className="max-w-md w-full bg-bg-panel border border-border-subtle rounded-2xl p-6 flex flex-col items-center text-center shadow-xl">
        <div className="p-4 bg-bg-base rounded-2xl border border-border-subtle/80 mb-4 shadow-inner">
          {category.icon}
        </div>

        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-accent/15 text-accent border border-accent/20 font-bold">
            .{ext}
          </span>
          <span className="text-xs font-semibold text-text-primary">
            {category.label}
          </span>
        </div>

        <h3 className="text-sm font-mono font-medium text-text-primary mb-1 truncate max-w-full" title={fileName}>
          {fileName}
        </h3>
        <p className="text-[11px] font-mono text-text-muted mb-5 truncate max-w-full opacity-70" title={relativePath}>
          {relativePath}
        </p>

        <div className="w-full bg-bg-base/80 border border-border-subtle rounded-xl p-3 mb-5 text-left flex items-start gap-2.5">
          <ShieldCheck size={16} className="text-accent shrink-0 mt-0.5" />
          <p className="text-[11px] text-text-muted leading-relaxed">
            Binary file contents are omitted from code preview and context packaging to prevent corruption and model hallucinations.
          </p>
        </div>

        <div className="w-full flex items-center gap-2">
          <button
            onClick={() => window.api.openPath(absolutePath)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
          >
            <ExternalLink size={13} />
            <span>Open in Default App</span>
          </button>
          <button
            onClick={() => window.api.showItemInFolder(absolutePath)}
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-bg-base border border-border-subtle hover:bg-bg-hover text-text-muted hover:text-text-primary rounded-lg text-xs font-medium transition-colors"
            title="Reveal in OS File Explorer"
          >
            <FolderSymlink size={13} />
            <span>Reveal</span>
          </button>
        </div>
      </div>
    </div>
  );
}