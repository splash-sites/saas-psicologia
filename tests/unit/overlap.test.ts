import { describe, it, expect } from "vitest";
import { sobrepoe } from "@/lib/agenda/overlap";

describe("sobrepoe", () => {
  const a0 = "2026-03-09T13:00:00Z";
  const a1 = "2026-03-09T14:00:00Z";

  it("detecta sobreposição parcial", () => {
    expect(sobrepoe(a0, a1, "2026-03-09T13:30:00Z", "2026-03-09T14:30:00Z")).toBe(
      true,
    );
  });

  it("intervalos encostados não se sobrepõem (fim exclusivo)", () => {
    expect(sobrepoe(a0, a1, "2026-03-09T14:00:00Z", "2026-03-09T15:00:00Z")).toBe(
      false,
    );
  });

  it("um contido no outro", () => {
    expect(sobrepoe(a0, a1, "2026-03-09T13:15:00Z", "2026-03-09T13:45:00Z")).toBe(
      true,
    );
  });

  it("totalmente separados", () => {
    expect(sobrepoe(a0, a1, "2026-03-09T09:00:00Z", "2026-03-09T10:00:00Z")).toBe(
      false,
    );
  });
});
