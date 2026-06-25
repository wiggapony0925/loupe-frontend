import { loupeGrade, measureCentering, nearestPsaLabel } from "@loupe/grade";

/**
 * Guards the shared @loupe/grade rubric — the same engine the web /grade
 * playground uses. If these drift, the mobile + web estimates diverge.
 */
describe("@loupe/grade engine", () => {
  it("returns a gem-mint 10 when every sub-grade is perfect", () => {
    const r = loupeGrade({ centering: 10, corners: 10, edges: 10, surface: 10 });
    expect(r.estimate).toBe(10);
    expect(r.band).toBe("PSA 10");
  });

  it("caps the estimate near the weakest sub-grade (no averaging away a flaw)", () => {
    // weighted = 9, but lowest(5)+1.5 = 6.5 governs.
    const r = loupeGrade({ centering: 10, corners: 10, edges: 10, surface: 5 });
    expect(r.estimate).toBe(6.5);
    expect(r.band).toBe("PSA 6–7");
  });

  it("measureCentering rejects an inner frame that escapes the outer", () => {
    const outer = { top: 0, right: 1, bottom: 1, left: 0 };
    const inner = { top: -0.1, right: 0.9, bottom: 0.9, left: 0.1 };
    expect(measureCentering(outer, inner)).toBeNull();
  });

  it("measureCentering grades a dead-centre card as 10", () => {
    const outer = { top: 0, right: 1, bottom: 1, left: 0 };
    const inner = { top: 0.1, right: 0.9, bottom: 0.9, left: 0.1 };
    expect(measureCentering(outer, inner)?.grade).toBe(10);
  });

  it("nearestPsaLabel rounds to the closest tier", () => {
    expect(nearestPsaLabel(8.5)).toBe("PSA 9");
    expect(nearestPsaLabel(7.2)).toBe("PSA 7");
  });
});
