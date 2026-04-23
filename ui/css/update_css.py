import os

css_path = r'c:\Users\Sam Deiter\Documents\GitHub\Unreal-Learning-Path-Tagging-System\ui\css\industrial-calm.css'

with open(css_path, 'r', encoding='utf-8') as f:
    existing = f.read()

shell_styles = """
/* --- Core Shell & Layout --- */
:root {
  --color-bg-base: #0a0c10;
  --color-bg-surface: #12151c;
  --color-bg-card: #1a1d26;
  --color-bg-hover: #232733;
  --color-border: #2d333d;
  --color-accent-primary: #7000ff;
  --color-accent-secondary: #00d4ff;
  --color-accent-success: #00e676;
  --color-accent-error: #ff5252;
  --color-accent-warning: #ffd600;
  --color-text-primary: #e6edf3;
  --color-text-secondary: #a3b3c1;
  --color-text-muted: #6e7681;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}

body {
  margin: 0;
  padding: 0;
  background-color: var(--color-bg-base);
  color: var(--color-text-primary);
  font-family: 'Inter', sans-serif;
  overflow: hidden;
}

.app-shell {
  display: grid;
  grid-template-columns: 64px 1fr 300px;
  grid-template-rows: 56px 1fr;
  height: 100vh;
  width: 100vw;
  transition: grid-template-columns 0.3s ease;
}

.app-shell.nav-collapsed {
  grid-template-columns: 64px 1fr 0px;
}

/* --- Rail --- */
.nav-rail {
  grid-row: 1 / 3;
  background: var(--color-bg-surface);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  padding: 0.75rem 0;
  z-index: 100;
}

.nav-item {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-text-muted);
  transition: all 0.2s;
  margin-bottom: 0.5rem;
}

.nav-item:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-hover);
}

.nav-item.active {
  color: var(--color-accent-primary);
  border-left: 2px solid var(--color-accent-primary);
  background: rgba(112, 0, 255, 0.1);
}

.nav-icon { font-size: 1.25rem; }

/* --- Header --- */
.app-header {
  grid-column: 2 / 3;
  background: var(--color-bg-base);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
}

.header-title {
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: -0.02em;
}

.status-badge {
  font-size: 0.65rem;
  background: rgba(0, 212, 255, 0.1);
  color: var(--color-accent-secondary);
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid rgba(0, 212, 255, 0.3);
}

/* --- Main Console --- */
.main-console {
  grid-column: 2 / 3;
  padding: 2rem;
  overflow-y: auto;
  background: radial-gradient(circle at top left, #12151c 0%, #0a0c10 100%);
}

.tab-pane { display: none; }
.tab-pane.active { display: block; }

/* --- Diagnostic Console --- */
.session-header h1 {
  font-size: 1.75rem;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: var(--color-text-secondary);
  margin-bottom: 2rem;
}

.input-methods {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.input-method-btn {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.input-method-btn.active {
  background: var(--color-bg-hover);
  border-color: var(--color-accent-primary);
  color: var(--color-text-primary);
}

.panel-viewport {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  margin-bottom: 2rem;
}

textarea {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--color-text-primary);
  font-family: 'Inter', sans-serif;
  font-size: 1rem;
  resize: none;
  min-height: 100px;
  outline: none;
}

.action-btn-primary {
  background: var(--color-accent-primary);
  color: white;
  border: none;
  padding: 0.6rem 1.25rem;
  border-radius: var(--radius-sm);
  font-weight: 600;
  cursor: pointer;
  margin-top: 1rem;
}

/* --- Evidence Vault --- */
.evidence-vault {
  margin-bottom: 2rem;
}

.evidence-tag {
  display: inline-flex;
  align-items: center;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  padding: 4px 12px;
  border-radius: 20px;
  margin-right: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 0.8rem;
}

.tag-remove {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  margin-left: 8px;
  cursor: pointer;
}

/* --- Inspector --- */
.inspector-panel {
  background: var(--color-bg-surface);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
}

.inspector-header {
  padding: 1rem;
  border-bottom: 1px solid var(--color-border);
}

.inspector-header h3 {
  margin: 0;
  font-size: 0.85rem;
  text-transform: uppercase;
  color: var(--color-text-muted);
  letter-spacing: 0.05em;
}

.inspector-body {
  padding: 1rem;
  overflow-y: auto;
}
"""

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(shell_styles + "\n" + existing)
print(f"Updated {css_path}")
