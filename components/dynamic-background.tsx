'use client';

import React from 'react';

export function DynamicBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none -z-10 bg-background overflow-hidden">
      {/* Ambient Radial Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.03)_0%,transparent_60%)] blur-3xl opacity-60" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.02)_0%,transparent_60%)] blur-3xl opacity-40" />
      <div className="absolute top-[40%] right-[20%] w-[40vw] h-[40vw] rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.02)_0%,transparent_70%)] blur-3xl opacity-30" />

      {/* SVG Noise Filter */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.015] mix-blend-overlay">
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="1 0 0 0 0, 0 1 0 0 0, 0 0 1 0 0, 0 0 0 0.5 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>
    </div>
  );
}
