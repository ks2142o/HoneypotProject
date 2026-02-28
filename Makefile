# ==============================================================================
# HONEYPOT THREAT INTELLIGENCE PLATFORM — Makefile
# ==============================================================================
# Usage:  make <target>
# Run     make help   to see all available targets with descriptions.
# ==============================================================================

# ── Configuration ──────────────────────────────────────────────────────────────
COMPOSE_FILE   := docker-compose.yml
PROJECT_DIR    := $(shell pwd)
ENV_FILE       := .env
DEPLOY_SCRIPT  := deploy.py
FRONTEND_DIR   := webapp/frontend

# Read port values from .env so Makefile health/url targets stay in sync
FLASK_HTTP_PORT    := $(shell grep -E '^FLASK_HTTP_PORT=' $(ENV_FILE) 2>/dev/null | cut -d= -f2 | tr -d ' \t' || echo 8181)
WEBAPP_PORT        := $(shell grep -E '^WEBAPP_PORT='     $(ENV_FILE) 2>/dev/null | cut -d= -f2 | tr -d ' \t' || echo 5000)
KIBANA_PORT        := $(shell grep -E '^KIBANA_PORT='     $(ENV_FILE) 2>/dev/null | cut -d= -f2 | tr -d ' \t' || echo 5601)
ELASTICSEARCH_PORT := $(shell grep -E '^ELASTICSEARCH_PORT=' $(ENV_FILE) 2>/dev/null | cut -d= -f2 | tr -d ' \t' || echo 9200)
COWRIE_SSH_PORT    := $(shell grep -E '^COWRIE_SSH_PORT=' $(ENV_FILE) 2>/dev/null | cut -d= -f2 | tr -d ' \t' || echo 2222)
COWRIE_TELNET_PORT := $(shell grep -E '^COWRIE_TELNET_PORT=' $(ENV_FILE) 2>/dev/null | cut -d= -f2 | tr -d ' \t' || echo 2223)

# Detect docker compose command (v2 plugin vs legacy standalone).
# Strategy:
#   1. Try "docker compose version" (v2 plugin, daemon running).
#   2. Try "docker-compose version" (legacy standalone binary).
#   3. Look for the plugin binary on disk — works even when the Docker
#      daemon is not yet running (e.g. fresh WSL2 terminal before
#      Docker Desktop has fully started).
DOCKER_COMPOSE := $(shell \
  if docker compose version > /dev/null 2>&1; then \
    echo "docker compose"; \
  elif docker-compose version > /dev/null 2>&1; then \
    echo "docker-compose"; \
  elif [ -x "$$HOME/.docker/cli-plugins/docker-compose" ]; then \
    echo "docker compose"; \
  elif [ -x "/usr/libexec/docker/cli-plugins/docker-compose" ]; then \
    echo "docker compose"; \
  elif [ -x "/usr/lib/docker/cli-plugins/docker-compose" ]; then \
    echo "docker compose"; \
  elif [ -x "/usr/local/lib/docker/cli-plugins/docker-compose" ]; then \
    echo "docker compose"; \
  else \
    echo "MISSING"; \
  fi)

