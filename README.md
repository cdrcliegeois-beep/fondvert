# 🌿 FondVert

Application de **prise de photo → détourage → collage**.
On prend (ou importe) une photo, l'outil **détoure automatiquement le sujet**,
puis on **compose des collages** en posant le sujet découpé dans d'autres images
(fond vert / uni ou n'importe quelle photo).

> Prototype **web** (utilisable au téléphone) qui préfigure la future app mobile.
> Stack React + TypeScript pour faciliter le passage à React Native ensuite.

## Ce que fait le prototype

- 📸 **Prise de photo** (caméra du téléphone) ou **import** depuis la galerie
- ✂️ **Détourage IA on-device** : la découpe se fait **dans le navigateur** via
  [`@imgly/background-removal`](https://github.com/imgly/background-removal-js).
  La photo **ne quitte jamais l'appareil** (privé, sans serveur). Le modèle IA
  se télécharge une seule fois puis est mis en cache.
- 🖼️ **Collage avancé** (canvas à calques) :
  - fond **importé** ou **bibliothèque intégrée** (couleurs unies + dégradés)
  - plusieurs **sujets** en calques : déplacer, redimensionner, pivoter
  - **opacité**, **ombre portée**, ordre des plans (avancer / reculer), duplication
  - **texte** (contenu, taille, couleur)
  - 3 **formats** : portrait, carré, paysage
  - **export** de l'image finale en PNG haute résolution

## Démarrer

```bash
npm install
npm run dev
```

Vite affiche une URL **Local** et une URL **Network** (`http://192.168.x.x:5173`).
Ouvre l'URL *Network* sur ton téléphone (même Wi-Fi) pour tester la caméra.

> ⚠️ La caméra en direct (`getUserMedia`) exige un contexte sécurisé (HTTPS ou
> localhost). Sur mobile via `http://` en réseau local, utilise le bouton
> **« Prendre une photo »** : il ouvre l'appareil photo natif du téléphone.

## Build de production

```bash
npm run build      # génère dist/
npm run preview    # sert le build localement
```

## Structure

```
src/
  App.tsx                  orchestration capture <-> éditeur
  types.ts                 modèle du document (fond, calques, formats)
  lib/backgroundRemoval.ts détourage IA (WASM, on-device)
  hooks/useImage.ts        chargement d'image pour Konva
  data/backgrounds.ts      bibliothèque de fonds intégrés
  components/
    CaptureScreen.tsx      prise/import de photo + progression du détourage
    Editor.tsx             éditeur de collage (canvas à calques)
    nodes.tsx              nœuds Konva (fond, sujet image, texte)
```

## Pistes pour la suite

- Détourage 100 % hors-ligne (embarquer les poids du modèle)
- Retouche du masque au doigt (gomme / pinceau)
- Filtres, contour lumineux du sujet, texte incurvé
- Sauvegarde des projets, partage, comptes utilisateurs
- Portage **React Native / Expo** pour une vraie app iOS/Android
