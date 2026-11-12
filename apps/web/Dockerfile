FROM node:22-alpine AS build
WORKDIR /usr/src/app
COPY apps/web/package.json ./
RUN npm install
COPY apps/web/ .
RUN npm run build

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /usr/src/app/dist /usr/share/nginx/html
