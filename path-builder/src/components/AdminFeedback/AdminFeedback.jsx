/**
 * AdminFeedback — Admin-only component to triage user feedback.
 *
 * Reads from Firestore `feedback` collection via getAdminFeedbackList().
 * Allows admins to view, filter by status, and update feedback status.
 */
import { useState, useEffect, useCallback } from "react";
import { getAdminFeedbackList } from "../../services/feedbackService";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import { getFirebaseApp } from "../../services/firebaseConfig";
import "./AdminFeedback.css";

const STATUS_OPTIONS = ["new", "reviewed", "resolved"];

function AdminFeedback() {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const items = await getAdminFeedbackList();
      setFeedback(items);
    } catch (err) {
      console.error("[AdminFeedback] Failed to load:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const handleStatusChange = async (feedbackId, newStatus) => {
    setUpdatingId(feedbackId);
    try {
      const db = getFirestore(getFirebaseApp());
      const fbDoc = doc(db, "feedback", feedbackId);
      await updateDoc(fbDoc, {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
      setFeedback((prev) =>
        prev.map((f) => (f.id === feedbackId ? { ...f, status: newStatus } : f))
      );
    } catch (err) {
      console.error("[AdminFeedback] Status update failed:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered =
    statusFilter === "all" ? feedback : feedback.filter((f) => f.status === statusFilter);

  const statusCounts = {
    all: feedback.length,
    new: feedback.filter((f) => f.status === "new").length,
    reviewed: feedback.filter((f) => f.status === "reviewed").length,
    resolved: feedback.filter((f) => f.status === "resolved").length,
  };

  const typeEmoji = { bug: "🐛", feature: "💡", general: "💬", content: "📝" };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="admin-feedback">
      <div className="af-header">
        <h2 className="af-title">📋 Feedback Triage</h2>
        <button className="af-refresh" onClick={fetchFeedback} title="Refresh">
          🔄 Refresh
        </button>
      </div>

      <div className="af-filters">
        {["all", ...STATUS_OPTIONS].map((s) => (
          <button
            key={s}
            className={`af-filter-btn ${statusFilter === s ? "active" : ""} af-status-${s}`}
            onClick={() => setStatusFilter(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}{" "}
            <span className="af-count">{statusCounts[s]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="af-loading">Loading feedback...</div>
      ) : filtered.length === 0 ? (
        <div className="af-empty">
          {statusFilter === "all" ? "No feedback submissions yet." : `No ${statusFilter} feedback.`}
        </div>
      ) : (
        <div className="af-table-wrap">
          <table className="af-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Description</th>
                <th>User</th>
                <th>Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className={`af-row af-row-${item.status}`}>
                  <td className="af-type">
                    {typeEmoji[item.type] || "❓"} {item.type}
                  </td>
                  <td className="af-desc">
                    {item.description || <em className="af-no-desc">No description</em>}
                    {item.attachments?.length > 0 && (
                      <span
                        className="af-attach"
                        title={`${item.attachments.length} attachment(s)`}
                      >
                        📎 {item.attachments.length}
                      </span>
                    )}
                  </td>
                  <td className="af-user">{item.userEmail || "Anonymous"}</td>
                  <td className="af-date">{formatDate(item.createdAt)}</td>
                  <td>
                    <span className={`af-status-badge af-status-${item.status}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="af-actions">
                    {STATUS_OPTIONS.filter((s) => s !== item.status).map((s) => (
                      <button
                        key={s}
                        className={`af-action-btn af-action-${s}`}
                        onClick={() => handleStatusChange(item.id, s)}
                        disabled={updatingId === item.id}
                      >
                        {s === "reviewed" ? "👀" : s === "resolved" ? "✅" : "🔄"}{" "}
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AdminFeedback;
