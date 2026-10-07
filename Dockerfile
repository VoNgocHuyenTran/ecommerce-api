FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
COPY prisma.config.ts ./
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate

COPY src ./src
COPY scripts ./scripts

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node src/server.js"]
