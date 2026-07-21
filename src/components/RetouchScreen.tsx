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

type Tool = 'erase' | 'restore' | 'pan'

const MAX_SIZE = 1200 // résolution de travail (perf mobile)
const UNDO_CAP = 8 // nombre de coups annulables (limite mémoire)
const MIN_ZOOM = 1
const MAX_ZOOM = 8

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
  const wrapRef = useRef<HTMLDivElement>(null)
  const displayRef = useRef<HTMLCanvasElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const originalCanvas = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  const maskCanvas = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  const resultCanvas = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  const size = useRef({ w: 0, h: 0 })
  const drawing = useRef(false)
  const lastPt = useRef<{ x: number; y: number } | null>(null)

  // gestion multi-doigts : pince (zoom) et déplacement
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchStart = useRef<{
    dist: number
    mid: { x: number; y: number }
    view: { s: number; tx: number; ty: number }
  } | null>(null)
  const panStart = useRef<{ x: number; y: number; view: { s: number; tx: number; ty: number } } | null>(
    null,
  )

  const [ready, setReady] = useState(false)
  const [tool, setTool] = useState<Tool>('erase')
  const [brush, setBrush] = useState(40)
  const [view, setView] = useState({ s: 1, tx: 0, ty: 0 })
  const [, bumpHistory] = useState(0)

  const undoStack = useRef<HTMLCanvasElement[]>([])
  const redoStack = useRef<HTMLCanvasElement[]>([])

  const toolRef = useRef(tool)
  const brushRef = useRef(brush)
  const viewRef = useRef(view)
  toolRef.current = tool
  brushRef.current = brush
  viewRef.current = view

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

      undoStack.current = []
      redoStack.current = []

      const disp = displayRef.current!
      disp.width = w
      disp.height = h
      setReady(true)
      setView({ s: 1, tx: 0, ty: 0 })
      composite()
      redraw()
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalUrl, cutoutUrl])

  // molette souris = zoom (desktop) — listener manuel pour pouvoir preventDefault
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const cur = viewRef.current
      applyZoom(cur.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15), { x: e.clientX, y: e.clientY })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // ---------- historique (annuler / rétablir) ----------

  function snapshotMask(): HTMLCanvasElement {
    const c = document.createElement('canvas')
    c.width = size.current.w
    c.height = size.current.h
    c.getContext('2d')!.drawImage(maskCanvas.current, 0, 0)
    return c
  }

  function pushUndo() {
    undoStack.current.push(snapshotMask())
    if (undoStack.current.length > UNDO_CAP) undoStack.current.shift()
    redoStack.current = []
    bumpHistory((t) => t + 1)
  }

  function restoreMask(c: HTMLCanvasElement) {
    const { w, h } = size.current
    const ctx = maskCanvas.current.getContext('2d')!
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(c, 0, 0)
    composite()
    redraw()
  }

  function undo() {
    const c = undoStack.current.pop()
    if (!c) return
    redoStack.current.push(snapshotMask())
    restoreMask(c)
    bumpHistory((t) => t + 1)
  }

  function redo() {
    const c = redoStack.current.pop()
    if (!c) return
    undoStack.current.push(snapshotMask())
    restoreMask(c)
    bumpHistory((t) => t + 1)
  }

  // ---------- zoom / déplacement ----------

  /** zoom vers `next`, centré sur le point écran donné */
  function applyZoom(next: number, screenPt: { x: number; y: number }) {
    const canvas = displayRef.current
    if (!canvas) return
    const cur = viewRef.current
    const s2 = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next))
    const rect = canvas.getBoundingClientRect()
    // centre "layout" (hors transform) : centre affiché moins la translation courante
    const layoutC = {
      x: rect.left + rect.width / 2 - cur.tx,
      y: rect.top + rect.height / 2 - cur.ty,
    }
    const k = s2 / cur.s
    let tx = screenPt.x - layoutC.x - k * (screenPt.x - layoutC.x - cur.tx)
    let ty = screenPt.y - layoutC.y - k * (screenPt.y - layoutC.y - cur.ty)
    if (s2 === 1) {
      tx = 0
      ty = 0
    }
    setView({ s: s2, tx, ty })
  }

  function resetZoom() {
    setView({ s: 1, tx: 0, ty: 0 })
  }

  // ---------- pinceau ----------

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

  function toCanvasCoords(e: { clientX: number; clientY: number }) {
    const disp = displayRef.current!
    const rect = disp.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * size.current.w
    const y = ((e.clientY - rect.top) / rect.height) * size.current.h
    return { x, y }
  }

  // aperçu du pinceau (cercle qui suit le doigt / la souris)
  function moveCursor(e: { clientX: number; clientY: number }) {
    const c = cursorRef.current
    const disp = displayRef.current
    if (!c || !disp || !size.current.w) return
    if (toolRef.current === 'pan') {
      c.style.display = 'none'
      return
    }
    const rect = disp.getBoundingClientRect()
    const r = brushRef.current * (rect.width / size.current.w)
    c.style.display = 'block'
    c.style.width = `${r * 2}px`
    c.style.height = `${r * 2}px`
    c.style.left = `${e.clientX - r}px`
    c.style.top = `${e.clientY - r}px`
  }

  // ---------- événements pointeur ----------

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    ;(e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2) {
      // deux doigts : on passe en mode pince (zoom), on interrompt le trait
      drawing.current = false
      lastPt.current = null
      panStart.current = null
      const [a, b] = [...pointers.current.values()]
      pinchStart.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        view: { ...viewRef.current },
      }
      return
    }

    if (toolRef.current === 'pan') {
      panStart.current = { x: e.clientX, y: e.clientY, view: { ...viewRef.current } }
      return
    }

    drawing.current = true
    lastPt.current = null
    pushUndo()
    const { x, y } = toCanvasCoords(e)
    strokeTo(x, y)
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    moveCursor(e)
    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }

    const pinch = pinchStart.current
    if (pinch && pointers.current.size >= 2) {
      e.preventDefault()
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const canvas = displayRef.current
      if (!canvas) return
      const s2 = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinch.view.s * (dist / pinch.dist)))
      const rect = canvas.getBoundingClientRect()
      const cur = viewRef.current
      const layoutC = {
        x: rect.left + rect.width / 2 - cur.tx,
        y: rect.top + rect.height / 2 - cur.ty,
      }
      const k = s2 / pinch.view.s
      // le point saisi au départ (mid0) doit suivre le doigt (mid) → zoom + déplacement
      let tx = mid.x - layoutC.x - k * (pinch.mid.x - layoutC.x - pinch.view.tx)
      let ty = mid.y - layoutC.y - k * (pinch.mid.y - layoutC.y - pinch.view.ty)
      if (s2 === 1) {
        tx = 0
        ty = 0
      }
      setView({ s: s2, tx, ty })
      return
    }

    const pan = panStart.current
    if (pan) {
      e.preventDefault()
      setView({
        s: pan.view.s,
        tx: pan.view.tx + (e.clientX - pan.x),
        ty: pan.view.ty + (e.clientY - pan.y),
      })
      return
    }

    if (drawing.current) {
      e.preventDefault()
      const { x, y } = toCanvasCoords(e)
      strokeTo(x, y)
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
    if (pointers.current.size === 0) panStart.current = null
    drawing.current = false
    lastPt.current = null
  }

  function onPointerLeave() {
    if (cursorRef.current) cursorRef.current.style.display = 'none'
  }

  function reset() {
    pushUndo()
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

      <div className="retouch-canvas-wrap" ref={wrapRef}>
        {!ready && <div className="spinner" />}
        <canvas
          ref={displayRef}
          className="retouch-canvas"
          style={{
            display: ready ? 'block' : 'none',
            transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.s})`,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerLeave}
        />
        <div className="zoom-controls">
          <button
            onClick={() =>
              applyZoom(view.s / 1.4, {
                x: window.innerWidth / 2,
                y: window.innerHeight / 2,
              })
            }
          >
            −
          </button>
          <span>{Math.round(view.s * 100)} %</span>
          <button
            onClick={() =>
              applyZoom(view.s * 1.4, {
                x: window.innerWidth / 2,
                y: window.innerHeight / 2,
              })
            }
          >
            +
          </button>
          {view.s > 1 && <button onClick={resetZoom}>⤢</button>}
        </div>
      </div>

      <div ref={cursorRef} className="brush-cursor" />

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
            <button
              className={tool === 'pan' ? 'tool-btn active' : 'tool-btn'}
              onClick={() => setTool('pan')}
            >
              ✋ Déplacer
              <small>naviguer zoomé</small>
            </button>
          </div>

          <label className="field">
            <span>Taille du pinceau : {brush} px</span>
            <input
              type="range"
              min={4}
              max={150}
              value={brush}
              onChange={(e) => setBrush(Number(e.target.value))}
            />
          </label>

          <div className="row wrap">
            <button className="btn tiny" onClick={undo} disabled={undoStack.current.length === 0}>
              ↶ Annuler
            </button>
            <button className="btn tiny" onClick={redo} disabled={redoStack.current.length === 0}>
              ↷ Rétablir
            </button>
            <button className="btn tiny" onClick={reset}>
              ↺ Réinitialiser
            </button>
            <button className="btn ghost" onClick={() => onSkip(cutoutUrl)}>
              Passer sans retoucher
            </button>
          </div>

          <p className="hint">
            Zoome avec deux doigts (ou la molette) pour retoucher avec précision. La zone effacée
            apparaît en transparence ; « Restaurer » repeint une partie du sujet enlevée par erreur.
          </p>
        </div>
      </div>
    </div>
  )
}
