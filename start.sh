#!/bin/sh
# Sobe o banco, cria os acessos, inicia o worker em segundo plano e o painel.
set -e
npx prisma db push --skip-generate
npx tsx prisma/seed.ts
if [ "${RUN_WORKER:-1}" = "1" ]; then
  (while true; do npx tsx src/worker/index.ts; echo "worker parou, reiniciando em 5s"; sleep 5; done) &
fi
exec npx next start -p "${PORT:-3000}"
