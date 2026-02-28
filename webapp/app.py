#!/usr/bin/env python3
"""
Honeypot Deployment Dashboard - Flask Backend
Serves the React SPA from ./static/ and exposes all /api/* routes.
"""

import requests
from flask import Flask, jsonify, request, send_from_directory
import docker
import subprocess
import os
from datetime import datetime

# static_folder='static' → Flask serves built React bundle
app = Flask(__name__, static_folder='static', static_url_path='')

try:
    docker_client = docker.from_env()
except Exception:
    docker_client = None

PROJECT_PATH = "/app/project"


def _detect_compose_cmd() -> list:
    """Return ['docker', 'compose'] if the v2 plugin is available, else ['docker-compose']."""
    for cmd in (['docker', 'compose'], ['docker-compose']):
        try:
            subprocess.run(cmd + ['version'], capture_output=True, check=True)
            return cmd
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass
    return ['docker', 'compose']


COMPOSE_CMD = _detect_compose_cmd()
ES_URL = os.environ.get('ELASTICSEARCH_URL', 'http://elasticsearch:9200')

# Canonical container name mapping
CONTAINER_NAMES = {
    'elasticsearch': 'elasticsearch',
    'logstash':      'logstash',
    'kibana':        'kibana',
    'webapp':        'webapp',
    'cowrie':        'cowrie-honeypot',
    'dionaea':       'dionaea-honeypot',
    'flask':         'flask-honeypot',
}


# ─────────────────────────────────────────
# React SPA serving
# ─────────────────────────────────────────

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_spa(path):
    """Serve React build; fall back to index.html for client-side routing."""
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')


# ─────────────────────────────────────────
# Container Status
# ─────────────────────────────────────────

@app.route('/api/status')
def get_status():
    """Return running status for every managed container."""
    containers = {}
    for service, container_name in CONTAINER_NAMES.items():
        try:
            if docker_client is None:
                raise RuntimeError("Docker client unavailable")
            container = docker_client.containers.get(container_name)
            containers[service] = {
                'status': container.status,
                'health': container.attrs.get('State', {}).get('Health', {}).get('Status', 'none'),
                'image':  container.image.tags[0] if container.image.tags else 'unknown',
            }
        except Exception as e:
            containers[service] = {
                'status': 'not running',
                'health': 'unknown',
                'error':  str(e),
            }
    return jsonify(containers)


# ─────────────────────────────────────────
# Deployment controls
# ─────────────────────────────────────────

