# --- STAGE 1: Build the Angular app ---
FROM node:24.13.0-alpine AS build
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build using the specified configuration (default: production)
ARG BUILD_PROFILE=production
RUN npm run build -- --configuration=${BUILD_PROFILE}

# --- STAGE 2: Serve with Nginx ---
FROM nginx:alpine

# Copy the compiled build from the previous stage to Nginx's web root
COPY --from=build /app/dist/applyflow /usr/share/nginx/html

# Copy your custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the entrypoint script that writes config.json from env vars at container startup
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]