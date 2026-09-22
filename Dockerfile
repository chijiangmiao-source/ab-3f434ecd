# syntax=docker/dockerfile:1

# ---- 构建阶段：TypeScript 类型检查 + Vite 生产构建（纯静态产物） ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- 发布阶段：nginx 仅托管静态文件，无业务后端 ----
FROM nginx:1.27-alpine AS web
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=5s --timeout=3s --retries=10 \
  CMD wget -q -O - http://localhost/healthz || exit 1
