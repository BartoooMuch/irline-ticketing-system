# ML Price Prediction Service Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app.py .

# Create model directory
RUN mkdir -p model

# Create non-root user
RUN addgroup --gid 1001 python && \
    adduser --uid 1001 --gid 1001 --disabled-password --gecos "" python && \
    chown -R python:python /app
USER python

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD sh -c "python -c \"import os,urllib.request; p=os.environ.get('PORT','5000'); urllib.request.urlopen(f'http://localhost:{p}/health')\" " || exit 1

CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-5000} --workers 2 --timeout 120 app:app"]
