#!/bin/sh
set -eu

endpoint=${1:-http://127.0.0.1:18082/v1/health}

# Ignore curlrc/proxy settings and require HTTP 200 without following redirects.
if ! status=$(/usr/bin/curl --disable --silent --show-error \
    --noproxy '*' --connect-timeout 1 --max-time 2 \
    --output /dev/null --write-out '%{http_code}' "$endpoint"); then
    exit 1
fi

if [ "$status" != 200 ]; then
    printf 'API health probe returned HTTP %s\n' "$status" >&2
    exit 1
fi
