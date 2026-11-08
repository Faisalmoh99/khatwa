// Khatwa: JSON for Firebase and the USB line (pure C++, no Arduino).
// The database rules reject ANY missing or extra field, so these builders write exactly the
// fields of docs/DATA_SCHEMA.md. Verified against the app's zod schemas and the rules emulator.
#pragma once

#include <cstddef>
#include <cstdio>

#include "khatwa_core.h"

namespace kh {

/** Firebase server timestamp placeholder. */
constexpr const char* SERVER_TS = "{\".sv\":\"timestamp\"}";

namespace detail {
inline int arr4(char* out, size_t n, const float* v) {
  return std::snprintf(out, n, "[%.2f,%.2f,%.2f,%.2f]", v[0], v[1], v[2], v[3]);
}
}  // namespace detail

/** status/ : {"online","lastSeen","firmware","source","rssi"} */
inline int buildStatus(char* out, size_t n, bool online, const char* firmware, int rssi) {
  return std::snprintf(out, n, "{\"online\":%s,\"lastSeen\":%s,\"firmware\":\"%s\",\"source\":\"esp32\",\"rssi\":%d}",
                       online ? "true" : "false", SERVER_TS, firmware, rssi);
}

/**
 * live/ : {"phase","msg"?,"L","R","fsrL","fsrR","standing","progress","elapsedSec","ts"}
 * L and R are 0 when there is no reading (idle), -127 for a faulty sensor.
 */
inline int buildLive(char* out, size_t n, const Step& st, const float* L, const float* R, int fsrL, int fsrR) {
  static const float ZERO[N] = {0, 0, 0, 0};
  const bool measuring = st.phase == Phase::Placing || st.phase == Phase::Settling || st.phase == Phase::Done;
  const float* l = measuring && st.phase != Phase::Placing ? L : ZERO;
  const float* r = measuring && st.phase != Phase::Placing ? R : ZERO;
  char a[64], b[64], msg[120] = "";
  detail::arr4(a, sizeof a, l);
  detail::arr4(b, sizeof b, r);
  if (st.msg) std::snprintf(msg, sizeof msg, "\"msg\":\"%s\",", st.msg);
  const int clampL = fsrL < 0 ? 0 : (fsrL > 4095 ? 4095 : fsrL);
  const int clampR = fsrR < 0 ? 0 : (fsrR > 4095 ? 4095 : fsrR);
  return std::snprintf(out, n,
                       "{\"phase\":\"%s\",%s\"L\":%s,\"R\":%s,\"fsrL\":%d,\"fsrR\":%d,\"standing\":%s,\"progress\":%d,\"elapsedSec\":%u,\"ts\":%s}",
                       phaseName(st.phase), msg, a, b, clampL, clampR, st.standing ? "true" : "false", st.progress,
                       static_cast<unsigned>(st.elapsedSec), SERVER_TS);
}

/**
 * scans/<push> : {"L","R","diff","standingOk","stable","durationSec","faults"?,"source","firmware","ts"}
 * tsMs = 0 → server timestamp; otherwise the NTP time of the measurement (for scans sent late).
 * "faults" is omitted when empty (Firebase drops empty arrays anyway).
 */
inline int buildScan(char* out, size_t n, const ScanResult& s, const char* firmware, unsigned long long tsMs = 0) {
  char a[64], b[64], d[64], faults[64] = "", ts[32];
  detail::arr4(a, sizeof a, s.L);
  detail::arr4(b, sizeof b, s.R);
  detail::arr4(d, sizeof d, s.diff);
  if (s.nFaults > 0) {
    int k = std::snprintf(faults, sizeof faults, "\"faults\":[");
    for (int i = 0; i < s.nFaults && k < static_cast<int>(sizeof faults) - 8; i++)
      k += std::snprintf(faults + k, sizeof faults - k, "%s\"%s\"", i ? "," : "", s.faults[i]);
    std::snprintf(faults + k, sizeof faults - k, "],");
  }
  if (tsMs) std::snprintf(ts, sizeof ts, "%llu", tsMs);
  else std::snprintf(ts, sizeof ts, "%s", SERVER_TS);
  return std::snprintf(out, n,
                       "{\"L\":%s,\"R\":%s,\"diff\":%s,\"standingOk\":true,\"stable\":%s,\"durationSec\":%u,%s\"source\":\"esp32\",\"firmware\":\"%s\",\"ts\":%s}",
                       a, b, d, s.stable ? "true" : "false", static_cast<unsigned>(s.durationSec), faults, firmware, ts);
}

/** USB line (Serial, 115200), same shape as live: {"L":[4],"R":[4],"fsrL":n,"fsrR":n} */
inline int buildSerial(char* out, size_t n, const float* L, const float* R, int fsrL, int fsrR) {
  char a[64], b[64];
  detail::arr4(a, sizeof a, L);
  detail::arr4(b, sizeof b, R);
  return std::snprintf(out, n, "{\"L\":%s,\"R\":%s,\"fsrL\":%d,\"fsrR\":%d}", a, b, fsrL, fsrR);
}

}  // namespace kh
