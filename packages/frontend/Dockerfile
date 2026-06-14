FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/frontend/package.json packages/frontend/

RUN npm install --workspace=@natures-crates/shared --workspace=@natures-crates/frontend

# Build shared
COPY packages/shared packages/shared/
RUN npm run build --workspace=@natures-crates/shared

# Build frontend
COPY packages/frontend packages/frontend/
RUN npm run build --workspace=@natures-crates/frontend

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/packages/frontend/.next ./.next
COPY --from=builder /app/packages/frontend/public ./public
COPY --from=builder /app/packages/frontend/package.json ./
COPY --from=builder /app/packages/frontend/next.config.js ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npx", "next", "start"]
