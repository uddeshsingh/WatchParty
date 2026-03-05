FROM golang:1.25-alpine

WORKDIR /app
# Install git for private modules if necessary
RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .
# 🚨 FIX: Build the actual entrypoint path
RUN go build -o server ./cmd/server/main.go

# Cloud Run expects the app to listen on $PORT
EXPOSE 8080
CMD ["./server"]