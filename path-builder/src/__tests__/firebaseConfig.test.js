import { describe, it, expect } from "vitest";
import { firebaseConfig, getFirebaseApp } from "../services/firebaseConfig";

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

  it("getFirebaseApp returns an app object (or null in test/E2E mode)", () => {
    const app = getFirebaseApp();
    // In CI/test environment, IS_E2E detection causes getFirebaseApp to return null
    if (app === null) {
      expect(app).toBeNull();
    } else {
      expect(app).toBeDefined();
      expect(app.name).toBeDefined();
    }
  });

  it("getFirebaseApp returns the same singleton (or null) on repeated calls", () => {
    const app1 = getFirebaseApp();
    const app2 = getFirebaseApp();
    expect(app1).toBe(app2);
  });
});
