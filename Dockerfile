# Use official Node.js 20 on Debian Bookworm (includes apt-get for installing C++, Python, Java)
FROM node:20-bookworm

# Install OpenJDK 17 (java + javac), Python 3, and build-essential (gcc + g++)
RUN apt-get update && apt-get install -y \
    openjdk-17-jdk \
    python3 \
    python3-pip \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy package definition files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy all application files (server and client static assets)
COPY . .

# Set environment variable defaults if needed (overridden by Render dashboard)
ENV PORT=3000

# Expose the server port
EXPOSE 3000

# Start the Express server
CMD ["npm", "start"]
