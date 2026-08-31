# Documentation Technique — SUPMEAL

## 1. Prérequis et configuration

### Prérequis

| Outil | Version minimale | Usage |
|---|---|---|
| Docker Engine | 24.x | Déploiement conteneurisé |
| Docker Compose | v2 (`docker compose`) | Orchestration des 3 services |
| Node.js | 20.x | Développement local uniquement |
| npm | 10.x | Développement local uniquement |

### Variables d'environnement

Copier `.env.example` en `.env` à la racine du projet et renseigner :

| Variable | Requis | Description | Valeur par défaut / exemple |
|---|---|---|---|
| `POSTGRES_USER` | non | Utilisateur PostgreSQL | `supmeal` |
| `POSTGRES_PASSWORD` | **oui** | Mot de passe PostgreSQL — aucune valeur de repli | à générer |
| `POSTGRES_DB` | non | Nom de la base | `supmeal` |
| `JWT_SECRET` | **oui** | Secret de signature des access tokens | `openssl rand -base64 64` |
| `JWT_REFRESH_SECRET` | **oui** | Secret de signature des refresh tokens | `openssl rand -base64 64` |
| `PORT` | non | Port d'écoute de l'API dans le conteneur | `3000` |
| `NODE_ENV` | non | Environnement d'exécution | `production` |
| `CLIENT_URL` | non | Origine autorisée par CORS (URL publique du client) | `http://localhost:8080` |
| `VITE_API_URL` | non | Base de l'API vue du navigateur. **Laisser vide** en Docker : le client utilise alors des chemins relatifs (`/api`) servis par le reverse proxy nginx | *(vide)* |
| `OAUTH_CALLBACK_BASE` | non | Base publique des callbacks OAuth2 | `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | non | OAuth2 Google — stratégie désactivée si absent | — |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | non | OAuth2 GitHub — stratégie désactivée si absent | — |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | non | OAuth2 Microsoft — stratégie désactivée si absent | — |

> Les trois variables marquées « requis » n'ont volontairement **aucune valeur de repli** dans
> `docker-compose.yml`, afin qu'aucun secret par défaut ne puisse se retrouver en production.
> Elles doivent être renseignées avant le premier `docker compose up`.

> **⚠️ Sécurité** : ne jamais committer le fichier `.env`, ni l'inclure dans une archive de livraison.
> Il est exclu par `.gitignore`.

### Génération des secrets

```bash
openssl rand -base64 64   # JWT_SECRET
openssl rand -base64 64   # JWT_REFRESH_SECRET
openssl rand -base64 32   # POSTGRES_PASSWORD
```

---

## 2. Guide de déploiement

### Via Docker Compose (recommandé)

```bash
git clone <url-du-repo>
cd SUPMEAL
cp .env.example .env
# Éditer .env : renseigner POSTGRES_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET
docker compose up --build -d
```

Les 3 services démarrent dans l'ordre imposé par les directives `depends_on` / `healthcheck` :
`postgres` (attente de `pg_isready`) → `server` → `client`.

Le schéma de base de données est appliqué automatiquement au démarrage du serveur : la commande de
conteneur exécute `npx prisma db push --accept-data-loss` avant `node dist/server.js`
(voir `server/Dockerfile`).

### URLs d'accès

| Service | URL | Mapping de ports |
|---|---|---|
| Application web | http://localhost:8080 | `8080` (hôte) → `80` (nginx dans le conteneur) |
| API REST | http://localhost:3000/api | `3000` → `3000` |
| Health check | http://localhost:3000/api/health | — |
| PostgreSQL | `localhost:5432` | `5432` → `5432` |

Le navigateur n'appelle jamais `localhost:3000` directement : nginx (`client/nginx.conf`) relaie
`/api/`, `/uploads/` et `/socket.io/` (avec mise à niveau WebSocket) vers le service `server`.
L'API reste néanmoins exposée sur l'hôte pour le débogage et pour les callbacks OAuth2.

### Activation de l'authentification OAuth2 (optionnel)

L'application fonctionne sans aucun fournisseur OAuth2 : seule l'authentification par e-mail et mot
de passe est alors proposée. Chaque fournisseur est activé indépendamment en renseignant sa paire
identifiant/secret dans `.env`, puis en redémarrant le service `server`.

Le serveur expose les fournisseurs réellement configurés sur `GET /api/auth/providers`, et le client
n'affiche que les boutons correspondants. Un fournisseur non configuré répond `503` avec un message
explicite plutôt que d'échouer sur une stratégie Passport absente.

L'URL de rappel à déclarer chez chaque fournisseur est construite à partir de `OAUTH_CALLBACK_BASE` :

```
${OAUTH_CALLBACK_BASE}/api/auth/<provider>/callback
```

soit, en déploiement local par défaut :

| Fournisseur | URL de rappel à déclarer |
|---|---|
| Google | `http://localhost:3000/api/auth/google/callback` |
| GitHub | `http://localhost:3000/api/auth/github/callback` |
| Microsoft | `http://localhost:3000/api/auth/microsoft/callback` |

