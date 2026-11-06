#!/bin/sh
# Disabled on purpose.
# This file used to copy workspace notes into activity-log.json in a public
# git checkout. That path is closed. This app does not read bot transcripts.
# Post a sanitized snapshot to the authenticated ingest API in README.md.
echo "collector disabled: this public repository does not store bot snapshots" >&2
exit 1
