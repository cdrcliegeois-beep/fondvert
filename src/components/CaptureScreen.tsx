import { useRef, useState } from 'react'
import { cutout } from '../lib/backgroundRemoval'

interface Props {
  /** Appelé avec la photo d'origine et le sujet détouré (URLs blob) */
  onDone: (originalUrl: string, cutoutUrl: string) => void
  /** Affiché seulement s'il y a déjà un collage en cours */
  onCancel?: () => void
}

type Phase = 'idle' | 'processing' | 'error'

export default function CaptureScreen({ onDone, onCancel }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string>()
  const [error, setError] = useState<string>()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setPhase('processing')
    setProgress(0)
    setError(undefined)
    try {
      const blob = await cutout(file, setProgress)
      const cutoutUrl = URL.createObjectURL(blob)
      onDone(url, cutoutUrl)
    } catch (e) {
      console.error(e)
      setError(
        "Le détourage a échoué. Vérifie ta connexion (le modèle IA se télécharge la 1ʳᵉ fois) puis réessaie.",
      )
      setPhase('error')
    }
  }

  return (
    <div className="screen capture">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {phase === 'processing' ? (
        <div className="processing">
          {previewUrl && <img className="preview" src={previewUrl} alt="aperçu" />}
          <div className="spinner" />
          <p className="processing-title">Détourage en cours…</p>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="hint">Le sujet est découpé directement sur ton appareil.</p>
        </div>
      ) : (
        <div className="capture-inner">
          <div className="brand">
            <span className="logo">🌿</span>
            <h1>FondVert</h1>
            <p className="tagline">Photo → détourage → collage</p>
          </div>

          {phase === 'error' && <div className="error-box">{error}</div>}

          <div className="actions">
            <button className="btn primary big" onClick={() => cameraRef.current?.click()}>
              📸 Prendre une photo
            </button>
            <button className="btn ghost big" onClick={() => galleryRef.current?.click()}>
              🖼️ Importer une image
            </button>
            {onCancel && (
              <button className="btn link" onClick={onCancel}>
                ← Retour au collage
              </button>
            )}
          </div>

          <p className="tip">Astuce : un fond vert ou uni donne un détourage encore plus net.</p>
        </div>
      )}
    </div>
  )
}
