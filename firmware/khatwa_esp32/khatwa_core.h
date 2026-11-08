// Khatwa: stand detection, stability and quality (pure C++, no Arduino).
// Same rules as docs/DATA_SCHEMA.md "الاستقرار" and the app's StabilityTracker:
//   standing = both heel sensors above FSR_ON; stepped off = either below FSR_MIN
//   stable   = every working sensor changes < STABLE_DELTA over the last STABLE_WIN, after MIN_MS
//   timeout  = MAX_MS → a scan is still written, with stable:false (the app rejects it)
// The device never applies the IWGDF rule. That lives in the app (rules.ts).
// Tested on a Mac with g++: firmware/test/test_core.cpp
#pragma once

#include <cmath>
#include <cstdint>
#include <cstring>

namespace kh {

constexpr int N = 4;            // sites per foot: hallux, MTH1, MTH5, heel
constexpr float FAULT = -127.0f;  // faulty / disconnected sensor (DallasTemperature value)

struct Params {
  int fsrOn = 1800;             // both heels above → standing
  int fsrMin = 600;             // either heel below → stepped off
  float stableDelta = 0.10f;    // °C
  uint32_t stableWinMs = 5000;
  uint32_t minMs = 8000;
  uint32_t maxMs = 90000;
  uint32_t placingMs = 2000;    // both heels must stay pressed this long before measuring
  uint32_t oneFootMs = 3000;    // one heel pressed alone this long → "one foot" error
  float plausMin = 20.0f;       // outside = implausible (wet foot, hot floor, error)
  float plausMax = 40.0f;
};

enum class Phase : uint8_t { Idle, Placing, Settling, Done, Error };
enum class Event : uint8_t { None, Started, Scan, Rejected, Released };

inline const char* phaseName(Phase p) {
  switch (p) {
    case Phase::Idle: return "idle";
    case Phase::Placing: return "placing";
    case Phase::Settling: return "settling";
    case Phase::Done: return "done";
    default: return "error";
  }
}

/** DS18B20 fault: -127 = disconnected, 85 = power-on value (read before a conversion finished). */
inline bool isFault(float v) { return !std::isfinite(v) || v <= -100.0f || v == 85.0f; }
inline float round2(float v) { return std::round(v * 100.0f) / 100.0f; }

/** Raw reading + calibration offset → value written to Firebase (faults always become -127). */
inline float cleanTemp(float raw, float offset) { return isFault(raw) ? FAULT : round2(raw + offset); }

struct Sample {
  uint32_t ms;
  float L[N];
  float R[N];
  int fsrL;
  int fsrR;
};

struct ScanResult {
  float L[N], R[N], diff[N];
  bool stable;
  uint32_t durationSec;
  char faults[2 * N][3];  // "L2", "R0", ...
  int nFaults;
  /** Device-side quality only (not the IWGDF rule): unstable, nothing usable, or implausible. */
  bool rejected;
};

struct Step {
  Phase phase;
  const char* msg;  // short Arabic reason for the app, or nullptr
  int progress;     // 0–100, for the progress ring only
  uint32_t elapsedSec;
  bool standing;
  Event event;
  bool hasScan;
  ScanResult scan;
};

class Tracker {
 public:
  explicit Tracker(Params p = Params()) : p_(p) {}

  Phase phase() const { return phase_; }

  Step push(const Sample& s) {
    Step out{};
    out.phase = phase_;
    const bool pressedL = s.fsrL > p_.fsrOn, pressedR = s.fsrR > p_.fsrOn;
    const bool both = pressedL && pressedR;
    const bool releasedAny = s.fsrL < p_.fsrMin || s.fsrR < p_.fsrMin;
    const bool releasedBoth = s.fsrL < p_.fsrMin && s.fsrR < p_.fsrMin;
    const bool oneAlone = (pressedL && s.fsrR < p_.fsrMin) || (pressedR && s.fsrL < p_.fsrMin);

    switch (phase_) {
      case Phase::Idle:
        if (both) {
          phase_ = Phase::Placing;
          start_ = s.ms;
          oneSince_ = 0;
          out.event = Event::Started;
        } else if (oneAlone) {
          if (!oneSince_) oneSince_ = s.ms ? s.ms : 1;
          if (s.ms - oneSince_ >= p_.oneFootMs) return error(out, s, "قدم وحدة أو القدم مو في مكانها");
        } else {
          oneSince_ = 0;
        }
        break;

      case Phase::Placing:
        if (releasedAny) return error(out, s, "قدم وحدة أو القدم مو في مكانها");
        if (s.ms - start_ >= p_.placingMs) {
          phase_ = Phase::Settling;
          settleStart_ = s.ms;
          n_ = 0;
        }
        break;

      case Phase::Settling: {
        if (releasedAny) return error(out, s, oneAlone ? "قدم وحدة أو القدم مو في مكانها" : "نزل قبل الانتهاء");
        if (!both) {  // weight shifting between the two thresholds: restart the stability window
          n_ = 0;
          out.msg = "اكتُشفت حركة، اثبت";
          break;
        }
        add(s);
        const uint32_t elapsed = s.ms - start_;
        if (isStable(s.ms) || elapsed >= p_.maxMs) {
          out.scan = buildScan(s, isStable(s.ms), elapsed);
          out.hasScan = true;
          out.event = Event::Scan;
          phase_ = Phase::Done;
          out.msg = out.scan.stable ? "تم" : "انتهى الوقت بدون استقرار";
        }
        break;
      }

      case Phase::Done:
      case Phase::Error:
        if (releasedBoth) {
          phase_ = Phase::Idle;
          oneSince_ = 0;
          out.event = Event::Released;
        }
        break;
    }

    out.phase = phase_;
    out.standing = both;
    out.elapsedSec = (phase_ == Phase::Placing || phase_ == Phase::Settling || out.hasScan) ? (s.ms - start_) / 1000 : 0;
    out.progress = progress(s.ms, out.hasScan);
    return out;
  }

