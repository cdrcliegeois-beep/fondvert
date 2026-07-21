# CLAUDE.md

Guide de travail pour Claude Code sur ce dépôt.

## Le projet

**FondVert** — application de **prise de photo → détourage → collage**.
On prend/importe une photo, l'outil **détoure automatiquement le sujet** (par IA,
dans le navigateur), puis on **compose des collages** en posant le sujet découpé
dans d'autres images (fond vert/uni ou n'importe quelle photo).

État actuel : **prototype web** (React + TypeScript + Vite), pensé pour un futur
portage **React Native / Expo** (mobile iOS/Android, objectif final).

### Décisions produit déjà validées avec l'utilisateur

- Support cible final : **app mobile iOS/Android** (le web est une 1ʳᵉ étape).
- Détourage : **IA automatique** (pas de chroma-key manuel), calcul **on-device**.
- Collage : **avancé** (calques, rotation, opacité, ombre, texte, ordre des plans).
- Usage : **outil partageable** (d'où le déploiement en ligne).
- L'utilisateur n'est **pas développeur** : préférer des explications simples,
  en **français**, et éviter le jargon. Il teste depuis son **téléphone**.

## Commandes

```bash
npm install      # dépendances
npm run dev      # serveur de dev (Vite) — http://localhost:5173
npm run build    # tsc + build de production dans dist/
npm run preview  # sert le build de production
```

Il n'y a pas de tests automatisés ni de linter configurés pour l'instant.
Validation minimale avant un commit : **`npm run build` doit passer** (TypeScript
strict). Un smoke test navigateur (Playwright + Chromium) est possible mais
optionnel.

## Architecture

```
src/
  App.tsx                  orchestration : écran capture <-> éditeur, ajout des sujets
  types.ts                 modèle du document (Format, Background, Layer, Doc)
  lib/backgroundRemoval.ts détourage IA via @imgly/background-removal (WASM, on-device)
  hooks/useImage.ts        charge une URL en HTMLImageElement pour Konva
  data/backgrounds.ts      bibliothèque de fonds intégrés (couleurs + dégradés générés)
  components/
    CaptureScreen.tsx      prise/import de photo + progression du détourage
    Editor.tsx             éditeur de collage (canvas Konva, panneaux de contrôle)
    nodes.tsx              nœuds Konva : BackgroundNode, SubjectNode, TextNode
```

Points clés d'implémentation :

- **Détourage** : `@imgly/background-removal` fait l'inférence dans le navigateur
  (l'image ne quitte jamais l'appareil). Le moteur WASM (~24 Mo) est empaqueté ;
  les poids du modèle sont téléchargés une fois puis mis en cache. → 1ᵉʳ détourage
  nécessite une connexion, ensuite ça marche hors-ligne.
- **Éditeur** : canvas `react-konva`. Le document a une taille logique fixe
  (`format.w × format.h`) ; le Stage est mis à l'échelle (`scale`) pour tenir dans
  l'écran via un `ResizeObserver`. Les coordonnées des calques sont en **espace
  logique**, donc l'export haute résolution se fait avec `pixelRatio = 2 / scale`.
- **Calques** : ordre dans le tableau `layers` = ordre des plans (dernier = dessus).
  Un `Transformer` unique s'attache au calque sélectionné (`findOne('#'+id)`).
- **Fonds** : soit couleur unie, soit image (import utilisateur ou dégradé généré
  en data-URL). Rendu en mode « cover ».

## Déploiement

- **GitHub Pages** via `.github/workflows/deploy.yml` (build + deploy à chaque
  push sur `claude/photo-app-detourage-xx6191` ou `main`).
- `base: './'` dans `vite.config.ts` (chemins relatifs, nécessaire pour le
  sous-dossier `/fondvert/`).
- URL publique : **https://cdrcliegeois-beep.github.io/fondvert/**
- Pages doit être activé une fois (Settings → Pages → Source = « GitHub Actions ») :
  déjà fait par l'utilisateur.

## Conventions de contribution

- Développer sur la branche **`claude/photo-app-detourage-xx6191`**, jamais
  directement sur `main` sans autorisation explicite.
- **Commiter et pousser tôt** : l'environnement distant est éphémère et peut être
  recyclé (les fichiers non commités sont perdus).
- Messages de commit et UI en **français**.
- Code : suivre le style existant (composants fonctionnels, hooks, TypeScript strict).

## Pistes pour la suite

- Retouche du masque au doigt (gomme / pinceau) pour corriger le détourage
- Contour lumineux / effet sticker autour du sujet
- Filtres, texte incurvé, plus de fonds
- Sauvegarde des projets, partage, comptes utilisateurs
- Portage **React Native / Expo** (vraie app mobile)
