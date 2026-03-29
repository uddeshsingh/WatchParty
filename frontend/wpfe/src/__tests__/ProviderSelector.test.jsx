import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProviderSelector from "../components/ProviderSelector";

describe("ProviderSelector", () => {
  it("calls onChange when selection changes", () => {
    const onChange = vi.fn();
    render(<ProviderSelector value="videasy" onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "vidlink" },
    });
    expect(onChange).toHaveBeenCalledWith("vidlink");
  });
});
