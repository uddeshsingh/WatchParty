FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY . .

RUN echo '#!/bin/bash\npython -m app.pubsub.gcp_listener &\nexec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}' > /start.sh && chmod +x /start.sh

CMD ["/start.sh"]