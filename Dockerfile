FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy lockfile first for layer caching
COPY package*.json ./

# Install dependencies reproducibly (fails if lockfile is out of sync)
RUN npm ci --ignore-scripts

# Copy source code (node_modules excluded via .dockerignore)
COPY . .

# Build the application
RUN npm run build

# Use nginx to serve the static files
FROM nginx:alpine

# Remove default nginx config and add custom SPA config
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Run nginx as non-root (nginx user already exists in nginx:alpine)
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

USER nginx

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
