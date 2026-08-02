FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npm run db:generate
RUN npm run build

# ────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --only=production && npm run db:generate

COPY --from=builder /app/dist ./dist

# Create uploads directory
RUN mkdir -p /app/uploads/recipes

EXPOSE 3000

# Run migrations then start the server
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/server.js"]