 private:
  static constexpr int CAP = 64;
  Params p_;
  Phase phase_ = Phase::Idle;
  uint32_t start_ = 0, settleStart_ = 0, oneSince_ = 0;
  Sample win_[CAP];
  int n_ = 0;

  Step error(Step& out, const Sample&, const char* msg) {
    phase_ = Phase::Error;
    n_ = 0;
    out.phase = phase_;
    out.msg = msg;
    out.event = Event::Rejected;
    out.progress = 0;
    out.standing = false;
    return out;
  }

  void add(const Sample& s) {
    if (n_ == CAP) {
      std::memmove(win_, win_ + 1, sizeof(Sample) * (CAP - 1));
      n_--;
    }
    win_[n_++] = s;
    int drop = 0;  // keep only samples inside the stability window
    while (drop < n_ && s.ms - win_[drop].ms > p_.stableWinMs) drop++;
    if (drop) {
      std::memmove(win_, win_ + drop, sizeof(Sample) * (n_ - drop));
      n_ -= drop;
    }
  }

  bool isStable(uint32_t now) const {
    if (now - start_ < p_.minMs || n_ < 2) return false;
    if (win_[n_ - 1].ms - win_[0].ms + 1000 < p_.stableWinMs) return false;  // window not full yet
    for (int k = 0; k < 2 * N; k++) {
      float lo = 1e9f, hi = -1e9f;
      for (int j = 0; j < n_; j++) {
        const float v = k < N ? win_[j].L[k] : win_[j].R[k - N];
        if (isFault(v)) continue;  // a faulty sensor never blocks stability
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      if (hi >= lo && hi - lo >= p_.stableDelta) return false;
    }
    return true;
  }

  int progress(uint32_t now, bool done) const {
    if (done) return 100;
    if (phase_ == Phase::Placing) return 0;
    if (phase_ != Phase::Settling) return 0;
    const uint32_t target = p_.minMs + p_.stableWinMs;
    const uint32_t e = now - start_;
    const int pct = static_cast<int>((e * 100) / (target ? target : 1));
    return pct > 99 ? 99 : pct;
  }

  ScanResult buildScan(const Sample& s, bool stable, uint32_t elapsedMs) const {
    ScanResult r{};
    r.stable = stable;
    r.durationSec = elapsedMs / 1000;
    int usable = 0;
    bool implausible = false;
    for (int i = 0; i < N; i++) {
      r.L[i] = isFault(s.L[i]) ? FAULT : round2(s.L[i]);
      r.R[i] = isFault(s.R[i]) ? FAULT : round2(s.R[i]);
      const bool lf = r.L[i] == FAULT, rf = r.R[i] == FAULT;
      if (lf) addFault(r, 'L', i);
      if (rf) addFault(r, 'R', i);
      r.diff[i] = (lf || rf) ? FAULT : round2(r.R[i] - r.L[i]);
      if (!lf && !rf) {
        usable++;
        if (r.L[i] < p_.plausMin || r.L[i] > p_.plausMax || r.R[i] < p_.plausMin || r.R[i] > p_.plausMax) implausible = true;
      }
    }
    r.rejected = !stable || usable == 0 || implausible;
    return r;
  }

  static void addFault(ScanResult& r, char foot, int i) {
    r.faults[r.nFaults][0] = foot;
    r.faults[r.nFaults][1] = static_cast<char>('0' + i);
    r.faults[r.nFaults][2] = '\0';
    r.nFaults++;
  }
};

}  // namespace kh
