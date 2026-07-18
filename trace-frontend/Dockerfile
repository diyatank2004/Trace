# trace-frontend/Dockerfile
# ---- Build stage ----
FROM node:20-alpine AS build

WORKDIR /app

# Build-time API URL. Wire this into src/lib/kanbanApi.ts and src/lib/sprintApi.ts
# via import.meta.env.VITE_API_BASE_URL instead of the current hardcoded localhost:8000.
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Serve stage ----
FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html

# SPA fallback so client-side routes (React Router / App.tsx routing) don't 404 on refresh
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://localhost:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]
