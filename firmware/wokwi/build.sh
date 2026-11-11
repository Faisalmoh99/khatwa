#!/usr/bin/env bash
# Builds the REAL mat sketch (../khatwa_esp32, copied unchanged) with the Wokwi secrets.h.
set -euo pipefail
cd "$(dirname "$0")"
[ -f secrets.h ] || { echo "Copy secrets.example.h to secrets.h and set DEVICE_PASSWORD"; exit 1; }
rm -rf build && mkdir -p build/src/khatwa_esp32
cp ../khatwa_esp32/khatwa_esp32.ino ../khatwa_esp32/config.h ../khatwa_esp32/khatwa_core.h ../khatwa_esp32/khatwa_json.h build/src/khatwa_esp32/
cp secrets.h build/src/khatwa_esp32/secrets.h
arduino-cli compile --fqbn esp32:esp32:esp32 --output-dir build build/src/khatwa_esp32
rm -rf build/src   # keep the demo password out of anything but secrets.h