# ── Colours ────────────────────────────────────────────────────────────────────
RED    := \033[0;31m
GREEN  := \033[0;32m
YELLOW := \033[1;33m
CYAN   := \033[0;36m
BLUE   := \033[0;34m
PURPLE := \033[0;35m
BOLD   := \033[1m
RESET  := \033[0m

# ── Helpers ────────────────────────────────────────────────────────────────────
define log
printf "$(CYAN)$(BOLD)[honeypot]$(RESET) $(1)\n"
endef
define ok
printf "$(GREEN)$(BOLD)  ✓ $(RESET)$(1)\n"
endef
define warn
printf "$(YELLOW)$(BOLD)  ⚠ $(RESET)$(1)\n"
endef
define err
printf "$(RED)$(BOLD)  ✗ $(RESET)$(1)\n"
endef

# ── Default target ─────────────────────────────────────────────────────────────
.DEFAULT_GOAL := help

# ==============================================================================
# HELP
# ==============================================================================
.PHONY: help
help: ## Show this help message
	@printf "\n$(BOLD)$(CYAN)╔══════════════════════════════════════════════════════════════╗$(RESET)\n"
	@printf "$(BOLD)$(CYAN)║   Honeypot Threat Intelligence Platform — Command Reference   ║$(RESET)\n"
	@printf "$(BOLD)$(CYAN)╚══════════════════════════════════════════════════════════════╝$(RESET)\n\n"
	@printf "$(BOLD)Usage:$(RESET)  make $(CYAN)<target>$(RESET)\n\n"
	@awk 'BEGIN {FS = ":.*##"; section=""} \
	  /^##@/ { section=$$0; sub(/^##@ /, "", section); \
	           printf "\n$(BOLD)$(PURPLE)%s$(RESET)\n", section } \
	  /^[a-zA-Z0-9_-]+:.*?## .*$$/ { \
	           printf "  $(CYAN)%-22s$(RESET) %s\n", $$1, $$2 }' \
	$(MAKEFILE_LIST)
	@printf "\n"


# ==============================================================================
##@ Setup & Prerequisites
# ==============================================================================

.PHONY: check-deps
check-deps: ## Check that Docker, compose, and Python are installed
	$(call log, Checking system dependencies…)
	@command -v docker      > /dev/null 2>&1 && $(call ok, docker found) || { \
	  $(call err, docker not found — WSL2 integration is not enabled); \
	  printf "$(YELLOW)  → Open Docker Desktop$(RESET) → Settings → Resources → WSL Integration\n"; \
	  printf "$(YELLOW)    Enable the toggle for this distro and click Apply & Restart$(RESET)\n"; \
	  exit 1; \
	}
	@if docker compose version > /dev/null 2>&1; then \
	  $(call ok, 'docker compose (v2 plugin) found'); \
	elif docker-compose version > /dev/null 2>&1; then \
	  $(call ok, 'docker-compose (standalone) found'); \
	elif [ -x "$$HOME/.docker/cli-plugins/docker-compose" ] || \
	     [ -x "/usr/libexec/docker/cli-plugins/docker-compose" ] || \
	     [ -x "/usr/lib/docker/cli-plugins/docker-compose" ] || \
	     [ -x "/usr/local/lib/docker/cli-plugins/docker-compose" ]; then \
	  $(call ok, 'docker compose plugin (binary) found — daemon may not be running yet'); \
	else \
	  $(call err, 'docker compose not found. Install Docker Desktop (WSL2) or run: sudo apt install docker-compose-plugin'); \
	  exit 1; \
	fi
	@command -v python3     > /dev/null 2>&1 && $(call ok, python3 found)       || ($(call err, python3 not found) && exit 1)
	@command -v node        > /dev/null 2>&1 && $(call ok, node found)          || $(call warn, node not found — only needed for local frontend dev)
	@command -v npm         > /dev/null 2>&1 && $(call ok, npm found)           || $(call warn, npm not found — only needed for local frontend dev)
	@$(call ok, All required dependencies satisfied)

.PHONY: vm-fix
vm-fix: ## Set vm.max_map_count=262144 required by Elasticsearch (WSL2/Linux)
	$(call log, Setting vm.max_map_count for Elasticsearch…)
	@current=$$(sysctl -n vm.max_map_count 2>/dev/null || echo 0); \
	 if [ "$$current" -lt 262144 ]; then \
	   sudo sysctl -w vm.max_map_count=262144 && $(call ok, vm.max_map_count set to 262144); \
	 else \
	   $(call ok, vm.max_map_count already $$current — no change needed); \
	 fi

.PHONY: env
env: ## Create .env file from template if it does not exist
	$(call log, Checking environment file…)
	@if [ ! -f "$(ENV_FILE)" ]; then \
	  cp .env.example .env 2>/dev/null || python3 $(DEPLOY_SCRIPT) --mode=status --force 2>/dev/null || true; \
	  $(call ok, .env created — please review and update passwords!); \
	else \
	  $(call ok, .env already exists); \
	fi

.PHONY: dirs
dirs: ## Create required log and data directory tree
	$(call log, Creating directory structure…)
	@mkdir -p logs/cowrie logs/dionaea logs/flask \
	           data/cowrie/downloads data/dionaea/binaries data/elasticsearch \
	           elk-stack/elasticsearch/config \
	           elk-stack/logstash/config elk-stack/logstash/pipeline \
	           elk-stack/kibana/config \
	           honeypots/cowrie honeypots/dionaea \
	           dashboards scripts backups
	@$(call ok, Directory structure ready)

.PHONY: setup
setup: check-deps vm-fix env dirs ## Full first-time setup (deps + kernel + env + dirs)
	@$(call ok, Setup complete — run 'make deploy' to start the platform)


# ==============================================================================
##@ Build
# ==============================================================================

.PHONY: build
build: ## Build all Docker images (webapp multi-stage build included)
	$(call log, Building all Docker images…)
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) build --no-cache
	@$(call ok, All images built)

.PHONY: build-webapp
build-webapp: ## Build only the webapp image (React + Flask)
	$(call log, Building webapp image…)
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) build --no-cache webapp
	@$(call ok, Webapp image built)

.PHONY: frontend-build
frontend-build: ## Build the React frontend locally (requires Node)
	$(call log, Building React frontend locally…)
	@cd $(FRONTEND_DIR) && npm ci && npm run build
	@$(call ok, Frontend built to webapp/frontend/dist/)

.PHONY: frontend-dev
frontend-dev: ## Start Vite dev server with HMR (requires Node + Flask running separately)
	$(call log, Starting Vite dev server on http://localhost:3000 …)
	@cd $(FRONTEND_DIR) && npm install && npm run dev


# ==============================================================================
##@ Deployment
# ==============================================================================

.PHONY: deploy
deploy: setup ## Full deployment — ELK stack + honeypots + webapp (recommended)
	$(call log, Starting full deployment via deploy.py…)
	@python3 $(DEPLOY_SCRIPT) --mode=full --force
	@$(call ok, Deployment complete)
	@$(MAKE) --no-print-directory urls

.PHONY: up
up: ## Start all services with docker compose (images must already be built)
	$(call log, Starting all services…)
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) up -d
	@$(call ok, All services started)
	@$(MAKE) --no-print-directory urls

.PHONY: deploy-elk
deploy-elk: vm-fix ## Deploy ELK stack only (Elasticsearch + Logstash + Kibana)
	$(call log, Deploying ELK stack…)
	@python3 $(DEPLOY_SCRIPT) --mode=elk-only --force
	@$(call ok, ELK stack deployed)

.PHONY: deploy-honeypots
deploy-honeypots: ## Deploy honeypots only (Cowrie + Dionaea + Flask)
	$(call log, Deploying honeypots…)
	@python3 $(DEPLOY_SCRIPT) --mode=honeypots-only --force
	@$(call ok, Honeypots deployed)

.PHONY: deploy-webapp
deploy-webapp: build-webapp ## Build and deploy the management webapp only
	$(call log, Deploying webapp…)
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) up -d webapp
	@$(call ok, Webapp deployed at http://localhost:5000)

.PHONY: start-%
start-%: ## Start a specific service: make start-elasticsearch
	$(call log, Starting $*…)
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) up -d $*
	@$(call ok, $* started)


# ==============================================================================
##@ Service Control
# ==============================================================================

.PHONY: stop
stop: ## Stop all services (containers remain, data preserved)
	$(call log, Stopping all services…)
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) stop
	@$(call ok, All services stopped)

.PHONY: down
down: ## Stop and remove containers (data volumes preserved)
	$(call log, Taking down all containers…)
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) down
	@$(call ok, Containers removed — volumes still intact)

.PHONY: restart
restart: ## Restart all running services
	$(call log, Restarting all services…)
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) restart
	@$(call ok, Services restarted)

.PHONY: restart-%
restart-%: ## Restart a specific service: make restart-kibana
	$(call log, Restarting $*…)
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) restart $*
	@$(call ok, $* restarted)


# ==============================================================================
##@ Status & Monitoring
# ==============================================================================

.PHONY: status
status: ## Show status of all containers
	$(call log, Checking service status…)
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) ps

