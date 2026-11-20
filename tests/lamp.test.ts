import Decimal from "break_infinity.js";
import { describe, expect, it } from "vitest";
import { chainStatus } from "../src/game/chain";
import { CHALLENGES, challengeById, challengeGoal, startChallenge } from "../src/game/challenges";
import { GULL_ROCK_ID } from "../src/game/config";
import { baseProductionPerSecond, emberMultiplier, lampMultiplier, productionPerSecond } from "../src/game/engine";
import { createInitialState, startBoard } from "../src/game/state";
import type { GameState, Moth } from "../src/game/types";

// The design review's item 5: the lamp's companions (moths on duty, the
// Brass Compass, the challenge lamps) light the thrown beam, after the
// chain; Embers rest through a challenge; challenge goals grow with the
// keeper's other lasting bonuses.

const glowing = (id: string, glow: number): Moth => ({ id, name: id, pattern: "prismatic", glow, generation: 1 });

function awakeChain(): GameState {
  const state = createInitialState(0);
  state.generators["candle-crab"] = 40; // chain awake, demand well past First Light's starting support
  return state;
}

describe("the lamp's companions light the beam, not the helpers", () => {
  it("moths on duty, the Compass and the challenge lamps never add to the chain's demand", () => {
    const plain = awakeChain();
    const lit = awakeChain();
    lit.moths = [glowing("a", 100), glowing("b", 100)];
    lit.mothDuty = ["a", "b"];
    lit.relics = ["brass-compass"];
    lit.completedChallenges = ["fogbound", "still-hands"];
    expect(baseProductionPerSecond(lit).toNumber()).toBe(baseProductionPerSecond(plain).toNumber());
    expect(chainStatus(lit).efficiency).toBe(chainStatus(plain).efficiency);
    // 1.2 (two glow-100 moths) × 1.05 (Compass) × 1.125 × 1.1 (the challenge lamps)
    const lamp = 1.2 * 1.05 * 1.125 * 1.1;
    expect(lampMultiplier(lit).toNumber()).toBeCloseTo(lamp, 9);
    expect(productionPerSecond(lit).div(productionPerSecond(plain)).toNumber()).toBeCloseTo(lamp, 9);
  });

  it("Fogbound's fog dims the thrown beam, not the helpers' demand", () => {
    const state = awakeChain();
    const before = baseProductionPerSecond(state).toNumber();
    state.activeChallenge = "fogbound";
    expect(baseProductionPerSecond(state).toNumber()).toBe(before);
    expect(lampMultiplier(state).toNumber()).toBe(0.5);
  });
});

describe("challenges are a trial of the keeper", () => {
  it("held Embers rest through a challenge run", () => {
    const state = createInitialState(0);
    state.embers = 1_000_000;
    expect(emberMultiplier(state).toNumber()).toBe(20_001);
    expect(startChallenge(state, "fogbound")).toBe(true);
    expect(emberMultiplier(state).toNumber()).toBe(1);
    expect(state.embers).toBe(1_000_000); // resting, not spent
  });

  it("goals grow with lit lighthouses and perks, never with Embers", () => {
    const state = createInitialState(0);
    for (const def of CHALLENGES) expect(challengeGoal(state, def).toNumber()).toBe(def.goalLifetime);
    state.embers = 1e12;
    expect(challengeGoal(state, challengeById("fogbound")).toNumber()).toBe(1_000_000);
    state.litLighthouses.push(GULL_ROCK_ID); // +50% production
    state.chainBoards[GULL_ROCK_ID] = startBoard(GULL_ROCK_ID);
    expect(challengeGoal(state, challengeById("fogbound")).toNumber()).toBe(1_500_000);
  });

  it("Still Hands can always be finished: a keeper with no purse gets one Candle Crab", () => {
    const state = createInitialState(0);
    expect(state.lumen.toNumber()).toBe(0);
    expect(startChallenge(state, "still-hands")).toBe(true);
    expect(state.generators["candle-crab"]).toBe(1);
    const purse = createInitialState(0);
    purse.emberPerks = ["head-start"]; // 1,000 Lumen: the keeper can hire their own
    expect(startChallenge(purse, "still-hands")).toBe(true);
    expect(purse.generators["candle-crab"] ?? 0).toBe(0);
    expect(purse.lumen.eq(new Decimal(1_000))).toBe(true);
  });
});
