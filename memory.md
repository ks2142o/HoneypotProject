# Project Memory

## Purpose
Honeypot Threat Intelligence Platform for capturing, enriching, and visualizing attack traffic using Cowrie, Dionaea, and a Flask HTTP honeypot with ELK + React/Flask dashboard.

## Runtime Architecture
- `docker-compose.yml`: Orchestrates all services (honeypots, ELK, dashboard), host port bindings, and Docker network/subnet.
- `deploy.py`: End-to-end deployment script (dependency checks, env bootstrap, subnet/port conflict resolution, staged startup).
- `Makefile`: Operator commands for setup, deploy, restart, diagnostics, network/port conflict fixes.

## Backend (Dashboard API)
- `webapp/app.py`:
  - Auth/session APIs and admin user management (SQLite users table).
  - Service control APIs (`/api/deploy/*`, `/api/shutdown`) via Docker Compose.
  - Service status/log APIs (`/api/status`, `/api/logs/*`) via Docker SDK.
  - Analytics APIs (`/api/attacks/*`) with Elasticsearch-first + SQLite fallback.
  - Local attack persistence table (`attacks`) for resilience when ES is unavailable.

## Frontend
- `webapp/frontend/src/api.js`: Central API wrapper; exports named auth/admin functions and `api` object for analytics/deploy endpoints.
- `webapp/frontend/src/App.jsx`: Auth gate + dashboard orchestration + auto-refresh.
- `webapp/frontend/src/components/AttackAdminPanel.jsx`: Global attack DB view with filter/search/pagination/export/delete.
- `webapp/frontend/src/components/UserAdminPanel.jsx`: Admin user CRUD panel.
- `webapp/frontend/src/components/ServiceStatus.jsx`: Service cards and start/restart actions.

## Ingestion Pipeline
- `elk-stack/logstash/pipeline/honeypot.conf`:
  - Inputs: Cowrie JSON, Dionaea logs, Flask logs.
  - Filters: normalize fields (`honeypot_type`, `event_type`), parse timestamps, extract `src_ip`, GeoIP enrichment.
  - Output: date-indexed Elasticsearch indices by honeypot type.

## Resolver Scripts
- `scripts/resolve_port_conflicts.py`: Detects occupied host ports from `.env` and remaps to available alternatives.
- `scripts/resolve_network_subnet.py`: Detects Docker subnet overlap and rewrites `.env` `SUBNET`.

## Key Errors Resolved and Fixes
1. Services shown as "not running" while containers were up.
- Cause: strict project-label matching in `webapp/app.py` (`COMPOSE_PROJECT_NAME` mismatch).
- Fix: resilient container discovery by service label + candidate project names + running-container preference.

2. Attack Database runtime error (`void 0 is not a function`).
- Cause: wrong frontend import usage in `AttackAdminPanel` (called `allAttacks` from wrong export namespace).
- Fix: switched to `import { api } from '../api'` and used `api.allAttacks()`.

3. Docker network overlap on startup (`invalid pool request`).
- Cause: `.env` subnet conflicted with existing Docker network CIDR.
- Fix: added `scripts/resolve_network_subnet.py` and wired it into deploy/make flows.

4. Frequent Docker bind failures (`port already in use`).
- Cause: occupied host ports or duplicate mappings.
- Fix: added `scripts/resolve_port_conflicts.py`, deploy-side diagnostics, optional auto-remap path.

5. Attack analytics broken when Elasticsearch unavailable.
- Cause: dashboard endpoints assumed ES availability.
- Fix: SQLite fallback analytics for stats, timeline, credentials, commands, countries, and recent/all attacks.

6. Dionaea/Flask noisy ingestion inflating counts with non-attack lines.
- Cause: pipeline ingested startup/header/body lines lacking valid attack source IPs.
- Fix: tightened Logstash filters:
  - Dionaea: parse bracket timestamp format, extract attacker IP from event text, drop lines without `src_ip`.
  - Flask: drop non-request continuation lines using grok-failure guard.

## Cloud Deployment Notes (Oracle)
- Keep static host ports for stable NSG/Security List/UFW rules (`AUTO_REMAP_PORTS_ON_CONFLICT=0`).
- Use explicit compose project label consistency:
  - `.env`: `COMPOSE_PROJECT_NAME=honeypotproject`
  - compose webapp env passes through same value.
- Keep private ELK ports bound to localhost where possible; expose honeypot and dashboard ports intentionally.

## Operator Checklist
- After changing pipeline rules, restart Logstash service.
- After env/network/port changes, run full deploy or targeted restart.
- Validate from dashboard and host:
  - `docker compose ps`
  - `ss -ltnp`
  - Dashboard `/api/status`, `/api/attacks/all`, `/api/attacks/geo-points`.
