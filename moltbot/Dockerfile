# OpenClaw Gateway Container
# Built from source: https://github.com/openclaw/openclaw

FROM node:22-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Enable corepack
RUN corepack enable

# Set working directory
WORKDIR /app

# Clone openclaw from GitHub
RUN git clone --depth 1 https://github.com/openclaw/openclaw.git .

# Use the repo's pinned pnpm version when available
RUN corepack prepare "$(node -p 'require("./package.json").packageManager || "pnpm@9"')" --activate

# Install dependencies
RUN pnpm install

# Build the project
RUN pnpm build

# Create config directory
RUN mkdir -p /root/.openclaw

# Copy configuration
COPY config/openclaw.json /root/.openclaw/openclaw.json

# Expose Gateway port
EXPOSE 18789

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:18789/health || exit 1

# Start Gateway (gateway:dev skips channel integrations)
CMD ["pnpm", "run", "gateway:dev"]
