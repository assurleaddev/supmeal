# SUPMEAL

Application web de gestion de recettes et de planification de repas : recettes personnelles,
cookbooks partagés avec rôles, recherche multicritère, planning hebdomadaire et liste de courses,
messagerie temps réel, import/export.

## Démarrage rapide (Docker)

```bash
git clone https://github.com/assurleaddev/supmeal.git
cd supmeal
docker compose up --build -d
```

C'est tout : aucune étape préalable. Les trois valeurs sensibles ont un repli de démonstration dans
`docker-compose.yml`, et le serveur avertit au démarrage tant qu'il les utilise.

```bash
# (optionnel) jeu de données de démonstration : 2 comptes, 7 recettes, 1 cookbook
docker compose exec server npm run db:seed

# Avant tout déploiement réel : des secrets générés, dans .env
cp .env.example .env
openssl rand -base64 64   # pour POSTGRES_PASSWORD, JWT_SECRET et JWT_REFRESH_SECRET
docker compose up -d --force-recreate
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

- [Guide d'exploitation](docs/guide-exploitation.md) — **lancer, diagnostiquer, déployer**. Le
  runbook : prérequis, vérification d'une installation, table des pannes courantes avec leur cause,
  sauvegarde et restauration, mise en ligne sur un serveur.
- [Documentation technique](docs/documentation-technique.md) — configuration, déploiement,
  choix technologiques, 14 diagrammes UML, modèles conceptuel/logique/physique, dictionnaire de
  données, sécurité, référence de l'API et plan de tests.
- [Schéma physique](docs/schema-physique.sql) — DDL PostgreSQL complète, générée depuis
  `schema.prisma` : 17 tables, 36 index, 24 clés étrangères.
- [Charte graphique](docs/charte-graphique.md) — identité visuelle, palette, typographie, règles de composants et d'accessibilité.
- [Manuel utilisateur](docs/manuel-utilisateur.md) — prise en main et présentation des
  fonctionnalités.
