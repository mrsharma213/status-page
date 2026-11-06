#!/bin/sh
# Disabled on purpose.
# This file used to probe local credentials and write status JSON into a
# public git checkout. That path is closed. Do not point it at tokens,
# transcripts, or local disks. Post a sanitized snapshot to the authenticated
# ingest API described in README.md.
echo "collector disabled: this public repository does not store bot snapshots" >&2
exit 1
