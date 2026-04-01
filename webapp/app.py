#!/usr/bin/env python3
"""
Honeypot Deployment Dashboard - Flask Backend with Authentication
Serves the React SPA from ./static/ and exposes all /api/* routes with role-based access control.
"""

import requests
from flask import Flask, jsonify, request, send_from_directory, session
import docker
import subprocess
import os
from datetime import datetime, timedelta
import sqlite3
import secrets
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
from flask_cors import CORS
import json

# Configuration
FLASK_ENV = os.environ.get('FLASK_ENV', 'development')
IS_PROD = FLASK_ENV == 'production'
FLASK_DEBUG = os.environ.get('FLASK_DEBUG', '0') == '1'

# static_folder='static' → Flask serves built React bundle
app = Flask(__name__, static_folder='static', static_url_path='')
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', secrets.token_hex(32))
# Fix session cookies for HTTP (disable secure flag until HTTPS is set up)
app.config['SESSION_COOKIE_SECURE'] = False  # Changed from IS_PROD
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)

# Configure CORS to allow credentials (cookies) from frontend
CORS(app, supports_credentials=True, origins=["http://localhost:5173", "http://127.0.0.1:5173"])

# Database configuration
DB_PATH = os.environ.get('WEBAPP_DB_PATH', '/app/data/users.db')
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

try:
    docker_client = docker.from_env()
except Exception:
    docker_client = None

PROJECT_PATH = "/app/project"


# ─────────────────────────────────────────
# Database Initialization
# ─────────────────────────────────────────

def get_db():
    """Get a database connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create users and attacks tables if they don't exist."""
    print("🔧 Initializing database...")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            is_active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS attacks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            src_ip TEXT NOT NULL,
            honeypot_type TEXT NOT NULL,
            event_type TEXT NOT NULL,
            username TEXT,
            password TEXT,
            input TEXT,
            http_method TEXT,
            request_url TEXT,
            message TEXT,
            country_name TEXT,
            city_name TEXT,
            latitude REAL,
            longitude REAL,
            raw_data TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_attacks_timestamp ON attacks(timestamp)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_attacks_src_ip ON attacks(src_ip)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_attacks_honeypot ON attacks(honeypot_type)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_attacks_event ON attacks(event_type)')
    conn.commit()
    conn.close()
    print("✅ Database initialized successfully")


def bootstrap_admin():
    """Ensure at least one admin exists; create from env if needed."""
    print("🔧 Checking for admin user...")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE role='admin' AND is_active=1")
    if cursor.fetchone() is None:
        admin_username = os.environ.get('ADMIN_USERNAME')
        admin_email = os.environ.get('ADMIN_EMAIL')
        admin_password = os.environ.get('ADMIN_PASSWORD')
        
        if admin_username and admin_email and admin_password:
            password_hash = generate_password_hash(admin_password)
            try:
                cursor.execute('''
                    INSERT INTO users (username, email, password_hash, role)
                    VALUES (?, ?, ?, 'admin')
                ''', (admin_username, admin_email, password_hash))
                conn.commit()
                print(f"✅ Admin user created: {admin_username}")
            except sqlite3.IntegrityError:
                print("⚠️ Admin user already exists")
        else:
            print("⚠️ Admin credentials not set in environment")
    else:
        print("✅ Admin user already exists")
    conn.close()


# Initialize database on startup
init_db()
bootstrap_admin()


# ─────────────────────────────────────────
# Auth Decorators
# ─────────────────────────────────────────

def login_required(f):
    """Decorator to require login for a route."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated_function


def admin_required(f):
    """Decorator to require admin role for a route."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session or session.get('role') != 'admin':
            return jsonify({'error': 'Forbidden'}), 403
        return f(*args, **kwargs)
    return decorated_function


def get_current_user():
    """Get the current user from the session."""
    if 'user_id' not in session:
        return None
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE id=? AND is_active=1', (session['user_id'],))
    user = cursor.fetchone()
    conn.close()
    return user


