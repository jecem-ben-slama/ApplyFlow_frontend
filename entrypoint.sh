#!/bin/sh
set -e

# Replace $PORT placeholder in nginx.conf with the actual PORT environment variable assigned by Vercel
envsubst '$PORT' < /etc/nginx/nginx.conf > /etc/nginx/nginx.conf.optimized
mv /etc/nginx/nginx.conf.optimized /etc/nginx/nginx.conf

# Ensure the assets directory exists before writing to it
# (prevents entrypoint from crashing -> nginx never starting -> 500 on every request)
mkdir -p /usr/share/nginx/html/assets

# Same-origin setup: frontend nginx proxies /api, /oauth2, /login to the backend
echo '{ "apiUrl": "" }' > /usr/share/nginx/html/assets/config.json

exec nginx -g 'daemon off;'