#!/bin/bash

echo 1 - Kill and remove the docker container called buddy-bot
docker rm -f buddy-bot

echo 2 - Pull the latest changes from the repo
git pull

echo 3 - Build a new container called buddy-bot
docker build -t buddy-bot .

echo 4 - Run the just built container as buddy-bot with restart-always
docker run -d --restart=always --name buddy-bot buddy-bot