#!/bin/bash
# Install Node.js dependencies for Codex environment

# check network connectivity to npm registry
if curl -s --head https://registry.npmjs.org >/dev/null; then
  echo "Installing dependencies..."
  npm install --silent
else
  echo "Network unavailable. Skipping npm install." >&2
fi
