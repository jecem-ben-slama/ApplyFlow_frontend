#!/bin/sh
set -e

# Same-origin setup: frontend nginx proxies /api, /oauth2, /login to the
# backend, so Angular always calls its own origin. apiUrl stays empty.
echo '{ "apiUrl": "" }' > /usr/share/nginx/html/assets/config.json

# If Vercel injects a dynamic $PORT environment variable, you can optionally 
# have Nginx listen to it dynamically here, or rely on port 80 mapping.
# For standard Vercel container runtimes, starting nginx directly works cleanly:
exec nginx