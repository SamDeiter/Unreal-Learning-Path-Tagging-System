/**
 * Narrator Service - Generates AI-powered intro and bridge text
 * Bridges multiple instructors with a unified voice
 */

/**
 * Generate personalized intro text for a learning path
 * @param {Object} params
 * @param {string} params.problemSummary - The user's problem summary
 * @param {Array} params.courses - Selected courses with instructor info
 * @param {Object} params.diagnosis - AI diagnosis from queryLearningPath
 * @returns {Object} Intro text and metadata
 */
export function generatePathIntro({ problemSummary, courses, diagnosis }) {
  if (!courses || courses.length === 0) {
    return {
      title: "Your Learning Path",
      intro: "Let's solve your problem step by step.",
      instructors: [],
      totalDuration: null,
    };
  }

  // Extract unique instructors from courses
  const instructors = extractInstructors(courses);

  // Calculate total duration
  const totalDuration = calculateTotalDuration(courses);

  // Generate intro based on problem and instructors
  const intro = buildIntroText({
    problemSummary,
    instructors,
    courseCount: courses.length,
    totalDuration,
    rootCauses: diagnosis?.root_causes || [],
  });

  return {
    title: `Your Path: ${summarizeProblem(problemSummary)}`,
    intro,
    instructors,
    totalDuration,
    courseCount: courses.length,
  };
}

/**
 * Generate context bridge text between videos
 * @param {Object} previousCourse - The course that just finished
 * @param {Object} nextCourse - The upcoming course
 * @param {Object} learningObjective - What this video teaches
 * @returns {Object} Bridge text and display info
 */
export function generateBridgeText(previousCourse, nextCourse, learningObjective) {
  if (!nextCourse) {
    return {
      type: "completion",
      text: "🎉 Congratulations! You've completed your learning path.",
      subtext: "You now have the skills to solve this problem and similar ones in the future.",
    };
  }

  const prevInstructor = extractInstructorName(previousCourse);
  const nextInstructor = extractInstructorName(nextCourse);
  const nextTitle = nextCourse.title || nextCourse.name || "the next lesson";

  // Different instructors = transition message
  if (prevInstructor && nextInstructor && prevInstructor !== nextInstructor) {
    return {
      type: "transition",
      text: `Now let's hear from ${nextInstructor}`,
      subtext: `${nextInstructor} will cover: ${learningObjective || nextTitle}`,
      instructor: nextInstructor,
    };
  }

  // Same instructor = continuation
  return {
    type: "continuation",
    text: `Next up: ${nextTitle}`,
    subtext: learningObjective || null,
    instructor: nextInstructor,
  };
}

/**
 * Extract unique instructors from courses
 */
function extractInstructors(courses) {
  const instructorSet = new Set();
  const instructorList = [];

  courses.forEach((course) => {
    const instructor = extractInstructorName(course);
    if (instructor && !instructorSet.has(instructor)) {
      instructorSet.add(instructor);
      instructorList.push({
        name: instructor,
        courses: [course.title || course.name],
        totalDuration: calculateCourseDuration(course),
      });
    } else if (instructor) {
      // Add course to existing instructor
      const existing = instructorList.find((i) => i.name === instructor);
      if (existing) {
        existing.courses.push(course.title || course.name);
        existing.totalDuration += calculateCourseDuration(course);
      }
    }
  });

  return instructorList;
}

/**
 * Extract instructor name from course metadata
 */
function extractInstructorName(course) {
  if (!course) return null;

  // Try different field names
  return (
    course.instructor ||
    course.author ||
    course.creator ||
    course.teacher ||
    // Parse from title if contains "by" or "with"
    parseInstructorFromTitle(course.title || course.name) ||
    null
  );
}

/**
 * Parse instructor name from title (e.g., "Lumen Basics by Sarah")
 */
function parseInstructorFromTitle(title) {
  if (!title) return null;

  // Match patterns like "... by Name" or "... with Name"
  const byMatch = title.match(/\bby\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i);
  if (byMatch) return byMatch[1];

  const withMatch = title.match(/\bwith\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i);
  if (withMatch) return withMatch[1];

  return null;
}

