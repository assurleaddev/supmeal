# Documentation Technique — SUPMEAL

## 1. Prérequis et configuration

### Variables d'environnement

Copier `.env.example` en `.env` à la racine du projet et renseigner :

| Variable | Description | Exemple |
|---|---|---|
| `POSTGRES_USER` | Utilisateur PostgreSQL | `supmeal` |
| `POSTGRES_PASSWORD` | Mot de passe PostgreSQL | `motdepasse_fort` |
| `POSTGRES_DB` | Nom de la base | `supmeal` |
| `JWT_SECRET` | Secret pour les JWT d'accès (≥64 chars) | `openssl rand -base64 64` |
| `JWT_REFRESH_SECRET` | Secret pour les refresh tokens | `openssl rand -base64 64` |
| `CLIENT_URL` | URL du frontend | `http://localhost:80` |
| `VITE_API_URL` | URL de l'API (vu du client) | `http://localhost:3000` |
| `OAUTH_CALLBACK_BASE` | Base des callbacks OAuth | `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | ID application Google OAuth (optionnel) | — |
| `GOOGLE_CLIENT_SECRET` | Secret Google OAuth (optionnel) | — |
| `GITHUB_CLIENT_ID` | ID application GitHub OAuth (optionnel) | — |
| `GITHUB_CLIENT_SECRET` | Secret GitHub OAuth (optionnel) | — |
| `MICROSOFT_CLIENT_ID` | ID application Microsoft OAuth (optionnel) | — |
| `MICROSOFT_CLIENT_SECRET` | Secret Microsoft OAuth (optionnel) | — |

> **⚠️ Sécurité** : Ne jamais committer le fichier `.env`. Il est exclu par `.gitignore`.

---

## 2. Guide de déploiement

### Via Docker Compose (recommandé)

```bash
git clone <url-du-repo>
cd SUPMEAL
cp .env.example .env
# Éditer .env
docker compose up --build -d
```

Les 3 services démarrent dans l'ordre : PostgreSQL → server → client.
Le schéma de base de données est créé automatiquement au démarrage via `prisma db push`.

### URLs d'accès

- **Application** : http://localhost:80
- **API** : http://localhost:3000/api
- **Health check** : http://localhost:3000/api/health

### Développement local

```bash
# PostgreSQL via Docker uniquement
docker compose up postgres -d

# Backend
cd server
npm install
echo "DATABASE_URL=postgresql://supmeal:supmeal_secret@localhost:5432/supmeal" > .env
npm run db:push    # sync schéma
npm run db:seed    # tags par défaut
npm run dev        # :3000

# Frontend
cd client
npm install
npm run dev        # :5173 avec proxy vers :3000
```

---

## 3. Justification des choix technologiques

### Backend — Node.js + Express + TypeScript

- **Node.js** : Runtime performant pour les I/O asynchrones, idéal pour une API REST et WebSockets
- **Express** : Framework minimaliste et flexible, large écosystème de middlewares
- **TypeScript** : Typage statique pour réduire les bugs à l'exécution, meilleure maintenabilité
- **Prisma ORM** : ORM moderne avec génération automatique des types TypeScript, migrations versionnées, queries type-safe
- **Zod** : Validation des données à la frontière (entrées API) avec inférence de types TS
- **bcryptjs** : Hashage des mots de passe (coût adaptatif, résistant aux attaques brute-force)
- **jsonwebtoken** : JWT pour l'authentification stateless (access token 15min + refresh token 7j)
- **Passport.js** : Middlewares OAuth2 standardisés (Google, GitHub, Microsoft)
- **Socket.io** : WebSockets avec fallback polling, gestion des rooms pour la messagerie temps réel
- **Multer** : Gestion des uploads multipart (images de recettes)
- **Helmet** : Headers de sécurité HTTP (XSS, CSRF, clickjacking)
- **express-rate-limit** : Protection contre les attaques par force brute

### Frontend — React + TypeScript + Vite

- **React 18** : Bibliothèque UI avec le modèle composant, concurrent mode, Suspense
- **TypeScript** : Cohérence des types avec le backend
- **Vite** : Build tool rapide (ESM natif), HMR instantané, optimisations de production
- **TailwindCSS** : CSS utilitaire pour une UI cohérente et responsive sans CSS custom
- **TanStack Query v5** : Cache côté client, synchronisation serveur, invalidation, pagination
- **Zustand** : State management léger (auth store) sans boilerplate Redux
- **React Router v6** : Routing déclaratif avec lazy loading des pages
- **React Hook Form** : Formulaires performants (pas de re-renders inutiles), intégration Zod
- **Socket.io Client** : Client WebSocket pour la messagerie temps réel
- **date-fns** : Manipulation de dates sans mutation, tree-shakeable (vs Moment.js)
- **react-hot-toast** : Notifications UX légères et accessibles

### Base de données — PostgreSQL

- SGBD relationnel robuste, ACID-compliant
- Support natif des tableaux (utilisé pour `diet`, `allergies`, `cuisineTypes`)
- Full-text search natif
- Support des index partiels et composites pour les performances de recherche

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

- **Mots de passe** : hashés avec bcrypt (coût 12, adaptatif)
- **Tokens JWT** : access token 15 minutes + refresh token 7 jours
- **Rate limiting** : 20 req/15min sur `/auth`, 500 req/15min sur le reste
- **Validation** : Toutes les entrées validées côté serveur avec Zod
- **CORS** : Restreint à l'URL du client configurée
- **Helmet** : Headers HTTP de sécurité (CSP, XSS, HSTS, etc.)
- **Permissions** : Système de rôles granulaire (CREATOR > EDITOR > COMMENTER > READER)
- **Uploads** : Validation du type MIME et limite à 5 Mo
