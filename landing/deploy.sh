#!/bin/sh
# Builds media/ and deploys the landing page to production (Netlify CLI, logged in).
# The site is given by id (khatwa-medathon); the CLI does not resolve this site by name.
set -eu
cd "$(dirname "$0")"
sh ./media.sh
npx --yes netlify-cli@latest deploy --prod --dir . --site "${LANDING_SITE:-a4096299-85e5-433a-9847-c731d7c171b5}" --message "landing $(git rev-parse --short HEAD)"
