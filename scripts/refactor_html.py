import os

html_path = r'c:\Users\Sam Deiter\Documents\GitHub\Unreal-Learning-Path-Tagging-System\ui\index.html'
with open(html_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add the new stylesheet
if 'industrial-calm.css' not in content:
    content = content.replace('<link rel="stylesheet" href="css/layout.css" />', 
                              '<link rel="stylesheet" href="css/layout.css" />\n    <link rel="stylesheet" href="css/industrial-calm.css" />')

# Build the new Body structure
new_body_start = '''  <body>
    <div class="app-shell" id="appShell">
      <!-- Navigation Rail -->
      <aside class="nav-rail">
        <div class="nav-item active" id="nav-session" title="Initialize Session" onclick="switchTab('session')">
          <span class="nav-icon">📡</span>
        </div>
        <div class="nav-item" id="nav-library" title="Path Library" onclick="switchTab('library')">
          <span class="nav-icon">📚</span>
        </div>
        <div class="nav-item" id="nav-ops" title="System Operations" onclick="switchTab('ops')">
          <span class="nav-icon">⚙️</span>
        </div>
        <div style="margin-top: auto;">
          <div class="nav-item" title="Settings" onclick="switchTab('settings')">
            <span class="nav-icon">🛠️</span>
          </div>
        </div>
      </aside>

      <!-- App Header -->
      <header class="app-header">
        <div class="header-left">
          <span class="header-title">UE5 Intelligence Console</span>
          <span class="status-badge badge-cyan" style="margin-left: 1rem;">v0.1.86 Online</span>
        </div>
        <div class="header-right">
          <button class="sidebar-btn" onclick="toggleInspector()" style="padding: 0.25rem 0.75rem; font-size: 0.7rem;">Inspector ◨</button>
        </div>
      </header>

      <!-- Main Console Area -->
      <main class="main-console" id="mainContent">'''

# Terminology Updates
content = content.replace('<h1>🎮 UE5 Learning Path Builder</h1>', '')
content = content.replace('<p class="subtitle">\n          Enter your problem, get a structured learning path from existing content\n        </p>', '')
content = content.replace('<h2 class="basket-title">🧺 Build Your Problem</h2>', '<h2 class="basket-title">Initialize Diagnostic Session</h2>')
content = content.replace('Add ingredients to describe your issue, then generate a learning path', 'Provide context evidence to generate a specialized operations path')
content = content.replace('🚀 Generate Learning Path', 'Initialize Path Blueprint')

# Inject the start of the shell
content = content.replace('<body>', new_body_start)

# Setup Inspector
inspector_html = '''      </main>

      <!-- Inspector Sidebar -->
      <aside class="inspector" id="inspector">
        <div class="inspector-header">
          <h3 style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-secondary);">Live Context</h3>
        </div>
        <div id="inspectorContent">
          <!-- Step Tree and Progress will be moved here via JS -->
        </div>
      </aside>
    </div>'''

# Move the footer and close the shell
content = content.replace('<footer class="site-footer">', inspector_html + '\n    <footer class="site-footer">')

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('HTML refactored successfully.')
