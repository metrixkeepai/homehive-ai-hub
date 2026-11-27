FROM node:24.22.3-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54
WORKDIR /app
RUN apt-get update && apt-get install --no-install-recommends -y python3 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package-lock.json /tmp/matrixkeep-package-lock.json
RUN node -e "const p=require('/tmp/matrixkeep-package-lock.json').packages['node_modules/postgres'];require('fs').writeFileSync('package.json',JSON.stringify({dependencies:{postgres:p.version}}));require('fs').writeFileSync('package-lock.json',JSON.stringify({lockfileVersion:3,packages:{'':{dependencies:{postgres:p.version}},'node_modules/postgres':p}}))" && npm ci --omit=dev --ignore-scripts
COPY server/email/ ./server/email/
ADD --chmod=0444 https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt /app/supabase-db-ca.crt
USER node
CMD ["node","server/email/start.mjs"]
