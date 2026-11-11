# Demo video and deck screenshots

Real footage only: every app and Wokwi pixel is a Chromium screencast frame. Cards and caption bands are rendered in IBM Plex Sans Arabic.

```bash
node tools/video/cards.mjs            # title cards + caption bands (APP_URL=… to change the link on the last card)
node tools/video/film.mjs all         # films Wokwi (public project) + the app on the preview link → raw/ + marks.json
python3 tools/video/compose.py        # → deliverables/khatwa-demo.mp4 (1080x1920, 30 fps, H.264)
node tools/video/screens.mjs          # → deliverables/screens/*.png (1290x2796)
```

- Scene 2–3: Wokwi source in demo mode («كل فحص = يوم»): two real firmware scans = day 1 yellow, day 2 orange.
- Scenes 4–6: the simulation source (the Wokwi source is read-only; Rafiq and alerts write events). The banner says «بيانات محاكاة».
- Waiting stretches are sped up and tagged «مسرّع».
- Netlify's preview toolbar is hidden in the footage (it is not part of the app and does not exist in production).
- If a stand stalls (the virtual ESP32's requests stop being answered), `film.mjs` restarts the simulation and retries.
