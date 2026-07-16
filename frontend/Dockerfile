# Build Stage
FROM node:22-slim AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps
ARG CACHEBUST
COPY frontend/ ./
RUN npm run build && npm cache clean --force

# Production Stage
FROM nginxinc/nginx-unprivileged:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
