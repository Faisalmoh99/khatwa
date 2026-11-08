// Step 1: is the board alive and uploading? Blinks the on-board LED (GPIO 2) and the green LED (GPIO 25).
#define PIN_BOARD_LED 2
#define PIN_LED_GREEN 25

void setup() {
  Serial.begin(115200);
  pinMode(PIN_BOARD_LED, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  delay(500);
  Serial.println("# 01_blink: started");
}

void loop() {
  static bool on = false;
  on = !on;
  digitalWrite(PIN_BOARD_LED, on);
  digitalWrite(PIN_LED_GREEN, on);
  Serial.printf("# blink %s\n", on ? "ON" : "OFF");
  delay(500);
}
