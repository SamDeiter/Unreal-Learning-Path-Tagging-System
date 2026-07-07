import { describe, it, expect } from "vitest";
import { firebaseConfig, getFirebaseApp } from "../services/firebaseConfig";
import { IS_E2E } from "../services/e2eBypass";

describe("firebaseConfig", () => {
  it("exports a config object with required Firebase keys", () => {
    expect(firebaseConfig).toBeDefined();
    expect(firebaseConfig).toHaveProperty("apiKey");
    expect(firebaseConfig).toHaveProperty("authDomain");
    expect(firebaseConfig).toHaveProperty("projectId");
    expect(firebaseConfig).toHaveProperty("storageBucket");
    expect(firebaseConfig).toHaveProperty("messagingSenderId");
    expect(firebaseConfig).toHaveProperty("appId");
  });

  it("getFirebaseApp returns an app object (or null in E2E bypass)", () => {
    const app = getFirebaseApp();
    if (IS_E2E) {
      expect(app).toBeNull();
    } else {
      expect(app).toBeDefined();
      expect(app.name).toBeDefined();
    }
  });

  it("getFirebaseApp returns the same singleton on repeated calls", () => {
    const app1 = getFirebaseApp();
    const app2 = getFirebaseApp();
    expect(app1).toBe(app2);
  });
});
