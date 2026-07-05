#!/bin/bash
# Pipeline do dashboard Instagram — Grupo A.M. Gomes
# Uso: bash atualizar_instagram.sh
# Exit: 0=ok · 10=coleta falhou (dados anteriores preservados) · 30=lock ativo

set -u
DIR="/Users/elkgomes/Desktop/claude/instagram-analytics"
LOCK="/tmp/instagram_update.lock"
LOG="$DIR/ultima_execucao.log"

# ── Lock ──
if [ -e "$LOCK" ]; then
  PID=$(cat "$LOCK" 2>/dev/null)
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "❌ Outra execução em andamento (PID $PID). Abortando." | tee "$LOG"
    exit 30
  fi
  rm -f "$LOCK"
fi
echo $$ > "$LOCK"
trap 'rm -f "$LOCK"' EXIT

cd "$DIR" || exit 10

{
  echo "═══ Atualização Instagram — $(date '+%d/%m/%Y %H:%M:%S') ═══"

  # ── Coleta (dados.js só é sobrescrito se a coleta funcionar) ──
  if ! node coleta_instagram.mjs; then
    echo "❌ Coleta falhou (exit 10). dados.js anterior preservado."
    # Notificar falha via osascript (notificação local do macOS)
    osascript -e 'display notification "Coleta do Instagram falhou — dashboard com dados antigos" with title "⚠️ Instagram Analytics"' 2>/dev/null
    exit 10
  fi

  # ── Commit e push (git = fonte da verdade; GitHub Pages serve o último push) ──
  if [ -d .git ]; then
    git add -A
    if ! git diff --cached --quiet; then
      git commit -m "Atualização automática $(date '+%d/%m/%Y %H:%M')" --quiet
      if git push --quiet 2>&1; then
        echo "✅ Push feito — GitHub Pages vai servir a nova versão."
      else
        echo "⚠️ Push falhou — commit local feito, tentar push manual."
      fi
    else
      echo "ℹ️ Sem mudanças para commitar."
    fi
  fi

  echo "✅ Concluído $(date '+%H:%M:%S')"
} 2>&1 | tee "$LOG"

exit 0
