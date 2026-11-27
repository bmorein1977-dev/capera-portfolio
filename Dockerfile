# Capera as a container, for hosting on a company's own platform. See docs/HOSTING.md for the settings it needs.
# Build:   docker build -t capera .
# Upgrade the database before starting a new version:   docker run --rm -e DATABASE_URL=... capera node scripts/db/migrate.mjs
# Run:     docker run --env-file capera.env -p 5000:5000 capera

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:20-bookworm-slim
ENV NODE_ENV=production PORT=5000
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/scripts/db ./scripts/db
# runs without root rights
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
