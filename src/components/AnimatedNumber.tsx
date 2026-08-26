"use client";

import { useEffect, useRef, useState } from "react";

export function AnimatedNumber({
  value,
  formatter = (n: number) => Math.round(n).toString(),
  duration = 900,
}: {
  value: number;
  formatter?: (n: number) => string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = prevValue.current;
    const to = value;

    if (reducedMotion) {
      const frame = requestAnimationFrame(() => {
        setDisplay(to);
        prevValue.current = to;
      });
      return () => cancelAnimationFrame(frame);
    }

    const start = performance.now();
    let frame: number;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        prevValue.current = to;
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <>{formatter(display)}</>;
}
