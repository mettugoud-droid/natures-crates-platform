FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/

RUN npm install --workspace=@natures-crates/shared --workspace=@natures-crates/backend

# Build shared
COPY packages/shared packages/shared/
RUN npm run build --workspace=@natures-crates/shared

# Build backend
COPY packages/backend packages/backend/
RUN npm run build --workspace=@natures-crates/backend

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/packages/backend/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./node_modules/@natures-crates/shared/dist
COPY --from=builder /app/packages/shared/package.json ./node_modules/@natures-crates/shared/

RUN mkdir -p logs

EXPOSE 3001

CMD ["node", "dist/src/index.js"]
