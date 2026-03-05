/**
 * Onboarding quiz question config + role section definitions.
 * Pure data — no React dependency.
 */
import {
  Gamepad2,
  Wand2,
  Wrench,
  Map,
  Target,
  BookOpen,
  Trophy,
  ArrowRight,
  Sparkles,
  MessageSquare,
  Code2,
  Palette,
  Bone,
  Diamond,
} from "lucide-react";

// ─────────── Role-based video grouping (matches Fix a Problem page) ───────────
export const ONBOARDING_ROLE_SECTIONS = [
  {
    key: "prerequisite",
    icon: "🔗",
    label: "Prerequisite",
    desc: "Build the foundation first — these cover concepts you'll need before tackling the main topic.",
  },
  {
    key: "core",
    icon: "⭐",
    label: "Core",
    desc: "These directly address your learning goals and are the most important courses to watch.",
  },
  {
    key: "supplemental",
    icon: "📚",
    label: "Supplemental",
    desc: "Go deeper — extra context and advanced techniques for when you're ready.",
  },
];

// ─────────── 4-Step Question Flow ───────────
export const QUESTIONS = [
  {
    id: "startPrompt",
    question: "What do you want to learn in UE5?",
    subtitle: "Describe in your own words (optional — helps personalize your path)",
    type: "freetext",
    placeholder: "e.g. I want to make a small RPG with inventory and combat...",
  },
  {
    id: "role",
    question: "Which best describes your role?",
    subtitle: "This determines your learning persona",
    type: "choice",
    options: [
      {
        value: "indie_isaac",
        label: "Indie Game Dev",
        description: "Solo/small-team — prototype fast, ship it",
        icon: Gamepad2,
      },
      {
        value: "logic_liam",
        label: "Games Programmer",
        description: "Architecture, systems, performance",
        icon: Code2,
      },
      {
        value: "animator_alex",
        label: "Animator / Film Artist",
        description: "Cinematics, sequencer, real-time previews",
        icon: Palette,
      },
      {
        value: "rigger_regina",
        label: "Rigger / Character TD",
        description: "Control Rig, deformation, retargeting",
        icon: Bone,
      },
      {
        value: "designer_cpg",
        label: "Designer (Retail/CPG)",
        description: "Product viz, lighting, stunning visuals",
        icon: Diamond,
      },
    ],
  },
  {
    id: "experience",
    question: "How many years of 3D / game engine experience do you have?",
    type: "choice",
    options: [
      {
        value: "beginner",
        label: "0–1 years",
        description: "Brand new to 3D or engines",
        icon: Sparkles,
      },
      {
        value: "junior",
        label: "2–5 years",
        description: "Used Maya, Blender, or another engine",
        icon: Palette,
      },
      {
        value: "mid",
        label: "5–10 years",
        description: "Professional with shipped work",
        icon: Wand2,
      },
      { value: "senior", label: "10+ years", description: "Senior / lead level", icon: Wrench },
    ],
  },
  {
    id: "goal",
    question: "What do you want to achieve in your first 10 hours?",
    type: "choice",
    options: [
      { value: "explore", label: "Explore and understand UE5", icon: Map },
      { value: "project", label: "Start a specific project", icon: Target },
      { value: "skill", label: "Learn a specific skill", icon: BookOpen },
      { value: "portfolio", label: "Build a portfolio piece", icon: Trophy },
      { value: "transition", label: "Transition from another tool", icon: ArrowRight },
    ],
  },
];
