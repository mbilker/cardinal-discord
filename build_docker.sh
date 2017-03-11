#!/bin/bash

cd "$(basename "$0")"

exec docker build -t cardinal:latest -f Dockerfile .
