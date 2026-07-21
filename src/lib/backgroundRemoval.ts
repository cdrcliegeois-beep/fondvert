import { removeBackground, type Config } from '@imgly/background-removal'

/**
 * Détoure le sujet d'une image en supprimant l'arrière-plan.
 * Le calcul se fait entièrement dans le navigateur (WASM) : l'image
 * ne quitte jamais l'appareil. Le modèle est téléchargé une fois puis
 * mis en cache par le navigateur.
 *
 * @param source  Fichier / Blob / URL de l'image d'origine
 * @param onProgress  Callback de progression (0 → 1)
 * @returns  Un Blob PNG avec transparence (le sujet détouré)
 */
export async function cutout(
  source: Blob | string,
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  const config: Config = {
    output: { format: 'image/png' },
    progress: (_key, current, total) => {
      if (onProgress && total > 0) {
        onProgress(Math.min(1, current / total))
      }
    },
  }
  return removeBackground(source, config)
}
