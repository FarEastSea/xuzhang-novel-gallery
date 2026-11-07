FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json VERSION version.mjs ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public
RUN npm run build
COPY server ./server
COPY tests ./tests
COPY scripts/version.mjs ./scripts/version.mjs
RUN npm test

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=4173 HOST=0.0.0.0 DATA_DIR=/app/data
WORKDIR /app
RUN mkdir /app/data && chown node:node /app/data
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node server.mjs VERSION version.mjs ./
COPY --chown=node:node server ./server
USER node
VOLUME ["/app/data"]
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:4173/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
