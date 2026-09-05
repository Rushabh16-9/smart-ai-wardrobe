'use client';

import { useState, MouseEvent, useCallback, useRef, useEffect } from 'react';

interface TiltConfig {
  maxRotation?: number; // max degrees of rotation (e.g. 15)
  perspective?: number; // perspective in pixels (e.g. 1000)
  scale?: number; // scale multiplier on hover (e.g. 1.02)
  transitionSpeed?: number; // transition speed when entering/leaving (ms)
}

export function useTilt(config: TiltConfig = {}) {
  const {
    maxRotation = 10,
    perspective = 1000,
    scale = 1.02,
    transitionSpeed = 400,
  } = config;

  const [style, setStyle] = useState({});
  const timer = useRef<NodeJS.Timeout | null>(null);

  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      if (timer.current) clearTimeout(timer.current);

      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      
      const width = rect.width;
      const height = rect.height;

      // Mouse position relative to element center (-1 to 1)
      const mouseX = (e.clientX - rect.left) / width;
      const mouseY = (e.clientY - rect.top) / height;

      const rotateY = (mouseX - 0.5) * 2 * maxRotation;
      const rotateX = -((mouseY - 0.5) * 2 * maxRotation);

      setStyle({
        transform: `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`,
        transition: 'transform 0.1s ease-out',
        willChange: 'transform',
      });
    },
    [maxRotation, perspective, scale]
  );

  const handleMouseLeave = useCallback(() => {
    setStyle({
      transform: `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale(1)`,
      transition: `transform ${transitionSpeed}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
      willChange: 'transform',
    });
    
    timer.current = setTimeout(() => {
      setStyle({});
    }, transitionSpeed);
  }, [perspective, transitionSpeed]);

  const handleMouseEnter = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setStyle({
      transform: `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale(1)`,
      transition: `transform ${transitionSpeed}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
      willChange: 'transform',
    });
  }, [perspective, transitionSpeed]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return {
    style,
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
    onMouseEnter: handleMouseEnter,
  };
}
