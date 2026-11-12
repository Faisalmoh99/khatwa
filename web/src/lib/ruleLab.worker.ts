/// <reference lib="webworker" />
import { runCohort } from './ruleLab';

self.onmessage = (e: MessageEvent<{ seed: number }>) => {
  self.postMessage(runCohort({ seed: e.data.seed }));
};