.PHONY: ps
ps: status ## Alias for status

.PHONY: health
health: ## Run health checks against all HTTP endpoints
	$(call log, Running health checks…)
	@printf "$(BLUE)  Webapp       $(RESET)"; \
	  curl -sf http://localhost:$(WEBAPP_PORT)/api/health > /dev/null 2>&1 \
	  && printf "$(GREEN)✓ healthy$(RESET)\n" || printf "$(RED)✗ unreachable$(RESET)\n"
	@printf "$(BLUE)  Elasticsearch$(RESET)"; \
	  curl -sf http://localhost:$(ELASTICSEARCH_PORT)/_cluster/health > /dev/null 2>&1 \
	  && printf "$(GREEN)✓ healthy$(RESET)\n" || printf "$(RED)✗ unreachable$(RESET)\n"
	@printf "$(BLUE)  Kibana       $(RESET)"; \
	  curl -sf http://localhost:$(KIBANA_PORT)/api/status > /dev/null 2>&1 \
	  && printf "$(GREEN)✓ healthy$(RESET)\n" || printf "$(RED)✗ unreachable$(RESET)\n"
	@printf "$(BLUE)  Flask Honeypot$(RESET)"; \
	  curl -sf http://localhost:$(FLASK_HTTP_PORT)/health > /dev/null 2>&1 \
	  && printf "$(GREEN)✓ healthy$(RESET)\n" || printf "$(RED)✗ unreachable$(RESET)\n"

