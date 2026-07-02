import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AccessibilityPanel from '../AccessibilityPanel';
import useAccessibilityPreferences from '../../../hooks/useAccessibilityPreferences';

// Mock useAccessibilityPreferences
vi.mock('../../../hooks/useAccessibilityPreferences', () => ({
  default: vi.fn()
}));

describe('AccessibilityPanel', () => {
  const mockPrefs = {
    dyslexicFont: false,
    reducedMotion: 'system',
    readingLevel: 'standard'
  };
  const setDyslexicFont = vi.fn();
  const setReducedMotion = vi.fn();
  const setReadingLevel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAccessibilityPreferences.mockReturnValue({
      prefs: mockPrefs,
      setDyslexicFont,
      setReducedMotion,
      setReadingLevel
    });
  });

  it('renders trigger button with correct ARIA attributes', () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByRole('button', { name: /accessibility settings/i });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens dialog on click and has aria-modal="true"', () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByRole('button', { name: /accessibility settings/i });
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('focuses back on trigger when closed', () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByRole('button', { name: /accessibility settings/i });

    // Open
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Close
    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
