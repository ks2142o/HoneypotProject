#!/usr/bin/env python3
"""
Automated Honeypot Deployment and Threat Intelligence Platform
Main Deployment Orchestrator
"""

import os
import sys
import subprocess
import argparse
import time
import json
import requests
from pathlib import Path
from typing import List, Dict, Tuple
import logging

# Log file lives next to this script (absolute path prevents CWD issues
# when called from make or another directory).
_LOG_FILE = Path(__file__).parent / 'deployment.log'

# Build handler list; if the log file is not writable (e.g. owned by root
# from a previous sudo run) fall back to stdout-only and warn afterwards.
_handlers: list = [logging.StreamHandler(sys.stdout)]
try:
    _handlers.append(logging.FileHandler(str(_LOG_FILE)))
except (PermissionError, OSError):
    pass  # warning emitted below after logger is initialised

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=_handlers,
)
logger = logging.getLogger(__name__)

if len(_handlers) == 1:
    logger.warning(
        "Cannot write to %s — logging to stdout only. "
        "Fix with: sudo chown $USER %s",
        _LOG_FILE, _LOG_FILE,
    )


class HoneypotDeployer:
    """Main class for orchestrating honeypot deployment"""

    def __init__(self):
        self.project_root = Path(__file__).parent
        self.docker_compose_file = self.project_root / 'docker-compose.yml'
        self.env_file = self.project_root / '.env'
        self.compose_cmd = self._detect_compose_cmd()

    @staticmethod
    def _detect_compose_cmd() -> list:
        """Return the docker-compose command as a list.

        Prefers the v2 plugin ('docker compose') and falls back to the
        legacy standalone binary ('docker-compose').
        """
        for cmd in (['docker', 'compose'], ['docker-compose']):
            try:
                subprocess.run(cmd + ['version'], capture_output=True, check=True)
                return cmd
            except (subprocess.CalledProcessError, FileNotFoundError):
                pass
        # If neither responds return the v2 form so the error message is clear
        return ['docker', 'compose']
        
    def check_dependencies(self) -> bool:
        """Check if all required dependencies are installed"""
        logger.info("Checking system dependencies...")

        dependencies = {
            'docker':          ['docker', '--version'],
            'docker-compose':  self.compose_cmd + ['version'],
            'python3':         ['python3', '--version'],
        }

        missing = []
        for name, command in dependencies.items():
            try:
                result = subprocess.run(
                    command,
                    capture_output=True,
                    text=True,
                    check=True
                )
                logger.info(f"✓ {name}: {result.stdout.strip()}")
            except (subprocess.CalledProcessError, FileNotFoundError):
                logger.error(f"✗ {name} not found")
                missing.append(name)

        if missing:
            logger.error(f"Missing dependencies: {', '.join(missing)}")
            return False

        logger.info("All dependencies satisfied ✓")
        return True
    
    def check_system_requirements(self) -> bool:
        """Check if system meets minimum requirements"""
        logger.info("Checking system requirements...")
        
        # Check available RAM
        try:
            with open('/proc/meminfo', 'r') as f:
                mem_total = int(f.readline().split()[1]) // 1024
                
            if mem_total < 4000:  # Relaxed for WSL
                logger.warning(f"Low memory detected: {mem_total}MB. 4GB minimum recommended for WSL")
                return False
            
            logger.info(f"✓ Available RAM: {mem_total}MB")
        except:
            logger.warning("Could not check RAM")
        
        # Check disk space
        try:
            stat = os.statvfs(str(self.project_root))
            free_gb = (stat.f_bavail * stat.f_frsize) / (1024**3)
            
            if free_gb < 20:
                logger.warning(f"Low disk space: {free_gb:.2f}GB. Minimum 20GB recommended")
                return False
                
            logger.info(f"✓ Free disk space: {free_gb:.2f}GB")
        except:
            logger.warning("Could not check disk space")
        
        # Check vm.max_map_count for Elasticsearch
        try:
            result = subprocess.run(
                ['sysctl', 'vm.max_map_count'],
                capture_output=True,
                text=True
            )
            current_value = int(result.stdout.split('=')[1].strip())
            
            if current_value < 262144:
                logger.warning(f"vm.max_map_count is {current_value}, need 262144 for Elasticsearch")
                logger.info("Attempting to set vm.max_map_count...")
                subprocess.run(
                    ['sudo', 'sysctl', '-w', 'vm.max_map_count=262144'],
                    check=True
                )
                logger.info("✓ vm.max_map_count set to 262144")
            else:
                logger.info(f"✓ vm.max_map_count: {current_value}")
        except:
            logger.warning("Could not check/set vm.max_map_count")
        
        return True
    
    def setup_environment(self) -> bool:
        """Setup environment variables and configuration files"""
        logger.info("Setting up environment...")
        
        # Check if .env exists
        if not self.env_file.exists():
            logger.info("Creating .env file from template...")
            env_template = """# ==============================================================================
# Honeypot Threat Intelligence Platform — Environment Configuration
# Auto-generated by deploy.py — edit values to suit your system.
# NEVER commit this file to version control.
# ==============================================================================

# ── Elastic Stack ─────────────────────────────────────────────────────────────
ELASTIC_VERSION=9.0.2
ELASTIC_USER=elastic
ELASTIC_PASSWORD=changeme123
KIBANA_PASSWORD=changeme123
KIBANA_SYSTEM_PASSWORD=changeme123
LOGSTASH_INTERNAL_PASSWORD=changeme123

# ── Elasticsearch connection (Docker internal DNS — do not change hostname) ───
ELASTICSEARCH_HOSTS=http://elasticsearch:9200
ELASTICSEARCH_URL=http://elasticsearch:9200

# ── JVM heap sizes ────────────────────────────────────────────────────────────
# 4 GB RAM: ES=512m/512m  LS=256m/256m  (WSL2 default)
# 8 GB RAM: ES=1g/1g      LS=512m/512m
ES_JAVA_OPTS=-Xms512m -Xmx512m
LS_JAVA_OPTS=-Xms256m -Xmx256m

# ── Docker network ────────────────────────────────────────────────────────────
NETWORK_NAME=honeypot-network
SUBNET=172.25.0.0/16

# ── Host port mappings ────────────────────────────────────────────────────────
ELASTICSEARCH_PORT=9200
KIBANA_PORT=5601
LOGSTASH_BEATS_PORT=5044
LOGSTASH_API_PORT=9600
WEBAPP_PORT=5000
COWRIE_SSH_PORT=2222
COWRIE_TELNET_PORT=2223
DIONAEA_FTP_PORT=2121
DIONAEA_DAYTIME_PORT=4042
DIONAEA_RPC_PORT=4135
DIONAEA_HTTPS_PORT=4443
DIONAEA_SMB_PORT=4445
DIONAEA_MSSQL_PORT=4433
DIONAEA_MYSQL_PORT=4306
DIONAEA_SIP_PORT=5060
DIONAEA_SIPS_PORT=5061
FLASK_HTTP_PORT=8181

# ── ngrok (WSL2 internet exposure — not needed on cloud VPS) ─────────────────
NGROK_AUTHTOKEN=

# ── Timezone & app settings ───────────────────────────────────────────────────
TZ=UTC
FLASK_ENV=production
LOG_LEVEL=INFO
LOG_RETENTION_DAYS=30
"""
            with open(self.env_file, 'w') as f:
                f.write(env_template)
            
            logger.warning("⚠ Default .env file created. Please review and update passwords!")
        else:
            logger.info("✓ .env file found")
        
        return True
    
    def create_directory_structure(self) -> bool:
        """Create necessary directory structure"""
        logger.info("Creating directory structure...")
        
        directories = [
            'honeypots/cowrie',
            'honeypots/dionaea', 
            'honeypots/flask-honeypot',
            'elk-stack/elasticsearch/config',
            'elk-stack/logstash/config',
            'elk-stack/logstash/pipeline',
            'elk-stack/kibana/config',
            'scripts',
            'dashboards',
            'logs',
            'data/elasticsearch',
            'data/cowrie',
            'data/dionaea',
            'webapp/templates'
        ]
        
        for directory in directories:
            dir_path = self.project_root / directory
            dir_path.mkdir(parents=True, exist_ok=True)
            logger.info(f"✓ Created {directory}")
        
        return True
    
    def deploy_honeypots(self, honeypots: List[str] = None) -> bool:
        """Deploy specified honeypots using Docker Compose"""
        if honeypots is None:
            honeypots = ['cowrie', 'dionaea', 'flask']
        
        logger.info(f"Deploying honeypots: {', '.join(honeypots)}")
        
        try:
            # Start services
            logger.info("Starting honeypot containers...")
            subprocess.run(
                self.compose_cmd + ['up', '-d'] + honeypots,
                cwd=str(self.project_root),
                check=True
            )
            
            logger.info("✓ Honeypots deployed successfully")
            return True
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to deploy honeypots: {e}")
            return False
    
    def deploy_elk_stack(self) -> bool:
        """Deploy ELK stack using Docker Compose"""
        logger.info("Deploying ELK stack...")
        
        try:
            # Start Elasticsearch first
            logger.info("Starting Elasticsearch...")
            subprocess.run(
                self.compose_cmd + ['up', '-d', 'elasticsearch'],
                cwd=str(self.project_root),
                check=True
            )

            # Wait for Elasticsearch to be ready
            logger.info("Waiting for Elasticsearch to be ready...")
            if not self.wait_for_elasticsearch():
                logger.error("Elasticsearch failed to start")
                return False

            # Start Logstash
            logger.info("Starting Logstash...")
            subprocess.run(
                self.compose_cmd + ['up', '-d', 'logstash'],
                cwd=str(self.project_root),
                check=True
            )

            # Start Kibana
            logger.info("Starting Kibana...")
            subprocess.run(
                self.compose_cmd + ['up', '-d', 'kibana'],
                cwd=str(self.project_root),
                check=True
            )
            # Do NOT block waiting for Kibana — on systems with <4 GB RAM
            # (e.g. WSL2 defaults) the first-boot migration can take 10+ min.
            # Kibana initialises in the background; check with: make health
            logger.info(
                "Kibana container started — it will become available at "
                "http://localhost:5601 in a few minutes. "
                "Run 'make health' to verify once deployment is complete."
            )
            
            logger.info("✓ ELK stack deployed successfully")
            return True
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to deploy ELK stack: {e}")
            return False
    
    def deploy_webapp(self) -> bool:
        """Deploy web management interface"""
        logger.info("Deploying web management interface...")
        
        try:
            subprocess.run(
                self.compose_cmd + ['up', '-d', 'webapp'],
                cwd=str(self.project_root),
                check=True
            )
            logger.info("✓ Web interface deployed at http://localhost:5000")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to deploy webapp: {e}")
            return False
    
    def wait_for_elasticsearch(self, timeout: int = 300) -> bool:
        """Wait for Elasticsearch to be ready"""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                response = requests.get(
                    'http://localhost:9200/_cluster/health',
                    timeout=5
                )
                
                if response.status_code == 200:
                    health = response.json()
                    logger.info(f"Elasticsearch status: {health.get('status')}")
                    if health.get('status') in ['green', 'yellow']:
                        return True
                    
            except requests.exceptions.RequestException:
                pass
            
            logger.info("Waiting for Elasticsearch...")
            time.sleep(10)
        
        return False
    
    def wait_for_kibana(self, timeout: int = 600) -> bool:
        """Wait for Kibana to be ready.

        Kibana 9.x performs savedObjects migrations and plugin initialisation
        on first boot which can take 5-8 minutes.  We accept both 'available'
        and 'degraded' as ready states — 'degraded' means Kibana is up but
        some non-critical plugins are still initialising.
        """
        start_time = time.time()
        READY = {'available', 'degraded'}

        while time.time() - start_time < timeout:
            try:
                response = requests.get(
                    'http://localhost:5601/api/status',
                    timeout=10
                )

                if response.status_code == 200:
                    status_data = response.json()
                    overall_status = (
                        status_data.get('status', {})
                                   .get('overall', {})
                                   .get('level', 'unknown')
                    )

                    if overall_status in READY:
                        logger.info(f"Kibana is ready (status: {overall_status})")
                        return True
                    else:
                        elapsed = int(time.time() - start_time)
                        logger.info(f"Kibana status: {overall_status} ({elapsed}s elapsed)")

            except requests.exceptions.RequestException:
                pass

            time.sleep(10)

        logger.warning("Kibana wait timeout reached — it may still be starting in the background")
        return True
    
    def check_deployment_status(self) -> Dict:
        """Check status of all deployed components"""
        logger.info("Checking deployment status...")
        
        status = {}
        
        try:
            result = subprocess.run(
                self.compose_cmd + ['ps', '--format', 'json'],
                cwd=str(self.project_root),
                capture_output=True,
                text=True,
                check=True
            )
            
            containers = []
            for line in result.stdout.strip().split('\n'):
                if line:
                    try:
                        containers.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass
            
            for container in containers:
                name = container.get('Service', 'unknown')
                state = container.get('State', 'unknown')
                status[name] = {
                    'state': state,
                    'status': container.get('Status', 'unknown')
                }
                
                symbol = "✓" if state == "running" else "✗"
                logger.info(f"{symbol} {name}: {state}")
        
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to check status: {e}")
        
        return status
    
    def shutdown(self, remove_volumes: bool = False) -> bool:
        """Shutdown all deployed components"""
        logger.info("Shutting down honeypot deployment...")
        
        try:
            cmd = self.compose_cmd + ['down']
            if remove_volumes:
                cmd.append('-v')
                logger.warning("⚠ This will remove all data volumes!")
            
            subprocess.run(
                cmd,
                cwd=str(self.project_root),
                check=True
            )
            
            logger.info("✓ Shutdown complete")
            return True
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to shutdown: {e}")
            return False


