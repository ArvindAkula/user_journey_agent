# Multi-stage build for analytics dashboard
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy root package files first for better layer caching
COPY package*.json ./
COPY tsconfig.json ./

# Copy shared library package.json
COPY packages/shared/package*.json ./packages/shared/
COPY packages/analytics-dashboard/package*.json ./packages/analytics-dashboard/

# Install dependencies (this layer will be cached if package files don't change)
RUN npm ci --only=production --no-audit --no-fund

# Copy shared library source
COPY packages/shared ./packages/shared

# Copy analytics dashboard source
COPY packages/analytics-dashboard ./packages/analytics-dashboard

# Build shared library first
WORKDIR /app/packages/shared
RUN npm run build

# Build analytics dashboard with production optimizations
WORKDIR /app/packages/analytics-dashboard
ENV NODE_ENV=production
ENV GENERATE_SOURCEMAP=false
ENV INLINE_RUNTIME_CHUNK=false
RUN npm run build

# Remove development dependencies and clean up
RUN npm prune --production && \
    rm -rf node_modules/.cache && \
    rm -rf /tmp/* /var/cache/apk/*

# Production stage
FROM nginx:alpine AS production

# Install curl for health checks and create non-root user
RUN apk add --no-cache curl && \
    addgroup -g 1001 -S nginx && \
    adduser -u 1001 -S nginx -G nginx

# Copy custom nginx configuration
COPY packages/analytics-dashboard/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application with proper ownership
COPY --from=builder --chown=nginx:nginx /app/packages/analytics-dashboard/build /usr/share/nginx/html

# Add health check script
COPY packages/analytics-dashboard/healthcheck.sh /usr/local/bin/healthcheck.sh
RUN chmod +x /usr/local/bin/healthcheck.sh

# Create nginx directories with proper permissions
RUN mkdir -p /var/cache/nginx /var/log/nginx /var/run && \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx /var/run /etc/nginx/conf.d

# Switch to non-root user
USER nginx

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Graceful shutdown
STOPSIGNAL SIGQUIT

# Start nginx
CMD ["nginx", "-g", "daemon off;"]