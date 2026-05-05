/**
 * UnderstandingUEVersionMigrations — concept page composer.
 *
 * Six discrete sections, each in its own file under ./UnderstandingUEVersionMigrations/.
 * Data is shared via ./UnderstandingUEVersionMigrations/data/ + the global
 * ./../data/versionDeltas.js. The composer's only job is layout + wiring.
 *
 * Hash-route: #/concept/understanding-ue-version-migrations
 */
import { ConceptPageShell } from "../ConceptPageShell";
import { useUserEngineVersion } from "../../../hooks/useUserEngineVersion";

import { VERSION_DELTAS } from "../data/versionDeltas";
import { REF_EXPOSURE, TOTAL_AFFECTED_VIDEOS } from "./UnderstandingUEVersionMigrations/data/exposure";
import { SIMULATOR_SCRIPTS } from "./UnderstandingUEVersionMigrations/data/simulatorScripts";
import { QUIZ_QUESTIONS } from "./UnderstandingUEVersionMigrations/data/quizQuestions";

import { HeroTimeline } from "./UnderstandingUEVersionMigrations/HeroTimeline";
import { ExposurePanel } from "./UnderstandingUEVersionMigrations/ExposurePanel";
import { DeltaGallery } from "./UnderstandingUEVersionMigrations/DeltaGallery";
import { Simulator } from "./UnderstandingUEVersionMigrations/Simulator";
import { Quiz } from "./UnderstandingUEVersionMigrations/Quiz";
import { Checklist } from "./UnderstandingUEVersionMigrations/Checklist";

export function UnderstandingUEVersionMigrations() {
  const [userVersion] = useUserEngineVersion();
  const refs = VERSION_DELTAS.refs;

  return (
    <ConceptPageShell
      title="Understanding UE Version Migrations"
      subtitle={`What your 5.6 tutorials don't say — ${refs.length} verified deltas in 5.7. What changed, why it matters, how to migrate.`}
    >
      <div className="flex flex-col">
        <HeroTimeline
          refs={refs}
          userVersion={userVersion}
          exposure={REF_EXPOSURE}
          totalAffected={TOTAL_AFFECTED_VIDEOS}
        />
        <ExposurePanel
          refs={refs}
          exposure={REF_EXPOSURE}
          totalAffected={TOTAL_AFFECTED_VIDEOS}
        />
        <DeltaGallery refs={refs} exposure={REF_EXPOSURE} />
        <Simulator scripts={SIMULATOR_SCRIPTS} refs={refs} />
        <Quiz questions={QUIZ_QUESTIONS} />
        <Checklist refs={refs} userVersion={userVersion} />
      </div>
    </ConceptPageShell>
  );
}
