FROM node:22-alpine AS build
WORKDIR /usr/src/app
COPY apps/api/package.json ./
RUN npm install
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json apps/api/nest-cli.json ./
COPY apps/api/prisma ./prisma
COPY apps/api/src ./src
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY apps/api/package.json ./
RUN npm install --omit=dev
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/prisma ./prisma
RUN npx prisma generate
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/main.js"]
