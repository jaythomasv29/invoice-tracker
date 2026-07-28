import {
  createContext, useContext, useCallback, useEffect, useRef, useState,
  type ReactNode,
} from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOrganization } from '@clerk/clerk-expo';
import { useStore } from '../../store/useStore';
import { hasSeenTour, markTourSeen } from '../../lib/tourFlag';
import { TOUR_STEPS, type TourStep, type TourTabId } from './TourTypes';

export interface TargetRect { x: number; y: number; width: number; height: number }

// A screen registers how the tour can scroll it, so targets below the fold can
// be brought into view before the spotlight measures them.
export interface ScrollerApi {
  scrollTo: (y: number) => void;
  getOffset: () => number;
}

interface TourContextValue {
  active: boolean;
  step: TourStep | null;
  stepIndex: number;
  stepCount: number;
  measuredRect: TargetRect | null;
  registerTarget: (id: string, node: View | null) => void;
  registerScroller: (tab: TourTabId, api: ScrollerApi | null) => void;
  next: () => void;
  back: () => void;
  skip: () => void;
  start: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within a TourProvider');
  return ctx;
}

function tabHref(tab: TourTabId): string {
  return tab === 'index' ? '/(tabs)' : `/(tabs)/${tab}`;
}

export function TourProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { organization } = useOrganization();
  const { height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [measuredRect, setMeasuredRect] = useState<TargetRect | null>(null);

  // Registered target nodes + per-tab scrollers. Refs (not state) so a card
  // laying out doesn't re-render the whole tree.
  const targets = useRef<Map<string, View>>(new Map());
  const scrollers = useRef<Map<TourTabId, ScrollerApi>>(new Map());
  const activeStep = useRef<TourStep | null>(null);
  const startedRef = useRef(false);

  // Measure the active target, first scrolling it into a comfortable band near
  // the top of the screen if it's off-screen or too low (so the spotlight and
  // its caption both fit). The tab-scan target lives in the fixed tab bar and
  // is never scrolled.
  const measureActive = useCallback((node: View | null, step: TourStep) => {
    if (!node) return;
    requestAnimationFrame(() => {
      node.measureInWindow((x, y, w, h) => {
        if (w === 0 && h === 0) return;
        const scroller = step.targetId !== 'tab-scan' ? scrollers.current.get(step.tab) : undefined;
        const topBand = insets.top + 100;
        const bottomBand = screenH - 340; // leave room for the caption card
        if (scroller && (y < topBand || y + h > bottomBand)) {
          const desiredTop = insets.top + 150;
          const newOffset = Math.max(0, scroller.getOffset() + (y - desiredTop));
          scroller.scrollTo(newOffset);
          // Re-measure once the scroll animation settles.
          setTimeout(() => {
            node.measureInWindow((x2, y2, w2, h2) => {
              if (w2 > 0 || h2 > 0) setMeasuredRect({ x: x2, y: y2, width: w2, height: h2 });
            });
          }, 340);
        } else {
          setMeasuredRect({ x, y, width: w, height: h });
        }
      });
    });
  }, [insets.top, screenH]);

  const registerTarget = useCallback((id: string, node: View | null) => {
    if (node) targets.current.set(id, node);
    else targets.current.delete(id);
    // If this is the element the current step points at, measure it now — this
    // makes the cross-tab case work: the target measures once it mounts and
    // lays out on the newly-focused tab.
    const step = activeStep.current;
    if (node && step && id === step.targetId) measureActive(node, step);
  }, [measureActive]);

  const registerScroller = useCallback((tab: TourTabId, api: ScrollerApi | null) => {
    if (api) scrollers.current.set(tab, api);
    else scrollers.current.delete(tab);
  }, []);

  // Drive navigation + measurement whenever the active step changes.
  useEffect(() => {
    if (!active) return;
    const step = TOUR_STEPS[stepIndex];
    if (!step) return;
    activeStep.current = step;
    setMeasuredRect(null); // hole-less centered caption until measured
    router.navigate(tabHref(step.tab) as never);
    // Same-tab steps: the target is already mounted, so measure directly.
    // Cross-tab steps fall back to registerTarget when the target mounts.
    const existing = targets.current.get(step.targetId);
    if (existing) measureActive(existing, step);
  }, [active, stepIndex, router, measureActive]);

  const start = useCallback(() => {
    useStore.getState().startDemo();
    activeStep.current = TOUR_STEPS[0] ?? null;
    setStepIndex(0);
    setMeasuredRect(null);
    setActive(true);
  }, []);

  // First-run trigger: once an org exists, start the tour if it hasn't been seen.
  useEffect(() => {
    if (startedRef.current) return;
    if (!organization?.id) return;
    startedRef.current = true;
    (async () => {
      const seen = await hasSeenTour();
      if (!seen) start();
    })();
  }, [organization?.id, start]);

  const next = useCallback(() => {
    const step = TOUR_STEPS[stepIndex];
    if (step?.isFinal) {
      // Complete: leave demo, persist, and hand off to the real scanner.
      setActive(false);
      activeStep.current = null;
      markTourSeen();
      useStore.getState().endDemo();
      router.push('/scan');
      return;
    }
    setStepIndex((i) => Math.min(TOUR_STEPS.length - 1, i + 1));
  }, [stepIndex, router]);

  const back = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const skip = useCallback(() => {
    // Close the guided overlay but keep the sample data loaded so the user can
    // explore freely; the persistent DemoBanner offers the final exit.
    setActive(false);
    activeStep.current = null;
    markTourSeen();
  }, []);

  const value: TourContextValue = {
    active,
    step: active ? TOUR_STEPS[stepIndex] ?? null : null,
    stepIndex,
    stepCount: TOUR_STEPS.length,
    measuredRect,
    registerTarget,
    registerScroller,
    next,
    back,
    skip,
    start,
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

// Attach to a target element (via <TourTarget>) so the tour can highlight it.
export function useTourTarget(id: string) {
  const ref = useRef<View>(null);
  const { registerTarget, step } = useTour();

  const onLayout = useCallback(() => {
    registerTarget(id, ref.current);
  }, [id, registerTarget]);

  // Re-register when this id becomes the active step, covering the case where
  // the target mounts after a cross-tab navigation.
  useEffect(() => {
    if (step?.targetId === id) registerTarget(id, ref.current);
  }, [step?.targetId, id, registerTarget]);

  return { ref, onLayout };
}
