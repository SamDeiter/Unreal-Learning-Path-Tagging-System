## 2025-05-15 - Platform-Aware Keyboard Shortcuts
**Learning:** Users on different operating systems expect different modifier keys (Cmd on Mac, Ctrl on Windows/Linux). Hardcoding "Ctrl" in UI hints or logic leads to a sub-par experience for Mac users who naturally reach for the Command key.
**Action:** Use a centralized utility like `osUtils.js` to detect the platform and provide dynamic `MODIFIER_KEY` constants for both UI hints and event listener logic (`e.ctrlKey || e.metaKey`).
