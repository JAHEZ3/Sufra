# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Build the target service
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY nest-cli.json ./
COPY tsconfig.json ./
COPY apps/ ./apps/
COPY package*.json ./

ARG SERVICE_NAME
RUN npx nest build ${SERVICE_NAME}

# Stage 3: Production image
FROM node:20-alpine AS production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

ARG SERVICE_NAME
ENV SERVICE_NAME=${SERVICE_NAME}

CMD node dist/apps/${SERVICE_NAME}/main
