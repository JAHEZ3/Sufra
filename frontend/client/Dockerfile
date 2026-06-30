# Next.js production image (no standalone output configured, so we ship the
# built app + node_modules and run `next start`).
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_GATEWAY_URL
ARG NEXT_PUBLIC_MANAGER_URL
ENV NEXT_PUBLIC_GATEWAY_URL=$NEXT_PUBLIC_GATEWAY_URL
ENV NEXT_PUBLIC_MANAGER_URL=$NEXT_PUBLIC_MANAGER_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app ./
EXPOSE 3010
CMD ["npm", "start"]