def save_attack_to_db(attack_data):
    """Save attack data to SQLite database for persistence."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Extract geoip data
        geoip = attack_data.get('geoip', {})
        
        cursor.execute('''
            INSERT INTO attacks (
                timestamp, src_ip, honeypot_type, event_type, username, password,
                input, http_method, request_url, message, country_name, city_name,
                latitude, longitude, raw_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            attack_data.get('@timestamp'),
            attack_data.get('src_ip'),
            attack_data.get('honeypot_type'),
            attack_data.get('event_type'),
            attack_data.get('username'),
            attack_data.get('password'),
            attack_data.get('input'),
            attack_data.get('http_method'),
            attack_data.get('request_url'),
            attack_data.get('message'),
            geoip.get('country_name'),
            geoip.get('city_name'),
            geoip.get('latitude'),
            geoip.get('longitude'),
            json.dumps(attack_data)  # Store full raw data as backup
        ))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"❌ Error saving attack to database: {e}")
        return False


def get_geo_points_from_db():
    """Get geolocated attack points from SQLite database."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT src_ip, honeypot_type, country_name, city_name, latitude, longitude
            FROM attacks
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
            ORDER BY timestamp DESC
            LIMIT 500
        ''')
        
        rows = cursor.fetchall()
        conn.close()
        
        points = []
        for row in rows:
            if row['latitude'] is not None and row['longitude'] is not None:
                points.append({
                    'lat': row['latitude'],
                    'lon': row['longitude'],
                    'country': row['country_name'] or 'Unknown',
                    'ip': row['src_ip'],
                    'type': row['honeypot_type']
                })
        
        return points
    except Exception as e:
        print(f"❌ Error getting geo points from database: {e}")
        return []


def get_attacks_from_db(limit=50, honeypot_type=None, event_type=None):
    """Query attack data from SQLite database."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        query = '''
            SELECT timestamp, src_ip, honeypot_type, event_type, username, password,
                   input, http_method, request_url, message, country_name, city_name,
                   latitude, longitude, raw_data
            FROM attacks
            WHERE 1=1
        '''
        params = []
        
        if honeypot_type:
            query += ' AND honeypot_type = ?'
            params.append(honeypot_type)
            
        if event_type:
            query += ' AND event_type = ?'
            params.append(event_type)
            
        query += ' ORDER BY timestamp DESC LIMIT ?'
        params.append(limit)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        # Convert to similar format as Elasticsearch
        attacks = []
        for row in rows:
            attack = {
                'id': row['id'],
                '@timestamp': row['timestamp'],
                'src_ip': row['src_ip'],
                'honeypot_type': row['honeypot_type'],
                'event_type': row['event_type'],
                'username': row['username'],
                'password': row['password'],
                'input': row['input'],
                'http_method': row['http_method'],
                'request_url': row['request_url'],
                'message': row['message'],
                'geoip': {
                    'country_name': row['country_name'],
                    'city_name': row['city_name'],
                    'latitude': row['latitude'],
                    'longitude': row['longitude']
                }
            }
            attacks.append(attack)
            
        return attacks
    except Exception as e:
        print(f"❌ Error querying attacks from database: {e}")
        return []


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
# Authentication Endpoints
# ─────────────────────────────────────────

@app.route('/api/auth/register', methods=['POST'])
def register():
    """Register a new user."""
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '').strip()
    
    if not username or len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 400
    if not email or '@' not in email:
        return jsonify({'error': 'Valid email required'}), 400
    if not password or len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    
    password_hash = generate_password_hash(password)
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO users (username, email, password_hash, role)
            VALUES (?, ?, ?, 'user')
        ''', (username, email, password_hash))
        conn.commit()
        conn.close()
        return jsonify({'message': 'User registered successfully'}), 201
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Username or email already exists'}), 400
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login with username or email."""
    data = request.get_json() or {}
    username_or_email = data.get('username', '').strip()
    password = data.get('password', '').strip()
    
    if not username_or_email or not password:
        return jsonify({'error': 'Username/email and password required'}), 400
    
    print(f"🔐 Login attempt for: {username_or_email}")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, username, email, password_hash, role FROM users
        WHERE (username=? OR email=?) AND is_active=1
    ''', (username_or_email, username_or_email))
    user = cursor.fetchone()
    conn.close()
    
    if not user or not check_password_hash(user['password_hash'], password):
        print("❌ Invalid credentials")
        return jsonify({'error': 'Invalid credentials'}), 401
    
    session.permanent = True
    session['user_id'] = user['id']
    session['username'] = user['username']
    session['role'] = user['role']
    
    print(f"✅ Login successful for user: {user['username']} (role: {user['role']})")
    print(f"📋 Session data set: user_id={user['id']}, username={user['username']}")
    
    return jsonify({
        'message': 'Logged in successfully',
        'user': {
            'id': user['id'],
            'username': user['username'],
            'email': user['email'],
            'role': user['role'],
        }
    }), 200


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    """Logout the current user."""
    session.clear()
    return jsonify({'message': 'Logged out successfully'}), 200


@app.route('/api/auth/me', methods=['GET'])
@login_required
def get_me():
    """Get current user info."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'id': user['id'],
        'username': user['username'],
        'email': user['email'],
        'role': user['role'],
    }), 200


