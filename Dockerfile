# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY ./src ./src
COPY ./public ./public
COPY vite.config.js .

# Build the application
RUN npm run build

# Production stage
FROM nginx:stable-alpine

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy the customized nginx config file to the nginx folder
COPY .docker/default.conf /etc/nginx/conf.d/default.conf
