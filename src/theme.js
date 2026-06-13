// Reign design tokens — single source of truth for the premium dark theme.
// Imported anywhere we use inline styles so the whole app stays consistent.

export const colors = {
  // Canvas
  bg: '#06070A',          // near-black base
  bgElevated: '#0D0F14',  // cards
  bgRaised: '#13161D',    // raised cards / inputs
  bgHover: '#1A1E27',

  // Lines
  border: '#1E222B',
  borderStrong: '#2A2F3A',

  // Text
  text: '#F4F5F7',        // primary
  textMuted: '#9BA1AD',   // secondary
  textFaint: '#5C626E',   // tertiary / disabled

  // Brand — "sovereign" gold
  gold: '#E8B339',
  goldSoft: '#F0C967',
  goldDim: 'rgba(232, 179, 57, 0.12)',

  // P&L semantics
  green: '#22C55E',
  greenSoft: '#4ADE80',
  greenDim: 'rgba(34, 197, 94, 0.12)',
  red: '#EF4444',
  redSoft: '#F87171',
  redDim: 'rgba(239, 68, 68, 0.12)',

  // Accent (cool) — for info / links
  blue: '#5B8DEF',
}

export const font = {
  // System stack first; we can swap in a display face later without refactor.
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', ui-monospace, 'Cascadia Code', Menlo, monospace",
}

export const radius = {
  sm: '8px',
  md: '12px',
  lg: '18px',
  xl: '26px',
  pill: '999px',
}

export const shadow = {
  card: '0 1px 2px rgba(0,0,0,0.4), 0 8px 28px rgba(0,0,0,0.35)',
  glow: '0 0 0 1px rgba(232,179,57,0.35), 0 0 30px rgba(232,179,57,0.18)',
}

export const space = (n) => `${n * 4}px`
