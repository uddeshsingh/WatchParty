# backend-go/Dockerfile
FROM golang:1.25

WORKDIR /app

# Copy modules first for caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Build
RUN go build -o server .

# Run
CMD ["./server"]