#### Google

1. Ouvrir [console.cloud.google.com](https://console.cloud.google.com/) → **APIs & Services** →
   **Credentials** → **Create credentials** → **OAuth client ID**
2. Type d'application : **Web application**
3. Ajouter l'URL de rappel ci-dessus dans **Authorized redirect URIs**
4. Reporter l'identifiant et le secret dans `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`

#### GitHub

1. Ouvrir [github.com/settings/developers](https://github.com/settings/developers) →
   **OAuth Apps** → **New OAuth App**
2. **Authorization callback URL** : l'URL de rappel ci-dessus
3. Générer un *client secret*, puis renseigner `GITHUB_CLIENT_ID` et `GITHUB_CLIENT_SECRET`

#### Microsoft

1. Ouvrir [portal.azure.com](https://portal.azure.com/) → **Microsoft Entra ID** →
   **App registrations** → **New registration**
2. **Redirect URI** : plateforme **Web**, avec l'URL de rappel ci-dessus
3. **Certificates & secrets** → **New client secret**
4. Renseigner `MICROSOFT_CLIENT_ID` et `MICROSOFT_CLIENT_SECRET`

#### Rattachement à un compte existant

Depuis **Paramètres → Comptes liés**, un utilisateur déjà connecté peut ajouter un fournisseur à son
compte. Le client demande d'abord une URL d'autorisation à `POST /api/auth/link/:provider` ; le
serveur y place un paramètre `state` signé (JWT de 10 minutes) qui identifie le compte courant, et le
callback rattache le fournisseur à **ce** compte plutôt que de se fier à l'adresse e-mail renvoyée.

Sans ce mécanisme, un fournisseur dont l'adresse e-mail diffère de celle du compte créerait un
second compte et la session basculerait dessus sans que l'utilisateur en soit averti.

Si l'identité du fournisseur est déjà rattachée à un autre compte SUPMEAL, la liaison est refusée.

---

### Jeu de données de démonstration (optionnel)

Le seed n'est **pas** exécuté automatiquement par Docker. Pour peupler la base avec les tags par
défaut, des utilisateurs de démonstration, des cookbooks, des recettes et un planning :

```bash
docker compose exec server npm run db:seed
```

### Développement local

```bash
# 1. PostgreSQL via Docker uniquement
docker compose up postgres -d

# 2. Backend
cd server
npm install
# Créer server/.env avec au minimum :
#   DATABASE_URL=postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@localhost:5432/<POSTGRES_DB>
#   JWT_SECRET=<secret>
#   JWT_REFRESH_SECRET=<secret>
# Reprendre les valeurs du .env racine — ne jamais écrire de secret en dur dans la documentation.
npm run db:push    # applique le schéma Prisma
npm run db:seed    # jeu de données de démonstration
npm run dev        # API sur :3000

# 3. Frontend (autre terminal)
cd client
npm install
npm run dev        # :5173, proxy Vite vers :3000 pour /api, /uploads et /socket.io
```

### Arrêt et réinitialisation

```bash
docker compose down          # arrêt, volumes conservés
docker compose down -v       # arrêt + suppression des données (postgres_data, uploads_data)
```

---

## 3. Justification des choix technologiques

### Backend — Node.js + Express + TypeScript

- **Node.js 20** : runtime non bloquant adapté aux I/O concurrentes d'une API REST doublée d'un
  serveur WebSocket ; un seul langage sur l'ensemble de la stack.
- **Express 4** : framework minimaliste, chaîne de middlewares explicite, écosystème mature.
- **TypeScript** (`strict: true`) : typage statique, erreurs détectées à la compilation plutôt qu'à
  l'exécution.
- **Prisma ORM 5** : schéma déclaratif unique (`schema.prisma`), client typé généré automatiquement,
  requêtes type-safe. Le schéma est appliqué via `prisma db push` — synchronisation directe, sans
  historique de migrations versionnées ; choix assumé pour un projet dont la base est recréée à
  chaque déploiement.
- **Zod** : validation des entrées à la frontière HTTP, avec inférence des types TypeScript.
- **bcryptjs** : hachage des mots de passe, coût adaptatif de 12 tours.
- **jsonwebtoken** : authentification stateless (access token 15 min, refresh token 7 j).
- **Passport.js** (`passport-google-oauth20`, `passport-github2`, `passport-microsoft`) :
  implémentations OAuth2 standardisées ; chaque stratégie n'est enregistrée que si ses variables
  d'environnement sont présentes.
- **Socket.io 4** : WebSocket avec repli automatique en long-polling et gestion native des *rooms*,
  utilisées pour cloisonner la messagerie par cookbook.
- **Multer** : réception des uploads multipart (images de recettes), avec filtre sur l'extension et limite de taille (voir §6).
- **Helmet** : en-têtes HTTP de sécurité (CSP, HSTS, `X-Content-Type-Options`, anti-clickjacking).
- **express-rate-limit** : limitation de débit pour freiner le bruteforce sur l'authentification.
- **cors** : restriction des origines autorisées à `CLIENT_URL`.
- **compression** : compression gzip des réponses HTTP.
- **morgan** : journalisation des requêtes HTTP (activée hors développement).
- **uuid** : génération des noms de fichiers uploadés, pour éviter les collisions et ne jamais
  réutiliser le nom fourni par le client.
- **dotenv** : chargement du fichier `server/.env` en développement local (sans effet en conteneur,
  où les variables sont injectées par docker-compose).

### Frontend — React + TypeScript + Vite + Material UI

- **React 18** : modèle par composants, rendu concurrent.
- **TypeScript** : cohérence des types avec le contrat d'API du backend.
- **Vite 5** : serveur de développement à ESM natif (HMR quasi instantané) et build de production
  optimisé via Rollup.
- **Material UI v5** (`@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`) :
  système de composants accessibles et thémables. C'est le système de style **principal** de
  l'application ; le thème est centralisé dans `client/src/theme.ts`.
- **TailwindCSS v4** (via `@tailwindcss/postcss`) : utilisé de manière **ciblée**, uniquement pour la
  section hero de la page d'accueil publique
  (`client/src/components/ui/glassmorphism-trust-hero.tsx`), dont les effets de *glassmorphism*
  étaient plus directs à exprimer en classes utilitaires. Les deux systèmes coexistent sans
  recouvrement : Tailwind n'est pas utilisé dans l'application authentifiée.
- **TanStack Query v5** : cache des données serveur, invalidation, états de chargement et d'erreur.
- **Zustand** : store d'authentification léger, sans le boilerplate de Redux.
- **React Router v6** : routage déclaratif et routes protégées (`client/src/App.tsx`).
- **React Hook Form** : formulaires non contrôlés, donc sans re-rendu à chaque frappe.
- **Axios** : client HTTP, avec intercepteurs pour l'injection du token et le rafraîchissement
  automatique sur `401` (`client/src/api/client.ts`).
- **Socket.io Client** : réception temps réel des messages de cookbook (`hooks/useSocket.ts`).
- **date-fns** : manipulation de dates immuable et *tree-shakeable* (planning hebdomadaire).
- **framer-motion** : animations d'entrée de la page d'accueil publique.
- **lucide-react** : jeu d'icônes de la page d'accueil publique ; l'application authentifiée utilise
  `@mui/icons-material`.
- **react-hot-toast** : notifications de retour utilisateur.

### Base de données — PostgreSQL 16

- SGBDR ACID, adapté au modèle fortement relationnel du domaine (recettes ↔ ingrédients ↔ tags ↔
  cookbooks ↔ membres).
- Types tableau natifs, utilisés pour `diet`, `allergies` et `cuisineTypes` dans `user_preferences`.
- Recherche insensible à la casse via le mode `insensitive` de Prisma (`ILIKE`).
- Index B-tree sur les colonnes de jointure et de filtrage (voir `schema.prisma`).

---

## 4. Diagrammes UML

### Diagramme de classes (modèle de données)

```
┌─────────────────┐         ┌──────────────────┐
│      User       │ 1     * │   OAuthAccount   │
│─────────────────│─────────│──────────────────│
│ id: String      │         │ id: String        │
│ email: String   │         │ provider: String  │
│ username: String│         │ providerId: String│
│ passwordHash?: S│         │ userId: String    │
│ avatar?: String │         └──────────────────┘
└───────┬─────────┘
        │ 1
        │
        │ *       ┌─────────────────┐
        ├─────────│   Cookbook      │
        │         │─────────────────│
        │         │ id: String      │
        │         │ name: String    │
        │         │ createdById: S  │
        │         └────────┬────────┘
        │                  │ 1
        │ *                │ *
┌───────┴──────────┐  ┌────┴───────────────┐
│  CookbookMember  │  │      Recipe        │
│──────────────────│  │────────────────────│
│ userId: String   │  │ id: String          │
│ cookbookId: Str  │  │ title: String       │
│ role: Enum       │  │ cookbookId?: String │
└──────────────────┘  │ createdById: String │
                       └────────┬────────────┘
                                │ 1
              ┌─────────────────┼─────────────────┐
              │ *               │ *               │ *
  ┌───────────┴──┐  ┌───────────┴──┐  ┌──────────┴──┐
  │RecipeIngred. │  │  RecipeStep  │  │  RecipeTag  │
  │──────────────│  │──────────────│  │─────────────│
  │ ingredientId │  │ orderIndex   │  │ tagId       │
  │ quantity?    │  │ description  │  └──────┬──────┘
  │ unit?        │  │ duration?    │         │ *
  └──────┬───────┘  └──────────────┘  ┌─────┴──────┐
         │ *                           │    Tag      │
  ┌──────┴───────┐                     │────────────│
  │ Ingredient   │                     │ name: Str  │
  │──────────────│                     │ type: Enum │
  │ name: String │                     └────────────┘
  └──────────────┘
```

### Diagramme de séquence — Authentification JWT

```
Client          API Server        Database
  │                 │                │
  │──POST /login───>│                │
  │                 │──findUser()───>│
  │                 │<──user──────── │
  │                 │──bcrypt.verify()│
  │                 │──generateTokens│
  │<─{accessToken,  │                │
  │   refreshToken}─│                │
  │                 │                │
  │──GET /recipes   │                │
  │ Bearer: token──>│                │
  │                 │──jwt.verify()  │
  │                 │──findRecipes()>│
  │<────recipes─────│<──recipes──── │
```

### Diagramme de séquence — Messagerie temps réel (Socket.io)

```
Client A    Socket.io Server    Client B
   │               │                │
   │──connect()───>│                │
   │ {token: JWT}  │                │
   │               │──verify JWT    │
   │<──connected───│                │
   │               │<──connect()────│
   │               │ {token: JWT}   │
   │──join room───>│                │
   │ cookbookId    │<──join room────│
   │               │                │
   │──sendMessage─>│                │
   │ {content}     │──save to DB    │
   │               │──broadcast()──>│
   │<──message─────│                │
   │               │────message────>│
```

---

## 5. Schéma de la base de données

```sql
-- Utilisateurs
users (id, email, username, passwordHash, avatar, createdAt, updatedAt)
oauth_accounts (id, userId, provider, providerId, accessToken, refreshToken)
user_preferences (id, userId, diet[], allergies[], cuisineTypes[], defaultPortions)

-- Cookbooks
cookbooks (id, name, description, coverImage, createdById, createdAt, updatedAt)
cookbook_members (id, cookbookId, userId, role[CREATOR|EDITOR|COMMENTER|READER], joinedAt)
cookbook_invites (id, cookbookId, email, token, role, invitedById, expiresAt, usedAt)

-- Recettes
recipes (id, title, description, prepTime, cookTime, portions, sourceUrl,
         imageUrl, isPersonal, createdById, cookbookId, createdAt, updatedAt)
ingredients (id, name)
recipe_ingredients (id, recipeId, ingredientId, quantity, unit, notes, orderIndex)
recipe_steps (id, recipeId, orderIndex, description, duration)

-- Tags
tags (id, name, type[CATEGORY|DIET|DIFFICULTY|CUISINE|CUSTOM])
recipe_tags (recipeId, tagId)

-- Social
favorites (userId, recipeId, createdAt)
comments (id, recipeId, userId, content, createdAt, updatedAt)
messages (id, cookbookId, userId, content, createdAt)

-- Planning
meal_plans (id, userId, cookbookId, name, weekStart, createdAt, updatedAt)
meal_plan_items (id, mealPlanId, recipeId, date, mealType[BREAKFAST|LUNCH|DINNER|SNACK], portions)
```

---

## 6. Sécurité

### Authentification

| Élément | Mise en œuvre | Référence |
|---|---|---|
| Hachage des mots de passe | bcrypt, coût 12 (adaptatif) | `server/src/routes/auth.ts:39` |
| Access token | JWT signé `HS256`, durée de vie 15 min | `server/src/middleware/auth.ts:61` |
| Refresh token | JWT signé avec un secret distinct, durée de vie 7 j | `server/src/middleware/auth.ts:64` |
| Rafraîchissement | Intercepteur Axios sur `401`, avec file d'attente des requêtes concurrentes | `client/src/api/client.ts` |
| OAuth2 | Google, GitHub, Microsoft via Passport ; stratégie enregistrée uniquement si ses variables d'environnement sont définies | `server/src/config/passport.ts` |

Le mot de passe n'est jamais stocké ni journalisé en clair : seul le condensat bcrypt est persisté
dans la colonne `users.passwordHash`, qui est nullable pour les comptes créés uniquement via OAuth2.

### Protections applicatives

- **Rate limiting** — 20 requêtes / 15 min sur les routes `/api/auth`, 500 requêtes / 15 min sur le
  reste de l'API (`server/src/app.ts:46-56`).
- **Validation** — toutes les entrées des routes mutantes sont validées côté serveur avec Zod.
- **CORS** — origine restreinte à la valeur de `CLIENT_URL`.
- **Helmet** — en-têtes de sécurité HTTP : CSP, HSTS, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options`, `Referrer-Policy`. La politique `crossOriginResourcePolicy` est assouplie en
  `cross-origin` pour permettre le service des images de recettes.
  *Helmet ne fournit pas de protection CSRF* ; celle-ci n'est pas nécessaire ici car
  l'authentification repose sur un en-tête `Authorization: Bearer` et non sur un cookie de session.
- **Taille des corps de requête** — limitée à 10 Mo (JSON et `urlencoded`).
- **Permissions** — système de rôles hiérarchique appliqué côté serveur
  (`CREATOR` > `EDITOR` > `COMMENTER` > `READER`), voir `server/src/middleware/permissions.ts`.

### Uploads de fichiers

- Taille limitée à **5 Mo** par fichier (`server/src/middleware/upload.ts`).
- Nom de fichier régénéré côté serveur avec un UUID v4 : le nom fourni par le client n'est jamais
  réutilisé, ce qui neutralise les tentatives de *path traversal*.
- Extensions autorisées : `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`.

> **Limite connue** : le filtre d'upload contrôle uniquement l'**extension** du fichier, et non son
> type MIME réel ni sa signature binaire. Un fichier arbitraire renommé en `.png` serait donc
> accepté. Le risque reste contenu (les fichiers sont servis en statique depuis un volume dédié,
> jamais interprétés côté serveur), mais un contrôle du `mimetype` Multer et de la signature du
> fichier constituerait un durcissement pertinent.

### Secrets

- Aucun secret n'est présent dans le code source ni dans le dépôt : `docker-compose.yml` lit
  exclusivement des variables d'environnement, et `POSTGRES_PASSWORD`, `JWT_SECRET` et
  `JWT_REFRESH_SECRET` n'ont volontairement aucune valeur de repli.
- Les variables d'environnement sont validées au démarrage par `server/src/config/env.ts` (schéma
  Zod). En l'absence d'un secret requis, le serveur **refuse de démarrer** avec un message explicite,
  plutôt que de retomber sur une valeur codée en dur qui serait publiquement connue et rendrait tous
  les jetons forgeables. Un avertissement est également émis si les secrets sont restés aux valeurs
  d'exemple.
- `.env` est exclu par `.gitignore` ; seul `.env.example`, qui ne contient que des valeurs
  d'exemple à remplacer, est versionné.
