# syntax=docker/dockerfile:1.7
# Multi-stage build: build Vite app, serve with nginx
ARG NODE_VERSION=20.14.0
ARG NGINX_VERSION=1.27-alpine

# Builder: install deps and build
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app

# Install build deps
RUN apk add --no-cache python3 make g++ bash

# Install dependencies with caching
COPY web/package.json web/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Copy the rest of the sources
COPY web/ ./

# Build for production
RUN --mount=type=cache,target=/root/.npm \
    npm run build

# Runtime: nginx to serve static files
FROM nginx:${NGINX_VERSION} AS runtime
WORKDIR /usr/share/nginx/html

# Remove default content and copy built assets
RUN rm -rf ./*
COPY --from=build /app/dist/ ./

# Provide a basic nginx config tuned for single page apps (history fallback)
# Assumes Vite build outputs index.html and assets/ in /usr/share/nginx/html
COPY --chown=nginx:nginx web/nginx.conf /etc/nginx/conf.d/default.conf

# Expose default HTTP port
EXPOSE 80

# Healthcheck: checks nginx is responding
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ > /dev/null || exit 1

# Run as non-root where possible (nginx image already uses nginx user for worker)
STOPSIGNAL SIGQUIT