import { useEffect, useState } from 'react'

type Status = 'loading' | 'loaded' | 'failed'

/**
 * Charge une image (data-URL ou blob-URL) en HTMLImageElement,
 * utilisable directement par react-konva.
 */
export function useImage(src: string | undefined): [HTMLImageElement | undefined, Status] {
  const [image, setImage] = useState<HTMLImageElement>()
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    if (!src) {
      setImage(undefined)
      setStatus('loading')
      return
    }
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    let active = true
    setStatus('loading')
    img.onload = () => {
      if (!active) return
      setImage(img)
      setStatus('loaded')
    }
    img.onerror = () => {
      if (!active) return
      setStatus('failed')
    }
    img.src = src
    return () => {
      active = false
    }
  }, [src])

  return [image, status]
}
