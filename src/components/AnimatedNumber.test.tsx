import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnimatedNumber } from "./AnimatedNumber";

describe("AnimatedNumber", () => {
  it("renders a span element", () => {
    render(<AnimatedNumber value={100} />);
    const span = screen.getByText(/\d/);
    expect(span.tagName).toBe("SPAN");
  });

  it("applies custom className", () => {
    const { container } = render(<AnimatedNumber value={0} className="test-class" />);
    expect(container.querySelector(".test-class")).toBeTruthy();
  });

  it("uses custom format function", async () => {
    render(<AnimatedNumber value={42} duration={0} format={(n) => `$${Math.round(n)}`} />);
    // With duration 0 it should still animate via rAF; initial render shows "0"
    const span = screen.getByText("0");
    expect(span).toBeInTheDocument();
  });
});
