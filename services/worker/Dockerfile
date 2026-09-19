FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/worker/package.json services/worker/package.json

# npm install handles cross-platform optional deps; npm ci fails on Alpine for emnapi.
RUN npm install --ignore-scripts --prefer-offline --workspace @ca-dcc/ingestion-worker --include-workspace-root

COPY packages/shared packages/shared
COPY services/worker services/worker

USER node

CMD ["npm", "run", "start", "--workspace", "@ca-dcc/ingestion-worker"]