/**
 * Calculate total duration of all courses
 */
function calculateTotalDuration(courses) {
  const totalSeconds = courses.reduce((sum, course) => {
    return sum + calculateCourseDuration(course);
  }, 0);

  return formatDurationText(totalSeconds);
}

/**
 * Calculate duration of a single course in seconds
 */
function calculateCourseDuration(course) {
  if (!course) return 0;

  // Try duration_seconds directly
  if (course.duration_seconds) return course.duration_seconds;

  // Try duration_minutes
  if (course.duration_minutes) return course.duration_minutes * 60;

  // Sum video durations
  if (course.videos?.length) {
    return course.videos.reduce((sum, v) => sum + (v.duration_seconds || 0), 0);
  }

  return 0;
}

/**
 * Format duration in seconds to readable text
 */
function formatDurationText(seconds) {
  if (!seconds || seconds <= 0) return null;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
  }
  return `${minutes} min`;
}

/**
 * Summarize problem into short title
 */
function summarizeProblem(problemSummary) {
  if (!problemSummary) return "Learning Path";

  // Show full text if short, otherwise truncate at word boundary
  if (problemSummary.length <= 80) return problemSummary;
  const truncated = problemSummary.slice(0, 80);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 30 ? truncated.slice(0, lastSpace) : truncated) + "…";
}

/**
 * Build the intro text paragraph
 */
function buildIntroText({ instructors, courseCount, totalDuration, rootCauses }) {
  const parts = [];

  // Opening based on problem
  if (rootCauses.length > 0) {
    parts.push(
      `We've identified ${rootCauses.length} root cause${rootCauses.length > 1 ? "s" : ""} for your issue.`
    );
  }

  // Instructor mention
  if (instructors.length === 1) {
    parts.push(
      `${instructors[0].name} will guide you through ${courseCount} lesson${courseCount > 1 ? "s" : ""}.`
    );
  } else if (instructors.length > 1) {
    const names = instructors.map((i) => i.name);
    const lastInstructor = names.pop();
    parts.push(`You'll learn from ${names.join(", ")} and ${lastInstructor}.`);
  } else {
    parts.push(`You have ${courseCount} lesson${courseCount > 1 ? "s" : ""} to complete.`);
  }

  // Duration
  if (totalDuration) {
    parts.push(`Total time: ${totalDuration}.`);
  }

  return parts.join(" ");
}

/**
 * Generate progress text for current position
 */
export function generateProgressText(currentIndex, totalCount) {
  const percent = Math.round(((currentIndex + 1) / totalCount) * 100);
  return {
    text: `Video ${currentIndex + 1} of ${totalCount}`,
    percent,
    isComplete: currentIndex + 1 >= totalCount,
  };
}

/**
 * Tag-specific challenge registry.
 * Each entry has multiple concrete tasks so courses get variety.
 * Tasks reference real UE5 UI: menu paths, panel names, specific tools.
 */
