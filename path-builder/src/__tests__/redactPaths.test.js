import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// PII Guard — same regex exported from ProblemInput for testability
// ---------------------------------------------------------------------------
const LOCAL_PATH_REGEX =
  /(?:[A-Za-z]:\\[\w\\. -]+|\/(?:Users|home|tmp|var|opt|etc)\/[\w/. -]+)/g;

function redactLocalPaths(text) {
  return text.replace(LOCAL_PATH_REGEX, "[LOCAL_PATH]");
}

describe("redactLocalPaths", () => {
  it("redacts Windows paths", () => {
    const input = 'Error in C:\\Users\\Sam Deiter\\Projects\\MyGame\\Source\\main.cpp at line 42';
    const result = redactLocalPaths(input);
    expect(result).toContain("[LOCAL_PATH]");
    expect(result).not.toContain("Sam Deiter");
    expect(result).not.toContain("Projects");
  });

  it("redacts macOS paths", () => {
    const input = "Could not find /Users/john/Documents/UE5/MyProject/Content/file.uasset";
    const result = redactLocalPaths(input);
    expect(result).toBe("Could not find [LOCAL_PATH]");
    expect(result).not.toContain("john");
  });

  it("redacts Linux home paths", () => {
    const input = "Fatal error loading /home/dev/unreal/MyProject/Saved/Logs/UE5.log";
    const result = redactLocalPaths(input);
    expect(result).toBe("Fatal error loading [LOCAL_PATH]");
    expect(result).not.toContain("dev");
  });

  it("redacts /tmp and /var paths", () => {
    const input = "Cache written to /tmp/ue5_build_cache/output.bin";
    const result = redactLocalPaths(input);
    expect(result).toBe("Cache written to [LOCAL_PATH]");
  });

  it("does not alter text without file paths", () => {
    const input = "My Blueprint Cast is giving me Accessed None error when trying to get the mesh";
    const result = redactLocalPaths(input);
    expect(result).toBe(input);
  });

  it("handles multiple paths in one string", () => {
    const input = 'Copying C:\\Users\\Sam\\Source to D:\\Backup\\Projects and /home/sam/logs';
    const result = redactLocalPaths(input);
    expect(result).toContain("[LOCAL_PATH]");
    expect(result).not.toContain("Sam");
    expect(result).not.toContain("sam");
  });

  it("handles empty string", () => {
    expect(redactLocalPaths("")).toBe("");
  });
});
