FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY tester/server/package*.json ./tester/server/

# Install dependencies
WORKDIR /app/tester/server
RUN npm ci --only=production

# Copy server source
COPY tester/server/src ./src
COPY tester/server/tsconfig.json ./

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3001

# Start server
CMD ["node", "dist/index.js"]
