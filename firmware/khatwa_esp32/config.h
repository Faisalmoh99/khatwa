// Khatwa device settings. Fill the ROM table from sketch 03 and the thresholds from sketch 04.
// Everything here is safe to commit (no passwords: those are in secrets.h).
#pragma once
#include <stdint.h>

#define FIRMWARE_VERSION "0.2.0"

// ---- Pins (ESP32 DevKit, 30 pins) ----
#define PIN_ONEWIRE_L 4    // left foot, 4 × DS18B20 (4.7–5.1 kΩ pull-up to 3.3 V)
#define PIN_ONEWIRE_R 18   // right foot, 4 × DS18B20
#define PIN_FSR_L 34       // left heel pressure (ADC1, input only)
#define PIN_FSR_R 35       // right heel pressure (ADC1, input only)
#define PIN_LED_GREEN 25
#define PIN_LED_RED 26
#define PIN_BUZZER 27      // active buzzer: HIGH = sound

// ---- Sensor order per foot: [0] hallux, [1] MTH1, [2] MTH5, [3] heel ----
// Paste the addresses printed by sketch 03 (touch each sensor to see which one warms up).
// While a row is all zeros, the code uses the order found on the wire and prints a warning.
static const uint8_t ROM_L[4][8] = {
    {0, 0, 0, 0, 0, 0, 0, 0},  // hallux
    {0, 0, 0, 0, 0, 0, 0, 0},  // MTH1
    {0, 0, 0, 0, 0, 0, 0, 0},  // MTH5
    {0, 0, 0, 0, 0, 0, 0, 0},  // heel
};
static const uint8_t ROM_R[4][8] = {
    {0, 0, 0, 0, 0, 0, 0, 0},
    {0, 0, 0, 0, 0, 0, 0, 0},
    {0, 0, 0, 0, 0, 0, 0, 0},
    {0, 0, 0, 0, 0, 0, 0, 0},
};

// ---- Calibration offsets (°C), added to each raw reading. From the 35–37 °C water test. ----
static const float OFFSET_L[4] = {0.0f, 0.0f, 0.0f, 0.0f};
static const float OFFSET_R[4] = {0.0f, 0.0f, 0.0f, 0.0f};

// ---- Standing (raw ADC 0–4095). From sketch 04: standing value well above FSR_ON, empty well below FSR_MIN. ----
#define FSR_ON 1800   // both heels above → standing
#define FSR_MIN 600   // either heel below → stepped off

// ---- Stability (docs/DATA_SCHEMA.md) ----
#define STABLE_DELTA_C 0.10f   // every sensor changes less than this...
#define STABLE_WIN_MS 5000     // ...over the last 5 s
#define MIN_MEASURE_MS 8000    // never finish before 8 s
#define MAX_MEASURE_MS 90000   // at 90 s: write the scan with stable:false

// ---- Timing ----
#define SAMPLE_EVERY_MS 1000   // read sensors, update live, print the USB line
#define STATUS_EVERY_MS 10000  // heartbeat
#define WIFI_RETRY_MS 10000    // reconnect attempt when Wi-Fi is down (skipped while measuring)
#define SCAN_QUEUE 10          // scans kept in RAM while offline
