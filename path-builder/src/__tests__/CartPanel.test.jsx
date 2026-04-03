import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CartPanel from "../components/CartPanel/CartPanel";

describe("CartPanel UX Improvements", () => {
  const mockCart = [
    {
      itemId: "video_1",
      type: "video",
      title: "Introduction to Unreal Engine 5",
      duration: 300,
    },
  ];

  const defaultProps = {
    cart: mockCart,
    onRemove: vi.fn(),
    onClear: vi.fn(),
    onWatchPath: vi.fn(),
  };

  it("should have an accessible aria-label on the Clear button", () => {
    render(<CartPanel {...defaultProps} />);
    const clearBtn = screen.getByTitle("Clear all");
    expect(clearBtn.getAttribute("aria-label")).toBe("Clear all items from learning path");
  });

  it("should call onClear when user confirms", () => {
    const onClear = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<CartPanel {...defaultProps} onClear={onClear} />);
    const clearBtn = screen.getByTitle("Clear all");

    fireEvent.click(clearBtn);

    expect(confirmSpy).toHaveBeenCalledWith("Are you sure you want to clear your learning path?");
    expect(onClear).toHaveBeenCalledTimes(1);

    confirmSpy.mockRestore();
  });

  it("should NOT call onClear when user cancels", () => {
    const onClear = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<CartPanel {...defaultProps} onClear={onClear} />);
    const clearBtn = screen.getByTitle("Clear all");

    fireEvent.click(clearBtn);

    expect(confirmSpy).toHaveBeenCalled();
    expect(onClear).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });
});
