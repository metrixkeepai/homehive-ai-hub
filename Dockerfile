FROM oven/bun:1.4.3 AS bun
FROM node:24.22.3-bookworm-slim AS build
WORKDIR /app
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
RUN npm run build

FROM node:24.22.3-bookworm-slim AS migrator
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=build /app/drizzle/migrations ./drizzle/migrations
COPY --from=build /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=build /app/node_modules/postgres ./node_modules/postgres
USER node
CMD ["npm", "run", "db:migrate"]

FROM node:24.22.3-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/.output ./.output
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server ./server
# Nitro bundles its dependencies. The standalone HTTP/voice host imports these separately.
COPY --from=build /app/node_modules/@supabase ./node_modules/@supabase
COPY --from=build /app/node_modules/iceberg-js ./node_modules/iceberg-js
COPY --from=build /app/node_modules/tslib ./node_modules/tslib
COPY --from=build /app/node_modules/ws ./node_modules/ws
USER node
EXPOSE 8080
CMD ["npm", "start"]
