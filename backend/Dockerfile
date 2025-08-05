# syntax=docker/dockerfile:1.7
# Multi-stage build for Go backend (minimal final image)
ARG GO_VERSION=1.24
ARG ALPINE_VERSION=3.20

FROM golang:${GO_VERSION}-alpine${ALPINE_VERSION} AS build
WORKDIR /app

# Install build deps
RUN apk add --no-cache git ca-certificates build-base

# Enable Go module caching
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

# Copy backend source
COPY backend/ ./backend/
# Build with static linking for scratch/alpine
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -o /out/server ./backend/cmd/server

# Runtime image
FROM gcr.io/distroless/base-debian12:nonroot AS runtime
WORKDIR /app

# Copy binary
COPY --from=build /out/server /app/server
# Copy default .env if you want baked defaults (optional)
# COPY backend/.env.example /app/.env

# Expose backend port
EXPOSE 8080

# HEALTHCHECK (adjust endpoint as appropriate)
# Using distroless - no shell, use binary directly if it serves /health
# Comment out if health endpoint not available
# HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
#   CMD ["/app/server", "-healthcheck"]

USER nonroot:nonroot
ENTRYPOINT ["/app/server"]