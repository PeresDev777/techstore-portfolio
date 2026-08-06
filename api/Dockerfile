# ---------------------------------------------------------------------------
# Build multi-estagio.
#
# A imagem final NAO contem codigo TypeScript, devDependencies, cache do npm nem
# o compilador. Isso nao e so economia de disco: cada pacote que sobra na imagem
# de producao e superficie de ataque a mais e um CVE a mais para responder.
# ---------------------------------------------------------------------------

# Debian slim e nao Alpine, apesar de Alpine ser ~30 MB menor.
#
# O projeto tem DUAS dependencias nativas: os engines do Prisma e o bcrypt. Ambas
# distribuem binarios prontos para glibc; o Alpine usa musl, onde o bcrypt precisaria ser
# COMPILADO (python3 + make + g++ dentro da imagem) e o Prisma exigiria declarar o
# binaryTarget musl correto. Trinta megabytes nao pagam uma classe inteira de falha de
# build que so aparece no CI.
FROM node:22-bookworm-slim AS base
# libssl e ca-certificates: exigidos pelo query engine do Prisma.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# --- Estagio 1: dependencias ------------------------------------------------
# Copiamos apenas os manifestos ANTES do codigo. Enquanto package-lock.json nao
# mudar, o Docker reaproveita esta camada em cache e pula o `npm ci` inteiro —
# a diferenca entre um rebuild de 5 segundos e um de 2 minutos.
FROM base AS deps
COPY package*.json ./
# O schema precisa existir antes do `npm ci` por causa do postinstall do Prisma.
COPY prisma ./prisma
RUN npm ci

# --- Estagio 2: build -------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build \
  && npm prune --omit=dev \
  && npx prisma generate

# --- Estagio 3: migrador ----------------------------------------------------
#
# Estagio separado, de vida curta, que aplica migrations e semeia o banco.
#
# Por que ele existe: a imagem de PRODUCAO nao consegue semear. O seed roda via `tsx`,
# uma devDependency que o `npm prune --omit=dev` remove — e remove com razao, porque
# ferramenta de desenvolvimento nao pertence a uma imagem de producao.
#
# Descoberto rodando `docker compose up` pela primeira vez: a pilha subia, a API
# respondia, e o catalogo vinha vazio. O Dockerfile estava correto sobre o que NAO levar
# para producao, e omisso sobre quem faria o trabalho que sobrou.
#
# Reaproveita o `node_modules` COMPLETO do estagio `deps` (antes do prune) e acrescenta o
# `src`, de onde o seed importa a massa de contrato.
FROM base AS migrator
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json tsconfig*.json ./
COPY prisma ./prisma
COPY src ./src
USER node
CMD ["sh", "-c", "npx prisma migrate deploy && npm run db:seed"]

# --- Estagio 4: runtime -----------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./

# A imagem node ja traz o usuario `node` sem privilegios. Rodar como root dentro
# do container transforma qualquer RCE na aplicacao em root no container.
USER node

EXPOSE 3000
CMD ["node", "dist/main.js"]
