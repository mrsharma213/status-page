#!/bin/sh
# Disabled on purpose.
# This file used to append activity lines into a public JSON file. That path
# is closed. Use the authenticated ingest API in README.md.
echo "collector disabled: this public repository does not store bot snapshots" >&2
exit 1
