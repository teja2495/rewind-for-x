#!/bin/sh
# Packages only the files the extension needs into dist/ for Chrome Web Store upload.
set -e
cd "$(dirname "$0")"
version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.json)
mkdir -p dist
out="dist/rewind-for-x-$version.zip"
rm -f "$out"
zip -q -r "$out" manifest.json content-script.js icons -x '.*'
echo "$out"
