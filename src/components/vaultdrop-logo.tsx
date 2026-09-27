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
    sm: { box: 'w-7 h-7 rounded-lg', img: 28, text: 'text-sm' },
    md: { box: 'w-9 h-9 rounded-xl', img: 36, text: 'text-base' },
    lg: { box: 'w-14 h-14 rounded-2xl', img: 56, text: 'text-xl' },
    xl: { box: 'w-20 h-20 rounded-3xl', img: 80, text: 'text-3xl' },
  };

  const { box, img, text } = sizeMap[size];

  const logoContent = (
    <div className={`inline-flex items-center gap-2.5 group select-none ${className}`}>
      {/* 3D Glass Emblem with Skeuomorphic Depth & Glassmorphism */}
      <div
        className={`relative ${box} flex items-center justify-center overflow-hidden bg-neutral-950/90 dark:bg-black/90 border border-white/20 dark:border-white/15 transition-all duration-300 group-hover:scale-105 ${
          withGlow
            ? 'shadow-[0_4px_16px_-2px_rgba(0,0,0,0.5),inset_0_1px_1px_0_rgba(255,255,255,0.4),0_0_20px_-3px_rgba(56,189,248,0.22)] group-hover:shadow-[0_6px_22px_-2px_rgba(0,0,0,0.6),inset_0_1px_2px_0_rgba(255,255,255,0.6),0_0_28px_-2px_rgba(56,189,248,0.4)]'
            : 'shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]'
        }`}
      >
        {/* Subtle Ambient Refractive Shimmer */}
        <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/10 via-transparent to-amber-500/10 pointer-events-none" />

        {/* 3D Glass Logo Graphic */}
        <Image
          src="/logo.png"
          alt="VaultDrop Logo"
          width={img}
          height={img}
          className="w-full h-full object-cover rounded-inherit"
          priority
        />

        {/* Specular Edge Highlight */}
        <div className="absolute inset-0 rounded-inherit border border-white/10 pointer-events-none" />
      </div>

      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`${text} font-black tracking-tight text-neutral-900 dark:text-white flex items-center`}>
            VAULT
            <span className="bg-gradient-to-r from-sky-400 via-indigo-300 to-amber-300 bg-clip-text text-transparent font-black tracking-normal ml-0.5">
              DROP
            </span>
          </span>
          {size === 'xl' && (
            <span className="text-[11px] font-mono tracking-widest uppercase text-neutral-400 dark:text-neutral-500 mt-1">
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
