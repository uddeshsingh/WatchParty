# syntax=docker/dockerfile:1

ARG GOLANG_IMAGE=golang:1.25-alpine3.21@sha256:b4dbd292a0852331c89dfd64e84d16811f3e3aae4c73c13d026c4d200715aff6
ARG RUNTIME_IMAGE=gcr.io/distroless/static-debian12:nonroot@sha256:a9329520abc449e3b14d5bc3a6ffae065bdde0f02667fa10880c49b35c109fd1

# -----------------------------------------------------------------------------
# Stage 1: build static binary (no CGO — matches distroless/static)
# -----------------------------------------------------------------------------
FROM ${GOLANG_IMAGE} AS builder
WORKDIR /src
RUN apk add --no-cache git ca-certificates \
    && rm -rf /var/cache/apk/*
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server/main.go

# -----------------------------------------------------------------------------
# Stage 2: minimal runtime (official distroless, non-root)
# -----------------------------------------------------------------------------
FROM ${RUNTIME_IMAGE}
WORKDIR /
COPY --from=builder --chown=nonroot:nonroot /out/server /server
USER nonroot
EXPOSE 8080
ENTRYPOINT ["/server"]
