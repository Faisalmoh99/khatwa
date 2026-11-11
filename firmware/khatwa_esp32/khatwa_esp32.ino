// Khatwa mat firmware (ESP32 DevKit, 30 pins).
// Measures 4 points per foot, detects standing with the heel sensors, waits for stable readings,
// and sends status / live / scans to Firebase exactly as docs/DATA_SCHEMA.md says.
// The device NEVER applies the IWGDF rule: that is done in the app (rules.ts).
//
// Libraries: OneWire, DallasTemperature, FirebaseClient (mobizt). Board: ESP32 Dev Module.
// Copy secrets.example.h to secrets.h first. Debug lines start with "#"; JSON lines are the USB bridge.

#define ENABLE_USER_AUTH
#define ENABLE_DATABASE

#include <DallasTemperature.h>
#include <FirebaseClient.h>
#include <OneWire.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiMulti.h>
#include <time.h>

#if __has_include("secrets.h")
#include "secrets.h"
#else
#error "Copy secrets.example.h to secrets.h and fill it in"
#endif
#include "config.h"
#include "khatwa_core.h"
#include "khatwa_json.h"

#define DEVICE_PATH "/devices/" DEVICE_ID

// ---------------- hardware ----------------
OneWire wireL(PIN_ONEWIRE_L), wireR(PIN_ONEWIRE_R);
DallasTemperature busL(&wireL), busR(&wireR);
DeviceAddress addrL[kh::N], addrR[kh::N];
bool foundL[kh::N] = {false}, foundR[kh::N] = {false};

// ---------------- network ----------------
WiFiMulti wifiMulti;
WiFiClientSecure sslClient;
using AsyncClient = AsyncClientClass;
AsyncClient aClient(sslClient);
UserAuth userAuth(FIREBASE_API_KEY, DEVICE_EMAIL, DEVICE_PASSWORD, 3000);
FirebaseApp app;
RealtimeDatabase db;

// ---------------- state ----------------
kh::Tracker tracker([] {
  kh::Params p;
  p.fsrOn = FSR_ON;
  p.fsrMin = FSR_MIN;
  p.stableDelta = STABLE_DELTA_C;
  p.stableWinMs = STABLE_WIN_MS;
  p.minMs = MIN_MEASURE_MS;
  p.maxMs = MAX_MEASURE_MS;
  return p;
}());

struct QueuedScan {
  char json[400];
};
QueuedScan queue[SCAN_QUEUE];
int qHead = 0, qCount = 0;
bool scanBusy = false, liveBusy = false, statusBusy = false;
bool idleLiveSent = false;
uint32_t lastSample = 0, lastStatus = 0, lastWifiTry = 0, selfTestUntil = 0;

// LEDs and buzzer (non-blocking)
enum class Light : uint8_t { Off, BlinkGreen, Green, Red };
Light light = Light::Off;
int beepsLeft = 0;
uint32_t beepNext = 0;
bool beepOn = false;

// ---------------- helpers ----------------
static bool romEmpty(const uint8_t* r) {
  for (int i = 0; i < 8; i++)
    if (r[i]) return false;
  return true;
}

/** Map sensors to sites from the ROM table in config.h, or fall back to bus order (with a warning). */
static void resolveAddresses(DallasTemperature& bus, const uint8_t rom[kh::N][8], DeviceAddress* out, bool* found, const char* name) {
  bus.begin();
  bus.setResolution(12);
  bus.setWaitForConversion(false);
  const int n = bus.getDeviceCount();
  Serial.printf("# %s foot: %d sensor(s) on the wire\n", name, n);
  bool tableFilled = true;
  for (int i = 0; i < kh::N; i++)
    if (romEmpty(rom[i])) tableFilled = false;
  for (int i = 0; i < kh::N; i++) {
    if (tableFilled) {
      memcpy(out[i], rom[i], 8);
      found[i] = bus.isConnected(out[i]);
    } else {
      found[i] = bus.getAddress(out[i], i);
    }
    if (!found[i]) Serial.printf("# WARNING %s site %d: sensor not found (will send -127)\n", name, i);
  }
  if (!tableFilled) Serial.printf("# WARNING %s: ROM table in config.h is empty, using wire order. Run sketch 03.\n", name);
}

static float readSite(DallasTemperature& bus, const DeviceAddress a, bool found, float offset) {
  if (!found) return kh::FAULT;
  return kh::cleanTemp(bus.getTempC(a), offset);  // -127 and 85 → -127
}

