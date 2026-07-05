// src/components/editor/ImageViewer.tsx
import { useEffect, useState } from 'react';

export function ImageViewer({ absolutePath }: { absolutePath: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    setTimeout(() => {
      if (isMounted) {
        setSrc(null);
        setError(null);
      }
    }, 0);

    window.api.readImageBase64(absolutePath)
      .then(res => { if (isMounted) setSrc(res); })
      .catch(e => { if (isMounted) setError(e.message || "Failed to load image"); });
      
    return () => { isMounted = false; };
  }, [absolutePath]);

  if (error) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-bg-base text-center gap-2">
        <span className="text-red-400 font-medium">{error}</span>
      </div>
    );
  }

  if (!src) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-text-muted animate-pulse bg-bg-base">
        Loading Image...
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg-base overflow-hidden p-8">
      <img src={src} className="max-w-full max-h-full object-contain drop-shadow-xl rounded shadow-black/50" alt="Preview" />
    </div>
  );
}