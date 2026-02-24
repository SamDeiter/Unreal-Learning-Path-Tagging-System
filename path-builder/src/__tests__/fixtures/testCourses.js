/**
 * Shared Test Fixtures — Production-Realistic Course Data
 *
 * All test files that need course objects should import from here.
 * These fixtures mirror the real shape and content of courses in
 * video_library.json and course_enrichment_data.json.
 *
 * DO NOT use generic names like "Test Course" or codes like "TEST.01".
 * Every fixture should look like it came from the real catalog.
 */

// ─── Real Course Fixtures ────────────────────────────────────────────────

/** Blueprint-heavy beginner course */
export const blueprintBasicsCourse = {
  code: "102.01",
  title: "Introducing Unreal Editor",
  canonical_tags: ["blueprint", "editor", "interface"],
  gemini_system_tags: ["beginner", "ui"],
  transcript_tags: ["viewport", "content-browser"],
  extracted_tags: ["actor", "level"],
  ai_tags: ["editor-fundamentals"],
  tags: ["blueprint", "editor", "interface", "beginner"],
  gemini_skill_level: "Beginner",
  gemini_outcomes: [
    "Navigate the Unreal Editor interface",
    "Create and modify Blueprint actors",
    "Understand the Content Browser workflow",
  ],
  estimated_minutes: 45,
  total_duration_seconds: 2700,
  _relevanceScore: 85,
  videos: [
    {
      name: "01_Editor_Overview.mp4",
      title: "Editor Overview",
      drive_id: "1abc123def",
      duration_seconds: 540,
    },
    {
      name: "02_Viewport_Navigation.mp4",
      title: "Viewport Navigation",
      drive_id: "2abc456def",
      duration_seconds: 480,
    },
    {
      name: "03_Content_Browser.mp4",
      title: "Content Browser Basics",
      drive_id: "3abc789def",
      duration_seconds: 600,
    },
  ],
};

/** Materials and rendering intermediate course */
export const materialsCourse = {
  code: "311.01",
  title: "Landscape Materials Creation",
  canonical_tags: ["materials", "shaders", "rendering", "landscape"],
  gemini_system_tags: ["intermediate", "art"],
  transcript_tags: ["pbr", "texture", "roughness"],
  extracted_tags: ["material-instance", "normal-map"],
  ai_tags: ["rendering-pipeline"],
  tags: ["materials", "shaders", "rendering", "landscape"],
  gemini_skill_level: "Intermediate",
  gemini_outcomes: [
    "Create PBR landscape materials",
    "Use material instances for variation",
    "Optimize material performance for open worlds",
  ],
  estimated_minutes: 90,
  total_duration_seconds: 5400,
  _relevanceScore: 72,
  videos: [
    {
      name: "01_Material_Basics.mp4",
      title: "Material Editor Introduction",
      drive_id: "4mat001abc",
      duration_seconds: 900,
    },
    {
      name: "02_PBR_Setup.mp4",
      title: "Creating PBR Materials",
      drive_id: "5mat002abc",
      duration_seconds: 1500,
    },
  ],
};

/** C++ programming advanced course */
export const cppGameplayCourse = {
  code: "400.02",
  title: "C++ Gameplay Programming Fundamentals",
  canonical_tags: ["c++", "programming", "gameplay"],
  gemini_system_tags: ["advanced", "engineering"],
  transcript_tags: ["class", "actor", "component"],
  extracted_tags: ["uobject", "garbage-collection"],
  ai_tags: ["code"],
  tags: ["c++", "programming", "gameplay"],
  gemini_skill_level: "Advanced",
  gemini_outcomes: [
    "Create custom C++ gameplay classes",
    "Expose C++ properties to Blueprint",
    "Implement replication in C++",
  ],
  estimated_minutes: 120,
  total_duration_seconds: 7200,
  _relevanceScore: 65,
  videos: [
    {
      name: "01_CPP_Classes.mp4",
      title: "Creating C++ Game Classes",
      drive_id: "6cpp001abc",
      duration_seconds: 1800,
    },
  ],
};

