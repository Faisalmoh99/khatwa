import type { DataSource, SourceKind } from './DataSource';
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
): Promise<DataSource> {
  if (kind === 'simulation') return new SimulationSource(deviceId, sim);
  if (kind === 'serial') return new SerialSource(deviceId);
  const { FirebaseSource } = await import('./FirebaseSource');
  return new FirebaseSource(deviceId);
}
