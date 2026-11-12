# Code review findings (before the web/ rebuild)

Summary of the earlier review of the prototype. Each item is mapped to where it is addressed in [PLAN_WEB.md](PLAN_WEB.md).

| # | Finding | Status / where |
|---|---|---|
| R1 | Firebase rules let any anonymous visitor delete `scans`, forge readings, or create fake devices. | Phase 4: rules hardening (device-only writes for status/live/scans, append-only events/photos, type validation, no extra fields). Tested on the emulator, deployed only after approval. |
| R2 | Whole-foot warming is rejected as a posture error (`allsites`). Possible missed alert. | **Waiting for Nouran.** Isolated behind `POLICY.allSitesHot` in `web/src/lib/rules/rules.ts`, with `test.todo` for the alternative. |
| R3 | `app/index.html` does not use `rules.js` (two rule engines). | The new app uses `rules.ts` only. A parity test runs the same cases against `app/js/rules.js`. |
| R4 | `app/dev/live.html` uses `innerHTML` with `scan.source` (injection). | The new app never uses `innerHTML` (ESLint rule). `live.html` gets a small surgical fix in phase 4. |
| R5 | `buildDays` keeps the last valid scan of the day, so a hot morning reading is lost if the evening one is normal. | **Waiting for Nouran.** Isolated behind `POLICY.dayPick`, with `test.todo`. |
| R6 | `init()` in `khatwa-firebase.js` does not retry if sign-in fails. | `FirebaseSource` retries with backoff and shows a "no connection" banner from `.info/connected`. |
| R7 | A scan with missing `stable` is accepted, and the rules do not check that `L`/`R` are numbers. | zod schema in `web/src/data/types.ts` requires `stable`. Rules validate each element in phase 4. |
| R8 | Small font, weak `--mute` contrast, negative sign on the wrong side in RTL, "2 أيام". | Design tokens (17px base, AA contrast), `NumberLTR` component, `dayWord()` with correct dual ("يومين"). |
| R9 | No PWA, heavy single page. | vite-plugin-pwa + code splitting (phase 4). |
| R10 | Missing tests: allsites, several scans per day, missing `stable`, 85°C, midnight in Riyadh time. | Added in `rules.test.ts` and `types.test.ts`. |
| R11 | The simulator writes to the same `khatwa-01` as the real device. | `DEVICE_ID` configurable in app settings; the simulator reads `?dev=` (phase 4). |
