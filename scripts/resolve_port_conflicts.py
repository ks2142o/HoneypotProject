#!/usr/bin/env python3
"""Resolve host port conflicts in .env before Docker Compose deployment.

This script checks configured host ports in the environment file. When a port is
already bound (or requires privileged access that the current user does not
have), it remaps that key to a safer high port and writes the updated .env.

Usage:
    python3 scripts/resolve_port_conflicts.py --env-file .env
"""

from __future__ import annotations

import argparse
import socket
from pathlib import Path

PORT_KEYS = [
    "ELASTICSEARCH_PORT",
    "KIBANA_PORT",
    "LOGSTASH_BEATS_PORT",
    "LOGSTASH_API_PORT",
    "WEBAPP_PORT",
    "COWRIE_SSH_PORT",
    "COWRIE_TELNET_PORT",
    "DIONAEA_FTP_PORT",
    "DIONAEA_DAYTIME_PORT",
    "DIONAEA_RPC_PORT",
    "DIONAEA_HTTPS_PORT",
    "DIONAEA_SMB_PORT",
    "DIONAEA_MSSQL_PORT",
    "DIONAEA_MYSQL_PORT",
    "DIONAEA_SIP_PORT",
    "DIONAEA_SIPS_PORT",
    "FLASK_HTTP_PORT",
]


def _is_truthy(value: str) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _load_env(env_path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in env_path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def _write_env(env_path: Path, updates: dict[str, str]) -> None:
    lines = env_path.read_text().splitlines(keepends=True)
    seen: set[str] = set()
    out: list[str] = []

    for raw_line in lines:
        stripped = raw_line.strip()
        if stripped and not stripped.startswith("#") and "=" in stripped:
            key = stripped.split("=", 1)[0].strip()
            if key in updates:
                out.append(f"{key}={updates[key]}\n")
                seen.add(key)
                continue
        out.append(raw_line)

    for key, value in updates.items():
        if key not in seen:
            out.append(f"{key}={value}\n")

    env_path.write_text("".join(out))


def _is_port_bindable(port: int) -> bool:
    """Return True when binding 0.0.0.0:port succeeds in this host namespace."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind(("0.0.0.0", port))
        return True
    except OSError:
        return False
    finally:
        sock.close()


def _next_candidate(current_port: int, used: set[int]) -> int:
    """Prefer high ports to avoid privileged binds and common service collisions."""
    if current_port < 1024:
        candidate = 10000 + current_port
    elif current_port < 10000:
        candidate = current_port + 1000
    else:
        candidate = current_port + 1

    while candidate in used or candidate > 65535 or not _is_port_bindable(candidate):
        candidate += 1
    return candidate


def main() -> int:
    parser = argparse.ArgumentParser(description="Auto-remap conflicted host ports in .env")
    parser.add_argument("--env-file", default=".env", help="Path to environment file")
    args = parser.parse_args()

    env_path = Path(args.env_file)
    if not env_path.exists():
        print(f"[ports] Skip: {env_path} not found")
        return 0

    env = _load_env(env_path)
    if not _is_truthy(env.get("AUTO_REMAP_PORTS_ON_CONFLICT", "1")):
        print("[ports] AUTO_REMAP_PORTS_ON_CONFLICT is disabled; skipping")
        return 0

    used: set[int] = set()
    key_to_port: dict[str, int] = {}
    for key in PORT_KEYS:
        raw = env.get(key)
        if raw is None:
            continue
        try:
            port = int(raw)
        except ValueError:
            continue
        key_to_port[key] = port
        used.add(port)

    updates: dict[str, str] = {}
    changes: list[str] = []

    # First pass: resolve duplicate assignments inside .env
    seen_ports: dict[int, str] = {}
    for key, port in key_to_port.items():
        if port not in seen_ports:
            seen_ports[port] = key
            continue
        new_port = _next_candidate(port, used)
        used.add(new_port)
        updates[key] = str(new_port)
        key_to_port[key] = new_port
        changes.append(f"{key}:{port}->{new_port} (duplicate with {seen_ports[port]})")

    # Second pass: resolve host conflicts
    for key, port in key_to_port.items():
        if key in updates:
            port = int(updates[key])
        if _is_port_bindable(port):
            continue
        new_port = _next_candidate(port, used)
        used.add(new_port)
        updates[key] = str(new_port)
        changes.append(f"{key}:{port}->{new_port} (in use)")

    if not updates:
        print("[ports] No host port conflicts detected")
        return 0

    _write_env(env_path, updates)
    print("[ports] Updated .env mappings:")
    for line in changes:
        print(f"  - {line}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