const CHALLENGE_REGISTRY = {
  blueprint: [
    {
      task: "Create a new Actor Blueprint (right-click Content Browser → Blueprint Class → Actor). Add a Point Light component and a Box Collision. In the Event Graph, wire 'On Component Begin Overlap' → 'Set Visibility' to toggle the light when the player walks through.",
      hint: "Compile the Blueprint after wiring. Drop it in your level and hit Play to test the overlap.",
    },
    {
      task: "Open any existing Blueprint. Add a Custom Event called 'ResetState'. Wire it to set at least 2 variables back to their defaults, then call it from Begin Play with a 3-second Delay node.",
      hint: "Right-click the Event Graph → Add Custom Event. Use a 'Delay' node (set Duration to 3.0) before the call.",
    },
  ],
  materials: [
    {
      task: "Create a new Material (right-click Content Browser → Material). Add a Texture Sample node for a Base Color map, plug a Constant3Vector into Emissive Color with a value like (1, 0.5, 0), and set Blend Mode to 'Masked'. Apply it to a cube in your scene.",
      hint: "Double-click the Material to open the editor. Drag from output pins to input pins to connect nodes.",
    },
    {
      task: "Create a Material Instance from an existing Material (right-click → Create Material Instance). Expose at least 2 parameters (a color and a scalar), then adjust them on the instance to see the changes live in the viewport.",
      hint: "In the parent Material, right-click a Constant → 'Convert to Parameter' and give it a name.",
    },
  ],
  lighting: [
    {
      task: "Build a small interior room with 4 walls and a ceiling (use BSP or cubes). Place a Rect Light (Add → Lights → Rect Light) inside, set its Source Width/Height to 200, Intensity to 15 cd, and color to warm white (4200K). Compare the result with a basic Point Light.",
      hint: "Select the Rect Light → Details panel → Light section. Use 'Lit' viewport mode to see the final result.",
    },
    {
      task: "Set up a three-point lighting rig: one Directional Light as key, one Rect Light as fill (half the intensity, opposite side), and one Spot Light as rim/backlight behind the subject. Screenshot the result.",
      hint: "Key light: ~10 lux, Fill: ~5 lux, Rim: ~8 lux. Adjust the Directional Light's rotation in the Details panel.",
    },
  ],
  lumen: [
    {
      task: "Go to Project Settings → Engine → Rendering → Global Illumination. Switch the method to Lumen. Place a colored Rect Light in a corner of a room and observe the indirect bounce light on nearby walls. Then try switching to 'Hardware Ray Tracing' under Lumen settings and compare.",
      hint: "Use viewport Show → Visualize → Lumen Scene to debug. Software tracing works on any GPU; hardware RT needs RTX/RX 6000+.",
    },
    {
      task: "Create a dark hallway with one open doorway letting in a Directional Light. With Lumen enabled, observe how light bleeds around the doorframe. Add an Emissive Material (Emissive value > 5) to a mesh inside and verify Lumen picks up the emission as a light source.",
      hint: "Emissive lighting in Lumen needs Emissive values well above 1.0. Try 10-50 for visible bounce.",
    },
  ],
  animation: [
    {
      task: "Open an Animation Blueprint for any Skeletal Mesh. In the Anim Graph, add a Blend Space 1D node. Create a new Blend Space asset (right-click Content Browser → Animation → Blend Space 1D), set the axis from 0-600 for 'Speed', and add Idle at 0 and Walk at 300.",
      hint: "The X-axis parameter typically maps to a 'Speed' variable. Add sample points by right-clicking the graph area.",
    },
    {
      task: "Create an Animation Montage from any animation (right-click anim → Create Montage). Add a Notify at the halfway point called 'FootstepSound'. In the Anim Blueprint's Event Graph, handle 'Anim Notify FootstepSound' to print a string.",
      hint: "In the Montage timeline, right-click → Add Notify → New Notify. Name it exactly to match your handler.",
    },
  ],
  niagara: [
    {
      task: "Create a new Niagara System (right-click Content Browser → FX → Niagara System → New System from Template → Fountain). Open it, find the 'Initialize Particle' module, and change the Lifetime from the default to a Min/Max of 1.0-3.0. Change the Sprite Size to 5-15. Drop it in your level.",
      hint: "Expand modules by clicking the arrow. Each module has parameters you can override. Use the preview panel to see changes live.",
    },
    {
      task: "In an existing Niagara emitter, add a 'Curl Noise Force' module (click + in the Particle Update group → search 'Curl Noise'). Set Noise Strength to 200 and Frequency to 0.5. Observe how particles now swirl instead of falling straight.",
      hint: "Curl Noise is under Particle Update → Forces. Increase Strength for more dramatic swirling.",
    },
  ],
  landscape: [
    {
      task: "Enter Landscape Mode (Shift+3 or Modes panel → Landscape). Create a new landscape (Manage → New, 63×63 quads). Use the Sculpt tool to carve a river bed: flatten a path, then lower it with the Erosion tool. Paint a water material on the channel.",
      hint: "Ctrl+scroll to resize brush. Flatten tool: hold Ctrl to sample target height first, then paint to level.",
    },
    {
      task: "Add a Landscape Layer Blend material with 3 layers: Grass, Rock, and Sand. In Landscape Paint mode, paint each layer onto appropriate terrain areas. Add at least one auto-threshold rule based on slope angle.",
      hint: "In the Material Editor, use a 'Landscape Layer Blend' node with 'LB Weight Blend' type. Each layer needs a Layer Info asset.",
    },
  ],
  mesh: [
    {
      task: "Import a Static Mesh (drag an .fbx into the Content Browser). Open the Static Mesh Editor (double-click). Add a second LOD: Mesh → LOD Settings → set Number of LODs to 2 → click 'Apply Changes'. Set LOD1's screen size to 0.5.",
      hint: "LOD0 is the highest detail. LOD1 kicks in when the mesh is smaller than 50% of the screen.",
    },
  ],
  texture: [
    {
      task: "Import a texture (drag a .png into Content Browser). Open it and change Compression Settings to 'BC7' for quality. Set the LOD Bias to 1 to test lower mip levels. Create a Material using this texture as Base Color and verify it renders in-scene.",
      hint: "Texture Editor → Details → Compression → Compression Settings. Apply changes with 'Save'.",
    },
  ],
  character: [
    {
      task: "Open your Character Blueprint. In the Details panel, find the Character Movement component. Set Max Walk Speed to 400, Jump Z Velocity to 600, and Air Control to 0.3. Test in Play mode — your character should now run faster and have more air steering.",
      hint: "Character Movement is a component on your Character BP. All movement tuning is under 'Character Movement: Walking' and 'Jumping/Falling'.",
    },
  ],
  sequencer: [
    {
      task: "Create a Level Sequence (Cinematics → Add Level Sequence). Add an actor track for a light in your scene. At frame 0, set intensity to 0. At frame 120, set intensity to 20. Play back the sequence and watch the light fade in over 4 seconds (at 30fps).",
      hint: "Click + Track → Actor to Sequence → select the light. Right-click a property → 'Add Key' at the playhead position.",
    },
  ],
  umg: [
    {
      task: "Create a Widget Blueprint (right-click Content Browser → User Interface → Widget Blueprint). Add a Vertical Box with a Text block ('Health: 100') and a Progress Bar below it. In the Graph, bind the Progress Bar's Percent to a float variable called 'HealthPercent'.",
      hint: "Select the Progress Bar → Details → Percent → click 'Bind' → Create Binding function that returns your HealthPercent variable.",
    },
  ],
  performance: [
    {
      task: "Open your project and press ` (backtick) to open the console. Type 'stat fps' → Enter, then 'stat unit' → Enter. Walk around your scene and note where GPU ms spikes above 16ms. Use 'stat scenerendering' to find the most expensive render pass.",
      hint: "stat unit shows Game, Draw, GPU, and RHIT thread times. The bottleneck is whichever thread has the highest ms value.",
    },
  ],
  nanite: [
    {
      task: "Import a high-poly mesh (1M+ triangles). Enable Nanite on it: Static Mesh Editor → Nanite Settings → check 'Enable Nanite Support' → Apply. Place 50 instances in your scene using the Foliage tool and compare the frame rate with Nanite on vs. off using 'stat fps'.",
      hint: "Nanite works best on Static Meshes without transparency. Use 'r.Nanite.Visualize.Overview 1' in console to see Nanite clusters.",
    },
  ],
  rendering: [
    {
      task: "Open Project Settings → Engine → Rendering. Enable 'Virtual Shadow Maps'. Place a Directional Light, set it to Movable, and verify shadows render correctly. Compare the shadow quality at distance by zooming the camera far from objects.",
      hint: "Virtual Shadow Maps replace Cascaded Shadow Maps. Check 'stat ShadowRendering' for performance impact.",
    },
  ],
  component: [
    {
      task: "Open any Actor Blueprint. Add 3 components: a Static Mesh (as root), an Audio Component (attach a sound cue), and a Particle System. Arrange them in the component hierarchy so the particle and audio are children of the mesh. Test that moving the root moves everything.",
      hint: "Drag components onto others in the hierarchy to parent them. Children inherit transform from their parent.",
    },
  ],
  actor: [
    {
      task: "Right-click in the level viewport → Place Actor → Empty Actor. Add a Scene Component as root, then add a Static Mesh and a Spot Light as children. Position the Spot Light to illuminate the mesh. Save the actor as a Blueprint (select it → Blueprints → Convert Selection to Blueprint Class).",
      hint: "Converting to a Blueprint lets you reuse this actor setup across levels. Choose 'Harvest Components' when prompted.",
    },
  ],
  foliage: [
    {
      task: "Enter Foliage Mode (Shift+4). Add a tree or bush mesh to the foliage palette (drag from Content Browser). Set Density to 200, Min/Max Scale to 0.8-1.2, and enable 'Align to Normal'. Paint foliage on a Landscape surface and check the instance count in the Foliage panel.",
      hint: "Use Erase (Shift+click) to remove foliage. Larger brush radius + lower density gives more natural distribution.",
    },
  ],
  plugin: [
    {
      task: "Go to Edit → Plugins. Search for 'Water' (the built-in Water plugin). Enable it and restart the editor. After restart, place a Water Body Lake in your level (Place Actors → Water Body Lake) and observe how it auto-generates a water surface.",
      hint: "Many built-in plugins are disabled by default. The Water plugin requires a Landscape in the level to function properly.",
    },
  ],
};

