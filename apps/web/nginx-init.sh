#!/bin/sh
# 运行时替换 nginx 代理目标：默认 campaignreport-server:4000（docker-compose 兼容），
# K8s 部署时通过 API_UPSTREAM 环境变量注入 Service DNS 名。
set -e
UPSTREAM="${API_UPSTREAM:-campaignreport-server:4000}"
echo "[nginx-init] API upstream -> $UPSTREAM"
sed -i "s|__API_UPSTREAM__|$UPSTREAM|g" /etc/nginx/conf.d/default.conf
exec nginx -g "daemon off;"
