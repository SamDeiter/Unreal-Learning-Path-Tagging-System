/* UE5 Intelligence Console - Event Handlers */
document.addEventListener('DOMContentLoaded', () => {
    console.log('Handler Initialization Sequence Started...');

    // --- Navigation Rail ---
    document.querySelectorAll('.rail-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.id.replace('rail-tab-', '');
            if (typeof window.switchTab === 'function') {
                window.switchTab(tabId);
            }
        });
    });

    // --- Inspector Toggle ---
    const inspectorToggle = document.getElementById('inspector-toggle');
    if (inspectorToggle) {
        inspectorToggle.addEventListener('click', () => {
            if (typeof window.toggleInspector === 'function') {
                window.toggleInspector();
            }
        });
    }

    // --- Core Actions ---
    const initializeBtn = document.getElementById('initialize-path-btn');
    if (initializeBtn) {
        initializeBtn.addEventListener('click', () => {
            if (typeof generateFromBasket === 'function') {
                generateFromBasket();
            }
        });
    }

    const backToOpsBtn = document.getElementById('back-to-ops');
    if (backToOpsBtn) {
        backToOpsBtn.addEventListener('click', () => {
            if (typeof goBackToSearch === 'function') {
                goBackToSearch();
            }
        });
    }

    // --- Input Panel Toggles ---
    const inputMethodBtns = document.querySelectorAll('.input-method-btn');
    const panelTypes = ['text', 'log', 'screenshot', 'tags'];
    inputMethodBtns.forEach((btn, i) => {
        if (panelTypes[i]) {
            btn.addEventListener('click', () => {
                if (typeof showInputPanel === 'function') {
                    showInputPanel(panelTypes[i]);
                }
            });
        }
    });

    // --- Video Modal ---
    const videoModal = document.getElementById('videoModal');
    if (videoModal) {
        videoModal.addEventListener('click', (e) => {
            if (e.target === videoModal && typeof closeVideo === 'function') {
                closeVideo();
            }
        });
    }

    const videoCloseBtn = document.querySelector('.video-close');
    if (videoCloseBtn) {
        videoCloseBtn.addEventListener('click', () => {
            if (typeof closeVideo === 'function') closeVideo();
        });
    }
});
