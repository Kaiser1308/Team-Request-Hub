#!/usr/bin/env sh
set -eu

git pull --ff-only
docker compose up -d --build
docker compose ps
