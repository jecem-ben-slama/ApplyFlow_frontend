#!/bin/sh
set -e

# Replace $PORT placeholder in nginx.conf with the actual PORT environment variable assigned by Vercel
envsubst '$PORT' < /etc/nginx/nginx.conf > /etc/nginx/nginx.conf.optimized
mv /etc/nginx/nginx.conf.optimized /etc/nginx/nginx.conf

# Same-origin setup: frontend nginx proxies /api, /oauth2, /login to the backend
echo '{ "apiUrl": "" }' > /usr/share/nginx/html/assets/config.json

# If Vercel injects a dynamic $PORT environment variable, you can optionally 
# have Nginx listen to it dynamically here, or rely on port 80 mapping.
# For standard Vercel container runtimes, starting nginx directly works cleanly:
exec nginx