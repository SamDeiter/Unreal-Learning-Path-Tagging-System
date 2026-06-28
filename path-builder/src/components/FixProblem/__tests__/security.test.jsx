import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openFixStepsPopout } from '../AnswerView';

describe('AnswerView Security', () => {
  let mockWindow;
  let mockDocument;

  beforeEach(() => {
    mockDocument = {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
    };

    mockWindow = {
      document: mockDocument,
      resizeTo: vi.fn(),
      addEventListener: vi.fn(),
      location: { origin: 'http://localhost' },
      screen: { availWidth: 1280, availHeight: 800 },
    };

    vi.stubGlobal('window', {
      open: vi.fn().mockReturnValue(mockWindow),
      screen: { availWidth: 1280, availHeight: 800 },
      location: { origin: 'http://localhost' },
    });
  });

  it('should escape < characters in stepsJSON to prevent script injection', () => {
    const maliciousSteps = ['Step 1 <script>alert("XSS")</script>'];
    const checked = new Set();

    openFixStepsPopout({ steps: maliciousSteps, checked });

    const callArgs = mockDocument.write.mock.calls[0][0];

    // The JSON string inside the template should have < escaped as \u003c
    // We expect something like: const steps = [{"title":null,"body":"Step 1 \u003cscript>alert(\"XSS\")\u003c/script>"}];
    expect(callArgs).toContain('\\u003cscript');
    expect(callArgs).toContain('\\u003c/script');

    // Ensure the malicious script tag is NOT present in its raw form in the data section
    expect(callArgs).not.toContain('body":"Step 1 <script');
  });

  it('should escape < characters in checkedJSON to prevent script injection', () => {
    const steps = ['Step 1'];
    const maliciousChecked = new Set(['<img src=x onerror=alert(1)>']);

    openFixStepsPopout({ steps, checked: maliciousChecked });

    const callArgs = mockDocument.write.mock.calls[0][0];

    expect(callArgs).toContain('\\u003cimg');
    expect(callArgs).not.toContain('Set(["<img');
  });
});