/** Niagara VFX course */
export const niagaraVFXCourse = {
  code: "250.03",
  title: "Introduction to Niagara VFX",
  canonical_tags: ["niagara", "vfx", "particles"],
  gemini_system_tags: ["intermediate", "effects"],
  transcript_tags: ["emitter", "module", "renderer"],
  extracted_tags: ["gpu-particles", "sprite"],
  ai_tags: ["visual-effects"],
  tags: ["niagara", "vfx", "particles"],
  gemini_skill_level: "Intermediate",
  gemini_outcomes: [
    "Create particle systems with Niagara",
    "Use Niagara modules for custom behavior",
    "Optimize VFX for real-time performance",
  ],
  estimated_minutes: 60,
  total_duration_seconds: 3600,
  _relevanceScore: 78,
  videos: [
    {
      name: "01_Niagara_Overview.mp4",
      title: "Niagara System Overview",
      drive_id: "7nfx001abc",
      duration_seconds: 720,
    },
    {
      name: "02_Emitters.mp4",
      title: "Creating Emitters",
      drive_id: "8nfx002abc",
      duration_seconds: 900,
    },
  ],
};

/** Sequencer / cinematics course (for animator persona tests) */
export const sequencerCourse = {
  code: "200.01",
  title: "Getting Started with Sequencer",
  canonical_tags: ["sequencer", "cinematics"],
  gemini_system_tags: ["beginner", "animation"],
  transcript_tags: ["timeline", "keyframe", "camera"],
  extracted_tags: ["matinee", "level-sequence"],
  ai_tags: ["animation"],
  tags: ["sequencer", "cinematics"],
  gemini_skill_level: "Beginner",
  gemini_outcomes: [
    "Create cinematic sequences",
    "Animate camera movements",
    "Master timeline editing",
  ],
  estimated_minutes: 40,
  total_duration_seconds: 2400,
  _relevanceScore: 90,
  videos: [
    {
      name: "01_Sequencer_Intro.mp4",
      title: "Introduction to Sequencer",
      drive_id: "9seq001abc",
      duration_seconds: 600,
    },
  ],
};

/** Lighting / Lumen course (for rendering-focused tests) */
export const lumenLightingCourse = {
  code: "310.04",
  title: "Lumen Global Illumination Deep Dive",
  canonical_tags: ["lumen", "lighting", "rendering", "global-illumination"],
  gemini_system_tags: ["advanced", "art"],
  transcript_tags: ["ray-tracing", "reflection", "gi"],
  extracted_tags: ["screen-space", "hardware-rt"],
  ai_tags: ["rendering-pipeline"],
  tags: ["lumen", "lighting", "rendering", "global-illumination"],
  gemini_skill_level: "Advanced",
  gemini_outcomes: [
    "Configure Lumen GI for production scenes",
    "Debug reflection and lighting artifacts",
    "Optimize Lumen for target hardware",
  ],
  estimated_minutes: 75,
  total_duration_seconds: 4500,
  _relevanceScore: 88,
  videos: [
    {
      name: "01_Lumen_Setup.mp4",
      title: "Setting Up Lumen",
      drive_id: "alum001abc",
      duration_seconds: 1200,
    },
    {
      name: "02_Reflections.mp4",
      title: "Lumen Reflections Configuration",
      drive_id: "blum002abc",
      duration_seconds: 900,
    },
  ],
};

// ─── Helper ──────────────────────────────────────────────────────────────

/**
 * Create a course object with realistic defaults. Pass overrides to
 * customize specific fields — everything else stays production-shaped.
 *
 * @param {Object} overrides - Fields to override on the base course
 * @returns {Object} A realistic course object
 */
export function makeCourse(overrides = {}) {
  return {
    code: "102.01",
    title: "Introducing Unreal Editor",
    canonical_tags: ["blueprint", "editor"],
    gemini_system_tags: ["beginner"],
    transcript_tags: ["viewport"],
    extracted_tags: [],
    ai_tags: [],
    tags: ["blueprint", "editor"],
    gemini_skill_level: "Intermediate",
    gemini_outcomes: [],
    estimated_minutes: 30,
    total_duration_seconds: 1800,
    _relevanceScore: 50,
    videos: [],
    ...overrides,
  };
}

/**
 * All fixture courses as an array — useful for tests that need a catalog.
 */
export const allCourses = [
  blueprintBasicsCourse,
  materialsCourse,
  cppGameplayCourse,
  niagaraVFXCourse,
  sequencerCourse,
  lumenLightingCourse,
];
