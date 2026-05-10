#!/usr/bin/env bash
# supabase-baseline.sh — gera baseline migration do schema public via supabase CLI.
# Output: supabase/migrations/<timestamp>_baseline.sql na raiz do repo.
# Não aplica nada; só dump local pra revisão e commit.
set -euo pipefail
TIMESTAMP=$(date -u +"%Y%m%d%H%M%S")
OUT_DIR="$(cd "$(dirname "$0")/../.." && pwd)/supabase/migrations"
mkdir -p "$OUT_DIR"
OUT_FILE="$OUT_DIR/${TIMESTAMP}_baseline.sql"

# Usa supabase CLI se disponível
if command -v supabase >/dev/null 2>&1; then
  echo "Usando supabase CLI..."
  supabase db dump --schema public -f "$OUT_FILE" "$@"
else
  echo "supabase CLI não encontrado. Instale via: brew install supabase/tap/supabase"
  echo "Alternativa: defina SUPABASE_DB_URL e rode pg_dump --schema-only --no-owner --no-privileges"
  exit 1
fi

echo "Baseline gravado: $OUT_FILE"
echo "Próximo passo: revisar e commitar."
