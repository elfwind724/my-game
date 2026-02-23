#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   bash deploy/deploy_aliyun_kr.sh <server_ip> [server_user] [remote_dir]
#
# Example:
#   bash deploy/deploy_aliyun_kr.sh 8.8.8.8 root /var/www/my-game

SERVER_IP="${1:-}"
SERVER_USER="${2:-root}"
REMOTE_DIR="${3:-/var/www/my-game}"

if [[ -z "$SERVER_IP" ]]; then
  echo "Error: missing server ip"
  echo "Usage: bash deploy/deploy_aliyun_kr.sh <server_ip> [server_user] [remote_dir]"
  exit 1
fi

echo "[1/5] Build project..."
npm run build

echo "[2/5] Ensure remote dir exists..."
ssh "${SERVER_USER}@${SERVER_IP}" "mkdir -p ${REMOTE_DIR}"

echo "[3/5] Upload dist/ ..."
rsync -avz --delete dist/ "${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR}/"

echo "[4/5] Write nginx config on server..."
NGINX_CONF_PATH="/etc/nginx/sites-available/my-game"
ssh "${SERVER_USER}@${SERVER_IP}" "bash -s" <<EOF
set -euo pipefail
cat > "${NGINX_CONF_PATH}" <<'CONF'
server {
  listen 80;
  server_name _;

  root ${REMOTE_DIR};
  index index.html;

  location / {
    try_files \$uri \$uri/ /index.html;
  }

  gzip on;
  gzip_types text/plain text/css application/javascript application/json image/svg+xml;
}
CONF

if [ ! -e /etc/nginx/sites-enabled/my-game ]; then
  ln -s "${NGINX_CONF_PATH}" /etc/nginx/sites-enabled/my-game
fi

nginx -t
systemctl reload nginx
EOF

echo "[5/5] Done."
echo "Open: http://${SERVER_IP}"
