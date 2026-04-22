/**
 * useSpeech — unit tests with a mocked speechSynthesis.
 *
 * Verifies:
 *   - speak() triggers synth.speak and moves state → "speaking"
 *   - pause() and resume() move through "paused"/"speaking"
 *   - speak() while an utterance is active cancels the previous one
 *   - unsupported environments return state "unsupported" and no-op
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Install mock BEFORE importing the hook so module-level init sees it.
function installMockSpeech() {
  const utterances = [];
  class FakeUtterance {
    constructor(text) {
      this.text = text;
      this.onstart = null;
      this.onend = null;
      this.onpause = null;
      this.onresume = null;
      this.onerror = null;
      utterances.push(this);
    }
  }
  const synth = {
    speak: vi.fn((u) => {
      // simulate onstart firing
      queueMicrotask(() => u.onstart && u.onstart());
    }),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  };
  window.speechSynthesis = synth;
  window.SpeechSynthesisUtterance = FakeUtterance;
  return { synth, utterances };
}

describe("useSpeech", () => {
  let mock;
  let hookModule;

  beforeEach(async () => {
    mock = installMockSpeech();
    // Re-import so module state resets. vi.resetModules() would be cleaner
    // but this hook keeps module-level singletons — call __resetSpeechForTests.
    vi.resetModules();
    hookModule = await import("../useSpeech");
    hookModule.__resetSpeechForTests();
  });

  afterEach(() => {
    delete window.speechSynthesis;
    delete window.SpeechSynthesisUtterance;
  });

  it("starts in idle state when supported", () => {
    const { result } = renderHook(() => hookModule.default());
    expect(result.current.state).toBe("idle");
    expect(result.current.supported).toBe(true);
  });

  it("speak() calls synth.speak and transitions to 'speaking'", async () => {
    const { result } = renderHook(() => hookModule.default());

    act(() => {
      result.current.speak("hello world", "id-1");
    });

    expect(mock.synth.cancel).toHaveBeenCalled();
    expect(mock.synth.speak).toHaveBeenCalled();
    expect(result.current.state).toBe("speaking");
    expect(result.current.currentId).toBe("id-1");
  });

  it("pause() transitions to 'paused' and resume() back to 'speaking'", () => {
    const { result } = renderHook(() => hookModule.default());

    act(() => {
      result.current.speak("text", "id-a");
    });
    act(() => {
      result.current.pause();
    });
    expect(mock.synth.pause).toHaveBeenCalled();
    expect(result.current.state).toBe("paused");

    act(() => {
      result.current.resume();
    });
    expect(mock.synth.resume).toHaveBeenCalled();
    expect(result.current.state).toBe("speaking");
  });

  it("cancel() returns state to 'idle' with null currentId", () => {
    const { result } = renderHook(() => hookModule.default());

    act(() => {
      result.current.speak("something", "id-x");
    });
    act(() => {
      result.current.cancel();
    });

    expect(mock.synth.cancel).toHaveBeenCalled();
    expect(result.current.state).toBe("idle");
    expect(result.current.currentId).toBeNull();
  });

  it("speak() a second time cancels the prior utterance (global singleton)", () => {
    const { result } = renderHook(() => hookModule.default());

    act(() => {
      result.current.speak("first", "id-1");
    });
    act(() => {
      result.current.speak("second", "id-2");
    });

    // cancel should have been called before each new speak
    expect(mock.synth.cancel).toHaveBeenCalledTimes(2);
    expect(result.current.currentId).toBe("id-2");
    expect(result.current.state).toBe("speaking");
  });

  it("reports 'unsupported' when speechSynthesis is missing", async () => {
    delete window.speechSynthesis;
    delete window.SpeechSynthesisUtterance;
    vi.resetModules();
    const unsupportedModule = await import("../useSpeech");
    unsupportedModule.__resetSpeechForTests();
    const { result } = renderHook(() => unsupportedModule.default());
    expect(result.current.state).toBe("unsupported");
    expect(result.current.supported).toBe(false);

    // speak() should no-op silently
    act(() => {
      result.current.speak("noop", "id-u");
    });
    expect(result.current.state).toBe("unsupported");
  });
});
