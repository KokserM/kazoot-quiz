# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

# Install dependencies
RUN cd frontend && npm install
RUN cd backend && npm install

# Copy source code
COPY . .

# Build frontend
RUN cd frontend && npm run build

# Expose port
EXPOSE 5000

# Start the application
CMD ["node", "backend/server.js"] 