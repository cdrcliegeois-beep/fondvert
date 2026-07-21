import { useState } from 'react'
import CaptureScreen from './components/CaptureScreen'
import RetouchScreen from './components/RetouchScreen'
import Editor from './components/Editor'
import type { Doc, ImageLayer } from './types'
import { FORMATS } from './types'

const initialDoc: Doc = {
  format: FORMATS[0],
  background: { type: 'color', color: '#00b140' }, // fond vert par défaut
  layers: [],
}

type View = 'capture' | 'retouch' | 'editor'

export default function App() {
  const [doc, setDoc] = useState<Doc>(initialDoc)
  const [view, setView] = useState<View>('capture')
  const [pending, setPending] = useState<{ originalUrl: string; cutoutUrl: string } | null>(null)

  /** Ajoute le sujet détouré comme nouveau calque, centré et à taille raisonnable */
  function addSubject(cutoutUrl: string) {
    const img = new window.Image()
    img.onload = () => {
      const { w, h } = doc.format
      const maxW = w * 0.7
      const maxH = h * 0.7
      const fit = Math.min(maxW / img.width, maxH / img.height, 1)
      const lw = img.width * fit
      const lh = img.height * fit
      const layer: ImageLayer = {
        id: crypto.randomUUID(),
        type: 'image',
        src: cutoutUrl,
        x: (w - lw) / 2,
        y: (h - lh) / 2,
        width: lw,
        height: lh,
        rotation: 0,
        opacity: 1,
        shadow: false,
      }
      setDoc((d) => ({ ...d, layers: [...d.layers, layer] }))
      setPending(null)
      setView('editor')
    }
    img.src = cutoutUrl
  }

  if (view === 'capture') {
    return (
      <CaptureScreen
        onDone={(originalUrl, cutoutUrl) => {
          setPending({ originalUrl, cutoutUrl })
          setView('retouch')
        }}
        onCancel={doc.layers.length > 0 ? () => setView('editor') : undefined}
      />
    )
  }

  if (view === 'retouch' && pending) {
    return (
      <RetouchScreen
        originalUrl={pending.originalUrl}
        cutoutUrl={pending.cutoutUrl}
        onValidate={(finalUrl) => addSubject(finalUrl)}
        onSkip={(cutoutUrl) => addSubject(cutoutUrl)}
        onCancel={() => {
          setPending(null)
          setView(doc.layers.length > 0 ? 'editor' : 'capture')
        }}
      />
    )
  }

  return <Editor doc={doc} setDoc={setDoc} onAddSubject={() => setView('capture')} />
}
