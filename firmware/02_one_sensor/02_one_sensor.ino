// Step 2: one DS18B20 on GPIO 4 (yellow = data, red = 3.3 V, black = GND, 4.7–5.1 kΩ between yellow and red).
#include <DallasTemperature.h>
#include <OneWire.h>

OneWire wire(4);
DallasTemperature sensors(&wire);

void setup() {
  Serial.begin(115200);
  delay(500);
  sensors.begin();
  Serial.printf("# 02_one_sensor: found %d sensor(s) on GPIO 4\n", sensors.getDeviceCount());
}

void loop() {
  sensors.requestTemperatures();  // waits ~750 ms at 12-bit
  const float c = sensors.getTempCByIndex(0);
  if (c == DEVICE_DISCONNECTED_C) Serial.println("# -127: not found. Check the wiring and the resistor.");
  else if (c == 85.0f) Serial.println("# 85: power-on value. Wait one more reading; if it stays, check 3.3 V.");
  else Serial.printf("# temperature: %.2f C  (hold it in your hand: it should rise)\n", c);
  delay(250);
}
