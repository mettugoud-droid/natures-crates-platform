FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files first
COPY package.json ./
COPY package-lock.json* ./
COPY tsconfig.base.json ./

# Copy workspace package.json files for dependency resolution
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/

# Install dependencies
RUN npm install --workspace=@natures-crates/shared --workspace=@natures-crates/backend

# Build shared package
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

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

CMD ["node", "dist/src/index.js"]