# ─────────────────────────────────────────
# Admin User Management Endpoints
# ─────────────────────────────────────────

@app.route('/api/admin/users', methods=['GET'])
@admin_required
def list_users():
    """List all users (admin only)."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id, username, email, role, is_active, created_at FROM users')
    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({'users': users}), 200


@app.route('/api/admin/users', methods=['POST'])
@admin_required
def create_user():
    """Create a new user (admin only)."""
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '').strip()
    role = data.get('role', 'user')
    
    if role not in ['admin', 'user']:
        role = 'user'
    
    if not username or len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 400
    if not email or '@' not in email:
        return jsonify({'error': 'Valid email required'}), 400
    if not password or len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    
    password_hash = generate_password_hash(password)
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO users (username, email, password_hash, role)
            VALUES (?, ?, ?, ?)
        ''', (username, email, password_hash, role))
        conn.commit()
        user_id = cursor.lastrowid
        conn.close()
        return jsonify({
            'message': 'User created',
            'user': {'id': user_id, 'username': username, 'email': email, 'role': role}
        }), 201
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Username or email already exists'}), 400
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
@admin_required
def update_user(user_id):
    """Update a user (admin only)."""
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    role = data.get('role', '').strip()
    is_active = data.get('is_active')
    password = data.get('password', '').strip()
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT id, role FROM users WHERE id=?', (user_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        return jsonify({'error': 'User not found'}), 404
    
    # Prevent demoting sole active admin
    if role and role != user['role'] and role != 'admin':
        cursor.execute("SELECT COUNT(*) as count FROM users WHERE role='admin' AND is_active=1")
        if cursor.fetchone()['count'] <= 1 and user['role'] == 'admin':
            conn.close()
            return jsonify({'error': 'Cannot demote sole active admin'}), 400
    
    updates = []
    params = []
    if username:
        updates.append('username=?')
        params.append(username)
    if email:
        updates.append('email=?')
        params.append(email)
    if role:
        updates.append('role=?')
        params.append(role)
    if is_active is not None:
        updates.append('is_active=?')
        params.append(1 if is_active else 0)
    if password:
        updates.append('password_hash=?')
        params.append(generate_password_hash(password))
    
    if not updates:
        conn.close()
        return jsonify({'error': 'No fields to update'}), 400
    
    updates.append('updated_at=CURRENT_TIMESTAMP')
    params.append(user_id)
    
    try:
        cursor.execute(f"UPDATE users SET {', '.join(updates)} WHERE id=?", params)
        conn.commit()
        conn.close()
        return jsonify({'message': 'User updated'}), 200
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Username or email already exists'}), 400
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    """Delete a user (admin only)."""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT role FROM users WHERE id=?', (user_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        return jsonify({'error': 'User not found'}), 404
    
    # Prevent deleting sole active admin
    if user['role'] == 'admin':
        cursor.execute("SELECT COUNT(*) as count FROM users WHERE role='admin' AND is_active=1")
        if cursor.fetchone()['count'] <= 1:
            conn.close()
            return jsonify({'error': 'Cannot delete sole active admin'}), 400
    
    try:
        cursor.execute('DELETE FROM users WHERE id=?', (user_id,))
        conn.commit()
        conn.close()
        return jsonify({'message': 'User deleted'}), 200
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500


# ─────────────────────────────────────────
# Container Status
# ─────────────────────────────────────────

@app.route('/api/status')
@login_required
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
@admin_required
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
@admin_required
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
@admin_required
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
@login_required
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
@login_required
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
# Attack data ingestion (saves to both ES and SQLite)
# ─────────────────────────────────────────

@app.route('/api/attacks/ingest', methods=['POST'])
def ingest_attack():
    """Ingest attack data and save to both Elasticsearch and SQLite database."""
    try:
        attack_data = request.get_json()
        if not attack_data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400

        # Save to SQLite database
        db_saved = save_attack_to_db(attack_data)
        
        # Save to Elasticsearch
        index_name = f"honeypot-{attack_data.get('honeypot_type', 'unknown')}-{datetime.now().strftime('%Y.%m.%d')}"
        
        # Create index mapping if it doesn't exist
        mapping = {
            "mappings": {
                "properties": {
                    "@timestamp": {"type": "date"},
                    "src_ip": {"type": "ip"},
                    "geoip": {
                        "properties": {
                            "location": {"type": "geo_point"},
                            "latitude": {"type": "float"},
                            "longitude": {"type": "float"},
                            "country_name": {"type": "keyword"},
                            "city_name": {"type": "keyword"},
                        }
                    },
                    "honeypot_type": {"type": "keyword"},
                    "event_type": {"type": "keyword"},
                    "username": {"type": "keyword"},
                    "password": {"type": "keyword"},
                    "input": {"type": "text", "fields": {"keyword": {"type": "keyword", "ignore_above": 256}}},
                    "http_method": {"type": "keyword"},
                    "request_url": {"type": "keyword"},
                    "message": {"type": "text"}
                }
            }
        }
        
        # Create index with mapping
        requests.put(f'{ES_URL}/{index_name}', json=mapping, timeout=5)
        
        # Index the document
        es_resp = requests.post(f'{ES_URL}/{index_name}/_doc', json=attack_data, timeout=5)
        es_saved = es_resp.status_code in (200, 201)
        
        return jsonify({
            'success': db_saved and es_saved,
            'database_saved': db_saved,
            'elasticsearch_saved': es_saved,
            'index': index_name
        }), 200
        
    except Exception as e:
        print(f"❌ Error ingesting attack data: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ─────────────────────────────────────────
# Attack analytics
# ─────────────────────────────────────────

@app.route('/api/attacks/recent')
@login_required
def get_recent_attacks():
    """50 most-recent attack events from Elasticsearch, with SQLite fallback."""
    try:
        # First try Elasticsearch
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
            attacks = []
            for h in hits:
                src = h.get('_source', {})
                src['id'] = h.get('_id')
                attacks.append(src)
            if attacks:  # If we got data from ES, return it
                return jsonify({'attacks': attacks, 'count': len(attacks), 'source': 'elasticsearch'})
        
        # Fallback to SQLite database
        print("⚠️ Elasticsearch unavailable, falling back to SQLite database")
        attacks = get_attacks_from_db(limit=50)
        return jsonify({'attacks': attacks, 'count': len(attacks), 'source': 'sqlite'})
        
    except Exception as e:
        # Final fallback to SQLite
        print(f"❌ Error querying Elasticsearch: {e}, using SQLite fallback")
        try:
            attacks = get_attacks_from_db(limit=50)
            return jsonify({'attacks': attacks, 'count': len(attacks), 'source': 'sqlite', 'error': str(e)})
        except Exception as db_e:
            return jsonify({'attacks': [], 'count': 0, 'error': f'ES: {str(e)}, DB: {str(db_e)}'})


@app.route('/api/attacks/<int:attack_id>', methods=['DELETE'])
@admin_required
def delete_attack(attack_id):
    """Delete an attack event from the local SQLite database."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT id FROM attacks WHERE id=?', (attack_id,))
        if cursor.fetchone() is None:
            conn.close()
            return jsonify({'success': False, 'error': 'Attack not found'}), 404

        cursor.execute('DELETE FROM attacks WHERE id=?', (attack_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Attack deleted'}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/attacks/top-credentials')
@login_required
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
@login_required
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
@login_required
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
@login_required
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
@login_required
def get_geo_points():
    """Geolocated attack origins for world map plotting from Elasticsearch, with SQLite fallback."""
    try:
        # First try Elasticsearch
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
            if points:  # If we got data from ES, return it
                return jsonify({'points': points, 'source': 'elasticsearch'})
        
        # Fallback to SQLite database
        print("⚠️ Elasticsearch unavailable, falling back to SQLite database for geo points")
        points = get_geo_points_from_db()
        return jsonify({'points': points, 'source': 'sqlite'})
        
    except Exception as e:
        # Final fallback to SQLite
        print(f"❌ Error querying Elasticsearch: {e}, using SQLite fallback")
        try:
            points = get_geo_points_from_db()
            return jsonify({'points': points, 'source': 'sqlite', 'error': str(e)})
        except Exception as db_e:
            return jsonify({'points': [], 'error': f'ES: {str(e)}, DB: {str(db_e)}'})


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
    app.run(host='0.0.0.0', port=5000, debug=FLASK_DEBUG)
