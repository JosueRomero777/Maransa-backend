FROM node:20-alpine

WORKDIR /app

# Install OpenSSL and PostgreSQL client for Prisma and wait script
RUN apk add --no-cache openssl postgresql-client

# Copy all files
COPY . .

# Make wait script executable
RUN chmod +x wait-for-postgres.sh

# Install dependencies with legacy peer deps flag
RUN npm install --legacy-peer-deps

# Generate Prisma Client
RUN npx prisma generate

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Wait for postgres, run migrations, and start app
# Run migrations and start application
CMD sh -c "npx prisma migrate deploy && node dist/main.js"
