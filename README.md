# Honeypot Threat Intelligence Platform

An automated, containerised honeypot deployment and threat intelligence system built for final-year security research. The platform captures and analyses real-world attack traffic across multiple protocols, enriches events with GeoIP data via the ELK stack, and presents everything through a React dashboard.

---

## Table of Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Make Targets](#make-targets)
- [Services & Ports](#services--ports)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [How It Works](#how-it-works)
- [Dashboard Features](#dashboard-features)
- [Testing (Objective 6)](#testing-objective-6)
- [Troubleshooting](#troubleshooting)

---

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                      Docker Network  172.25.0.0/16             │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Cowrie    │  │  Dionaea    │  │     Flask Honeypot      │ │
│  │  SSH/Telnet │  │ Multi-proto │  │  HTTP catch-all logger  │ │
│  │ :2222/:2223 │  │  :21/:445…  │  │         :8080           │ │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘ │
│         │                │                        │              │
│         └────────────────┴──────────┬─────────────┘             │
│                                     │  JSON logs                 │
│                                     ▼                            │
│                          ┌─────────────────┐                    │
│                          │    Logstash     │  GeoIP enrichment  │
│                          │  parse + enrich │  field mapping     │
│                          └────────┬────────┘                    │
│                                   │                              │
│                                   ▼                              │
│                          ┌─────────────────┐                    │
│                          │ Elasticsearch   │  honeypot-*        │
│                          │  index & store  │  daily indices     │
│                          └────────┬────────┘                    │
│                 ┌─────────────────┴─────────────────┐           │
│                 ▼                                     ▼          │
│       ┌─────────────────┐               ┌────────────────────┐  │
│       │     Kibana      │               │   React Dashboard  │  │
│       │  dashboards     │               │  Flask API :5000   │  │
│       │    :5601        │               │  (this project)    │  │
│       └─────────────────┘               └────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### Stack

| Layer | Technology |
|---|---|
| Honeypots | Cowrie (SSH/Telnet), Dionaea (multi-protocol), Flask HTTP trap |
| Ingestion | Logstash 9 with GeoIP filter |
| Storage | Elasticsearch 9 (single-node, daily rolling indices) |
| Visualisation | Kibana 9 + custom React dashboard |
| Dashboard UI | React 18 · Vite · Tailwind CSS · Recharts · react-leaflet |
| Dashboard API | Flask 3 · Docker SDK · Python 3.11 |
| Orchestration | Docker Compose v2 · Makefile |

---

## Prerequisites

| Requirement | Minimum | Notes |
|---|---|---|
| RAM | 4 GB | 8 GB recommended |
| Disk | 20 GB free | For logs and ES data |
| Docker | 24+ | [Install guide](https://docs.docker.com/get-docker/) |
| Docker Compose | v2 plugin **or** standalone `docker-compose` | Makefile detects both |
| Python | 3.10+ | For `deploy.py` and local dev |
| Node / npm | 18+ | Only for local frontend development |

> **WSL2 users:** Elasticsearch requires `vm.max_map_count=262144`. Run `make vm-fix` once after each WSL2 restart.

---

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url>
cd honeypot-project

# 2. First-time setup (checks deps, sets kernel params, creates .env, creates dirs)
make setup

# 3. Edit .env and change default passwords
nano .env

# 4. Full deployment — builds images, starts all services
make deploy

# 5. Open the dashboard
xdg-open http://localhost:5000   # Linux / WSL2
# or browse manually to http://localhost:5000
```

That's it. `make deploy` does everything: it builds the React frontend inside Docker (no local Node required), starts ES → waits for health → starts Logstash → Kibana → honeypots → webapp.

---

## Make Targets

Run `make help` at any time to see the full list. Key targets:

### Setup

```bash
make setup            # Full first-time setup
make check-deps       # Verify Docker / Python are installed
make vm-fix           # Set vm.max_map_count for Elasticsearch (WSL2/Linux)
make env              # Create .env from template
make dirs             # Create log/data directory tree
```

### Build

```bash
make build            # Build all Docker images
make build-webapp     # Rebuild webapp image only (React + Flask)
make frontend-build   # Build React bundle locally (needs Node)
make frontend-dev     # Vite dev server with HMR on :3000
```

### Deployment

```bash
make deploy           # Full deploy (ELK + honeypots + webapp)
make up               # docker compose up -d (images must be pre-built)
make deploy-elk       # ELK stack only
make deploy-honeypots # Cowrie + Dionaea + Flask only
make deploy-webapp    # Webapp only
make start-kibana     # Start a single named service
```

### Service Control

```bash
make stop             # Stop all (data preserved)
make down             # Remove containers (volumes preserved)
make restart          # Restart all services
make restart-kibana   # Restart one service
```

### Status & Monitoring

```bash
make status           # docker compose ps
make health           # Curl health checks against all endpoints
make urls             # Print all access URLs
make es-status        # Elasticsearch cluster health (JSON)
make es-indices       # List honeypot indices
make attack-count     # Total attack event count
make stats            # Live container resource usage (CPU/RAM)
```

### Logs

```bash
make logs             # Tail all service logs
make logs-cowrie      # Tail Cowrie logs
make logs-elasticsearch
make cowrie-attacks   # Grep login attempts from Cowrie log files
make flask-attacks    # Tail Flask HTTP honeypot log
```

### Testing (Objective 6)

```bash
make test             # Full test suite
make test-health      # HTTP health endpoint tests
make test-ports       # TCP port availability tests
make test-es          # Elasticsearch ingest pipeline test
make test-ssh         # Cowrie SSH honeypot response test
```

### Utilities

```bash
make validate         # Validate YAML + Python syntax
make shell-elasticsearch  # Exec into a container
make backup           # Snapshot ES data to ./backups/
make version          # Print all tool versions
make clean            # Remove containers, preserve data
make purge            # DESTRUCTIVE: remove containers + volumes
make purge-images     # DESTRUCTIVE: purge + remove images
```

---

## Services & Ports

| Service | Port | Protocol | Description |
|---|---|---|---|
| React Dashboard | **5000** | HTTP | Main management UI (this project) |
| Kibana | **5601** | HTTP | Elasticsearch visualisation |
| Elasticsearch | **9200** | HTTP | REST API & data store |
| Logstash monitoring | **9600** | HTTP | Logstash metrics API |
| Cowrie SSH | **2222** | SSH | SSH honeypot |
| Cowrie Telnet | **2223** | Telnet | Telnet honeypot |
| Flask HTTP trap | **8080** | HTTP | HTTP honeypot (logs all requests) |
| Dionaea FTP | **2121** | FTP | FTP honeypot |
| Dionaea SMB | **445** | SMB | SMB/Windows honeypot |
| Dionaea MySQL | **3306** | MySQL | MySQL honeypot |

---

## Project Structure

```
honeypot-project/
├── Makefile                          ← All deployment commands
├── deploy.py                         ← Python deployment orchestrator
├── docker-compose.yml                ← Service definitions
├── requirements.txt                  ← Python deps (dev/scripts)
├── .env                              ← Environment variables (not committed)
│
├── webapp/                           ← Management dashboard
│   ├── Dockerfile                    ← Multi-stage: Node build + Python serve
│   ├── app.py                        ← Flask REST API
│   ├── requirements.txt              ← Flask + docker SDK
│   └── frontend/                     ← React application
│       ├── package.json
│       ├── vite.config.js
│       ├── tailwind.config.js
│       ├── index.html
│       └── src/
│           ├── App.jsx               ← Root component + global state
│           ├── api.js                ← Centralised API layer
│           ├── index.css             ← Tailwind + custom cyber theme
│           └── components/
│               ├── Header.jsx        ← Nav bar + health indicators
│               ├── StatCards.jsx     ← 4 KPI cards
│               ├── ServiceStatus.jsx ← Container status grid
│               ├── ControlPanel.jsx  ← Deploy controls + quick links
│               ├── WorldMap.jsx      ← react-leaflet attack origin map
│               ├── Charts.jsx        ← Recharts: timeline, countries, credentials
│               ├── AttacksTable.jsx  ← Paginated + filterable event table
│               ├── LogsViewer.jsx    ← Terminal-style log viewer
│               └── Notifications.jsx ← Slide-in toast system
│
├── elk-stack/
│   ├── elasticsearch/config/
│   ├── kibana/config/
│   └── logstash/
│       ├── config/logstash.yml       ← Logstash settings
│       └── pipeline/honeypot.conf   ← Parse + GeoIP enrichment pipeline
│
├── honeypots/
│   ├── cowrie/
│   ├── dionaea/
│   └── flask-honeypot/
│       ├── Dockerfile
│       └── app.py                    ← HTTP catch-all honeypot
│
├── logs/                             ← Honeypot log files (git-ignored)
│   ├── cowrie/
│   ├── dionaea/
│   └── flask/
│
└── data/                             ← Downloaded malware / binaries (git-ignored)
    ├── cowrie/downloads/
    └── dionaea/binaries/
```

---

## Configuration

All configuration lives in `.env`. Key variables:

```bash
# Elasticsearch
ELASTIC_VERSION=9.0.2
ELASTIC_PASSWORD=changeme123      # ← CHANGE THIS

# Ports
COWRIE_SSH_PORT=2222
COWRIE_TELNET_PORT=2223
FLASK_HTTP_PORT=8080

# Memory (tune to your system)
ES_JAVA_OPTS=-Xms512m -Xmx512m
LS_JAVA_OPTS=-Xms256m -Xmx256m

# Timezone
TZ=Asia/Karachi
```

> **Security note:** The `.env` file is in `.gitignore`. Never commit passwords to version control.

---

## How It Works

### Data Flow

1. **Attackers** connect to the exposed honeypot ports (SSH 2222, HTTP 8080, FTP 2121, SMB 445, etc.)
2. **Cowrie** emulates a real SSH/Telnet server, records credentials tried and commands run, writes JSON logs to `logs/cowrie/`
3. **Dionaea** captures multi-protocol attack traffic and malware samples, writes to `logs/dionaea/`
4. **Flask HTTP trap** logs every HTTP request (method, URL, headers, body) to `logs/flask/`
5. **Logstash** tails all log files, parses them with grok/json filters, enriches with **GeoIP** (country, city, lat/lon), and ships to Elasticsearch
6. **Elasticsearch** stores events in daily rolling indices (`honeypot-cowrie-YYYY.MM.dd`, `honeypot-dionaea-*`, `honeypot-flask-*`)
7. **React Dashboard** polls the Flask API (`/api/attacks/*`) which queries ES aggregations and renders charts, world map, and tables in real-time
8. **Kibana** provides additional ad-hoc analysis and saved dashboards

### Logstash GeoIP

The pipeline (`elk-stack/logstash/pipeline/honeypot.conf`) uses the bundled MaxMind GeoLite2 database:

```ruby
geoip {
  source => "src_ip"
  target => "geoip"
}
```

This adds `geoip.country_name`, `geoip.city_name`, `geoip.latitude`, `geoip.longitude` to every event with a public IP address.

---

## Dashboard Features

| Feature | Implementation |
|---|---|
| Real-time service status | Docker SDK polling every 10 s |
| Attack timeline (24 h) | ES date histogram → Recharts AreaChart |
| World attack map | react-leaflet with colour-coded circle markers per honeypot type |
| Top countries | ES terms aggregation → horizontal BarChart |
| Top usernames / passwords | ES terms aggregation → horizontal BarChart |
| Top shell commands | ES terms aggregation → horizontal BarChart |
| Recent attacks table | ES search, client-side sort + filter + pagination |
| Service logs viewer | Docker container log API with download button |
| Deploy / shutdown controls | Flask API → `docker compose` subprocess |
| Toast notifications | React `forwardRef` / `useImperativeHandle` system |

---

## Testing (Objective 6)

```bash
# Full automated test suite
make test

# Individual test categories
make test-health   # HTTP 200 checks on all endpoints
make test-ports    # TCP port availability (5000, 5601, 9200, 8080, 2222, 2223)
make test-es       # Insert + query a document to verify the ES pipeline
make test-ssh      # Verify Cowrie SSH is responding on port 2222
```

To simulate attacks for testing:

```bash
# SSH brute-force simulation (requires hydra or nmap)
ssh -p 2222 admin@localhost                          # manual test
nmap -p 2222 --script ssh-brute localhost            # automated

# HTTP attack simulation
curl http://localhost:8080/admin
curl http://localhost:8080/wp-login.php
curl -X POST http://localhost:8080/ -d "user=admin&pass=123"

# Check events arrived in Elasticsearch
make attack-count
make es-indices
```

---

## Troubleshooting

### Elasticsearch fails to start

```bash
# Check the log
make logs-elasticsearch

# Fix kernel parameter (most common cause on WSL2)
make vm-fix

# Verify it's set
sysctl vm.max_map_count  # should be 262144
```

### "No such container" errors in the dashboard

The webapp reads from Docker socket. Verify the socket is accessible:

```bash
docker ps   # should work without sudo in WSL2
# if permission denied: sudo usermod -aG docker $USER && newgrp docker
```

### Webapp shows blank page

The React bundle is built inside Docker during `make build`. If you skipped the build:

```bash
make build-webapp   # rebuild webapp image
make restart-webapp
```

### Ports already in use

```bash
# Find and kill the conflicting process
sudo lsof -i :9200    # or :5601, :5000, etc.
sudo kill -9 <PID>
```

### docker-compose.yml YAML validation

```bash
make validate
# or directly:
docker compose -f docker-compose.yml config
```

---

## Security Notice

This platform is designed for **research and educational use only**. The honeypots intentionally expose services to collect attack data. Deploy only in isolated network environments or on dedicated cloud instances with appropriate firewall rules. Do **not** deploy on systems that carry real user data.

Default passwords (`changeme123`) in `.env` must be changed before any deployment exposed to external networks.
