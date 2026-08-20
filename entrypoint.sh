#!/bin/sh
set -e

# Create assets directory if it doesn't exist
mkdir -p /usr/share/nginx/html/assets

# Runtime API configuration
# The actual API URL can be injected here later if needed.
echo '{ "apiUrl": "" }' > /usr/share/nginx/html/assets/config.json

# Keep nginx running in the foreground
exec nginx -g 'daemon off;'