.PHONY: urls
urls: ## Print all service access URLs
	@printf "\n$(BOLD)$(CYAN)  Access Points$(RESET)\n"
	@printf "  $(CYAN)Dashboard         $(RESET)→  http://localhost:$(WEBAPP_PORT)\n"
	@printf "  $(YELLOW)Kibana            $(RESET)→  http://localhost:$(KIBANA_PORT)\n"
	@printf "  $(BLUE)Elasticsearch     $(RESET)→  http://localhost:$(ELASTICSEARCH_PORT)\n"
	@printf "  $(GREEN)Flask Honeypot    $(RESET)→  http://localhost:$(FLASK_HTTP_PORT)\n"
	@printf "  $(PURPLE)Cowrie SSH        $(RESET)→  ssh -p $(COWRIE_SSH_PORT) root@localhost\n"
	@printf "  $(PURPLE)Cowrie Telnet     $(RESET)→  telnet localhost $(COWRIE_TELNET_PORT)\n\n"

.PHONY: es-status
es-status: ## Show Elasticsearch cluster health in detail
	$(call log, Querying Elasticsearch cluster health…)
	@curl -s http://localhost:9200/_cluster/health?pretty 2>/dev/null \
	  || $(call err, Elasticsearch is not responding)

.PHONY: es-indices
es-indices: ## List all Elasticsearch honeypot indices
	$(call log, Listing honeypot indices…)
	@curl -s "http://localhost:9200/_cat/indices/honeypot-*?v&s=index" 2>/dev/null \
	  || $(call err, Elasticsearch is not responding)

.PHONY: attack-count
attack-count: ## Show total attack event count across all honeypot indices
	$(call log, Counting attack events…)
	@curl -s "http://localhost:9200/honeypot-*/_count" 2>/dev/null | python3 -m json.tool \
	  || $(call err, Elasticsearch is not responding)

.PHONY: seed
seed: ## Inject 600 fake attack events into Elasticsearch for demo/testing
	$(call log, Seeding Elasticsearch with demo attack data…)
	@python3 scripts/seed_attacks.py --es http://localhost:$(ELASTICSEARCH_PORT)


# ==============================================================================
##@ Logs
# ==============================================================================

.PHONY: logs
logs: ## Tail live logs from ALL services (Ctrl+C to stop)
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) logs -f --tail=50

.PHONY: logs-%
logs-%: ## Tail logs for a specific service: make logs-elasticsearch
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) logs -f --tail=100 $*

