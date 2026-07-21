import { useRef } from 'react'
import { Rect, Image as KonvaImage, Text as KonvaText } from 'react-konva'
import type Konva from 'konva'
import { useImage } from '../hooks/useImage'
import type { Background, ImageLayer, TextLayer } from '../types'

export function BackgroundNode({
  background,
  w,
  h,
}: {
  background: Background
  w: number
  h: number
}) {
  const [img] = useImage(background.type === 'image' ? background.src : undefined)

  if (background.type === 'color') {
    return <Rect x={0} y={0} width={w} height={h} fill={background.color} listening={false} />
  }
  if (!img) {
    return <Rect x={0} y={0} width={w} height={h} fill="#1e293b" listening={false} />
  }
  // "cover" : l'image remplit tout le canvas sans déformation
  const scale = Math.max(w / img.width, h / img.height)
  const iw = img.width * scale
  const ih = img.height * scale
  return (
    <KonvaImage
      image={img}
      x={(w - iw) / 2}
      y={(h - ih) / 2}
      width={iw}
      height={ih}
      listening={false}
    />
  )
}

export function SubjectNode({
  layer,
  onSelect,
  onChange,
}: {
  layer: ImageLayer
  onSelect: () => void
  onChange: (patch: Partial<ImageLayer>) => void
}) {
  const [img] = useImage(layer.src)
  const ref = useRef<Konva.Image>(null)
  if (!img) return null

  return (
    <KonvaImage
      id={layer.id}
      ref={ref}
      image={img}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={layer.height}
      rotation={layer.rotation}
      opacity={layer.opacity}
      shadowColor="black"
      shadowBlur={layer.shadow ? 24 : 0}
      shadowOpacity={layer.shadow ? 0.5 : 0}
      shadowOffsetX={layer.shadow ? 10 : 0}
      shadowOffsetY={layer.shadow ? 10 : 0}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={() => {
        const node = ref.current
        if (!node) return
        const sx = node.scaleX()
        const sy = node.scaleY()
        node.scaleX(1)
        node.scaleY(1)
        onChange({
          x: node.x(),
          y: node.y(),
          width: Math.max(20, layer.width * sx),
          height: Math.max(20, layer.height * sy),
          rotation: node.rotation(),
        })
      }}
    />
  )
}

export function TextNode({
  layer,
  onSelect,
  onChange,
}: {
  layer: TextLayer
  onSelect: () => void
  onChange: (patch: Partial<TextLayer>) => void
}) {
  const ref = useRef<Konva.Text>(null)

  return (
    <KonvaText
      id={layer.id}
      ref={ref}
      text={layer.text}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      fontSize={layer.fontSize}
      fontStyle={layer.fontStyle}
      fontFamily="Inter, system-ui, sans-serif"
      fill={layer.fill}
      rotation={layer.rotation}
      opacity={layer.opacity}
      align="center"
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={() => {
        const node = ref.current
        if (!node) return
        const sx = node.scaleX()
        const sy = node.scaleY()
        node.scaleX(1)
        node.scaleY(1)
        onChange({
          x: node.x(),
          y: node.y(),
          width: Math.max(40, node.width() * sx),
          fontSize: Math.max(8, layer.fontSize * sy),
          rotation: node.rotation(),
        })
      }}
    />
  )
}
