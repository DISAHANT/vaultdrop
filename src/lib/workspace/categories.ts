/**
 * Deterministic file categorizer for Developer Workspaces / CodeDrop.
 * Categorizes files into: 'code', 'config', 'asset', 'doc', 'other'.
 */

export type FileCategory = 'code' | 'config' | 'asset' | 'doc' | 'other';

const CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
  'py', 'pyw',
  'rs', 'go', 'java', 'kt', 'kts', 'scala',
  'c', 'cpp', 'cc', 'cxx', 'h', 'hpp', 'cs',
  'rb', 'php', 'swift', 'dart', 'lua', 'sh', 'bash', 'zsh',
  'html', 'htm', 'vue', 'svelte', 'astro',
  'css', 'scss', 'sass', 'less',
  'sql', 'graphql', 'gql', 'proto',
  'r', 'm', 'f90', 'zig', 'nim', 'v'
]);

const CONFIG_EXTENSIONS = new Set([
  'json', 'json5', 'jsonc',
  'yaml', 'yml',
  'toml', 'xml', 'ini', 'env',
  'dockerfile', 'containerfile',
  'lock', 'properties', 'conf', 'config'
]);

const ASSET_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'avif',
  'mp4', 'webm', 'mov', 'avi',
  'mp3', 'wav', 'ogg', 'flac',
  'woff', 'woff2', 'ttf', 'otf', 'eot'
]);

const DOC_EXTENSIONS = new Set([
  'md', 'markdown', 'mdx',
  'txt', 'rst', 'pdf', 'doc', 'docx', 'csv', 'tsv'
]);

const EXACT_CONFIG_NAMES = new Set([
  'package.json', 'tsconfig.json', 'next.config.js', 'next.config.ts', 'next.config.mjs',
  'tailwind.config.js', 'tailwind.config.ts', 'vite.config.ts', 'vite.config.js',
  'webpack.config.js', 'babel.config.js', '.eslintrc', '.eslintrc.json', '.eslintrc.js',
  'biome.json', 'deno.json', 'cargo.toml', 'pyproject.toml', 'requirements.txt',
  'docker-compose.yml', 'docker-compose.yaml', 'dockerfile', 'makefile', 'gemfile',
  '.gitignore', '.npmrc', '.prettierrc'
]);

export function categorizeFile(filePath: string): FileCategory {
  const normalized = filePath.replace(/\\/g, '/');
  const filename = (normalized.split('/').pop() || '').toLowerCase();
  
  if (EXACT_CONFIG_NAMES.has(filename)) {
    return 'config';
  }
  
  if (filename.startsWith('.env')) {
    return 'config';
  }

  const dotParts = filename.split('.');
  if (dotParts.length > 1) {
    const ext = dotParts.pop() || '';
    if (CODE_EXTENSIONS.has(ext)) return 'code';
    if (CONFIG_EXTENSIONS.has(ext)) return 'config';
    if (ASSET_EXTENSIONS.has(ext)) return 'asset';
    if (DOC_EXTENSIONS.has(ext)) return 'doc';
  }

  return 'other';
}

export function getCategoryBadge(category: FileCategory): { label: string; color: string; bg: string } {
  switch (category) {
    case 'code':
      return { label: 'Code', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)' };
    case 'config':
      return { label: 'Config', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' };
    case 'asset':
      return { label: 'Asset', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' };
    case 'doc':
      return { label: 'Doc', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' };
    default:
      return { label: 'Other', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.12)' };
  }
}
