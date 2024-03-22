#!/bin/bash

# ANSI escape code for magenta
MAGENTA='\033[0;35m'
# ANSI escape code to reset color
NC='\033[0m'

echo -e "${MAGENTA}1 - Kill and remove the docker container called buddy-bot${NC}"
docker rm -f buddy-bot

echo -e "${MAGENTA}2 - Pull the latest changes from the repo${NC}"
git pull

echo -e "${MAGENTA}3 - Build a new container called buddy-bot${NC}"
docker build -t buddy-bot .

echo -e "${MAGENTA}4 - Run the just built container as buddy-bot with restart-always${NC}"
docker run -d --restart=always --name buddy-bot buddy-bot