@app.route('/api/deploy/<service>', methods=['POST'])
def deploy_service(service):
    """Start a single service via docker-compose."""
    if service not in CONTAINER_NAMES:
        return jsonify({'success': False, 'error': f'Unknown service: {service}'}), 400
    try:
        result = subprocess.run(
            COMPOSE_CMD + ['up', '-d', service],
            cwd=PROJECT_PATH,
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode == 0:
            return jsonify({'success': True, 'message': f'{service} deployed successfully'})
        return jsonify({'success': False, 'error': result.stderr or result.stdout}), 500
    except subprocess.TimeoutExpired:
        return jsonify({'success': False, 'error': 'Deployment timed out'}), 504
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/deploy/all', methods=['POST'])
def deploy_all():
    """Start any stopped services without recreating already-running ones."""
    try:
        result = subprocess.run(
            COMPOSE_CMD + ['up', '-d'],
            cwd=PROJECT_PATH,
            capture_output=True,
            text=True,
            timeout=300,
        )
        if result.returncode == 0:
            return jsonify({'success': True, 'message': 'All services started'})
        return jsonify({'success': False, 'error': result.stderr or result.stdout}), 500
    except subprocess.TimeoutExpired:
        return jsonify({'success': False, 'error': 'Timed out after 5 minutes'}), 504
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/shutdown', methods=['POST'])
def shutdown():
    """Stop all services."""
    try:
        result = subprocess.run(
            COMPOSE_CMD + ['down'],
            cwd=PROJECT_PATH,
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode == 0:
            return jsonify({'success': True, 'message': 'All services stopped'})
        return jsonify({'success': False, 'error': result.stderr}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ─────────────────────────────────────────
# Logs
# ─────────────────────────────────────────

@app.route('/api/logs/<service>')
def get_logs(service):
    """Return last 200 log lines for a container."""
    if service not in CONTAINER_NAMES:
        return jsonify({'error': f'Unknown service: {service}'}), 400
    try:
        container = docker_client.containers.get(CONTAINER_NAMES[service])
        logs = container.logs(tail=200, timestamps=True).decode('utf-8', errors='replace')
        return jsonify({'logs': logs, 'service': service})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─────────────────────────────────────────
# Elasticsearch stats
# ─────────────────────────────────────────

@app.route('/api/stats')
def get_stats():
    """High-level Elasticsearch index stats."""
    try:
        resp = requests.get(f'{ES_URL}/_stats', timeout=5)
        if resp.status_code == 200:
            stats = resp.json()
            honeypot_indices = [k for k in stats.get('indices', {}) if k.startswith('honeypot')]
            total_docs = stats.get('_all', {}).get('total', {}).get('docs', {}).get('count', 0)
            return jsonify({
                'status':     'connected',
                'indices':    len(honeypot_indices),
                'total_docs': total_docs,
            })
        return jsonify({'status': 'unavailable', 'total_docs': 0, 'indices': 0})
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e), 'total_docs': 0, 'indices': 0})


# ─────────────────────────────────────────
# Attack analytics
# ─────────────────────────────────────────

@app.route('/api/attacks/recent')
def get_recent_attacks():
    """50 most-recent attack events."""
    try:
        query = {
            'size': 50,
            'sort': [{'@timestamp': {'order': 'desc'}}],
            'query': {'match_all': {}},
            '_source': ['@timestamp', 'src_ip', 'username', 'password', 'input',
                        'geoip.country_name', 'geoip.city_name', 'honeypot_type', 'event_type'],
        }
        resp = requests.post(f'{ES_URL}/honeypot-*/_search', json=query, timeout=5)
        if resp.status_code == 200:
            hits = resp.json().get('hits', {}).get('hits', [])
            return jsonify({'attacks': [h['_source'] for h in hits], 'count': len(hits)})
        return jsonify({'attacks': [], 'count': 0})
    except Exception as e:
        return jsonify({'attacks': [], 'count': 0, 'error': str(e)})


@app.route('/api/attacks/top-credentials')
def get_top_credentials():
    """Top usernames, passwords, and username:password combos attempted."""
    try:
        query = {
            'size': 0,
            'aggs': {
                'top_usernames': {'terms': {'field': 'username.keyword', 'size': 10}},
                'top_passwords': {'terms': {'field': 'password.keyword', 'size': 10}},
            },
        }
        resp = requests.post(f'{ES_URL}/honeypot-cowrie-*/_search', json=query, timeout=5)
        if resp.status_code == 200:
            aggs = resp.json().get('aggregations', {})
            return jsonify({
                'top_usernames': aggs.get('top_usernames', {}).get('buckets', []),
                'top_passwords': aggs.get('top_passwords', {}).get('buckets', []),
            })
        return jsonify({'top_usernames': [], 'top_passwords': []})
    except Exception as e:
        return jsonify({'top_usernames': [], 'top_passwords': [], 'error': str(e)})


@app.route('/api/attacks/top-commands')
def get_top_commands():
    """Top shell commands executed in SSH honeypot."""
    try:
        query = {
            'size': 0,
            'query': {'exists': {'field': 'input'}},
            'aggs': {
                'top_commands': {'terms': {'field': 'input.keyword', 'size': 15}},
            },
        }
        resp = requests.post(f'{ES_URL}/honeypot-cowrie-*/_search', json=query, timeout=5)
        if resp.status_code == 200:
            aggs = resp.json().get('aggregations', {})
            return jsonify({'top_commands': aggs.get('top_commands', {}).get('buckets', [])})
        return jsonify({'top_commands': []})
    except Exception as e:
        return jsonify({'top_commands': [], 'error': str(e)})


