import { type DataSource, type SourceKind, WOKWI_DEVICE_ID } from './DataSource';
import { SerialSource } from './SerialSource';
import { SimulationSource, type SimOptions } from './SimulationSource';

export * from './DataSource';
export * from './types';
export { SerialSource, SimulationSource };

/**
 * Factory. Swapping the source never changes a screen: they all depend on DataSource only.
 * Firebase is loaded on demand so the simulation and USB modes never download it.
 */
export async function createSource(
  kind: SourceKind,
  deviceId: string,
  sim: SimOptions = {},
  canWrite: () => boolean = () => false,
): Promise<DataSource> {
  if (kind === 'simulation') return new SimulationSource(deviceId, sim);
  if (kind === 'serial') return new SerialSource(deviceId);
  const { FirebaseSource } = await import('./FirebaseSource');
  // The Wokwi mat is read-only for the app: only the virtual ESP32 writes there.
  if (kind === 'wokwi') return new FirebaseSource(WOKWI_DEVICE_ID, { kind: 'wokwi', canWrite: () => false });
  return new FirebaseSource(deviceId, { kind: 'firebase', canWrite });
}
