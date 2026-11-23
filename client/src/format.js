const nf = new Intl.NumberFormat('en-US')

export const fmt = n => nf.format(n ?? 0)

export const isUnlimited = n => n >= 1e15

export const range = (min, max) => isUnlimited(max) ? `from ${fmt(min)}` : `${fmt(min)} to ${fmt(max)}`

export function hue(name = '') {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

export function initials(name = '') {
  const parts = name.trim().split(/[\s_.-]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export const THEMES = {
  emerald: { felt: ['#24865b', '#0f5236', '#08301f'], name: 'Emerald' },
  royal: { felt: ['#3462b3', '#1a3672', '#0c1c3f'], name: 'Royal blue' },
  crimson: { felt: ['#9b2c3c', '#5e1421', '#320810'], name: 'Burgundy' },
  teal: { felt: ['#23807f', '#0f4d4f', '#072b2c'], name: 'Lagoon' },
  onyx: { felt: ['#3a3f48', '#1d2026', '#0c0d10'], name: 'Onyx' },
  velvet: { felt: ['#6a3f9e', '#3a2160', '#1c0f33'], name: 'Velvet' }
}

export const theme = id => THEMES[id] || THEMES.emerald
