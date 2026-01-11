# Admin Portal Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create a simple health check file
RUN echo "OK" > /usr/share/nginx/html/health.txt

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
