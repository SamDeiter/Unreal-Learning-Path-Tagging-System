/**
 * Tracking Abstraction Layer for UE5 Learning Path Builder
 *
 * Works in two modes:
 * 1. STANDALONE: Uses local/Firebase logging (default)
 * 2. LMS: Uses xAPI (Tin Can) for Absorb LMS integration
 *
 * Usage:
 *   Tracker.init();
 *   Tracker.trackEvent('path_started', { pathId: 'lumen_flickering', title: 'Fix Lumen Flickering' });
 *   Tracker.trackEvent('step_completed', { pathId: 'lumen_flickering', stepNumber: 1 });
 *   Tracker.trackEvent('path_completed', { pathId: 'lumen_flickering' });
 */

const Tracker = {
  // Current mode: 'standalone' or 'lms'
  mode: "standalone",

  // xAPI actor (learner identity from LMS)
  actor: null,

  // xAPI endpoint
  endpoint: null,

  // Base URL for activity IDs
  baseUrl: "https://ue5-learning-paths.web.app",

  // Local query analytics (for standalone mode)
  analytics: {
    queries: [],
    pathsGenerated: 0,
    sessionStart: new Date().toISOString(),
  },

  /**
   * Initialize the tracker. Detects LMS launch parameters.
   */
  init() {
    const params = new URLSearchParams(window.location.search);

    // Check for xAPI launch parameters (from Absorb or other LMS)
    if (params.has("endpoint") && params.has("actor")) {
      this.mode = "lms";
      this.endpoint = params.get("endpoint");

      try {
        this.actor = JSON.parse(decodeURIComponent(params.get("actor")));
      } catch (e) {
        console.warn(
          "[Tracker] Failed to parse actor, falling back to standalone mode",
        );
        this.mode = "standalone";
        return;
      }

      // Configure ADL xAPI Wrapper if available
      if (typeof ADL !== "undefined" && ADL.XAPIWrapper) {
        ADL.XAPIWrapper.changeConfig({
          endpoint: this.endpoint,
          auth: params.get("auth") || "",
        });
        console.log(
          "[Tracker] LMS mode initialized - xAPI endpoint:",
          this.endpoint,
        );
      } else {
        console.warn(
          "[Tracker] xAPI wrapper not loaded, falling back to standalone",
        );
        this.mode = "standalone";
      }
    } else {
      console.log("[Tracker] Standalone mode initialized");
    }

    // Load persisted analytics from localStorage
    this._loadLocalAnalytics();
  },

  /**
   * Track an event (works in both modes)
   * @param {string} eventType - Type of event: 'query', 'path_started', 'step_completed', 'path_completed', 'video_watched'
   * @param {object} data - Event-specific data
   */
  trackEvent(eventType, data = {}) {
    console.log(`[Tracker] Event: ${eventType}`, data);

    if (this.mode === "lms") {
      this._sendXAPIStatement(eventType, data);
    } else {
      this._logStandalone(eventType, data);
    }
  },

  /**
   * Track a search query (for "most commonly asked" analytics)
   */
  trackQuery(query, tags = []) {
    this.analytics.queries.push({
      query: query.toLowerCase().trim(),
      tags: tags,
      timestamp: new Date().toISOString(),
    });
    this.analytics.pathsGenerated++;

    this._saveLocalAnalytics();

    // Also track as event
    this.trackEvent("query", { query, tags });
  },

  /**
   * Get most commonly asked queries
   * @param {number} limit - Maximum number to return
   * @returns {Array} Sorted list of {query, count}
   */
  getTopQueries(limit = 10) {
    const counts = {};
    this.analytics.queries.forEach((q) => {
      const key = q.query;
      counts[key] = (counts[key] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  },

  /**
   * Get analytics summary
   */
  getAnalyticsSummary() {
    return {
      mode: this.mode,
      totalQueries: this.analytics.queries.length,
      pathsGenerated: this.analytics.pathsGenerated,
      sessionStart: this.analytics.sessionStart,
      topQueries: this.getTopQueries(5),
      isLMSMode: this.mode === "lms",
    };
  },

  // ============ PRIVATE METHODS ============

  /**
   * Send xAPI statement to LRS
   */
  _sendXAPIStatement(eventType, data) {
    if (typeof ADL === "undefined" || !ADL.XAPIWrapper) {
      console.warn("[Tracker] xAPI wrapper not available");
      return;
    }

    let statement;

    switch (eventType) {
      case "query":
        statement = this._buildQueryStatement(data);
        break;
      case "path_started":
        statement = this._buildPathStartedStatement(data);
        break;
      case "step_completed":
        statement = this._buildStepCompletedStatement(data);
        break;
      case "path_completed":
        statement = this._buildPathCompletedStatement(data);
        break;
      case "video_watched":
        statement = this._buildVideoWatchedStatement(data);
        break;
      default:
        statement = this._buildGenericStatement(eventType, data);
    }

    if (statement) {
      statement.actor = this.actor;
      ADL.XAPIWrapper.sendStatement(statement, (err, res) => {
        if (err) {
          console.error("[Tracker] xAPI send failed:", err);
        } else {
          console.log(
            "[Tracker] xAPI statement sent:",
            statement.verb.display["en-US"],
          );
        }
      });
    }
  },

  _buildQueryStatement(data) {
    return {
      verb: {
        id: "http://adlnet.gov/expapi/verbs/asked",
        display: { "en-US": "searched" },
      },
      object: {
        id: `${this.baseUrl}/search`,
        definition: {
          name: { "en-US": `Search: ${data.query}` },
          type: "http://adlnet.gov/expapi/activities/interaction",
        },
      },
      result: {
        response: data.query,
      },
    };
  },

  _buildPathStartedStatement(data) {
    return {
      verb: ADL.verbs.initialized,
      object: {
        id: `${this.baseUrl}/path/${data.pathId}`,
        definition: {
          name: { "en-US": data.title || data.pathId },
          type: "http://adlnet.gov/expapi/activities/course",
        },
      },
    };
  },

  _buildStepCompletedStatement(data) {
    return {
      verb: ADL.verbs.completed,
      object: {
        id: `${this.baseUrl}/path/${data.pathId}/step/${data.stepNumber}`,
        definition: {
          name: { "en-US": data.title || `Step ${data.stepNumber}` },
          type: "http://adlnet.gov/expapi/activities/module",
        },
      },
      result: {
        completion: true,
        success: true,
      },
    };
  },

  _buildPathCompletedStatement(data) {
    return {
      verb: ADL.verbs.passed,
      object: {
        id: `${this.baseUrl}/path/${data.pathId}`,
        definition: {
          name: { "en-US": data.title || data.pathId },
          type: "http://adlnet.gov/expapi/activities/course",
        },
      },
      result: {
        completion: true,
        success: true,
        score: { scaled: 1.0 },
      },
    };
  },

  _buildVideoWatchedStatement(data) {
    return {
      verb: ADL.verbs.experienced,
      object: {
        id: data.url,
        definition: {
          name: { "en-US": data.title || "Video" },
          type: "http://adlnet.gov/expapi/activities/media",
        },
      },
    };
  },

  _buildGenericStatement(eventType, data) {
    return {
      verb: {
        id: `http://adlnet.gov/expapi/verbs/${eventType}`,
        display: { "en-US": eventType },
      },
      object: {
        id: `${this.baseUrl}/event/${eventType}`,
        definition: {
          name: { "en-US": eventType },
          type: "http://adlnet.gov/expapi/activities/interaction",
          extensions: {
            [`${this.baseUrl}/extensions/data`]: data,
          },
        },
      },
    };
  },

  /**
   * Log event in standalone mode (localStorage + console)
   */
  _logStandalone(eventType, data) {
    const event = {
      type: eventType,
      data: data,
      timestamp: new Date().toISOString(),
    };

    // Store in localStorage for persistence
    const events = JSON.parse(
      localStorage.getItem("ue5_tracker_events") || "[]",
    );
    events.push(event);

    // Keep last 1000 events
    if (events.length > 1000) {
      events.shift();
    }

    localStorage.setItem("ue5_tracker_events", JSON.stringify(events));
  },

  /**
   * Load analytics from localStorage
   */
  _loadLocalAnalytics() {
    try {
      const stored = localStorage.getItem("ue5_tracker_analytics");
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with existing
        this.analytics.queries = parsed.queries || [];
        this.analytics.pathsGenerated = parsed.pathsGenerated || 0;
      }
    } catch (e) {
      console.warn("[Tracker] Failed to load analytics:", e);
    }
  },

  /**
   * Save analytics to localStorage
   */
  _saveLocalAnalytics() {
    try {
      localStorage.setItem(
        "ue5_tracker_analytics",
        JSON.stringify(this.analytics),
      );
    } catch (e) {
      console.warn("[Tracker] Failed to save analytics:", e);
    }
  },
};

// Auto-initialize when DOM is ready
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => Tracker.init());
  } else {
    Tracker.init();
  }
}

// Export for module systems
if (typeof module !== "undefined" && module.exports) {
  module.exports = Tracker;
}
