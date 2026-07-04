#!/bin/sh
set -e

echo "{\"apiUrl\": \"${API_URL}\"}" > /usr/share/nginx/html/assets/config.json

exec nginx -g 'daemon off;'