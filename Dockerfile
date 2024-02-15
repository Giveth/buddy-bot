# Use an official Node.js runtime as the base image
FROM node:18

# Set the working directory in the container to /app
WORKDIR /app

# Copy the package.json and package-lock.json to the container
COPY package*.json ./

# Install the bot's dependencies inside the container
RUN npm install

# Copy the rest of the bot's files to the container
COPY . .

# Specify the command to run when the container starts
CMD ["node", "src/mainBot.js"]
