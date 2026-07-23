# trace-backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# System deps needed to build mysqlclient / cryptography / bcrypt wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    default-libmysqlclient-dev \
    pkg-config \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency list first for better layer caching
COPY requirements.txt .

# Install python deps + MySQL driver (pymysql is pure-python, no extra native deps needed
# beyond cryptography, which is included here for MySQL's caching_sha2_password auth)
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir pymysql cryptography

# Copy the rest of the backend source
COPY . .

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

# Healthcheck hits FastAPI docs route
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/docs || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
