/**
 * EngineVersionPicker — small select for the learner's installed UE version.
 * Drives the version-delta surface (EngineDeltaChip uses the same hook).
 */
import { useUserEngineVersion } from "../../hooks/useUserEngineVersion";
import "./EngineVersionPicker.css";

// Full UE5 range, current through imminent. Bump the upper bound when a new
// minor release is announced (or move this to a config that pulls from data
// once we have engineRef changeLogs covering newer versions).
const SUPPORTED_VERSIONS = ["5.0", "5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "5.8"];

export function EngineVersionPicker() {
  const [version, setVersion] = useUserEngineVersion();

  return (
    <label className="engine-version-picker">
      <span className="engine-version-picker__label">Your UE</span>
      <select
        className="engine-version-picker__select"
        value={version}
        onChange={(e) => setVersion(e.target.value)}
        title="Set your installed Unreal Engine version. Used to flag content that predates your version."
      >
        {SUPPORTED_VERSIONS.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
    </label>
  );
}
