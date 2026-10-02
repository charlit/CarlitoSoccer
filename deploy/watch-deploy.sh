#!/bin/bash
# Déploiement automatique de Carlito Soccer sur le Mac mini (lancé par cron toutes les 5 minutes).
# S'il y a un nouveau commit sur GitHub : reconstruit l'image, puis remplace le conteneur.
# Si la construction échoue, l'ancien conteneur continue de tourner et on réessaie au passage suivant.
#
# On compare GitHub à un fichier marqueur (.last_deployed), pas au HEAD local : un `git pull` fait
# à la main sans reconstruire l'image ne doit pas faire croire que tout est déjà déployé.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" # cron n'a presque rien dans son PATH (docker, git)

REPO_DIR="$HOME/CarlitoSoccer"
LOG_FILE="$REPO_DIR/deploy/watch-deploy.log"
MARKER_FILE="$REPO_DIR/deploy/.last_deployed"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"; }

cd "$REPO_DIR"
git fetch -q origin main
REMOTE=$(git rev-parse origin/main)
DEPLOYED=$(cat "$MARKER_FILE" 2>/dev/null || echo "")
[ "$DEPLOYED" = "$REMOTE" ] && exit 0

log "Nouveau commit $REMOTE, déploiement..."
git reset -q --hard origin/main
docker build -t carlito-soccer . >> "$LOG_FILE" 2>&1
docker rm -f carlito-soccer >> "$LOG_FILE" 2>&1 || true
docker run -d --name carlito-soccer --restart unless-stopped -p 8086:8080 carlito-soccer >> "$LOG_FILE" 2>&1
echo "$REMOTE" > "$MARKER_FILE"
log "Déployé : $(git log --oneline -1)"
