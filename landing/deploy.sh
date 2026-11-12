#!/bin/sh
# Builds media/ and deploys the landing page to production (Netlify CLI, logged in).
set -eu
cd "$(dirname "$0")"
sh ./media.sh
npx --yes netlify-cli@latest deploy --prod --dir . --site "${LANDING_SITE:-khatwa-medathon}" --message "landing $(git rev-parse --short HEAD)"
