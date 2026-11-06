import { useEffect, useRef, useState } from "react";
import { AppState, Text, type TextProps } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { tickerValue } from "../../lib/numberTicker";
/** Isolated text updates at 30fps; charts and parent screens do not rerender per frame. */
export default function AnimatedNumber({
  value,
  format,
  contextKey,
  ready = true,
  placeholder = "—",
  ...props
}: TextProps & {
  value: number;
  format: (n: number) => string;
  contextKey: string;
  ready?: boolean;
  placeholder?: string;
}) {
  const reduced = useReducedMotion();
  const current = useRef(Number.isFinite(value) ? value : 0),
    context = useRef(contextKey);
  const [display, setDisplay] = useState(current.current),
    [hasValue, setHasValue] = useState(ready || value !== 0);
  const changedContext = context.current !== contextKey;
  useEffect(() => {
    if (!ready) return;
    const changed = context.current !== contextKey;
    context.current = contextKey;
    setHasValue(true);
    const target = Number.isFinite(value) ? value : 0;
    let frame: number | undefined,
      last = 0;
    const from = current.current,
      start = performance.now();
    const settle = () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      current.current = target;
      setDisplay(target);
    };
    if (
      reduced ||
      changed ||
      AppState.currentState !== "active" ||
      from === target
    ) {
      settle();
      return;
    }
    const tick = (time: number) => {
      const elapsed = time - start;
      if (elapsed >= 800) {
        settle();
        return;
      }
      if (time - last >= 1000 / 30) {
        last = time;
        current.current = tickerValue(from, target, elapsed);
        setDisplay(current.current);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") settle();
    });
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      listener.remove();
    };
  }, [value, contextKey, ready, reduced]);
  const text = changedContext
    ? ready
      ? format(value)
      : placeholder
    : hasValue
      ? format(display)
      : placeholder;
  return (
    <Text
      {...props}
      accessibilityLabel={hasValue || ready ? format(value) : placeholder}
      accessibilityLiveRegion="none"
    >
      {text}
    </Text>
  );
}
