# Official Playwright image, pinned to the @playwright/test version in package.json
# (1.58.2). If that version changes, change this tag with it: the image's
# preinstalled browsers must match the library.
FROM mcr.microsoft.com/playwright:v1.58.2-noble

ENV HUSKY=0 \
    CI=1 \
    npm_config_fund=false \
    npm_config_update_notifier=false

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages ./packages
COPY scripts ./scripts
RUN npm ci

COPY . .

# Production build with the web-llm fake, so the import specs can reach their
# AI-gated flows; see vite.docker.config.js for the two changes it makes.
RUN npx vite build --mode e2e --config tools/device-lab/docker/vite.docker.config.js

CMD ["node", "tools/device-lab/docker/container-run.mjs"]
