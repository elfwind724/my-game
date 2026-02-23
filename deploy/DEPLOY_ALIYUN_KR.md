# Aliyun Korea Server Deploy Guide

This project can be deployed as a static site to your Aliyun Korea server with Nginx.

## Files

- Script: `deploy/deploy_aliyun_kr.sh`
- This guide: `deploy/DEPLOY_ALIYUN_KR.md`

## Prerequisites

1. Local machine:
   - Node.js + npm
   - `ssh` and `rsync`
2. Server:
   - Nginx installed
   - Port 80 open in security group
3. SSH key login recommended

## One-command deploy

From project root:

```bash
bash deploy/deploy_aliyun_kr.sh <server_ip> [server_user] [remote_dir]
```

Example:

```bash
bash deploy/deploy_aliyun_kr.sh 47.XX.XX.XX root /var/www/my-game
```

The script will:

1. Build (`npm run build`)
2. Upload `dist/` to server
3. Write Nginx config
4. Reload Nginx

## First-time server setup (if nginx not installed)

Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

## HTTPS (recommended)

If you bind a domain, install certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Troubleshooting

1. Nginx test failed:
   - Run `sudo nginx -t` and fix syntax.
2. Cannot access from browser:
   - Check security group inbound rules for 80/443.
   - Check firewall (`ufw status`).
3. White screen after deploy:
   - Ensure `location /` has `try_files $uri $uri/ /index.html;`
   - Browser hard refresh.
