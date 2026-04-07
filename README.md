# Smart Gestion

**Plateforme intelligente de gestion des activités numériques** – Salle du Numérique UNILU

## Fonctionnalités

- **Gestion académique** : facultés, promotions, étudiants
- **Visiteurs** : enregistrement des non-étudiants
- **Activités** : création, types configurables, QR codes uniques
- **Inscriptions** : formulaire public accessible par QR (étudiants + visiteurs)
- **Finances** : suivi des montants, totaux par activité
- **Exports** : Excel et PDF par activité (liste participants, montants, signature)
- **Tableau de bord** : statistiques, graphiques, filtres

## Démarrage

### 1. Supabase

1. Créez un projet sur [supabase.com](https://supabase.com)
2. Dans l'éditeur SQL, exécutez le contenu de `supabase/migrations/001_initial_schema.sql`
3. Créez un utilisateur admin :
   - Authentication → Users → Add user (email + mot de passe)
   - Copiez l'UUID de l'utilisateur créé
   - Exécutez : `INSERT INTO admin_profiles (id, email, nom_complet) VALUES ('uuid-créé', 'email@admin.com', 'Secrétaire');`

### 2. Frontend

```bash
cd AfriqueDATAv2/frontend
cp .env.example .env
# Éditez .env avec votre URL Supabase et clé anon
npm install
npm start
```

Ouvre http://localhost:3000

### Application bureau et base locale

- **PostgreSQL / Supabase en local** (Docker) et **installateur Windows** : voir [`AfriqueDATAv2/DEMARRAGE_LOCAL.md`](AfriqueDATAv2/DEMARRAGE_LOCAL.md).
- **Exécutable Windows** : dossier `AfriqueDATAv2/electron` — voir [`AfriqueDATAv2/electron/COMMENT_BUILDER_EXE.md`](AfriqueDATAv2/electron/COMMENT_BUILDER_EXE.md). Racine : `npm run desktop:dist` ou `desktop:setup`.
- Racine du dépôt : `npm run supabase:start` / `supabase:stop` / `supabase:status`.

- **Admin** : connectez-vous avec l'email/mot de passe créé
- **Formulaire QR** : `/inscription/{id_activite}` (lien généré par le QR de chaque activité)

## Structure

```
smartGestion/
├── SmartGestion/
│   ├── frontend/          # React + Tailwind + Supabase
│   │   └── src/
│   │       ├── components/
│   │       ├── context/
│   │       ├── lib/
│   │       └── pages/
│   └── supabase/
│       └── migrations/    # Schéma SQL
└── README.md
```

## Technologies

- React 19, React Router
- Tailwind CSS
- Supabase (Auth, Database)
- QRCode.react, xlsx, jspdf, recharts, lucide-react
# SMARTGESTION
# SmartGestion