def main():
    """Main entry point for deployment script"""
    
    parser = argparse.ArgumentParser(
        description='Automated Honeypot Deployment System'
    )
    
    parser.add_argument(
        '--mode',
        choices=['full', 'honeypots-only', 'elk-only', 'webapp-only', 'status', 'shutdown'],
        default='full',
        help='Deployment mode (default: full)'
    )
    
    parser.add_argument(
        '--honeypots',
        help='Comma-separated list of honeypots to deploy (cowrie,dionaea,flask)'
    )
    
    parser.add_argument(
        '--remove-volumes',
        action='store_true',
        help='Remove data volumes on shutdown'
    )

    parser.add_argument(
        '--force',
        action='store_true',
        help='Skip interactive prompts (non-interactive / CI mode)'
    )
    
    args = parser.parse_args()
    
    deployer = HoneypotDeployer()
    
    # Print banner
    print("""
╔═══════════════════════════════════════════════════════════════╗
║   Automated Honeypot Deployment & Threat Intelligence Platform  ║
║                         Version 1.0                             ║
╚═══════════════════════════════════════════════════════════════╝
    """)
    
    # Handle different modes
    if args.mode == 'status':
        deployer.check_deployment_status()
        sys.exit(0)
    
    if args.mode == 'shutdown':
        success = deployer.shutdown(args.remove_volumes)
        sys.exit(0 if success else 1)
    
    # Pre-deployment checks
    if not deployer.check_dependencies():
        logger.error("Dependency check failed")
        sys.exit(1)
    
    if not deployer.check_system_requirements():
        if args.force:
            logger.warning("System requirements not fully met — continuing due to --force flag")
        else:
            try:
                response = input("System requirements not fully met. Continue anyway? (y/n): ")
            except EOFError:
                response = 'n'
            if response.lower() != 'y':
                sys.exit(1)
    
    if not deployer.setup_environment():
        logger.error("Environment setup failed")
        sys.exit(1)
    
    if not deployer.create_directory_structure():
        logger.error("Directory structure creation failed")
        sys.exit(1)
    
    # Deployment
    success = True
    
    if args.mode in ['full', 'elk-only']:
        success = success and deployer.deploy_elk_stack()
    
    if args.mode in ['full', 'honeypots-only']:
        honeypots = None
        if args.honeypots:
            honeypots = [h.strip() for h in args.honeypots.split(',')]
        success = success and deployer.deploy_honeypots(honeypots)
    
    if args.mode in ['full', 'webapp-only']:
        success = success and deployer.deploy_webapp()
    
    # Final status check
    if success:
        logger.info("\n" + "="*60)
        logger.info("DEPLOYMENT SUCCESSFUL!")
        logger.info("="*60)
        
        deployer.check_deployment_status()
        
        logger.info("\nAccess Points:")
        logger.info("  - Web Management Interface: http://localhost:5000")
        logger.info("  - Kibana Dashboard: http://localhost:5601")
        logger.info("  - Elasticsearch API: http://localhost:9200")
        logger.info("  - SSH Honeypot: port 2222")
        logger.info("  - Telnet Honeypot: port 2223")
        _flask_port = os.environ.get('FLASK_HTTP_PORT', '8181')
        logger.info(f"  - Web Honeypot: port {_flask_port}")
        logger.info("\n⚠ NOTE: No authentication required (security disabled for testing)")
        logger.info("="*60)
    else:
        logger.error("Deployment failed. Check logs for details.")
        sys.exit(1)


if __name__ == '__main__':
    main()