import { useEffect, useRef, useState } from 'react'

interface Props {
  /** photo d'origine (pour restaurer les zones mangées par l'IA) */
  originalUrl: string
  /** résultat du détourage IA (sert de masque de départ) */
  cutoutUrl: string
  /** valide la retouche : renvoie le PNG détouré final */
  onValidate: (finalUrl: string) => void
  /** garde le détourage IA tel quel, sans retouche */
  onSkip: (cutoutUrl: string) => void
  /** annule et revient en arrière */
  onCancel: () => void
}

type Tool = 'erase' | 'restore'

const MAX_SIZE = 1200 // résolution de travail (perf mobile)

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export default function RetouchScreen({
  originalUrl,
  cutoutUrl,
  onValidate,
  onSkip,
  onCancel,
}: Props) {
  const displayRef = useRef<HTMLCanvasElement>(null)
  const originalCanvas = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  const maskCanvas = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  const resultCanvas = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  const size = useRef({ w: 0, h: 0 })
  const drawing = useRef(false)
  const lastPt = useRef<{ x: number; y: number } | null>(null)

  const [ready, setReady] = useState(false)
  const [tool, setTool] = useState<Tool>('erase')
  const [brush, setBrush] = useState(40)
  const toolRef = useRef(tool)
  const brushRef = useRef(brush)
  toolRef.current = tool
  brushRef.current = brush

  // Initialisation : charge les images, prépare les canvas
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [orig, cut] = await Promise.all([loadImage(originalUrl), loadImage(cutoutUrl)])
      if (cancelled) return
      const scale = Math.min(1, MAX_SIZE / Math.max(orig.naturalWidth, orig.naturalHeight))
      const w = Math.round(orig.naturalWidth * scale)
      const h = Math.round(orig.naturalHeight * scale)
      size.current = { w, h }

      for (const c of [originalCanvas.current, maskCanvas.current, resultCanvas.current]) {
        c.width = w
        c.height = h
      }
      originalCanvas.current.getContext('2d')!.drawImage(orig, 0, 0, w, h)
      // le masque de départ = l'alpha du détourage IA
      maskCanvas.current.getContext('2d')!.drawImage(cut, 0, 0, w, h)

      const disp = displayRef.current!
      disp.width = w
      disp.height = h
      setReady(true)
      composite()
      redraw()
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalUrl, cutoutUrl])

  // result = original ∩ masque
  function composite() {
    const { w, h } = size.current
    const ctx = resultCanvas.current.getContext('2d')!
    ctx.clearRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(originalCanvas.current, 0, 0)
    ctx.globalCompositeOperation = 'destination-in'
    ctx.drawImage(maskCanvas.current, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
  }

  // affichage : fond original fantôme + sujet détouré par-dessus
  function redraw() {
    const disp = displayRef.current
    if (!disp) return
    const { w, h } = size.current
    const ctx = disp.getContext('2d')!
    ctx.clearRect(0, 0, w, h)
    ctx.globalAlpha = 0.22
    ctx.drawImage(originalCanvas.current, 0, 0)
    ctx.globalAlpha = 1
    ctx.drawImage(resultCanvas.current, 0, 0)
  }

  // applique un coup de pinceau (rond doux) sur le masque
  function stamp(x: number, y: number) {
    const ctx = maskCanvas.current.getContext('2d')!
    const r = brushRef.current
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
    if (toolRef.current === 'restore') {
      ctx.globalCompositeOperation = 'source-over'
      grad.addColorStop(0, 'rgba(255,255,255,1)')
      grad.addColorStop(0.7, 'rgba(255,255,255,1)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
    } else {
      ctx.globalCompositeOperation = 'destination-out'
      grad.addColorStop(0, 'rgba(0,0,0,1)')
      grad.addColorStop(0.7, 'rgba(0,0,0,1)')
      grad.addColorStop(1, 'rgba(0,0,0,0)')
    }
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  }

  // trace un segment entre deux points pour éviter les trous
  function strokeTo(x: number, y: number) {
    const last = lastPt.current
    if (last) {
      const dist = Math.hypot(x - last.x, y - last.y)
      const step = Math.max(2, brushRef.current / 4)
      const n = Math.ceil(dist / step)
      for (let i = 1; i <= n; i++) {
        stamp(last.x + ((x - last.x) * i) / n, last.y + ((y - last.y) * i) / n)
      }
    } else {
      stamp(x, y)
    }
    lastPt.current = { x, y }
    composite()
    redraw()
  }

  function toCanvasCoords(e: React.PointerEvent<HTMLCanvasElement>) {
    const disp = displayRef.current!
    const rect = disp.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * size.current.w
    const y = ((e.clientY - rect.top) / rect.height) * size.current.h
    return { x, y }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    ;(e.target as HTMLCanvasElement).setPointerCapture(e.pointerId)
    drawing.current = true
    lastPt.current = null
    const { x, y } = toCanvasCoords(e)
    strokeTo(x, y)
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    e.preventDefault()
    const { x, y } = toCanvasCoords(e)
    strokeTo(x, y)
  }
  function onPointerUp() {
    drawing.current = false
    lastPt.current = null
  }

  function reset() {
    const { w, h } = size.current
    const ctx = maskCanvas.current.getContext('2d')!
    ctx.clearRect(0, 0, w, h)
    loadImage(cutoutUrl).then((cut) => {
      ctx.drawImage(cut, 0, 0, w, h)
      composite()
      redraw()
    })
  }

  function validate() {
    composite()
    resultCanvas.current.toBlob((blob) => {
      if (blob) onValidate(URL.createObjectURL(blob))
    }, 'image/png')
  }

  return (
    <div className="screen retouch">
      <header className="topbar">
        <button className="btn link" onClick={onCancel}>
          ← Annuler
        </button>
        <strong>Retouche</strong>
        <button className="btn primary sm" onClick={validate} disabled={!ready}>
          ✓ Valider
        </button>
      </header>

      <div className="retouch-canvas-wrap">
        {!ready && <div className="spinner" />}
        <canvas
          ref={displayRef}
          className="retouch-canvas"
          style={{ display: ready ? 'block' : 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>

      <div className="panel">
        <div className="panel-body">
          <div className="tool-toggle">
            <button
              className={tool === 'erase' ? 'tool-btn active' : 'tool-btn'}
              onClick={() => setTool('erase')}
            >
              🧽 Gomme
              <small>effacer le fond</small>
            </button>
            <button
              className={tool === 'restore' ? 'tool-btn active' : 'tool-btn'}
              onClick={() => setTool('restore')}
            >
              🖌️ Restaurer
              <small>récupérer le sujet</small>
            </button>
          </div>

          <label className="field">
            <span>Taille du pinceau : {brush} px</span>
            <input
              type="range"
              min={8}
              max={120}
              value={brush}
              onChange={(e) => setBrush(Number(e.target.value))}
            />
          </label>

          <div className="row wrap">
            <button className="btn tiny" onClick={reset}>
              ↺ Réinitialiser
            </button>
            <button className="btn ghost" onClick={() => onSkip(cutoutUrl)}>
              Passer sans retoucher
            </button>
          </div>

          <p className="hint">
            La zone effacée apparaît en transparence (fond fantôme). Utilise
            « Restaurer » pour repeindre une partie du sujet enlevée par erreur.
          </p>
        </div>
      </div>
    </div>
  )
}
