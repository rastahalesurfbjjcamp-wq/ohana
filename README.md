# Rasta Hale Hub

O nome aparece como "{nome da loja} Hub" (variável STORE_NAME), para o mesmo sistema servir outras lojas depois.

Sistema de gestão da Rasta Hale. Esta é a **etapa 1**: WhatsApp e grupos, relatório diário e comandos no grupo de resultados.

## O que já funciona

- **Grupos**: lê todos os grupos do número conectado, mostra a lotação e o link de convite. Você marca quais são da comunidade e qual é o grupo de resultados.
- **Entradas e saídas**: registra quem entrou, saiu e voltou. Quem sai recebe uma mensagem no privado com o link para voltar (texto e tempo de espera configuráveis; não manda para quem foi removido por admin).
- **Agendamentos**: mensagens com texto, foto, vídeo ou PDF para vários grupos, marcando todos, com repetição diária ou semanal.
- **Relatório diário** no grupo de resultados no horário escolhido (padrão 22h): faturamento, pedidos, anúncios, lucro, conversão, produto campeão e uma dica da IA. Resumo semanal opcional.
- **Comandos no grupo de resultados**, por texto ou áudio, só dos números autorizados:
  - “relatório de ontem”, “como foi a semana”, “resultado do mês”
  - “lança 89 reais da ferramenta X todo mês” (custo fixo, entra inteiro no mês)
  - “200 unidades da Pura por 11 mil” (lote: o sistema divide e liga o custo por peça aos produtos com “pura” no nome)
  - Todo lançamento pede confirmação: responda **ok** ou **não**.
- **Custos e lotes** pelo painel, com imposto, taxas e embalagem configurados uma vez.
- **Proteção do número**: limite de mensagens por hora e intervalo aleatório entre envios.
- Dois acessos (administrador e equipe).

## Como subir no Easypanel (VPS da Hostinger)

1. No Easypanel, crie um projeto **hub**.
2. Adicione os serviços prontos:
   - **Postgres** chamado `hub-postgres`. Depois de criado, abra o console dele e rode `CREATE DATABASE evolution;` (a Evolution usa um banco separado).
   - **Redis** chamado `hub-redis`.
3. **Evolution API**: adicione o modelo “Evolution API” do Easypanel (ou um app com a imagem `evoapicloud/evolution-api`). Use o banco `evolution` do Postgres acima e o Redis. Defina a `AUTHENTICATION_API_KEY` direto nas variáveis dele. Coloque o domínio, por exemplo `api.rastahalehub.com.br`.
4. **Painel**: novo app `hub`, origem **GitHub** `rastahalesurfbjjcamp-wq/ohana`, branch `main`, build por **Dockerfile**.
   - Cole as variáveis do arquivo `.env.example` em *Environment*, preenchendo as chaves ali mesmo.
   - Porta 3000. Domínio `rastahalehub.com.br`.
   - Em *Mounts*, crie um volume em `/app/uploads` (fotos e vídeos dos agendamentos).
5. **Worker**: novo app `hub-worker`, mesmo repositório e mesmas variáveis, com o comando de início `npm run worker`. Não precisa de domínio.
6. Abra o painel, entre com o e-mail e a senha de `ADMIN_EMAIL` e `ADMIN_PASSWORD`, vá em **Configurações**, clique em **Conectar WhatsApp** e leia o QR code com o celular do número que está nos grupos.
7. Em **Grupos** aparecem todos os grupos desse número. Marque os da comunidade e escolha o grupo de resultados. Os demais ficam de fora.
8. Em **Configurações > Acessos**, coloque o WhatsApp de quem pode dar comandos no grupo de resultados.

O banco é criado e atualizado sozinho quando o painel inicia (`prisma db push`).

## Desenvolvimento

```bash
npm install
cp .env.example .env   # preencha
npm run dev            # painel em http://localhost:3000
npm run worker         # em outro terminal
```

Estrutura: `src/lib` (integrações e regras), `src/app` (telas e webhook), `src/worker` (tarefas em segundo plano), `prisma/schema.prisma` (banco).

## Próximas etapas

1. Leads da página do Grupo VIP, disparos e vendas por origem (UTM).
2. Recuperação de carrinho, Pix e cartão; pedidos e entregas.
3. Financeiro, produtos e lucro, estoque.
4. CRM, calendário, diagnóstico com IA, pós-venda e o restante.
