# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build the React frontend
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /frontend

# Install dependencies first (layer-cached separately from source)
# npm install is used instead of npm ci — no package-lock.json in repo
COPY frontend/package.json ./
RUN npm install --silent

# Copy source and build
COPY frontend/ .
RUN npm run build
# Output lands at /frontend/dist


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Python + Flask — serves the API and the built React bundle
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Install Docker CLI + Compose plugin from the official Docker apt repository.
# Uses download.docker.com (plain HTTPS, no Docker Hub account/credentials needed)
# so this step works even when Docker Hub auth is unavailable in WSL2.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg \
       | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && chmod a+r /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
             https://download.docker.com/linux/debian bookworm stable" \
       > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
         docker-ce-cli \
         docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Flask backend
COPY app.py .

# React bundle — served as static files by Flask
COPY --from=frontend-build /frontend/dist ./static

EXPOSE 5000

CMD ["python", "app.py"]
