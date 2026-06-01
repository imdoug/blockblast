// src/components/AnimatedScore.tsx
//
// Casino-style animated score counter.
// Counts up from old value to new with ease-out cubic curve.
// Pulses scale on every increase.
// Briefly flashes gold when `flash` prop is true (use on line clears).

import { useEffect, useRef, useState } from "react";
import { Animated, TextStyle } from "react-native";

interface Props {
  value: number;
  style?: TextStyle | TextStyle[];
  duration?: number;
  flash?: boolean; // briefly turn gold — pass true when lines are cleared
}

export function AnimatedScore({ value, style, duration = 350, flash = false }: Props) {
  const [displayed, setDisplayed] = useState(value);
  const prevRef  = useRef(value);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scale pulse — plays on every score increase
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Color flash — white → gold → white
  const flashAnim = useRef(new Animated.Value(0)).current;
  const flashColor = flashAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ["#FFFFFF", "#FFE66D"],
  });

  useEffect(() => {
    const start = prevRef.current;
    const diff  = value - start;

    if (Math.abs(diff) < 5) {
      setDisplayed(value);
      prevRef.current = value;
      return;
    }

    // Scale pulse: grow slightly then snap back
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.14, duration: 90,  useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1.0,  duration: 220, useNativeDriver: true }),
    ]).start();

    // Gold flash on line clear
    if (flash) {
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 80,  useNativeDriver: false }),
        Animated.timing(flashAnim, { toValue: 0, duration: 500, useNativeDriver: false }),
      ]).start();
    }

    // Count up from previous value to new value
    const startTime = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      const elapsed  = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplayed(Math.round(start + diff * eased));
      if (progress >= 1) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        prevRef.current  = value;
      }
    }, 16);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [value, duration, flash]);

  // Extract color from style so we can animate it separately
  const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style ?? {};
  const { color: _ignoredColor, ...restStyle } = flatStyle as any;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Animated.Text style={[restStyle, { color: flashColor }]}>
        {displayed.toLocaleString()}
      </Animated.Text>
    </Animated.View>
  );
}