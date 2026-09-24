/**
 * Static Project Health & Architecture Inspector
 * SAFELY inspects workspace file names and configurations purely through static heuristics.
 * NO DEPENDENCY INSTALLATION. NO SCRIPT EXECUTION.
 */

export interface ProjectHealthReport {
  framework: string;
  language: string;
  packageManager: string;
  checks: {
    name: string;
    passed: boolean;
    description: string;
  }[];
  fileStats: {
    totalFiles: number;
    excludedFiles: number;
    sensitiveFiles: number;
    categories: {
      code: number;
      config: number;
      asset: number;
      doc: number;
      other: number;
    };
  };
}

export function analyzeProjectHealth(
  files: { path: string; size: number; category: string; isSensitive: boolean }[],
  excludedCount: number
): ProjectHealthReport {
  const filePaths = new Set(files.map((f) => f.path.replace(/\\/g, '/').toLowerCase()));
  const filenames = new Set(
    files.map((f) => (f.path.replace(/\\/g, '/').split('/').pop() || '').toLowerCase())
  );

  // 1. Detect Package Manager
  let packageManager = 'Unknown';
  if (filenames.has('pnpm-lock.yaml')) packageManager = 'pnpm';
  else if (filenames.has('yarn.lock')) packageManager = 'yarn';
  else if (filenames.has('bun.lockb') || filenames.has('bun.lock')) packageManager = 'bun';
  else if (filenames.has('package-lock.json')) packageManager = 'npm';
  else if (filenames.has('cargo.lock')) packageManager = 'cargo';
  else if (filenames.has('poetry.lock') || filenames.has('pipfile.lock')) packageManager = 'poetry/pipenv';
  else if (filenames.has('requirements.txt')) packageManager = 'pip';
  else if (filenames.has('go.mod')) packageManager = 'go modules';

  // 2. Detect Language
  let language = 'Plain Text / Other';
  const hasTs = files.some((f) => f.path.endsWith('.ts') || f.path.endsWith('.tsx'));
  const hasJs = files.some((f) => f.path.endsWith('.js') || f.path.endsWith('.jsx'));
  const hasPy = files.some((f) => f.path.endsWith('.py'));
  const hasRust = files.some((f) => f.path.endsWith('.rs'));
  const hasGo = files.some((f) => f.path.endsWith('.go'));

  if (hasTs) language = 'TypeScript';
  else if (hasJs) language = 'JavaScript';
  else if (hasPy) language = 'Python';
  else if (hasRust) language = 'Rust';
  else if (hasGo) language = 'Go';

  // 3. Detect Framework
  let framework = 'Generic Project';
  const hasNext = Array.from(filenames).some((f) => f.startsWith('next.config.'));
  const hasVite = Array.from(filenames).some((f) => f.startsWith('vite.config.'));
  const hasNuxt = Array.from(filenames).some((f) => f.startsWith('nuxt.config.'));
  const hasSvelte = Array.from(filenames).some((f) => f.startsWith('svelte.config.'));
  const hasAstro = Array.from(filenames).some((f) => f.startsWith('astro.config.'));
  const hasTailwind = Array.from(filenames).some((f) => f.startsWith('tailwind.config.'));

  if (hasNext) framework = 'Next.js';
  else if (hasNuxt) framework = 'Nuxt.js';
  else if (hasSvelte) framework = 'SvelteKit / Svelte';
  else if (hasAstro) framework = 'Astro';
  else if (hasVite) framework = 'Vite';
  else if (filenames.has('cargo.toml')) framework = 'Rust Crate';
  else if (filenames.has('go.mod')) framework = 'Go Module';
  else if (hasPy) framework = 'Python App';

  // 4. Checklist
  const checks = [
    {
      name: 'Manifest detected',
      passed: filenames.has('package.json') || filenames.has('cargo.toml') || filenames.has('pyproject.toml') || filenames.has('go.mod'),
      description: 'Found project configuration / dependency manifest.',
    },
    {
      name: 'Lockfile present',
      passed: packageManager !== 'Unknown',
      description: `Dependency lockfile verified (${packageManager}).`,
    },
    {
      name: 'TypeScript configured',
      passed: filenames.has('tsconfig.json'),
      description: 'tsconfig.json detected for strict static typing.',
    },
    {
      name: 'Styling system',
      passed: hasTailwind || Array.from(filenames).some((f) => f.endsWith('.css') || f.endsWith('.scss')),
      description: hasTailwind ? 'Tailwind CSS detected.' : 'CSS styling sheets detected.',
    },
    {
      name: 'Documentation',
      passed: Array.from(filenames).some((f) => f.startsWith('readme')),
      description: 'README documentation file included.',
    },
    {
      name: 'Environment config',
      passed: Array.from(filenames).some((f) => f.startsWith('.env')),
      description: 'Project environment configuration detected.',
    },
  ];

  // 5. Category Breakdown
  const categories = {
    code: 0,
    config: 0,
    asset: 0,
    doc: 0,
    other: 0,
  };

  let sensitiveCount = 0;
  for (const f of files) {
    if (f.isSensitive) sensitiveCount++;
    const cat = f.category as keyof typeof categories;
    if (categories[cat] !== undefined) {
      categories[cat]++;
    } else {
      categories.other++;
    }
  }

  return {
    framework,
    language,
    packageManager,
    checks,
    fileStats: {
      totalFiles: files.length,
      excludedFiles: excludedCount,
      sensitiveFiles: sensitiveCount,
      categories,
    },
  };
}