static int readFsr(int pin) {
  long sum = 0;
  for (int i = 0; i < 8; i++) sum += analogRead(pin);
  return static_cast<int>(sum / 8);
}

static void beep(int count) {
  beepsLeft = count;
  beepOn = false;
  beepNext = millis();
}

static void updateOutputs(uint32_t now) {
  const bool blink = (now / 250) % 2;
  digitalWrite(PIN_LED_GREEN, light == Light::Green || (light == Light::BlinkGreen && blink));
  digitalWrite(PIN_LED_RED, light == Light::Red);
  if (beepsLeft > 0 && now >= beepNext) {
    beepOn = !beepOn;
    digitalWrite(PIN_BUZZER, beepOn);
    if (!beepOn) beepsLeft--;
    beepNext = now + 120;
  }
}

static unsigned long long epochMs() {
  const time_t t = time(nullptr);
  return t > 1700000000 ? static_cast<unsigned long long>(t) * 1000ULL : 0ULL;  // 0 = no NTP yet
}

static bool online() { return WiFi.status() == WL_CONNECTED && app.ready(); }

// ---------------- Firebase callbacks ----------------
static void onStatus(AsyncResult& r) {
  if (r.isError() || r.available()) statusBusy = false;
  if (r.isError()) Serial.printf("# status error: %s\n", r.error().message().c_str());
}

static void onLive(AsyncResult& r) {
  if (r.isError() || r.available()) liveBusy = false;
  if (r.isError()) Serial.printf("# live error: %s\n", r.error().message().c_str());
}

static void onScan(AsyncResult& r) {
  if (!r.isError() && !r.available()) return;
  // The library can report the same push twice. Without this guard the queue count went to -1 and every
  // later scan stayed in RAM unsent (found on the Wokwi virtual mat: the second stand was never saved).
  if (!scanBusy) return;
  scanBusy = false;
  if (r.isError()) {
    Serial.printf("# scan not sent (%s), will retry\n", r.error().message().c_str());
    return;
  }
  Serial.println("# scan saved");
  qHead = (qHead + 1) % SCAN_QUEUE;  // sent: drop it from the queue
  qCount--;
}

static void onAuth(AsyncResult& r) {
  if (r.isError()) Serial.printf("# auth error: %s (code %d)\n", r.error().message().c_str(), r.error().code());
  else if (r.isEvent()) Serial.printf("# auth: %s\n", r.eventLog().message().c_str());
}

// ---------------- senders ----------------
static void sendStatus() {
  if (!online() || statusBusy) return;
  char json[200];
  kh::buildStatus(json, sizeof json, true, FIRMWARE_VERSION, WiFi.RSSI());
  statusBusy = true;
  db.update(aClient, DEVICE_PATH "/status", object_t(json), onStatus, "status");
}

static void sendLive(const kh::Step& st, const float* L, const float* R, int fsrL, int fsrR) {
  if (!online() || liveBusy) return;  // never queue live frames: the next second replaces this one
  char json[400];
  kh::buildLive(json, sizeof json, st, L, R, fsrL, fsrR);
  liveBusy = true;
  db.set<object_t>(aClient, DEVICE_PATH "/live", object_t(json), onLive, "live");
}

static void queueScan(const kh::ScanResult& s) {
  if (qCount == SCAN_QUEUE) {  // full: drop the oldest
    qHead = (qHead + 1) % SCAN_QUEUE;
    qCount--;
    Serial.println("# scan queue full, oldest dropped");
  }
  const int slot = (qHead + qCount) % SCAN_QUEUE;
  // Online: server time. Offline: the NTP time of the measurement, so a late scan keeps its real day.
  kh::buildScan(queue[slot].json, sizeof queue[slot].json, s, FIRMWARE_VERSION, online() ? 0 : epochMs());
  qCount++;
}

static void flushScans() {
  if (!online() || scanBusy || qCount == 0) return;
  scanBusy = true;
  db.push<object_t>(aClient, DEVICE_PATH "/scans", object_t(queue[qHead].json), onScan, "scan");
}

static void keepWifi(uint32_t now, bool measuring) {
  if (WiFi.status() == WL_CONNECTED || measuring || now - lastWifiTry < WIFI_RETRY_MS) return;
  lastWifiTry = now;
  Serial.println("# Wi-Fi down, retrying...");
  wifiMulti.run(1500);  // short block, never while someone is standing
}

