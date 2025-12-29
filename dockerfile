FROM node:24-alpine AS build

ARG ORDERS_MS_DATABASE_URL

ENV DATABASE_URL=$ORDERS_MS_DATABASE_URL

WORKDIR /build

COPY package*.json ./

RUN npm install

COPY . .

RUN npx prisma migrate deploy

RUN npx prisma generate

RUN npm run build

RUN npm ci -f --only=production && npm cache clean --force

FROM node:24-alpine

WORKDIR /usr/src/app

COPY --from=build /build/node_modules ./node_modules

COPY --from=build /build/dist ./dist

ENV NODE_ENV=production

USER node

EXPOSE 3000

CMD ["node", "dist/src/main.js"]