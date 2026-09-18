'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-9 h-9" />;

  const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <button
      onClick={() => setTheme(next)}
      className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 hover:bg-[var(--bg-secondary)]"
      aria-label={`Switch to ${next} theme`}
      title={`Current: ${theme} — Click for ${next}`}
    >
      <Icon className="w-[18px] h-[18px] text-[var(--text-secondary)]" />
    </button>
  );
}
