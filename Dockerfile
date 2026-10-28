# Uma imagem para o painel e o worker. No Easypanel, crie dois serviços apontando para este repositório:
#   tribo (painel):  comando padrão
#   tribo-worker:    comando "npm run worker"
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=3000 UPLOAD_DIR=/app/uploads
EXPOSE 3000
CMD ["npm", "start"]
