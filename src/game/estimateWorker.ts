import { estimateRecoveryMinutes } from "./estimate";
import { deserializeState } from "./state";

// ── The Rekindle recovery estimate, off the main thread ─────────────────────
// The estimate simulates a whole new run (≈350 ms late in the game, longer
// on a slow phone), so the page hands this worker a save and keeps drawing.
// Messages: in { id, save } (a serialized GameState), out { id, minutes }.

interface EstimateRequest {
  id: number;
  save: unknown;
}

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<EstimateRequest>) => void) | null;
  postMessage(message: { id: number; minutes: number | null }): void;
};

scope.onmessage = (event) => {
  const state = deserializeState(event.data.save);
  scope.postMessage({ id: event.data.id, minutes: state ? estimateRecoveryMinutes(state) : null });
};
