// Step definitions for the first-run product tour. Each step highlights one
// real on-screen element (by `targetId`, matched to a useTourTarget(id)) on a
// given tab; the engine navigates to that tab before measuring the target.

export type TourTabId = 'index' | 'recipes' | 'vendors';

export interface TourStep {
  id: string;
  tab: TourTabId;
  targetId: string;
  title: string;
  body: string;
  placement: 'top' | 'bottom'; // caption above or below the spotlight hole
  isFinal?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'streak',
    tab: 'index',
    targetId: 'home-streak',
    placement: 'bottom',
    title: 'Build kitchen momentum',
    body: 'Reach milestones with saved invoices and see your upload activity this week. Scan when deliveries arrive; there is no daily streak to protect.',
  },
  {
    id: 'spend',
    tab: 'index',
    targetId: 'home-spend',
    placement: 'bottom',
    title: 'See spend at a glance',
    body: 'Reviewed, saved invoices build your spending history. Tap totals on Home to open their invoices, or explore supplier trends here.',
  },
  {
    id: 'alerts',
    tab: 'index',
    targetId: 'home-alerts',
    placement: 'bottom',
    title: 'Catch price creep',
    body: 'Sift flags any item whose price crept up since the last time you bought it.',
  },
  {
    id: 'vendors',
    tab: 'index',
    targetId: 'home-vendors',
    placement: 'bottom',
    title: 'Know your vendors',
    body: 'Spend broken down by supplier, so you can see who you rely on most.',
  },
  {
    id: 'recipes',
    tab: 'recipes',
    targetId: 'recipes-list',
    placement: 'bottom',
    title: 'Cost every dish',
    body: 'Sift prices your recipes from your real invoice history — and keeps them live as prices move.',
  },
  {
    id: 'scan',
    tab: 'index',
    targetId: 'tab-scan',
    placement: 'top',
    title: 'Now scan your first invoice',
    body: "You've seen it with sample data — snap a real invoice and Sift does the rest.",
    isFinal: true,
  },
];
