import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Stage, Layer, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { Doc, ImageLayer, Layer as AnyLayer, TextLayer } from '../types'
import { FORMATS } from '../types'
import { BackgroundNode, SubjectNode, TextNode } from './nodes'
import { COLOR_PRESETS, GRADIENT_PRESETS, gradientDataUrl } from '../data/backgrounds'

interface Props {
  doc: Doc
  setDoc: (updater: (d: Doc) => Doc) => void
  onAddSubject: () => void
}

type Tab = 'element' | 'background'

export default function Editor({ doc, setDoc, onAddSubject }: Props) {
  const { format, layers } = doc
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('element')

  const wrapRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const bgFileRef = useRef<HTMLInputElement>(null)
  const [scale, setScale] = useState(0.3)

  // Sélectionne automatiquement le dernier calque ajouté
  const prevCount = useRef(layers.length)
  useEffect(() => {
    if (layers.length > prevCount.current) {
      setSelectedId(layers[layers.length - 1].id)
      setTab('element')
    }
    prevCount.current = layers.length
  }, [layers])

  // Adapte la taille du canvas à l'espace disponible
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const compute = () => {
      const pad = 24
      const availW = el.clientWidth - pad
      const availH = el.clientHeight - pad
      const s = Math.min(availW / format.w, availH / format.h)
      setScale(s > 0 ? s : 0.1)
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [format.w, format.h])

  // (Ré)attache le Transformer au calque sélectionné
  useEffect(() => {
    const tr = trRef.current
    const stage = stageRef.current
    if (!tr || !stage) return
    const node = selectedId ? stage.findOne('#' + selectedId) : null
    tr.nodes(node ? [node as Konva.Node] : [])
    tr.getLayer()?.batchDraw()
  })

  const selected = layers.find((l) => l.id === selectedId) ?? null

  function updateLayer(id: string, patch: Partial<AnyLayer>) {
    setDoc((d) => ({
      ...d,
      layers: d.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as AnyLayer) : l)),
    }))
  }

  function removeLayer(id: string) {
    setDoc((d) => ({ ...d, layers: d.layers.filter((l) => l.id !== id) }))
    setSelectedId(null)
  }

  function duplicateLayer(id: string) {
    setDoc((d) => {
      const l = d.layers.find((x) => x.id === id)
      if (!l) return d
      const copy = { ...l, id: crypto.randomUUID(), x: l.x + 30, y: l.y + 30 }
      return { ...d, layers: [...d.layers, copy] }
    })
  }

  function reorder(id: string, dir: 'up' | 'down') {
    setDoc((d) => {
      const idx = d.layers.findIndex((l) => l.id === id)
      if (idx < 0) return d
      const target = dir === 'up' ? idx + 1 : idx - 1
      if (target < 0 || target >= d.layers.length) return d
      const arr = [...d.layers]
      ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
      return { ...d, layers: arr }
    })
  }

  function addText() {
    const t: TextLayer = {
      id: crypto.randomUUID(),
      type: 'text',
      text: 'Votre texte',
      x: format.w * 0.15,
      y: format.h * 0.4,
      width: format.w * 0.7,
      fontSize: Math.round(format.w * 0.08),
      fill: '#ffffff',
      fontStyle: 'bold',
      rotation: 0,
      opacity: 1,
    }
    setDoc((d) => ({ ...d, layers: [...d.layers, t] }))
  }

  function setBackgroundColor(color: string) {
    setDoc((d) => ({ ...d, background: { type: 'color', color } }))
  }
  function setBackgroundImage(src: string) {
    setDoc((d) => ({ ...d, background: { type: 'image', src } }))
  }

  function onBgFile(file: File | undefined) {
    if (!file) return
    setBackgroundImage(URL.createObjectURL(file))
  }

  function exportImage() {
    setSelectedId(null)
    requestAnimationFrame(() => {
      const stage = stageRef.current
      if (!stage) return
      const pixelRatio = (format.w * 2) / stage.width()
      const uri = stage.toDataURL({ pixelRatio, mimeType: 'image/png' })
      const a = document.createElement('a')
      a.href = uri
      a.download = 'fondvert.png'
      a.click()
    })
  }

  function deselectOnEmpty(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (e.target === e.target.getStage()) setSelectedId(null)
  }

  return (
    <div className="screen editor">
      <header className="topbar">
        <strong>🌿 FondVert</strong>
        <div className="format-switch">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              className={f.id === format.id ? 'chip active' : 'chip'}
              onClick={() => setDoc((d) => ({ ...d, format: f }))}
            >
              {f.label.split(' ')[0]}
            </button>
          ))}
        </div>
        <button className="btn primary sm" onClick={exportImage}>
          ⬇ Exporter
        </button>
      </header>

      <div className="canvas-wrap" ref={wrapRef}>
        <Stage
          ref={stageRef}
          width={format.w * scale}
          height={format.h * scale}
          scaleX={scale}
          scaleY={scale}
          onMouseDown={deselectOnEmpty}
          onTouchStart={deselectOnEmpty}
          className="stage"
        >
          <Layer>
            <BackgroundNode background={doc.background} w={format.w} h={format.h} />
            {layers.map((l) =>
              l.type === 'image' ? (
                <SubjectNode
                  key={l.id}
                  layer={l}
                  onSelect={() => setSelectedId(l.id)}
                  onChange={(patch) => updateLayer(l.id, patch)}
                />
              ) : (
                <TextNode
                  key={l.id}
                  layer={l}
                  onSelect={() => setSelectedId(l.id)}
                  onChange={(patch) => updateLayer(l.id, patch)}
                />
              ),
            )}
            <Transformer
              ref={trRef}
              rotateEnabled
              anchorSize={16}
              borderStroke="#22d3ee"
              anchorStroke="#22d3ee"
              anchorFill="#0f172a"
              anchorCornerRadius={8}
            />
          </Layer>
        </Stage>
      </div>

      <div className="panel">
        <div className="tabs">
          <button
            className={tab === 'element' ? 'tab active' : 'tab'}
            onClick={() => setTab('element')}
          >
            Éléments
          </button>
          <button
            className={tab === 'background' ? 'tab active' : 'tab'}
            onClick={() => setTab('background')}
          >
            Fond
          </button>
        </div>

        {tab === 'element' && (
          <div className="panel-body">
            <div className="row wrap">
              <button className="btn primary" onClick={onAddSubject}>
                📸 + Sujet
              </button>
              <button className="btn ghost" onClick={addText}>
                🔤 + Texte
              </button>
            </div>

            {selected ? (
              <div className="props">
                <label className="field">
                  <span>Opacité</span>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={selected.opacity}
                    onChange={(e) => updateLayer(selected.id, { opacity: Number(e.target.value) })}
                  />
                </label>

                {selected.type === 'image' && (
                  <label className="field checkbox">
                    <input
                      type="checkbox"
                      checked={(selected as ImageLayer).shadow}
                      onChange={(e) => updateLayer(selected.id, { shadow: e.target.checked })}
                    />
                    <span>Ombre portée</span>
                  </label>
                )}

                {selected.type === 'text' && (
                  <>
                    <label className="field">
                      <span>Texte</span>
                      <input
                        type="text"
                        value={(selected as TextLayer).text}
                        onChange={(e) => updateLayer(selected.id, { text: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>Taille</span>
                      <input
                        type="range"
                        min={12}
                        max={200}
                        value={(selected as TextLayer).fontSize}
                        onChange={(e) => updateLayer(selected.id, { fontSize: Number(e.target.value) })}
                      />
                    </label>
                    <label className="field">
                      <span>Couleur</span>
                      <input
                        type="color"
                        value={(selected as TextLayer).fill}
                        onChange={(e) => updateLayer(selected.id, { fill: e.target.value })}
                      />
                    </label>
                  </>
                )}

                <div className="row wrap">
                  <button className="btn tiny" onClick={() => reorder(selected.id, 'up')}>
                    ⬆ Avancer
                  </button>
                  <button className="btn tiny" onClick={() => reorder(selected.id, 'down')}>
                    ⬇ Reculer
                  </button>
                  <button className="btn tiny" onClick={() => duplicateLayer(selected.id)}>
                    ⧉ Dupliquer
                  </button>
                  <button className="btn tiny danger" onClick={() => removeLayer(selected.id)}>
                    🗑 Supprimer
                  </button>
                </div>
              </div>
            ) : (
              <p className="hint">
                {layers.length === 0
                  ? 'Ajoute un sujet ou du texte pour commencer.'
                  : 'Touche un élément sur le canvas pour le modifier.'}
              </p>
            )}
          </div>
        )}

        {tab === 'background' && (
          <div className="panel-body">
            <input
              ref={bgFileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => onBgFile(e.target.files?.[0])}
            />
            <button className="btn primary" onClick={() => bgFileRef.current?.click()}>
              🖼️ Importer un fond
            </button>

            <p className="section-label">Couleurs unies</p>
            <div className="swatches">
              {COLOR_PRESETS.map((p) => (
                <button
                  key={p.id}
                  className="swatch"
                  title={p.label}
                  style={{ background: p.color }}
                  onClick={() => setBackgroundColor(p.color!)}
                />
              ))}
            </div>

            <p className="section-label">Dégradés</p>
            <div className="swatches">
              {GRADIENT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  className="swatch"
                  title={p.label}
                  style={{ background: `linear-gradient(${p.gradient![0]}, ${p.gradient![1]})` }}
                  onClick={() => setBackgroundImage(gradientDataUrl(p.gradient!))}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
