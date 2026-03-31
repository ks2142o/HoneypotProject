#!/bin/sh
# Dionaea Entrypoint Wrapper
# Ensures all required data directories exist before Dionaea starts
# Fixes issue: Named volume not initialized due to bind mount shadowing

set -e

# Ensure all required directories exist in the bind-mounted volume
mkdir -p /opt/dionaea/var/lib/dionaea/ftp/root
mkdir -p /opt/dionaea/var/lib/dionaea/tftp/root
mkdir -p /opt/dionaea/var/lib/dionaea/http/root
mkdir -p /opt/dionaea/var/lib/dionaea/sip
mkdir -p /opt/dionaea/var/lib/dionaea/printer/root
mkdir -p /opt/dionaea/var/lib/dionaea/binaries
mkdir -p /opt/dionaea/var/log/dionaea

# Fix ownership if needed (Dionaea runs as 'dionaea' user)
chown -R dionaea:dionaea /opt/dionaea/var/lib/dionaea 2>/dev/null || true
chown -R dionaea:dionaea /opt/dionaea/var/log/dionaea 2>/dev/null || true

# Execute original Dionaea entrypoint
# Note: This allows environment variables DIONAEA_FORCE_INIT, DIONAEA_SKIP_INIT, etc. to still work
exec /usr/local/sbin/entrypoint.sh "$@"
