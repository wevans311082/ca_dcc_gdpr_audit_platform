FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/api/package.json services/api/package.json

# npm install handles cross-platform optional deps; npm ci fails on Alpine for emnapi.
RUN npm install --ignore-scripts --prefer-offline --workspace @ca-dcc/audit-api --include-workspace-root

COPY packages/shared packages/shared
COPY services/api services/api

USER node

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace", "@ca-dcc/audit-api"]
