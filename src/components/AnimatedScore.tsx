// src/components/AnimatedScore.tsx
//
// Smoothly counts up to a new score value whenever it changes.
// Uses a setInterval-based easing loop (no Animated.Value needed)
// so it works reliably on the JS thread without useNativeDriver issues.

import { useEffect, useRef, useState } from "react";
import { Text, TextStyle } from "react-native";

interface Props {
  value: number;
  style?: TextStyle | TextStyle[];
  duration?: number; // ms — how long the count-up animation takes
  prefix?: string;   // optional text before the number
}

export function AnimatedScore({ value, style, duration = 450, prefix = "" }: Props) {
  const [displayed, setDisplayed] = useState(value);
  const prevRef  = useRef(value);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const start = prevRef.current;
    const diff  = value - start;

    // Skip animation for tiny changes or first render
    if (Math.abs(diff) < 5) {
      setDisplayed(value);
      prevRef.current = value;
      return;
    }

    const startTime = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      const elapsed  = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic: fast start, slows down as it approaches the target
      const eased    = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(start + diff * eased));

      if (progress >= 1) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        prevRef.current  = value;
      }
    }, 16); // ~60fps

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [value, duration]);

  return <Text style={style}>{prefix}{displayed.toLocaleString()}</Text>;
}