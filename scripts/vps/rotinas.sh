#!/usr/bin/env bash
# Executa uma tarefa da função "rotinas" (chamado pelo cron).
# Uso: scripts/vps/rotinas.sh notificacoes|lembretes|relatorio_mensal|limpeza
source "$(dirname "$(readlink -f "$0")")/comum.sh"

TAREFA="${1:-}"
case "$TAREFA" in
  notificacoes|lembretes|relatorio_mensal|limpeza) ;;
  *) morrer "uso: $0 notificacoes|lembretes|relatorio_mensal|limpeza" ;;
esac

garantir_pastas
exec 9>"$ESTADO_DIR/rotinas-$TAREFA.lock"
flock -n 9 || { log "$TAREFA ainda em execução; pulando"; exit 0; }

if SAIDA="$(chamar_rotinas "{\"tarefa\":\"$TAREFA\"}" 2>&1)"; then
  log "$TAREFA: $SAIDA"
else
  morrer "$TAREFA: $SAIDA"
fi
