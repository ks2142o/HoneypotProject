#!/usr/bin/env python3
"""Resolve Docker bridge subnet overlap issues for this compose project.

If SUBNET in .env overlaps an existing Docker network subnet, this script picks
an available subnet and updates .env before deployment.
"""

from __future__ import annotations

import argparse
import ipaddress
import subprocess
from pathlib import Path


def _load_env(env_path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in env_path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def _write_env_value(env_path: Path, key: str, value: str) -> None:
    lines = env_path.read_text().splitlines(keepends=True)
    out: list[str] = []
    replaced = False

    for raw_line in lines:
        stripped = raw_line.strip()
        if stripped and not stripped.startswith("#") and "=" in stripped:
            current_key = stripped.split("=", 1)[0].strip()
            if current_key == key:
                out.append(f"{key}={value}\n")
                replaced = True
                continue
        out.append(raw_line)

    if not replaced:
        out.append(f"{key}={value}\n")

    env_path.write_text("".join(out))


def _docker_network_ids() -> list[str]:
    result = subprocess.run(
        ["docker", "network", "ls", "-q"],
        capture_output=True,
        text=True,
        check=True,
    )
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def _docker_network_subnets() -> list[ipaddress._BaseNetwork]:
    subnets: list[ipaddress._BaseNetwork] = []
    ids = _docker_network_ids()
    if not ids:
        return subnets

    result = subprocess.run(
        ["docker", "network", "inspect", *ids, "--format", "{{range .IPAM.Config}}{{println .Subnet}}{{end}}"],
        capture_output=True,
        text=True,
        check=True,
    )

    for raw in result.stdout.splitlines():
        subnet = raw.strip()
        if not subnet:
            continue
        try:
            subnets.append(ipaddress.ip_network(subnet, strict=False))
        except ValueError:
            continue
    return subnets


def _candidate_subnets() -> list[ipaddress.IPv4Network]:
    candidates: list[ipaddress.IPv4Network] = []
    for second_octet in (30, 31):
        for third_octet in range(0, 256):
            candidates.append(ipaddress.ip_network(f"172.{second_octet}.{third_octet}.0/24"))
    return candidates


def main() -> int:
    parser = argparse.ArgumentParser(description="Resolve Docker network subnet overlaps in .env")
    parser.add_argument("--env-file", default=".env", help="Path to .env file")
    args = parser.parse_args()

    env_path = Path(args.env_file)
    if not env_path.exists():
        print(f"[network] Skip: {env_path} not found")
        return 0

    env = _load_env(env_path)
    configured = env.get("SUBNET", "172.30.250.0/24")
    try:
        configured_net = ipaddress.ip_network(configured, strict=False)
    except ValueError:
        configured_net = ipaddress.ip_network("172.30.250.0/24", strict=False)

    try:
        existing = _docker_network_subnets()
    except Exception as exc:
        print(f"[network] Docker inspect unavailable, skipping subnet check: {exc}")
        return 0

    overlap = any(configured_net.overlaps(net) for net in existing)
    if not overlap:
        print(f"[network] SUBNET {configured_net} is available")
        return 0

    for candidate in _candidate_subnets():
        if any(candidate.overlaps(net) for net in existing):
            continue
        _write_env_value(env_path, "SUBNET", str(candidate))
        print(f"[network] Updated SUBNET: {configured_net} -> {candidate}")
        return 0

    print("[network] Could not find a non-overlapping subnet automatically")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
