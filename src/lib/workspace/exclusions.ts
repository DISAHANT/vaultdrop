export interface ExclusionRule {
  id: string;
  pattern: string;
  name: string;
  category: string;
  reason: string;
  enabled: boolean;
  defaultExcluded: boolean;
}

export const DEFAULT_EXCLUSION_RULES: ExclusionRule[] = [
  { id: 'node_modules', pattern: 'node_modules', name: 'node_modules/', category: 'Dependencies', reason: 'Dependencies (install locally)', enabled: true, defaultExcluded: true },
  { id: 'next', pattern: '.next', name: '.next/', category: 'Build Output', reason: 'Next.js build output', enabled: true, defaultExcluded: true },
  { id: 'dist', pattern: 'dist', name: 'dist/', category: 'Build Output', reason: 'Production build output', enabled: true, defaultExcluded: true },
  { id: 'build', pattern: 'build', name: 'build/', category: 'Build Output', reason: 'Build output', enabled: true, defaultExcluded: true },
  { id: 'out', pattern: 'out', name: 'out/', category: 'Build Output', reason: 'Exported build artifacts', enabled: true, defaultExcluded: true },
  { id: 'coverage', pattern: 'coverage', name: 'coverage/', category: 'Testing', reason: 'Test coverage reports', enabled: true, defaultExcluded: true },
  { id: 'git', pattern: '.git', name: '.git/', category: 'Version Control', reason: 'Git version control metadata', enabled: true, defaultExcluded: true },
  { id: 'cache', pattern: '.cache', name: '.cache/', category: 'Cache', reason: 'Cache directory', enabled: true, defaultExcluded: true },
  { id: 'turbo', pattern: '.turbo', name: '.turbo/', category: 'Cache', reason: 'Turborepo cache', enabled: true, defaultExcluded: true },
  { id: 'parcel-cache', pattern: '.parcel-cache', name: '.parcel-cache/', category: 'Cache', reason: 'Parcel bundler cache', enabled: true, defaultExcluded: true },
  { id: 'nuxt', pattern: '.nuxt', name: '.nuxt/', category: 'Build Output', reason: 'Nuxt build directory', enabled: true, defaultExcluded: true },
  { id: 'svelte-kit', pattern: '.svelte-kit', name: '.svelte-kit/', category: 'Build Output', reason: 'SvelteKit build directory', enabled: true, defaultExcluded: true },
  { id: 'angular', pattern: '.angular', name: '.angular/', category: 'Cache', reason: 'Angular cache', enabled: true, defaultExcluded: true },
  { id: 'target', pattern: 'target', name: 'target/', category: 'Build Output', reason: 'Rust / Maven build output', enabled: true, defaultExcluded: true },
  { id: 'bin', pattern: 'bin', name: 'bin/', category: 'Binaries', reason: 'Compiled binary artifacts', enabled: true, defaultExcluded: true },
  { id: 'obj', pattern: 'obj', name: 'obj/', category: 'Binaries', reason: '.NET intermediate output', enabled: true, defaultExcluded: true },
  { id: 'pycache', pattern: '__pycache__', name: '__pycache__/', category: 'Cache', reason: 'Python bytecode cache', enabled: true, defaultExcluded: true },
  { id: 'venv', pattern: '.venv', name: '.venv/', category: 'Environment', reason: 'Python virtual environment', enabled: true, defaultExcluded: true },
  { id: 'venv2', pattern: 'venv', name: 'venv/', category: 'Environment', reason: 'Python virtual environment', enabled: true, defaultExcluded: true },
  { id: 'gradle', pattern: '.gradle', name: '.gradle/', category: 'Build Output', reason: 'Gradle build cache', enabled: true, defaultExcluded: true },
  { id: 'idea', pattern: '.idea', name: '.idea/', category: 'IDE', reason: 'IDE metadata', enabled: true, defaultExcluded: true },
  { id: 'vscode', pattern: '.vscode', name: '.vscode/', category: 'IDE', reason: 'VS Code local settings', enabled: true, defaultExcluded: true },
  { id: 'ds_store', pattern: '.DS_Store', name: '.DS_Store', category: 'OS', reason: 'macOS system file', enabled: true, defaultExcluded: true },
  { id: 'thumbs_db', pattern: 'Thumbs.db', name: 'Thumbs.db', category: 'OS', reason: 'Windows thumbnail cache', enabled: true, defaultExcluded: true },
];

export interface FileScanItem {
  file: File;
  relativePath: string;
  size: number;
  isExcluded: boolean;
  exclusionReason?: string;
  ruleName?: string;
}

export interface ExclusionAnalysis {
  includedFiles: FileScanItem[];
  excludedFiles: FileScanItem[];
  includedCount: number;
  excludedCount: number;
  includedBytes: number;
  excludedBytes: number;
  folderCount: number;
  breakdown: Array<{
    name: string;
    fileCount: number;
    totalBytes: number;
    reason: string;
  }>;
}

export type WorkspaceAnalysisResult = ExclusionAnalysis;

export function analyzeWorkspaceFiles(
  files: File[],
  activeRules: ExclusionRule[] = DEFAULT_EXCLUSION_RULES
): ExclusionAnalysis {
  const included: FileScanItem[] = [];
  const excluded: FileScanItem[] = [];
  let totalIncludedSize = 0;
  let totalExcludedSize = 0;
  const folderSet = new Set<string>();
  const summaryByRule: Record<string, { count: number; totalSize: number; reason: string }> = {};

  const enabledRules = activeRules.filter((r) => r.enabled);

  for (const file of files) {
    const rawPath = (file as any).webkitRelativePath || file.name;
    const normalized = rawPath.replace(/\\/g, '/');

    // Track folders
    const parts = normalized.split('/');
    if (parts.length > 1) {
      for (let i = 1; i < parts.length; i++) {
        folderSet.add(parts.slice(0, i).join('/'));
      }
    }

    // Check against active exclusion rules
    let matchedRule: ExclusionRule | null = null;
    for (const rule of enabledRules) {
      const isSegmentMatch = parts.some((p: string) => p === rule.pattern);
      if (
        isSegmentMatch ||
        normalized.includes(`/${rule.pattern}/`) ||
        normalized.startsWith(`${rule.pattern}/`)
      ) {
        matchedRule = rule;
        break;
      }
    }

    if (matchedRule) {
      excluded.push({
        file,
        relativePath: normalized,
        size: file.size,
        isExcluded: true,
        exclusionReason: matchedRule.reason,
        ruleName: matchedRule.name,
      });
      totalExcludedSize += file.size;

      if (!summaryByRule[matchedRule.name]) {
        summaryByRule[matchedRule.name] = {
          count: 0,
          totalSize: 0,
          reason: matchedRule.reason,
        };
      }
      summaryByRule[matchedRule.name].count++;
      summaryByRule[matchedRule.name].totalSize += file.size;
    } else {
      included.push({
        file,
        relativePath: normalized,
        size: file.size,
        isExcluded: false,
      });
      totalIncludedSize += file.size;
    }
  }

  const breakdown = Object.entries(summaryByRule).map(([name, data]) => ({
    name,
    fileCount: data.count,
    totalBytes: data.totalSize,
    reason: data.reason,
  }));

  return {
    includedFiles: included,
    excludedFiles: excluded,
    includedCount: included.length,
    excludedCount: excluded.length,
    includedBytes: totalIncludedSize,
    excludedBytes: totalExcludedSize,
    folderCount: folderSet.size,
    breakdown,
  };
}
