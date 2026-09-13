// src/features/session/components/diff/languageHelper.ts
export function getLanguageFromFilename(filename: string): string {
  if (!filename) return 'plaintext';
  const clean = filename.replace(/\\/g, '/');
  const base = clean.split('/').pop() || '';
  const lowerBase = base.toLowerCase();

  // Special dotfile & whole-filename matching
  if (lowerBase === 'dockerfile') return 'dockerfile';
  if (lowerBase === 'makefile' || lowerBase === 'gnumakefile') return 'makefile';
  if (lowerBase === '.gitignore' || lowerBase === '.npmignore') return 'plaintext';
  if (lowerBase === '.env' || lowerBase.startsWith('.env.')) return 'ini';

  const parts = lowerBase.split('.');
  if (parts.length <= 1) return 'plaintext';
  const ext = parts.pop() || '';

  const languageMap: Record<string, string> = {
    // Game Development & Shaders
    lua: 'lua',
    hlsl: 'hlsl',
    glsl: 'glsl',
    shader: 'hlsl',
    cg: 'hlsl',
    cs: 'csharp',
    cpp: 'cpp',
    c: 'c',
    h: 'cpp',
    hpp: 'cpp',
    cxx: 'cpp',
    hxx: 'cpp',
    gd: 'python', // Monaco highlights GDScript accurately using python rules

    // Web & Application Development
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    json: 'json',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    vue: 'html',
    svelte: 'html',
    graphql: 'graphql',
    gql: 'graphql',

    // Systems & Backend Languages
    py: 'python',
    pyw: 'python',
    rs: 'rust',
    go: 'go',
    java: 'java',
    kt: 'kotlin',
    kts: 'kotlin',
    rb: 'ruby',
    php: 'php',
    swift: 'swift',
    dart: 'dart',
    scala: 'scala',
    r: 'r',

    // Configuration, Markup, Scripts & Query
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'ini',
    ini: 'ini',
    cfg: 'ini',
    conf: 'ini',
    xml: 'xml',
    svg: 'xml',
    md: 'markdown',
    mdx: 'markdown',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    fish: 'shell',
    bat: 'bat',
    cmd: 'bat',
    ps1: 'powershell',
    proto: 'protobuf',
    sol: 'solidity',
  };

  return languageMap[ext] || 'plaintext';
}

export function formatLanguageName(langId: string): string {
  const displayNames: Record<string, string> = {
    typescript: 'TypeScript',
    javascript: 'JavaScript',
    csharp: 'C#',
    cpp: 'C++',
    c: 'C',
    lua: 'Lua',
    hlsl: 'HLSL Shader',
    glsl: 'GLSL Shader',
    python: 'Python',
    rust: 'Rust',
    go: 'Go',
    java: 'Java',
    kotlin: 'Kotlin',
    ruby: 'Ruby',
    php: 'PHP',
    swift: 'Swift',
    dart: 'Dart',
    json: 'JSON',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    yaml: 'YAML',
    xml: 'XML',
    markdown: 'Markdown',
    sql: 'SQL',
    shell: 'Shell Script',
    powershell: 'PowerShell',
    dockerfile: 'Dockerfile',
    ini: 'Config / INI',
    plaintext: 'Plain Text'
  };

  return displayNames[langId] || (langId.charAt(0).toUpperCase() + langId.slice(1));
}