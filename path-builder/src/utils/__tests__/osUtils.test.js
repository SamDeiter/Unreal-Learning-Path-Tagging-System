import { describe, it, expect } from 'vitest';
import { getOSInfo } from '../osUtils';

describe('osUtils', () => {
  it('should detect Mac platform', () => {
    const mockNav = {
      platform: 'MacIntel',
      userAgentData: { platform: 'macOS' }
    };
    const { isMac, MODIFIER_KEY } = getOSInfo(mockNav);
    expect(isMac).toBe(true);
    expect(MODIFIER_KEY).toBe('⌘');
  });

  it('should detect Windows platform', () => {
    const mockNav = {
      platform: 'Win32',
      userAgentData: { platform: 'Windows' }
    };
    const { isMac, MODIFIER_KEY } = getOSInfo(mockNav);
    expect(isMac).toBe(false);
    expect(MODIFIER_KEY).toBe('Ctrl');
  });

  it('should handle missing navigator gracefully', () => {
    const { isMac, MODIFIER_KEY } = getOSInfo(null);
    expect(isMac).toBe(false);
    expect(MODIFIER_KEY).toBe('Ctrl');
  });

  it('should fall back to navigator.platform if userAgentData is missing', () => {
    const mockNav = {
      platform: 'MacIntel'
    };
    const { isMac, MODIFIER_KEY } = getOSInfo(mockNav);
    expect(isMac).toBe(true);
    expect(MODIFIER_KEY).toBe('⌘');
  });
});
