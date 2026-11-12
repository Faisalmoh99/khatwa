// Step 5: green LED (GPIO 25), red LED (GPIO 26, through 220 Ω) and active buzzer (GPIO 27).
// Pattern: green blinks (measuring) → green + short beep (saved) → red + two beeps (rejected).
#define PIN_LED_GREEN 25
#define PIN_LED_RED 26
#define PIN_BUZZER 27

static void beep(int ms) {
  digitalWrite(PIN_BUZZER, HIGH);
  delay(ms);
  digitalWrite(PIN_BUZZER, LOW);
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  delay(500);
  Serial.println("# 05_leds_buzzer");
}

void loop() {
  Serial.println("# measuring: green blinks");
  for (int i = 0; i < 6; i++) {
    digitalWrite(PIN_LED_GREEN, i % 2 == 0);
    delay(250);
  }
  Serial.println("# saved: green + short beep");
  digitalWrite(PIN_LED_GREEN, HIGH);
  beep(120);
  delay(1500);
  digitalWrite(PIN_LED_GREEN, LOW);
  Serial.println("# rejected: red + two beeps");
  digitalWrite(PIN_LED_RED, HIGH);
  beep(120);
  delay(120);
  beep(120);
  delay(1500);
  digitalWrite(PIN_LED_RED, LOW);
  delay(1000);
}
