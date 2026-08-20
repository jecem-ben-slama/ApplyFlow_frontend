#!/bin/sh
set -e

# Replace $PORT placeholder in nginx.conf with the actual PORT environment variable assigned by Vercel
envsubst '$PORT' < /etc/nginx/nginx.conf > /etc/nginx/nginx.conf.optimized
mv /etc/nginx/nginx.conf.optimized /etc/nginx/nginx.conf

# Same-origin setup: frontend nginx proxies /api, /oauth2, /login to the backend
mkdir -p /usr/share/nginx/html/assets
echo '{ "apiUrl": "" }' > /usr/share/nginx/html/assets/config.json

exec nginx -g 'daemon off;'