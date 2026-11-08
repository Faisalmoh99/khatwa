// Mac tests for the Khatwa stability/quality logic and JSON builders (no Arduino).
//   g++ -std=c++17 -Wall -Wextra -I../khatwa_esp32 test_core.cpp -o test_core && ./test_core
//   ./test_core --samples   → prints JSON samples (checked against the app's zod schemas and the DB rules)
#include <cstdio>
#include <cstring>
#include <string>

#include "khatwa_core.h"
#include "khatwa_json.h"

using namespace kh;

static int failures = 0, checks = 0;
#define CHECK(cond)                                                       \
  do {                                                                    \
    checks++;                                                             \
    if (!(cond)) {                                                        \
      failures++;                                                         \
      std::printf("  FAIL %s:%d  %s\n", __FILE__, __LINE__, #cond);       \
    }                                                                     \
  } while (0)

static const float BASE_L[N] = {30.8f, 31.2f, 30.6f, 29.9f};
static const float BASE_R[N] = {30.9f, 33.8f, 30.8f, 29.9f};

static Sample sample(uint32_t ms, int fsrL = 2600, int fsrR = 2550, float wobble = 0) {
  Sample s{};
  s.ms = ms;
  s.fsrL = fsrL;
  s.fsrR = fsrR;
  for (int i = 0; i < N; i++) {
    s.L[i] = BASE_L[i] + wobble;
    s.R[i] = BASE_R[i] - wobble;
  }
  return s;
}

/** Feeds 1 Hz samples from t0 until a scan or `until`; returns the step with the scan (or the last). */
template <class F>
static Step runUntilScan(Tracker& t, uint32_t from, uint32_t until, F make) {
  Step last{};
  for (uint32_t ms = from; ms <= until; ms += 1000) {
    last = t.push(make(ms));
    if (last.hasScan || last.phase == Phase::Error) return last;
  }
  return last;
}

static void testStable() {
  std::puts("stable stand → scan after at least 8 s, stable:true, accepted");
  Tracker t;
  Step st = t.push(sample(0, 100, 100));
  CHECK(st.phase == Phase::Idle);
  st = t.push(sample(1000));
  CHECK(st.event == Event::Started && st.phase == Phase::Placing);
  st = runUntilScan(t, 2000, 120000, [](uint32_t ms) { return sample(ms); });
  CHECK(st.hasScan);
  CHECK(st.scan.stable);
  CHECK(!st.scan.rejected);
  CHECK(st.scan.durationSec >= 8 && st.scan.durationSec <= 12);
  CHECK(st.scan.nFaults == 0);
  CHECK(st.scan.diff[1] == round2(33.8f - 31.2f));
  CHECK(st.progress == 100);
  CHECK(std::strcmp(st.msg, "تم") == 0);
  st = t.push(sample(st.elapsedSec * 1000 + 3000, 2600, 2600));
  CHECK(st.phase == Phase::Done);  // stays done while standing
  st = t.push(sample(60000, 100, 100));
  CHECK(st.phase == Phase::Idle && st.event == Event::Released);
}

static void testMovement() {
  std::puts("movement: weight shifting restarts the window, temperatures moving delay stability");
  Tracker calm, moving;
  calm.push(sample(0));
  moving.push(sample(0));
  Step a = runUntilScan(calm, 1000, 120000, [](uint32_t ms) { return sample(ms); });
  Step b = runUntilScan(moving, 1000, 120000, [](uint32_t ms) {
    if (ms >= 9000 && ms <= 10000) return sample(ms, 1200, 2600);                      // heel shifting (between thresholds)
    return sample(ms, 2600, 2550, ms < 14000 ? (ms % 2000 ? 0.15f : 0.0f) : 0.0f);  // wobbling, then still
  });
  CHECK(a.hasScan && b.hasScan);
  CHECK(b.scan.stable);
  CHECK(b.scan.durationSec > a.scan.durationSec + 4);
  Tracker t;
  t.push(sample(0));
  t.push(sample(1000));
  t.push(sample(2000));
  Step m = t.push(sample(3000, 1200, 2600));
  CHECK(m.phase == Phase::Settling && m.msg && std::strcmp(m.msg, "اكتُشفت حركة، اثبت") == 0);
}

static void testFault() {
  std::puts("-127 and 85: reported as faults, -127 in arrays and diff, do not block stability, scan accepted");
  Tracker t;
  t.push(sample(0));
  Step st = runUntilScan(t, 1000, 120000, [](uint32_t ms) {
    Sample s = sample(ms);
    s.L[2] = -127.0f;
    s.R[0] = 85.0f;
    return s;
  });
  CHECK(st.hasScan && st.scan.stable && !st.scan.rejected);
  CHECK(st.scan.L[2] == FAULT && st.scan.R[0] == FAULT);
  CHECK(st.scan.diff[2] == FAULT && st.scan.diff[0] == FAULT);
  CHECK(st.scan.nFaults == 2);
  CHECK(std::strcmp(st.scan.faults[0], "R0") == 0 || std::strcmp(st.scan.faults[0], "L2") == 0);
  CHECK(cleanTemp(85.0f, 0.3f) == FAULT);
  CHECK(cleanTemp(-127.0f, 0.3f) == FAULT);
  CHECK(cleanTemp(30.84f, 0.2f) == round2(31.04f));
}

static void testTimeout() {
  std::puts("never stable → scan at 90 s with stable:false, rejected (red light)");
  Tracker t;
  t.push(sample(0));
  Step st = runUntilScan(t, 1000, 200000, [](uint32_t ms) { return sample(ms, 2600, 2550, (ms / 1000) % 2 ? 0.3f : 0.0f); });
  CHECK(st.hasScan);
  CHECK(!st.scan.stable);
  CHECK(st.scan.rejected);
  CHECK(st.scan.durationSec == 90);
  CHECK(std::strcmp(st.msg, "انتهى الوقت بدون استقرار") == 0);
}

static void testErrors() {
  std::puts("one foot / stepping off → error, no scan; wet foot → implausible → rejected");
  Tracker t;
  Step st{};
  for (uint32_t ms = 0; ms <= 3000; ms += 1000) st = t.push(sample(ms, 2600, 100));
  CHECK(st.phase == Phase::Error && st.event == Event::Rejected && !st.hasScan);  // after 3 s on one foot
  st = t.push(sample(4000, 2600, 100));
  CHECK(st.phase == Phase::Error && st.event == Event::None);  // no repeated beeps while still standing
  CHECK(st.msg && std::strcmp(st.msg, "قدم وحدة أو القدم مو في مكانها") == 0);  // reason stays visible
  Tracker off;
  off.push(sample(0));
  off.push(sample(1000));
  off.push(sample(2000));
  off.push(sample(3000));
  st = off.push(sample(4000, 100, 100));
  CHECK(st.phase == Phase::Error && !st.hasScan);
  CHECK(std::strcmp(st.msg, "نزل قبل الانتهاء") == 0);
  Tracker wet;
  wet.push(sample(0));
  st = runUntilScan(wet, 1000, 120000, [](uint32_t ms) {
    Sample s = sample(ms);
    s.L[0] = 18.5f;
    return s;
  });
  CHECK(st.hasScan && st.scan.stable && st.scan.rejected);
}

static void testJson() {
  std::puts("JSON: exact fields only");
  char buf[512];
  buildStatus(buf, sizeof buf, true, "0.2.0", -61);
  CHECK(std::string(buf) == "{\"online\":true,\"lastSeen\":{\".sv\":\"timestamp\"},\"firmware\":\"0.2.0\",\"source\":\"esp32\",\"rssi\":-61}");
  ScanResult s{};
  for (int i = 0; i < N; i++) {
    s.L[i] = BASE_L[i];
    s.R[i] = BASE_R[i];
    s.diff[i] = round2(BASE_R[i] - BASE_L[i]);
  }
  s.stable = true;
  s.durationSec = 31;
  buildScan(buf, sizeof buf, s, "0.2.0");
  CHECK(std::strstr(buf, "\"faults\"") == nullptr);  // empty faults omitted
  CHECK(std::strstr(buf, "\"standingOk\":true") != nullptr);
  CHECK(std::strstr(buf, "\"source\":\"esp32\"") != nullptr);
  buildScan(buf, sizeof buf, s, "0.2.0", 1762750000123ULL);
  CHECK(std::strstr(buf, "\"ts\":1762750000123}") != nullptr);
  float L[N] = {30.1f, -127, 30.3f, 29.9f}, R[N] = {30.2f, 31, 30.4f, 30};
  buildSerial(buf, sizeof buf, L, R, 2600, 2510);
  CHECK(std::string(buf) == "{\"L\":[30.10,-127.00,30.30,29.90],\"R\":[30.20,31.00,30.40,30.00],\"fsrL\":2600,\"fsrR\":2510}");
}

/** JSON samples for the schema check (web/src/data/firmware.test.ts) and the rules emulator. */
static void printSamples() {
  char buf[512];
  Tracker t;
  Step st = t.push(sample(0, 100, 100));
  buildLive(buf, sizeof buf, st, BASE_L, BASE_R, 100, 100);
  std::printf("live %s\n", buf);
  st = t.push(sample(1000));
  buildLive(buf, sizeof buf, st, BASE_L, BASE_R, 2600, 2550);
  std::printf("live %s\n", buf);
  Step last{};
  for (uint32_t ms = 2000; ms < 120000 && !last.hasScan; ms += 1000) {
    Sample s = sample(ms);
    s.L[2] = -127.0f;
    last = t.push(s);
    buildLive(buf, sizeof buf, last, s.L, s.R, s.fsrL, s.fsrR);
    if (ms == 5000 || last.hasScan) std::printf("live %s\n", buf);
  }
  buildScan(buf, sizeof buf, last.scan, "0.2.0");
  std::printf("scan %s\n", buf);
  buildScan(buf, sizeof buf, last.scan, "0.2.0", 1762750000123ULL);
  std::printf("scan %s\n", buf);
  Tracker slow;
  slow.push(sample(0));
  Step to = runUntilScan(slow, 1000, 200000, [](uint32_t ms) { return sample(ms, 2600, 2550, (ms / 1000) % 2 ? 0.3f : 0.0f); });
  buildScan(buf, sizeof buf, to.scan, "0.2.0");
  std::printf("scan %s\n", buf);
  Tracker one;
  Step e{};
  for (uint32_t ms = 0; ms <= 4000; ms += 1000) e = one.push(sample(ms, 2600, 100));
  buildLive(buf, sizeof buf, e, BASE_L, BASE_R, 2600, 100);
  std::printf("live %s\n", buf);
  buildStatus(buf, sizeof buf, true, "0.2.0", -61);
  std::printf("status %s\n", buf);
  float L[N] = {30.1f, -127, 30.3f, 29.9f};
  buildSerial(buf, sizeof buf, L, BASE_R, 2600, 2510);
  std::printf("serial %s\n", buf);
}

int main(int argc, char** argv) {
  if (argc > 1 && std::strcmp(argv[1], "--samples") == 0) {
    printSamples();
    return 0;
  }
  testStable();
  testMovement();
  testFault();
  testTimeout();
  testErrors();
  testJson();
  std::printf("\n%d checks, %d failed\n", checks, failures);
  return failures ? 1 : 0;
}
