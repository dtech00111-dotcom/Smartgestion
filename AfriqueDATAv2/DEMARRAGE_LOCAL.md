# Smart Gestion — base locale et application bureau

## 1. Base de données locale (Supabase + PostgreSQL)

L’application utilise **Auth**, **API REST** et **RLS** Supabase : la solution recommandée est la **stack locale officielle** (PostgreSQL + GoTrue + PostgREST, etc.), via le **Supabase CLI** et **Docker Desktop**.

### Prérequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installé et démarré
- [Node.js](https://nodejs.org/) (déjà utilisé pour le frontend)

### Démarrer la base et les services

Dans un terminal, à la racine **`AfriqueDATAv2`** :

```bash
cd AfriqueDATAv2
npx supabase@latest start
```

Au premier lancement, les images Docker sont téléchargées (plusieurs minutes). Les migrations du dossier `supabase/migrations/` sont appliquées automatiquement.

### Récupérer l’URL et la clé « anon »

```bash
npx supabase@latest status
```

Copiez **API URL** (souvent `http://127.0.0.1:54321`) et la clé **anon** **public**.

### Configurer le frontend

Dans `frontend/.env` (créez-le à partir de `frontend/.env.example`) :

```env
REACT_APP_SUPABASE_URL=http://127.0.0.1:54321
REACT_APP_SUPABASE_ANON_KEY=<clé anon affichée par supabase status>
REACT_APP_PUBLIC_URL=http://127.0.0.1:3000
```

Puis :

```bash
cd frontend
npm install
npm start
```

### Interfaces utiles

| Service        | URL typique                 |
|----------------|-----------------------------|
| Supabase Studio| `http://127.0.0.1:54323`    |
| API            | `http://127.0.0.1:54321`    |
| PostgreSQL     | port `54322` (connexion directe) |

### Arrêter la stack

```bash
cd AfriqueDATAv2
npx supabase@latest stop
```

Documentation : [Développement local Supabase](https://supabase.com/docs/guides/cli/local-development).

---

## 2. Application bureau (Windows)

Le dossier **`AfriqueDATAv2/electron`** regroupe **Electron** + build **frontend** + **backend** Express (sert l’interface sur `http://127.0.0.1` dans la fenêtre).

Voir les commandes détaillées : [`electron/COMMENT_BUILDER_EXE.md`](electron/COMMENT_BUILDER_EXE.md).

Résumé :

```bash
cd AfriqueDATAv2/electron
npm install
npm run dist          # exe portable dans electron/release/
npm run dist:setup    # installateur NSIS
npm run dev           # test sans packager
```

Configurer `frontend/.env` **avant** le build (variables Supabase). La version affichée dans le menu **Aide** correspond à `electron/package.json`.
