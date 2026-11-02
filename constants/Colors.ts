export const Colors = {
  hero: '#123D30',
  heroText: '#FFFFFF',
  heroMuted: '#C4D7CD',
  accent: '#D5ECA0',
  // Primary green (from design: oklch(70% 0.16 145))
  primary: '#17624B',
  primaryDark: '#104B3A',
  primaryLight: '#E7F1EB',
  primaryMuted: '#A8CBB9',

  // Backgrounds
  background: '#F5F5F0',
  surface: '#FFFFFF',
  surfacePressed: '#EEF1EB',

  // Borders
  border: '#DFE5DC',
  borderLight: '#EDF0E9',

  // Text
  textPrimary: '#172C25',
  textSecondary: '#5D6D64',
  textTertiary: '#647368',
  textOnPrimary: '#FFFFFF',

  // Semantic
  warning: '#A65524',
  warningLight: '#FAEEE1',
  warningMuted: '#F5A96B',
  danger: '#BD4938',
  dangerLight: '#FDECEA',
  dangerMuted: '#E88A7D',
  success: '#17624B',
  successLight: '#E7F1EB',

  // Vendor chart colors (from design)
  vendorCascade: '#17624B',
  vendorGolden: '#5B7FD4',
  vendorGoldenLight: '#EEF2FF',
  vendorPinnacle: '#E09030',
  vendorHarbor: '#4AABB8',
  vendorHarborLight: '#E6F4F6',

  // Dark screen (scan)
  darkBg: '#1A1A2A',
  darkSurface: '#252535',
  darkBorder: 'rgba(255,255,255,0.15)',
  darkText: '#FFFFFF',
  darkTextMuted: 'rgba(255,255,255,0.5)',

  // Dashboard chart accents (spend trend + bar/area viz)
  chartGrid: '#E7ECE4',          // recessive gridlines / baseline
  chartBarFrom: '#8BBE9B',       // duotone bar — light top
  chartBarTo: '#17624B',         // duotone bar — dark bottom (emphasis)
  chartBarMutedFrom: '#D9E8D9',  // past-period bar — light top
  chartBarMutedTo: '#B7D3BE',    // past-period bar — dark bottom
  chartAreaFrom: 'rgba(93,176,117,0.18)',
  chartAreaTo: 'rgba(93,176,117,0.0)',
  heroTintTop: '#EDF4E9',        // faint green wash for the hero card
  heroTintBottom: '#FFFFFF',

  // Misc
  shadow: 'rgba(0,0,0,0.08)',
  tabBar: '#FFFFFF',
  tabBarBorder: '#DFE5DC',
  tabBarActive: '#17624B',
  tabBarInactive: '#718076',
} as const;
