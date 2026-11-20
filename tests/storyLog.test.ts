import { describe, expect, it } from "vitest";
import { createInitialState } from "../src/game/state";
import { STORY_BEATS, checkStory } from "../src/game/story";

describe("story beats in the Keeper's Log", () => {
  it("log one line, the title, and leave the text to The Story So Far", () => {
    const state = createInitialState(0);
    checkStory(state); // "Cold Lamp" fires at once
    const beat = STORY_BEATS.find((b) => b.id === state.storySeen[0])!;
    const entry = state.log.find((e) => e.message.startsWith("📖"))!;
    expect(entry.message).toBe(`📖 ${beat.title} — a new page in The Story So Far`);
    expect(entry.message).not.toContain(beat.text.slice(0, 20));
  });
});
