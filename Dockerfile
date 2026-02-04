FROM node:20-alpine

WORKDIR /app

# Install OpenSSL and PostgreSQL client for Prisma
RUN apk add --no-cache openssl postgresql-client curl

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install --legacy-peer-deps

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY src ./src/

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application with migrations
CMD sh -c "npx prisma migrate deploy && node dist/src/main.js"
