export interface Format {
  id: string
  label: string
  w: number
  h: number
}

export const FORMATS: Format[] = [
  { id: 'portrait', label: 'Portrait 3:4', w: 900, h: 1200 },
  { id: 'square', label: 'Carré 1:1', w: 1080, h: 1080 },
  { id: 'landscape', label: 'Paysage 4:3', w: 1200, h: 900 },
]

export type Background =
  | { type: 'color'; color: string }
  | { type: 'image'; src: string }

interface BaseLayer {
  id: string
  x: number
  y: number
  rotation: number
  opacity: number
}

export interface ImageLayer extends BaseLayer {
  type: 'image'
  src: string
  width: number
  height: number
  shadow: boolean
}

export interface TextLayer extends BaseLayer {
  type: 'text'
  text: string
  fontSize: number
  fill: string
  fontStyle: string
  width: number
}

export type Layer = ImageLayer | TextLayer

export interface Doc {
  format: Format
  background: Background
  layers: Layer[]
}
