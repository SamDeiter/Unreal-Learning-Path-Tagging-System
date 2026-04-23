import os

js_path = r'c:\Users\Sam Deiter\Documents\GitHub\Unreal-Learning-Path-Tagging-System\ui\js\app.js'
with open(js_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add UI Control functions at the top or bottom. Let's add them at the bottom.
ui_controls = '''
/** 
 * UI Shell Controls 
 */
function switchTab(tabId) {
    AppState.currentTab = tabId;
    
    // Update Nav Rail UI
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const activeNav = document.getElementById(`nav-${tabId}`);
    if (activeNav) activeNav.classList.add('active');

    // Toggle Content Sections
    const sessionSection = document.querySelector('.search-section');
    const librarySection = document.getElementById('gallerySection');
    const activePathSection = document.getElementById('pathSection');
    
    // Default Hide
    if (sessionSection) sessionSection.style.display = 'none';
    if (librarySection) librarySection.style.display = 'none';
    if (activePathSection) activePathSection.style.display = 'none';

    if (tabId === 'session') {
        if (AppState.currentPath) {
            activePathSection.style.display = 'block';
        } else {
            sessionSection.style.display = 'block';
        }
    } else if (tabId === 'library') {
        librarySection.style.display = 'block';
    } else if (tabId === 'ops') {
        // Ops view - could show system metrics or patterns
        alert('System Heuristics: Monitoring UE5 Pattern Matching Engine...');
    }
}

function toggleInspector() {
    AppState.inspectorOpen = !AppState.inspectorOpen;
    const shell = document.getElementById('appShell');
    if (AppState.inspectorOpen) {
        shell.classList.remove('nav-collapsed');
    } else {
        shell.classList.add('nav-collapsed');
    }
}

// Ensure inspector elements are moved to the inspector panel
function moveSidebarToInspector() {
    const sidebar = document.getElementById('progressSidebar');
    const inspectorContent = document.getElementById('inspectorContent');
    if (sidebar && inspectorContent) {
        // Remove from original flow and move to inspector
        inspectorContent.appendChild(sidebar);
        sidebar.style.display = 'block';
        sidebar.style.position = 'static'; // Unglue from sticky
        sidebar.style.width = '100%';
    }
}

// Run on load
window.addEventListener('DOMContentLoaded', () => {
    moveSidebarToInspector();
    // Default to session tab
    switchTab('session');
    
    // Custom Terminology updates for dynamically rendered items
    const loaderText = document.querySelector('.loading-text');
    if (loaderText) loaderText.textContent = 'System Heuristics Running...';
});
'''

# Update terminology in renderPath
content = content.replace('document.getElementById("pathTitle").textContent = "🎯 Your Learning Path";', 
                         'document.getElementById("pathTitle").textContent = "Operational Path Blueprint";')

# Update generatePath to show the active path section in the session tab
content = content.replace('document.getElementById("pathSection").classList.add("active");', 
                         'document.getElementById("pathSection").classList.add("active");\n  document.getElementById("pathSection").style.display = "block";')

content += ui_controls

with open(js_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('App.js updated with UI controls.')
