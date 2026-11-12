FROM node:22-alpine AS web
WORKDIR /web
COPY apps/web/package.json ./
RUN npm install
COPY apps/web/ ./
RUN npm run build

FROM node:22-alpine AS api
WORKDIR /api
COPY apps/api/package.json ./
COPY apps/api/prisma ./prisma
RUN npm install
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json apps/api/nest-cli.json ./
COPY apps/api/src ./src
RUN npx prisma generate && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY apps/api/package.json ./
COPY apps/api/prisma ./prisma
RUN npm install --omit=dev
COPY --from=api /api/dist ./dist
COPY --from=web /web/dist ./web
ENV WEB_DIST=/app/web
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/main.js"]
