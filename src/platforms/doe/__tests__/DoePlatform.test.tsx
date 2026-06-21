// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DoePlatform } from "@/platforms/doe/DoePlatform";

const generateMutate = vi.fn();

vi.mock("plotly.js-dist-min", () => ({ default: {} }));
vi.mock("react-plotly.js/factory", () => ({
  default: () => () => <div data-testid="plotly-mock" />,
}));
vi.mock("@/api/doe", () => ({
  useGenerateDesign: () => ({
    mutate: generateMutate,
    isPending: false,
    data: undefined,
    isError: false,
    error: null,
  }),
}));

describe("DoePlatform", () => {
  beforeEach(() => {
    generateMutate.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders factor rows with name, low, and high inputs", () => {
    render(<DoePlatform />);

    // Two default factors should be rendered
    const nameInputs = screen.getAllByLabelText("Factor name");
    expect(nameInputs.length).toBe(2);
    const lowInputs = screen.getAllByLabelText("Factor low value");
    expect(lowInputs.length).toBe(2);
    const highInputs = screen.getAllByLabelText("Factor high value");
    expect(highInputs.length).toBe(2);
  });

  it("renders the design type selector", () => {
    render(<DoePlatform />);

    const select = screen.getByLabelText("Design type");
    expect(select).toBeTruthy();
  });

  it("renders the Generate Design button", () => {
    render(<DoePlatform />);

    expect(screen.getByRole("button", { name: "Generate Design" })).toBeTruthy();
  });

  it("calls useGenerateDesign mutate with factor values and design type when button is clicked", () => {
    render(<DoePlatform />);

    // Update the first factor name
    const nameInputs = screen.getAllByLabelText("Factor name");
    fireEvent.change(nameInputs[0], { target: { value: "Temperature" } });

    // Click generate
    fireEvent.click(screen.getByRole("button", { name: "Generate Design" }));

    expect(generateMutate).toHaveBeenCalledOnce();
    const callArg = generateMutate.mock.calls[0][0];
    expect(callArg.design_type).toBe("full_factorial");
    expect(callArg.factors).toHaveLength(2);
    expect(callArg.factors[0].name).toBe("Temperature");
  });

  it("adds a new factor row when Add Factor is clicked", () => {
    render(<DoePlatform />);

    fireEvent.click(screen.getByRole("button", { name: "+ Add Factor" }));

    const nameInputs = screen.getAllByLabelText("Factor name");
    expect(nameInputs.length).toBe(3);
  });

  it("changes design type selector and passes it to mutate", () => {
    render(<DoePlatform />);

    const select = screen.getByLabelText("Design type");
    fireEvent.change(select, { target: { value: "plackett_burman" } });

    fireEvent.click(screen.getByRole("button", { name: "Generate Design" }));

    const callArg = generateMutate.mock.calls[0][0];
    expect(callArg.design_type).toBe("plackett_burman");
  });
});
