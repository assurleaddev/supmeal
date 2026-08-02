# SUPMEAL

Application web de gestion de recettes et de planification de repas.

## Démarrage rapide (Docker)

```bash
# 1. Copier et configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos valeurs (mots de passe, JWT secrets)

# 2. Lancer l'application
docker compose up --build

# 3. Accéder à l'application
# Client : http://localhost:80
# API    : http://localhost:3000
```

## Architecture

| Service    | Technologie                     | Port |
|------------|---------------------------------|------|
| `postgres` | PostgreSQL 16                   | 5432 |
| `server`   | Node.js + Express + TypeScript  | 3000 |
| `client`   | React + Vite + TailwindCSS      | 80   |

## Développement local

```bash
# Backend
cd server && npm install
cp ../.env.example .env   # configurer DATABASE_URL
npm run db:push           # créer le schéma
npm run db:seed           # insérer les tags par défaut
npm run dev               # démarre sur :3000

# Frontend (autre terminal)
cd client && npm install
npm run dev               # démarre sur :5173
```

## Documentation

Voir le dossier `docs/` pour la documentation technique complète et le manuel utilisateur.
