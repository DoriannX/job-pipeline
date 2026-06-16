import { describe, expect, it } from "vitest";

// Placeholder (story 1.1) : prouve que le runner tourne en CI. Le vrai filet de tests
// (cross-tenant 2 users, property-test sanitize, atomicité du moat) arrive avec les
// stories concernées — cf. architecture.md §tests.
describe("socle", () => {
  it("le harness de test tourne", () => {
    expect(true).toBe(true);
  });
});
