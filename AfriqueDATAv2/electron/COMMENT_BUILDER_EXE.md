# Créer l’exécutable Smart Gestion (Windows)

Tout se fait **dans le dossier `electron`**, en 2 grandes étapes : construire le frontend + préparer le backend, puis lancer Electron Builder.

## Prérequis

- Node.js installé  
- Une seule fois : installer les dépendances de l’app Electron  

```powershell
cd E:\smartGestion\AfriqueDATAv2\electron
npm install
```

## Commandes

### 1) Build frontend + dépendances backend, puis **exe portable** (recommandé pour tester)

```powershell
cd E:\smartGestion\AfriqueDATAv2\electron
npm run dist
```

L’exécutable est dans : **`electron/release/`**  
Exemple : `Smart Gestion 1.0.0.exe` (version portable).

### 2) **Installateur** Windows (.exe d’installation)

```powershell
cd E:\smartGestion\AfriqueDATAv2\electron
npm run dist:setup
```

### 3) Portable **et** installateur en une fois

```powershell
npm run dist:all
```

### 4) Tester sans créer d’exe (fenêtre Electron + serveur local)

```powershell
npm run dev
```

---

## Rappel

- Le **frontend** utilise toujours **Supabase** (cloud ou local) via le fichier `frontend/.env`. Les variables `REACT_APP_*` sont figées au moment du **`npm run build`** du frontend. Pour changer de serveur Supabase, refaites `npm run dist` après avoir modifié `.env` et rebuild le frontend.
- Le **backend** Express sert surtout l’interface (fichiers du build) et l’URL `/api` ; la logique métier reste côté Supabase.