@app.route('/api/attacks/by-country')
def get_attacks_by_country():
    """Attack counts grouped by source country."""
    try:
        query = {
            'size': 0,
            'aggs': {
                'by_country': {'terms': {'field': 'geoip.country_name.keyword', 'size': 20}},
            },
        }
        resp = requests.post(f'{ES_URL}/honeypot-*/_search', json=query, timeout=5)
        if resp.status_code == 200:
            aggs = resp.json().get('aggregations', {})
            return jsonify({'by_country': aggs.get('by_country', {}).get('buckets', [])})
        return jsonify({'by_country': []})
    except Exception as e:
        return jsonify({'by_country': [], 'error': str(e)})


@app.route('/api/attacks/timeline')
def get_attack_timeline():
    """Hourly attack count histogram for the last 24 hours."""
    try:
        query = {
            'size': 0,
            'query': {
                'range': {
                    '@timestamp': {'gte': 'now-24h', 'lte': 'now'},
                },
            },
            'aggs': {
                'attacks_over_time': {
                    'date_histogram': {
                        'field': '@timestamp',
                        'calendar_interval': '1h',
                    },
                },
            },
        }
        resp = requests.post(f'{ES_URL}/honeypot-*/_search', json=query, timeout=5)
        if resp.status_code == 200:
            aggs = resp.json().get('aggregations', {})
            return jsonify({'timeline': aggs.get('attacks_over_time', {}).get('buckets', [])})
        return jsonify({'timeline': []})
    except Exception as e:
        return jsonify({'timeline': [], 'error': str(e)})


@app.route('/api/attacks/geo-points')
def get_geo_points():
    """Geolocated attack origins for world map plotting."""
    try:
        query = {
            'size': 500,
            '_source': ['geoip.latitude', 'geoip.longitude', 'geoip.country_name',
                        'src_ip', 'honeypot_type'],
            'query': {'exists': {'field': 'geoip.location'}},
        }
        resp = requests.post(f'{ES_URL}/honeypot-*/_search', json=query, timeout=5)
        if resp.status_code == 200:
            hits = resp.json().get('hits', {}).get('hits', [])
            points = []
            for h in hits:
                src   = h.get('_source', {})
                geoip = src.get('geoip', {})
                lat   = geoip.get('latitude')
                lon   = geoip.get('longitude')
                if lat is not None and lon is not None:
                    points.append({
                        'lat':     lat,
                        'lon':     lon,
                        'country': geoip.get('country_name', 'Unknown'),
                        'ip':      src.get('src_ip', ''),
                        'type':    src.get('honeypot_type', 'unknown'),
                    })
            return jsonify({'points': points})
        return jsonify({'points': []})
    except Exception as e:
        return jsonify({'points': [], 'error': str(e)})


# ─────────────────────────────────────────
# Health / testing
# ─────────────────────────────────────────

@app.route('/api/health')
def health_check():
    """System health for Objective 6 validation."""
    health = {
        'webapp':          'healthy',
        'docker':          'unknown',
        'elasticsearch':   'unknown',
        'timestamp':       datetime.utcnow().isoformat() + 'Z',
    }
    try:
        if docker_client:
            docker_client.ping()
        health['docker'] = 'healthy'
    except Exception as e:
        health['docker'] = f'unhealthy: {e}'

    try:
        resp = requests.get(f'{ES_URL}/_cluster/health', timeout=3)
        health['elasticsearch'] = resp.json().get('status', 'unknown') if resp.status_code == 200 else 'unreachable'
    except Exception:
        health['elasticsearch'] = 'unreachable'

    return jsonify(health)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
