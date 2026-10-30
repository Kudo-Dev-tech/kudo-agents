# The launcher needs two tools beside node: cast, to fund wallets and register
# identities, and the docker CLI, to start agent containers on this host's
# daemon (through the mounted socket). Both are copied from their official
# images rather than installed at runtime.
#
# Pin the Foundry digest to the one ../kudo-agent/Dockerfile uses, so the
# launcher and its agents speak the same cast.
FROM ghcr.io/foundry-rs/foundry:stable@sha256:043752653d5be351c71709091b3db97c4421c907eb40ea294195e7f532aadf46 AS foundry
FROM docker:27-cli AS docker

FROM node:22-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY --from=foundry /usr/local/bin/cast /usr/local/bin/cast
COPY --from=docker /usr/local/bin/docker /usr/local/bin/docker

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src ./src

RUN cast --version && docker --version

ENV NODE_ENV=production
EXPOSE 8080
ENTRYPOINT ["./node_modules/.bin/tsx", "src/main.ts"]