// ---------------- Arduino ----------------
void setup() {
  Serial.begin(115200);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  analogReadResolution(12);
  delay(300);
  Serial.printf("# Khatwa firmware %s, device %s\n", FIRMWARE_VERSION, DEVICE_ID);

  resolveAddresses(busL, ROM_L, addrL, foundL, "LEFT");
  resolveAddresses(busR, ROM_R, addrR, foundR, "RIGHT");
  busL.requestTemperatures();
  busR.requestTemperatures();

  WiFi.mode(WIFI_STA);
  wifiMulti.addAP(WIFI_SSID, WIFI_PASSWORD);
  if (strlen(WIFI_SSID_2) > 0) wifiMulti.addAP(WIFI_SSID_2, WIFI_PASSWORD_2);
  wifiMulti.run(8000);
  Serial.printf("# Wi-Fi: %s\n", WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString().c_str() : "not connected (will keep measuring and retry)");
  configTime(0, 0, "pool.ntp.org", "time.google.com");

  sslClient.setInsecure();
  sslClient.setConnectionTimeout(TLS_CONNECT_TIMEOUT_MS);  // the default gave up before a slow (~6 s) connect finished
  initializeApp(aClient, app, getAuth(userAuth), onAuth, "auth");
  app.getApp<RealtimeDatabase>(db);
  db.url(FIREBASE_DB_URL);

  light = Light::Green;  // short self-test at boot: green for 1 s + one beep
  selfTestUntil = millis() + 1000;
  beep(1);
}

void loop() {
  const uint32_t now = millis();
  app.loop();
  updateOutputs(now);
  if (selfTestUntil && now >= selfTestUntil) {
    selfTestUntil = 0;
    if (tracker.phase() == kh::Phase::Idle) light = Light::Off;
  }

  if (now - lastSample >= SAMPLE_EVERY_MS) {
    lastSample = now;
    // Conversions were started one second ago (non-blocking): read, then start the next ones.
    float L[kh::N], R[kh::N];
    for (int i = 0; i < kh::N; i++) {
      L[i] = readSite(busL, addrL[i], foundL[i], OFFSET_L[i]);
      R[i] = readSite(busR, addrR[i], foundR[i], OFFSET_R[i]);
    }
    busL.requestTemperatures();
    busR.requestTemperatures();
    const int fsrL = readFsr(PIN_FSR_L), fsrR = readFsr(PIN_FSR_R);

    // USB bridge: one JSON line per second (the app's SerialSource reads it).
    char line[160];
    kh::buildSerial(line, sizeof line, L, R, fsrL, fsrR);
    Serial.println(line);

    kh::Sample s{now, {L[0], L[1], L[2], L[3]}, {R[0], R[1], R[2], R[3]}, fsrL, fsrR};
    const kh::Step st = tracker.push(s);
    const bool measuring = st.phase == kh::Phase::Placing || st.phase == kh::Phase::Settling;

    if (st.event == kh::Event::Started) {
      light = Light::BlinkGreen;
      idleLiveSent = false;
      Serial.println("# standing: measuring");
    } else if (st.event == kh::Event::Scan) {
      const bool ok = !st.scan.rejected;
      light = ok ? Light::Green : Light::Red;
      beep(ok ? 1 : 2);
      queueScan(st.scan);
      Serial.printf("# scan ready: stable=%d rejected=%d faults=%d (%us)\n", st.scan.stable, st.scan.rejected, st.scan.nFaults, (unsigned)st.scan.durationSec);
    } else if (st.event == kh::Event::Rejected) {
      light = Light::Red;
      beep(2);
      Serial.printf("# rejected: %s (no scan written)\n", st.msg ? st.msg : "");
    } else if (st.event == kh::Event::Released) {
      light = Light::Off;
    }

    // live: every second while someone is on the mat, and once when it goes back to idle.
    if (st.phase != kh::Phase::Idle) sendLive(st, L, R, fsrL, fsrR);
    else if (!idleLiveSent && online() && !liveBusy) {
      sendLive(st, L, R, fsrL, fsrR);
      idleLiveSent = true;
    }

    keepWifi(now, measuring || st.phase == kh::Phase::Done);
  }

  if (now - lastStatus >= STATUS_EVERY_MS) {
    lastStatus = now;
    sendStatus();
  }
  flushScans();
}
