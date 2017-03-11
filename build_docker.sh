#!/bin/bash

cd "$(dirname "$0")"

exec docker build -t cardinal:latest -f Dockerfile .
