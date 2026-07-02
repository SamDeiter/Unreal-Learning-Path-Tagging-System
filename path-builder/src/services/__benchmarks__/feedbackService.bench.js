import { bench, describe } from "vitest";
import { applyFeedbackMultiplier } from "../feedbackService";

describe("feedbackService performance", () => {
  // Populate localStorage with some data
  const data = {};
  for (let i = 0; i < 100; i++) {
    data[`drive_${i}`] = { up: 1, down: 0 };
  }
  localStorage.setItem("feedback_v1", JSON.stringify(data));

  bench("applyFeedbackMultiplier (with localStorage overhead)", () => {
    for (let i = 0; i < 100; i++) {
      applyFeedbackMultiplier(`drive_${i}`, 100);
    }
  });
});