/**
 * Generate a hands-on challenge based on course metadata.
 * Uses tag-specific templates with concrete UE5 steps.
 *
 * @param {Object} course - current course object
 * @param {string} problemContext - the user's original problem summary
 * @param {string} videoTitle - title of the current video
 * @returns {{ task: string, hint: string, difficulty: string }}
 */
export function generateChallenge(course, problemContext, videoTitle) {
  // Collect tags from ALL available sources
  const tags = [
    ...(course?.canonical_tags || []),
    ...(course?.gemini_system_tags || []),
    ...(course?.transcript_tags || []),
    ...(course?.extracted_tags || []),
    ...(Array.isArray(course?.tags) ? course.tags : []),
  ];
  const tagNames = tags
    .map((t) => (typeof t === "string" ? t.split(".").pop() : t.name || t.display_name || ""))
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i); // unique

  const skillLevel = course?.gemini_skill_level || "Intermediate";

  // Try to match tags against the challenge registry (case-insensitive)
  for (const tagName of tagNames) {
    const key = tagName.toLowerCase();
    const templates = CHALLENGE_REGISTRY[key];
    if (templates && templates.length > 0) {
      // Pick deterministically based on course title hash
      const titleHash = (course?.title || "")
        .split("")
        .reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const template = templates[titleHash % templates.length];
      return {
        task: template.task,
        hint: template.hint,
        difficulty: skillLevel,
      };
    }
  }

  // Also check problem context for registry matches
  if (problemContext) {
    const contextLower = problemContext.toLowerCase();
    for (const [key, templates] of Object.entries(CHALLENGE_REGISTRY)) {
      if (contextLower.includes(key)) {
        const template = templates[0];
        return {
          task: template.task,
          hint: template.hint,
          difficulty: skillLevel,
        };
      }
    }
  }

  // Fallback: still specific to UE5 even without a tag match
  const primaryTag =
    tagNames[0] || (videoTitle ? videoTitle.split(/\s+/).slice(0, 3).join(" ") : "this concept");
  const lessonRef = videoTitle ? `"${videoTitle}"` : "this lesson";
  const outcome = course?.gemini_outcomes?.[0] || "";

  return {
    task: problemContext
      ? `Open UE5 and apply the technique from ${lessonRef} to address "${problemContext}". In the Details panel, identify which ${primaryTag} settings you changed and note the before/after values.`
      : `Open UE5, create a test Actor, and set up ${primaryTag} from scratch following the approach from ${lessonRef}. Document which panels and properties you used.`,
    hint: outcome
      ? `Focus on: ${outcome}. Check Details panel and World Settings for relevant options.`
      : `Look for ${primaryTag} options in the Details panel, Modes panel, or Project Settings → Engine.`,
    difficulty: skillLevel,
  };
}