.PHONY: cowrie-attacks
cowrie-attacks: ## Show recent Cowrie SSH login attempts
	$(call log, Recent Cowrie events…)
	@if [ -d logs/cowrie ]; then \
	  grep -h "login attempt" logs/cowrie/*.log 2>/dev/null | tail -50 \
	  || $(call warn, No Cowrie logs yet — wait for SSH activity); \
	else \
	  $(call warn, logs/cowrie directory not found); \
	fi

.PHONY: flask-attacks
flask-attacks: ## Show recent Flask honeypot HTTP requests
	$(call log, Recent Flask HTTP events…)
	@if [ -f logs/flask/flask-honeypot.log ]; then \
	  tail -50 logs/flask/flask-honeypot.log; \
	else \
	  $(call warn, No Flask logs yet — wait for HTTP activity); \
	fi


# ==============================================================================
##@ Cleanup
# ==============================================================================

.PHONY: clean
clean: ## Stop and remove containers; preserve data volumes
	$(call log, Removing containers…)
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) down --remove-orphans
	@$(call ok, Containers removed — data volumes preserved)

.PHONY: clean-logs
clean-logs: ## Remove all collected honeypot log files
	$(call warn, Deleting all log files in logs/…)
	@rm -rf logs/cowrie/* logs/dionaea/* logs/flask/*
	@$(call ok, Log files removed)

.PHONY: purge
purge: ## DESTRUCTIVE: stop all, remove containers AND data volumes
	$(call warn, This will permanently delete all attack data and logs!)
	@read -p "Type YES to confirm: " confirm; \
	 [ "$$confirm" = "YES" ] && \
	   $(DOCKER_COMPOSE) -f $(COMPOSE_FILE) down -v --remove-orphans && \
	   $(call ok, All containers and volumes removed) || \
	   $(call warn, Aborted)

.PHONY: purge-images
purge-images: purge ## DESTRUCTIVE: purge + remove all built images
	$(call warn, Removing all honeypot Docker images…)
	@docker image rm honeypot/webapp:latest 2>/dev/null || true
	@docker image prune -f
	@$(call ok, Images removed)


# ==============================================================================
##@ Testing  (Objective 6)
# ==============================================================================

.PHONY: test
test: ## Run all system tests (health, ES connectivity, honeypot ports)
	$(call log, Running system test suite…)
	@$(MAKE) --no-print-directory test-health
	@$(MAKE) --no-print-directory test-ports
	@$(MAKE) --no-print-directory test-es
	@$(call ok, All tests completed — review output above)

.PHONY: test-health
test-health: ## Test HTTP health endpoints
	$(call log, Health endpoint tests…)
	@passed=0; failed=0; \
	 check() { \
	   printf "  %-28s" "$$1"; \
	   if curl -sf "$$2" > /dev/null 2>&1; then \
	     printf "$(GREEN)PASS$(RESET)\n"; passed=$$((passed+1)); \
	   else \
	     printf "$(RED)FAIL$(RESET)\n"; failed=$$((failed+1)); \
	   fi; \
	 }; \
	 check "Webapp /api/health"       "http://localhost:$(WEBAPP_PORT)/api/health"; \
	 check "Webapp /api/status"       "http://localhost:$(WEBAPP_PORT)/api/status"; \
	 check "Elasticsearch /_cluster"  "http://localhost:$(ELASTICSEARCH_PORT)/_cluster/health"; \
	 check "Kibana /api/status"       "http://localhost:$(KIBANA_PORT)/api/status"; \
	 check "Flask Honeypot /health"   "http://localhost:$(FLASK_HTTP_PORT)/health"; \
	 printf "\n  Results: $(GREEN)$$passed passed$(RESET), $(RED)$$failed failed$(RESET)\n"

.PHONY: test-ports
test-ports: ## Verify all expected TCP ports are listening
	$(call log, Port availability tests…)
	@for port in $(WEBAPP_PORT) $(KIBANA_PORT) $(ELASTICSEARCH_PORT) 9600 $(FLASK_HTTP_PORT) $(COWRIE_SSH_PORT) $(COWRIE_TELNET_PORT); do \
	   printf "  Port %-6s  " "$$port"; \
	   if timeout 2 bash -c "echo >/dev/tcp/localhost/$$port" 2>/dev/null; then \
	     printf "$(GREEN)OPEN$(RESET)\n"; \
	   else \
	     printf "$(RED)CLOSED$(RESET)\n"; \
	   fi; \
	 done

.PHONY: test-es
test-es: ## Test Elasticsearch index creation and document ingestion pipeline
	$(call log, Elasticsearch pipeline test…)
	@printf "  Inserting test document… "
	@result=$$(curl -sf -X POST "http://localhost:9200/honeypot-test-$(shell date +%Y.%m.%d)/_doc" \
	  -H "Content-Type: application/json" \
	  -d '{"src_ip":"1.2.3.4","event_type":"test","honeypot_type":"test","@timestamp":"$(shell date -u +%Y-%m-%dT%H:%M:%SZ)"}' \
	  2>/dev/null); \
	 echo "$$result" | grep -q '"result":"created"' \
	   && printf "$(GREEN)PASS$(RESET)\n" \
	   || printf "$(RED)FAIL (ES may not be ready)$(RESET)\n"
	@printf "  Querying test index…     "
	@curl -sf "http://localhost:9200/honeypot-test-*/_count" > /dev/null 2>&1 \
	  && printf "$(GREEN)PASS$(RESET)\n" || printf "$(RED)FAIL$(RESET)\n"

.PHONY: test-ssh
test-ssh: ## Test Cowrie SSH honeypot responds on port 2222
	$(call log, Testing Cowrie SSH honeypot…)
	@timeout 5 ssh -o StrictHostKeyChecking=no -o ConnectTimeout=3 \
	  -p 2222 root@localhost 2>&1 | head -2 \
	  && $(call ok, Cowrie SSH is responding) \
	  || $(call warn, Cowrie SSH did not respond — may not be running)


