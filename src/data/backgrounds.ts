// Fonds intégrés (bibliothèque de dépannage), générés à la volée en dégradés.
// Aucune ressource externe : tout est dessiné dans un canvas puis exporté en data-URL.

export interface Preset {
  id: string
  label: string
  /** couleur unie si `src` absent */
  color?: string
  /** dégradé [couleur haut, couleur bas] */
  gradient?: [string, string]
}

export const COLOR_PRESETS: Preset[] = [
  { id: 'green', label: 'Fond vert', color: '#00b140' },
  { id: 'white', label: 'Blanc', color: '#f5f5f5' },
  { id: 'black', label: 'Noir', color: '#111111' },
  { id: 'blue', label: 'Bleu', color: '#2563eb' },
  { id: 'pink', label: 'Rose', color: '#ec4899' },
]

export const GRADIENT_PRESETS: Preset[] = [
  { id: 'sunset', label: 'Coucher', gradient: ['#ff9966', '#ff5e62'] },
  { id: 'ocean', label: 'Océan', gradient: ['#2b5876', '#4e4376'] },
  { id: 'mint', label: 'Menthe', gradient: ['#43e97b', '#38f9d7'] },
  { id: 'peach', label: 'Pêche', gradient: ['#ffecd2', '#fcb69f'] },
  { id: 'night', label: 'Nuit', gradient: ['#0f2027', '#2c5364'] },
  { id: 'candy', label: 'Bonbon', gradient: ['#a18cd1', '#fbc2eb'] },
]

/** Construit une data-URL PNG pour un dégradé vertical. */
export function gradientDataUrl([from, to]: [string, string], size = 512): string {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createLinearGradient(0, 0, 0, size)
  grad.addColorStop(0, from)
  grad.addColorStop(1, to)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  return canvas.toDataURL('image/png')
}
