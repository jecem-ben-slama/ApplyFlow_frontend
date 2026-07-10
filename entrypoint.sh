#!/bin/sh
set -e

# Same-origin setup: frontend nginx proxies /api, /oauth2, /login to the
# backend, so Angular always calls its own origin. apiUrl stays empty.
echo '{ "apiUrl": "" }' > /usr/share/nginx/html/assets/config.json

exec nginx -g 'daemon off;'