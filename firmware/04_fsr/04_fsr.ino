// Step 4: heel pressure sensors (left GPIO 34, right GPIO 35), to choose FSR_ON and FSR_MIN in config.h.
// Note the numbers with nobody on the mat, then standing on both feet, then on one foot.
#define PIN_FSR_L 34
#define PIN_FSR_R 35

static int readAvg(int pin) {
  long sum = 0;
  for (int i = 0; i < 8; i++) sum += analogRead(pin);
  return sum / 8;
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);  // 0–4095
  delay(500);
  Serial.println("# 04_fsr: left, right (0-4095). Current thresholds: ON 1800, MIN 600");
}

void loop() {
  const int l = readAvg(PIN_FSR_L), r = readAvg(PIN_FSR_R);
  const char* state = (l > 1800 && r > 1800) ? "STANDING" : (l < 600 && r < 600) ? "EMPTY" : "ONE FOOT / SHIFTING";
  Serial.printf("# fsrL=%4d  fsrR=%4d  -> %s\n", l, r, state);
  delay(200);
}
