# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY ./src ./src
COPY vite.config.js .

# Build the application
RUN npm run build

# Production stage
FROM nginx:stable-alpine

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Move the customized nginx config file to the nginx folder
RUN mv /usr/share/nginx/html/.docker/default.conf /etc/nginx/conf.d/default.conf
