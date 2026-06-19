import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AnswerView from '../AnswerView';

// Mock child components to focus on AnswerView logic
vi.mock('../EvidencePanel', () => ({ default: () => <div data-testid="evidence-panel" /> }));
vi.mock('../FeedbackPanel', () => ({ default: () => <div data-testid="feedback-panel" /> }));
vi.mock('../HowItWorksDiagram', () => ({ default: () => <div data-testid="diagram" /> }));
vi.mock('../../OfficialDocsSummary/OfficialDocsSummary', () => ({ default: () => <div data-testid="docs-summary" /> }));

describe('AnswerView Security', () => {
  const mockAnswer = {
    mostLikelyCause: 'Test Cause',
    confidence: 'high',
    fixSteps: ['Step 1', 'Step 2 with </script><script>alert(1)</script>'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.open
    window.open = vi.fn().mockReturnValue({
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      },
      focus: vi.fn(),
    });
  });

  it('escapes < characters in fix steps to prevent script breakout in popout', () => {
    render(
      <AnswerView
        answer={mockAnswer}
        onFeedback={vi.fn()}
        onBackToVideos={vi.fn()}
        onStartOver={vi.fn()}
      />
    );

    // Navigate to Fix Steps
    // In the mock answer above, stepper will only have 2 steps: Cause and Fix.
    const fixStepsBtn = screen.getByLabelText(/Step 2: Fix Steps/i);
    fireEvent.click(fixStepsBtn);

    // Click Pop out
    const popoutBtn = screen.getByText(/Pop out/i);
    fireEvent.click(popoutBtn);

    expect(window.open).toHaveBeenCalled();
    const popup = window.open.mock.results[0].value;
    const writtenHtml = popup.document.write.mock.calls[0][0];

    // Verify that </script> is escaped as \u003c/script>
    expect(writtenHtml).toContain('\\u003c/script>');
    expect(writtenHtml).toContain('\\u003cscript>');

    // Ensure the raw </script> tag is NOT present in the JSON strings
    // We check the variable assignments in the generated HTML
    const stepsVarLine = writtenHtml.split('\n').find(line => line.includes('const steps = '));
    expect(stepsVarLine).not.toContain('</script>');
    expect(stepsVarLine).toContain('\\u003c/script>');
  });
});
