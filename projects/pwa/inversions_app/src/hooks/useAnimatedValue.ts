// FIC: Animated numeric counter hook using requestAnimationFrame with easeOutCubic easing.
// FIC: Hook de contador numérico animado usando requestAnimationFrame con easing easeOutCubic.

import { useEffect, useRef, useState } from "react";

interface UseAnimatedValueOptions {
  duration?: number;
  decimals?: number;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useAnimatedValue(
  target: number,
  options: UseAnimatedValueOptions = {}
): number {
  const { duration = 220, decimals = 2 } = options;

  const [displayValue, setDisplayValue] = useState(target);
  const rafRef = useRef<number | null>(null);
  const startValueRef = useRef(target);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplayValue(target);
      return;
    }

    if (Math.abs(target - displayValue) < 0.001) return;

    startValueRef.current = displayValue;
    startTimeRef.current = null;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const current = startValueRef.current + (target - startValueRef.current) * eased;

      const factor = Math.pow(10, decimals);
      setDisplayValue(Math.round(current * factor) / factor);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(target);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target]);

  return displayValue;
}
