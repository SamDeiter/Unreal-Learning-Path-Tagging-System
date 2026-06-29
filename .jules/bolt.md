## 2025-05-14 - Cache feedback localStorage access
**Learning:** Synchronous `localStorage.getItem` and `JSON.parse` operations inside hot loops (like video ranking) can cause significant latency as the feedback data grows.
**Action:** Use a module-level cache to ensure `localStorage` is read and parsed only once per session or until an update occurs.
