import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AnimatedNumber } from "./AnimatedNumber";

describe("AnimatedNumber", () => {
  it("renders a span element", () => {
    const { container } = render(<AnimatedNumber value={100} />);
    const span = container.querySelector("span");
    expect(span).toBeTruthy();
  });

  it("applies custom className", () => {
    const { container } = render(<AnimatedNumber value={0} className="test-class" />);
    expect(container.querySelector(".test-class")).toBeTruthy();
  });

  it("displays initial value", () => {
    const { container } = render(<AnimatedNumber value={0} />);
    const span = container.querySelector("span");
    expect(span?.textContent).toBe("0");
  });
});
