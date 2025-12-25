# backend-python/Dockerfile
FROM python:3.11-slim

# Set work directory
WORKDIR /app

# Install dependencies
# We copy requirements.txt first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy project files
COPY . .

# Run the application using Gunicorn (Production Server)
# Cloud Run injects the PORT environment variable automatically
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 core.wsgi:application