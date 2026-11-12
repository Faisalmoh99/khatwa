// Step 3: list every sensor's ROM address on both feet, ready to paste into khatwa_esp32/config.h.
// Then it prints each sensor's temperature every 2 s: touch one sensor and see which line warms up.
#include <DallasTemperature.h>
#include <OneWire.h>

OneWire wireL(4), wireR(18);
DallasTemperature left(&wireL), right(&wireR);

static void printRom(const DeviceAddress a) {
  Serial.print("{");
  for (int i = 0; i < 8; i++) Serial.printf("0x%02X%s", a[i], i < 7 ? ", " : "");
  Serial.print("}");
}

static void list(DallasTemperature& bus, const char* name, int pin) {
  const int n = bus.getDeviceCount();
  Serial.printf("\n# %s foot (GPIO %d): %d sensor(s) (expected 4)\n", name, pin, n);
  DeviceAddress a;
  for (int i = 0; i < n; i++) {
    if (!bus.getAddress(a, i)) continue;
    Serial.printf("#   sensor %d: ", i);
    printRom(a);
    Serial.println(",");
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  left.begin();
  right.begin();
  Serial.println("# 03_scan_addresses");
  list(left, "LEFT", 4);
  list(right, "RIGHT", 18);
  Serial.println("\n# Copy each address into ROM_L / ROM_R in config.h in this order: hallux, MTH1, MTH5, heel.");
}

static void temps(DallasTemperature& bus, const char* name) {
  DeviceAddress a;
  for (int i = 0; i < bus.getDeviceCount(); i++) {
    if (!bus.getAddress(a, i)) continue;
    Serial.printf("# %s %d: %.2f C   ", name, i, bus.getTempC(a));
  }
}

void loop() {
  left.requestTemperatures();
  right.requestTemperatures();
  temps(left, "L");
  temps(right, "R");
  Serial.println();
  delay(2000);
}