# ==============================================================================
##@ Python Dependencies
# ==============================================================================

.PHONY: pip-install
pip-install: ## Install Python dependencies for local development
	$(call log, Installing Python dependencies…)
	@pip3 install -r requirements.txt
	@$(call ok, Python dependencies installed)

.PHONY: pip-install-webapp
pip-install-webapp: ## Install Python dependencies for the webapp only
	$(call log, Installing webapp Python dependencies…)
	@pip3 install -r webapp/requirements.txt
	@$(call ok, Webapp dependencies installed)


# ==============================================================================
##@ Utilities
# ==============================================================================

.PHONY: validate
validate: ## Validate docker-compose.yml and Python syntax
	$(call log, Validating docker-compose.yml…)
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) config > /dev/null && $(call ok, docker-compose.yml is valid) || $(call err, YAML validation failed)
	$(call log, Validating Python files…)
	@python3 -m py_compile webapp/app.py          && $(call ok, webapp/app.py OK)
	@python3 -m py_compile deploy.py              && $(call ok, deploy.py OK)
	@python3 -m py_compile honeypots/flask-honeypot/app.py && $(call ok, flask-honeypot/app.py OK)

.PHONY: shell-%
shell-%: ## Open a shell inside a running container: make shell-elasticsearch
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) exec $* /bin/bash 2>/dev/null \
	  || $(DOCKER_COMPOSE) -f $(COMPOSE_FILE) exec $* /bin/sh

.PHONY: stats
stats: ## Show running container resource usage
	@docker stats --no-stream $$($(DOCKER_COMPOSE) -f $(COMPOSE_FILE) ps -q 2>/dev/null) 2>/dev/null \
	  || $(call warn, No containers running)

.PHONY: backup
backup: ## Snapshot Elasticsearch data to ./backups/
	$(call log, Backing up Elasticsearch data…)
	@mkdir -p backups
	@ts=$$(date +%Y%m%d_%H%M%S); \
	 curl -sf -X PUT "http://localhost:9200/_snapshot/backup_$$ts" \
	   -H "Content-Type: application/json" \
	   -d "{\"type\":\"fs\",\"settings\":{\"location\":\"/backups/$$ts\"}}" > /dev/null 2>&1; \
	 docker cp elasticsearch:/usr/share/elasticsearch/data/ backups/es-$$ts/ 2>/dev/null \
	   && $(call ok, Backup saved to backups/es-$$ts/) \
	   || $(call warn, Backup via docker cp failed — Elasticsearch may not be running)

.PHONY: fix-perms
fix-perms: ## Fix root-owned files left behind by previous sudo runs
	$(call log, Fixing file ownership…)
	@sudo chown -R "$(shell id -un):$(shell id -gn)" \
	    deployment.log logs/ data/ backups/ 2>/dev/null || true
	@sudo chmod -R u+rw \
	    deployment.log logs/ data/ backups/ 2>/dev/null || true
	@$(call ok, Ownership of deployment.log / logs / data fixed)

.PHONY: version
version: ## Print tool versions
	@printf "$(CYAN)docker$(RESET)          "; docker --version 2>/dev/null || echo "not found"
	@printf "$(CYAN)docker compose$(RESET) "; $(DOCKER_COMPOSE) version 2>/dev/null | head -1 || echo "not found"
	@printf "$(CYAN)python3$(RESET)         "; python3 --version 2>/dev/null || echo "not found"
	@printf "$(CYAN)node$(RESET)            "; node --version 2>/dev/null || echo "not found"
	@printf "$(CYAN)npm$(RESET)             "; npm --version 2>/dev/null || echo "not found"


# Prevent 'make logs-elasticsearch' style targets from confusing make
.PHONY: logs-elasticsearch logs-logstash logs-kibana logs-cowrie logs-dionaea logs-flask logs-webapp
.PHONY: restart-elasticsearch restart-logstash restart-kibana restart-cowrie restart-dionaea restart-flask restart-webapp
.PHONY: start-elasticsearch start-logstash start-kibana start-cowrie start-dionaea start-flask start-webapp
.PHONY: shell-elasticsearch shell-logstash shell-kibana shell-cowrie shell-dionaea shell-flask shell-webapp
