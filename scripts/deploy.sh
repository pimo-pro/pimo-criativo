#!/bin/bash
# Deploy para Hostinger
# Uso: ./scripts/deploy.sh [version]
# Se version não for passado, gera vYYYY.MM.DD-HHMM

set -e

VERSION="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

# Gerar versão se não fornecida
if [ -z "$VERSION" ]; then
  VERSION="v$(date +%Y.%m.%d-%H%M)"
fi

echo "=== Deploy PIMO ==="
echo "Versão: $VERSION"
echo ""

# 1. Instalar dependências
echo "[1/4] npm install"
cd "$ROOT"
npm install

# 2. Gerar version.json
echo "[2/4] version.json"
node scripts/write-version.mjs "$VERSION"

# 3. Build
echo "[3/4] npm run build"
npm run build

# 4. Enviar para Hostinger
# TODO: Configurar FTP/SFTP ou usar GitHub Action
# Ex.: lftp -c "open -u $FTP_USER,$FTP_PASS $FTP_HOST; mirror -R dist/ /public_html/"
echo "[4/4] Upload para servidor"
echo "TODO: Configurar upload (FTP/SFTP). O GitHub Action .github/workflows/deploy.yml faz o deploy automático no push para main."
echo "Para deploy manual, copie o conteúdo de dist/ para o servidor."

echo ""
echo "Build concluído. Versão: $VERSION"
