'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface VaultDropLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  href?: string;
  withGlow?: boolean;
}

export function VaultDropLogo({
  size = 'md',
  showText = true,
  className = '',
  href,
  withGlow = true,
}: VaultDropLogoProps) {
  const sizeMap = {
    sm: { box: 'w-8 h-8 rounded-xl', img: 32, text: 'text-sm' },
    md: { box: 'w-10 h-10 rounded-2xl', img: 40, text: 'text-base' },
    lg: { box: 'w-14 h-14 rounded-2xl', img: 56, text: 'text-xl' },
    xl: { box: 'w-20 h-20 rounded-3xl', img: 80, text: 'text-3xl' },
  };

  const { box, img, text } = sizeMap[size];

  const logoContent = (
    <div className={`inline-flex items-center gap-2.5 group select-none ${className}`}>
      {/* 3D Glass Emblem Tile — Clean, High-End & Modern */}
      <div
        className={`relative ${box} flex items-center justify-center overflow-hidden bg-neutral-950 dark:bg-black border border-neutral-900/10 dark:border-white/15 transition-all duration-300 group-hover:scale-105 ${
          withGlow
            ? 'shadow-sm shadow-neutral-950/10 dark:shadow-[0_0_20px_-3px_rgba(56,189,248,0.25)] group-hover:shadow-md dark:group-hover:shadow-[0_0_28px_-2px_rgba(56,189,248,0.4)]'
            : 'shadow-sm'
        }`}
      >
        {/* Subtle Ambient Shimmer on Dark */}
        <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/10 via-transparent to-amber-500/10 pointer-events-none opacity-0 dark:opacity-100 transition-opacity" />

        {/* 3D Glass Logo Graphic */}
        <Image
          src="/logo.png"
          alt="VaultDrop Logo"
          width={img}
          height={img}
          className="w-full h-full object-cover rounded-inherit"
          priority
        />
      </div>

      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`${text} font-black tracking-tight text-neutral-900 dark:text-white flex items-center`}>
            VAULT
            <span className="bg-gradient-to-r from-sky-600 via-indigo-600 to-amber-600 dark:from-sky-400 dark:via-indigo-300 dark:to-amber-300 bg-clip-text text-transparent font-black tracking-normal ml-0.5">
              DROP
            </span>
          </span>
          {size === 'xl' && (
            <span className="text-[11px] font-mono tracking-widest uppercase text-neutral-500 dark:text-neutral-400 mt-1">
              Cross-Device Workspace Bridge
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex">
        {logoContent}
      </Link>
    );
  }

  return logoContent;
}
