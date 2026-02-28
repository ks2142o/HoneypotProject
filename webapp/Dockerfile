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

# System deps (curl for healthchecks, docker CLI for socket comms)
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Flask backend
COPY app.py .

# React bundle — served as static files by Flask
COPY --from=frontend-build /frontend/dist ./static

EXPOSE 5000

CMD ["python", "app.py"]
