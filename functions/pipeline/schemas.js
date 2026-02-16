/**
 * Pipeline Stage Schemas — Zod validation for every LLM stage output.
 *
 * Each schema uses .passthrough() to preserve extra fields the LLM may return
 * while enforcing the minimum required structure.
 */

const { z } = require("zod");

// ─── Intent ──────────────────────────────────────────────────────────────────

const IntentSchema = z
  .object({
    intent_id: z.string().min(1),
    user_role: z.string().min(1),
    goal: z.string().min(1),
    problem_description: z.string().min(1),
    systems: z.array(z.string()).min(1),
    constraints: z.array(z.string()).default([]),
  })
  .passthrough();

// ─── Diagnosis ───────────────────────────────────────────────────────────────

const DiagnosisSchema = z
  .object({
    diagnosis_id: z.string().min(1),
    problem_summary: z.string().min(1),
    root_causes: z.array(z.string()).min(1),
    signals_to_watch_for: z.array(z.string()).default([]),
    variables_that_matter: z.array(z.string()).default([]),
    variables_that_do_not: z.array(z.string()).default([]),
    generalization_scope: z.array(z.string()).default([]),
  })
  .passthrough();

// ─── Objectives ──────────────────────────────────────────────────────────────

const ObjectivesSchema = z
  .object({
    fix_specific: z.array(z.string()).min(1),
    transferable: z.array(z.string()).min(1),
  })
  .passthrough();

// ─── Validation ──────────────────────────────────────────────────────────────

const ValidationSchema = z
  .object({
    approved: z.boolean(),
    reason: z.string().min(1),
    issues: z.array(z.string()).default([]),
    suggestions: z.array(z.string()).default([]),
  })
  .passthrough();

// ─── Path Summary ────────────────────────────────────────────────────────────

const PathSummarySchema = z
  .object({
    path_summary: z.string().min(1),
    topics_covered: z.array(z.string()).min(1),
  })
  .passthrough();

// ─── Micro-Lesson ────────────────────────────────────────────────────────────

const MicroLessonSchema = z
  .object({
    quick_fix: z.object({
      title: z.string().min(1),
      steps: z.array(z.string()).min(1),
    }).passthrough(),
    why_it_works: z.object({
      explanation: z.string().min(1),
      key_concept: z.string().min(1),
    }).passthrough(),
    related_situations: z.array(
      z.object({
        scenario: z.string().min(1),
        connection: z.string().min(1),
      }).passthrough()
    ).min(1),
  })
  .passthrough();

// ─── Learning Path (Onboarding) ─────────────────────────────────────────────

const LearningPathStepSchema = z
  .object({
    number: z.number().int().min(1),
    type: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
  })
  .passthrough();

const LearningPathSchema = z
  .object({
    title: z.string().min(1),
    ai_summary: z.string().min(1),
    steps: z.array(LearningPathStepSchema).min(1),
  })
  .passthrough();

// ─── Schema Registry (lookup by stage name) ─────────────────────────────────

const SCHEMAS = {
  intent: IntentSchema,
  diagnosis: DiagnosisSchema,
  objectives: ObjectivesSchema,
  validation: ValidationSchema,
  path_summary_data: PathSummarySchema,
  micro_lesson: MicroLessonSchema,
  learning_path: LearningPathSchema,
};

module.exports = {
  IntentSchema,
  DiagnosisSchema,
  ObjectivesSchema,
  ValidationSchema,
  PathSummarySchema,
  MicroLessonSchema,
  LearningPathSchema,
  LearningPathStepSchema,
  SCHEMAS,
};
