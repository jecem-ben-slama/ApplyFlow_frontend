#!/bin/sh
set -e

echo "=========================================="
echo "ApplyFlow container starting..."
echo "PORT=${PORT}"
echo "=========================================="

# Make sure runtime assets directory exists
mkdir -p /usr/share/nginx/html/assets

# Runtime configuration
echo '{ "apiUrl": "" }' > /usr/share/nginx/html/assets/config.json

echo "Generating nginx configuration..."

envsubst '${PORT}' \
    < /etc/nginx/nginx.conf \
    > /tmp/nginx.conf

echo "Testing nginx configuration..."

nginx -t -c /tmp/nginx.conf

echo "=========================================="
echo "Nginx configuration is valid."
echo "Starting nginx on port ${PORT}..."
echo "=========================================="

exec nginx -c /tmp/nginx.conf -g 'daemon off;'