# SUPMEAL

Application web de gestion de recettes et de planification de repas : recettes personnelles,
cookbooks partagés avec rôles, recherche multicritère, planning hebdomadaire et liste de courses,
messagerie temps réel, import/export.

## Démarrage rapide (Docker)

```bash
# 1. Copier et configurer les variables d'environnement
cp .env.example .env
# Éditer .env : renseigner au minimum POSTGRES_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET
#   openssl rand -base64 64   # pour chaque secret JWT

# 2. Lancer l'application
docker compose up --build -d

# 3. (optionnel) Charger le jeu de données de démonstration
docker compose exec server npm run db:seed
```

| | URL |
|---|---|
| Application | http://localhost:8080 |
| API | http://localhost:3000/api |
| Health check | http://localhost:3000/api/health |

## Architecture

Trois services distincts, orchestrés par `docker-compose.yml` :

| Service | Technologie | Port hôte → conteneur |
|---|---|---|
| `postgres` | PostgreSQL 16 | `5432` → `5432` |
| `server` | Node.js 20 + Express + TypeScript + Prisma | `3000` → `3000` |
| `client` | React 18 + Vite + Material UI, servi par nginx | `8080` → `80` |

Le client est une interface pure : toute la logique métier réside dans l'API REST. nginx relaie
`/api/`, `/uploads/` et `/socket.io/` vers le service `server`, ce qui évite toute configuration CORS
côté navigateur.

## Développement local

```bash
# PostgreSQL seul
docker compose up postgres -d

# Backend
cd server && npm install
# Créer server/.env avec DATABASE_URL, JWT_SECRET et JWT_REFRESH_SECRET
npm run db:push           # applique le schéma Prisma
npm run db:seed           # jeu de données de démonstration
npm run dev               # API sur :3000

# Frontend (autre terminal)
cd client && npm install
npm run dev               # :5173, proxy Vite vers :3000
```

## Constitution du rendu

```bash
node scripts/package-rendu.mjs   # -> dist-rendu/SUPMEAL.zip
```

L'archive est bâtie depuis `git archive` : elle ne contient que les fichiers suivis, donc ni
`.env`, ni `node_modules`, ni artefacts de build. Le script refuse de tourner sur un arbre sale et
vérifie l'absence de secret avant d'écrire.

## Documentation

- [Documentation technique](docs/documentation-technique.md) — configuration, déploiement,
  choix technologiques, diagrammes UML, schéma de base de données, sécurité.
- [Charte graphique](docs/charte-graphique.md) — identité visuelle, palette, typographie, règles de composants et d'accessibilité.
- [Manuel utilisateur](docs/manuel-utilisateur.md) — prise en main et présentation des
  fonctionnalités.
