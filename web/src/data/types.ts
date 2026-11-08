/**
 * Data contract between ESP32, the simulator and the app. Mirrors docs/DATA_SCHEMA.md (v1).
 * Any change here must also change the firmware, app/sim and the schema doc.
 */
import { z } from 'zod';

/** RTDB can return arrays as objects {0:..,1:..}. Normalise before validating. */
const arr4 = z.preprocess(
  (v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.keys(v)
          .sort((a, b) => Number(a) - Number(b))
          .map((k) => (v as Record<string, unknown>)[k])
      : v,
  z.array(z.number()).length(4),
);

export const StatusSchema = z.object({
  online: z.boolean().optional(),
  lastSeen: z.number(),
  firmware: z.string().optional(),
  source: z.enum(['esp32', 'sim']).optional(),
  rssi: z.number().optional(),
});
export type DeviceStatus = z.infer<typeof StatusSchema>;

export const LIVE_PHASES = ['idle', 'placing', 'settling', 'done', 'error'] as const;
export const LiveSchema = z.object({
  phase: z.enum(LIVE_PHASES),
  msg: z.string().optional(),
  L: arr4.optional(),
  R: arr4.optional(),
  fsrL: z.number().optional(),
  fsrR: z.number().optional(),
  standing: z.boolean().optional(),
  progress: z.number().min(0).max(100).optional(),
  elapsedSec: z.number().optional(),
  ts: z.number().optional(),
});
export type Live = z.infer<typeof LiveSchema>;

/** A finished scan. `stable` and `standingOk` are required (review finding R7). */
export const ScanSchema = z.object({
  L: arr4,
  R: arr4,
  diff: arr4.optional(),
  standingOk: z.boolean(),
  stable: z.boolean(),
  durationSec: z.number().optional(),
  faults: z.array(z.string()).optional(),
  source: z.enum(['esp32', 'sim', 'serial']),
  firmware: z.string().optional(),
  demoDay: z.number().int().optional(),
  backfill: z.boolean().optional(),
  scenario: z.string().optional(),
  ts: z.number(),
});
export type Scan = z.infer<typeof ScanSchema> & { id: string };

/**
 * Events written by the app. v1 kinds plus the kinds added for the web app (see DATA_SCHEMA.md).
 * `escalation` = an alert sent to someone (audit log). `mode` = travel / bandage / hospital / normal.
 */
export const EVENT_KINDS = [
  'quickcheck',
  'redflag',
  'photo',
  'family_ack',
  'clinic_ack',
  'mode',
  'escalation',
  'booking',
  'reminder',
  'question',
  'message',
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const EventSchema = z.object({
  kind: z.enum(EVENT_KINDS),
  data: z.record(z.string(), z.unknown()).optional(),
  day: z.string().optional(),
  ts: z.number(),
});
export type KhEvent = z.infer<typeof EventSchema> & { id: string };
/** What the app sends. `ts` is filled with the server time by the source. */
export type NewEvent = Omit<z.infer<typeof EventSchema>, 'ts'>;

/** Line sent by the ESP32 over USB serial at 115200 baud (same shape as live). */
export const SerialLineSchema = z.object({
  L: arr4,
  R: arr4,
  fsrL: z.number().optional(),
  fsrR: z.number().optional(),
  phase: z.enum(LIVE_PHASES).optional(),
  progress: z.number().optional(),
  standing: z.boolean().optional(),
  stable: z.boolean().optional(),
  done: z.boolean().optional(),
});
export type SerialLine = z.infer<typeof SerialLineSchema>;

/** Parses a keyed Firebase collection, dropping (and reporting) entries that break the contract. */
export function parseCollection<T extends z.ZodTypeAny>(
  schema: T,
  raw: unknown,
): { items: (z.infer<T> & { id: string })[]; rejected: { id: string; error: string }[] } {
  const items: (z.infer<T> & { id: string })[] = [];
  const rejected: { id: string; error: string }[] = [];
  if (!raw || typeof raw !== 'object') return { items, rejected };
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const r = schema.safeParse(v);
    if (r.success) items.push({ ...(r.data as object), id } as z.infer<T> & { id: string });
    else
      rejected.push({ id, error: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
  }
  const tsOf = (x: unknown) => Number((x as { ts?: unknown }).ts) || 0;
  items.sort((a, b) => tsOf(a) - tsOf(b));
  return { items, rejected };
}

/** The device counts as online if its last heartbeat (server time) is younger than this. */
export const ONLINE_WINDOW_MS = 60_000;
