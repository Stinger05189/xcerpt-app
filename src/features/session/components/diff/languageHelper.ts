// src/features/session/components/diff/languageHelper.ts
export function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    html: 'html',
    css: 'css',
    scss: 'scss',
    md: 'markdown',
    mdx: 'markdown',
    py: 'python',
    rs: 'rust',
    go: 'go',
    cpp: 'cpp',
    c: 'c',
    h: 'cpp',
    hpp: 'cpp',
    cs: 'csharp',
    java: 'java',
    sh: 'shell',
    bash: 'shell',
    yaml: 'yaml',
    yml: 'yaml',
    sql: 'sql',
    xml: 'xml',
    cjs: 'javascript',
    mjs: 'javascript',
  };
  return languageMap[ext] || 'plaintext';
}