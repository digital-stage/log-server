FROM node:16.13.0-buster-slim AS base
WORKDIR /app

FROM base as deps
COPY package*.json ./
COPY tsconfig.json ./
COPY src .
COPY StatsStore .
RUN npm install --legacy-peer-deps

FROM base as build
COPY . ./
COPY --from=deps /app/node_modules ./node_modules
# TODO: run tests
RUN npm run build

FROM base as release
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules

ENV NODE_ENV production
ENV ES_ID unset
ENV ES_USER unset
ENV ES_PASS unset

EXPOSE 3001

CMD ["node", "./dist/src/index.js"]