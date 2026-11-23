import { z } from "zod";

export const attributeSchema = z.enum(["body", "mind", "soul"]);
export const skillSchema = z.enum([
  "athletics",
  "operation",
  "stealth",
  "investigation",
  "insight",
  "persuasion",
  "hunter-lore",
]);
export const cardKindSchema = z.enum([
  "martial",
  "spell",
  "specialty",
  "imprint",
  "ultimate",
  "styleAction",
  "style",
  "bond",
]);
export const selectionKindSchema = z.enum(["martial", "spell", "specialty", "imprint"]);

const identityFieldSchema = z.enum([
  "name",
  "codename",
  "gender",
  "age",
  "background",
]);

const abilityFieldSchema = z.enum([
  "name",
  "description",
  "defect",
  "specialization",
  "specialization2",
]);

export const operationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("setAttribute"), attribute: attributeSchema, value: z.number() }),
  z.object({ op: z.literal("setInsight"), value: z.number() }),
  z.object({ op: z.literal("setSkill"), skill: skillSchema, value: z.number() }),
  z.object({ op: z.literal("addCard"), kind: selectionKindSchema, id: z.string() }),
  z.object({ op: z.literal("removeCard"), kind: selectionKindSchema, id: z.string() }),
  z.object({
    op: z.literal("replaceCard"),
    kind: selectionKindSchema,
    oldId: z.string(),
    newId: z.string(),
  }),
  z.object({ op: z.literal("setUltimate"), tier: z.union([z.literal(1), z.literal(2)]), id: z.string().optional() }),
  z.object({ op: z.literal("setStyle"), styleId: z.string() }),
  z.object({
    op: z.literal("setCombinedStyle"),
    name: z.string(),
    styleIds: z.array(z.string()),
    actionIds: z.array(z.string()),
  }),
  z.object({ op: z.literal("setBond"), category: z.string(), name: z.string() }),
  z.object({
    op: z.literal("setAbilityField"),
    field: abilityFieldSchema,
    value: z.string(),
  }),
  z.object({ op: z.literal("setExperienceTags"), tags: z.array(z.string()) }),
  z.object({ op: z.literal("setSoulWeaponName"), value: z.string() }),
  z.object({ op: z.literal("setPockets"), value: z.string() }),
  z.object({
    op: z.literal("setIdentityField"),
    field: identityFieldSchema,
    value: z.string(),
  }),
]);

export const toolInputs = {
  get_character: z.object({}),
  search_cards: z.object({
    kind: cardKindSchema.optional(),
    query: z.string().optional(),
    expansion: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }),
  get_cards: z.object({ ids: z.array(z.string()).min(1).max(50) }),
  explain_character: z.object({ character: z.record(z.string(), z.unknown()).optional() }),
  recommend_cards: z.object({
    kind: z.enum(["martial", "spell", "specialty", "imprint", "ultimate"]),
    intent: z.string().optional(),
    limit: z.number().int().min(1).max(20).optional(),
  }),
  analyze_build: z.object({ character: z.record(z.string(), z.unknown()).optional() }),
  plan_growth: z.object({
    expBudget: z.number().int().min(0).max(200).optional(),
    goal: z.enum(["insight", "specialty", "ultimate", "imprint", "any"]).optional(),
  }),
  diff_character: z.object({
    before: z.record(z.string(), z.unknown()).optional(),
    after: z.record(z.string(), z.unknown()).optional(),
    proposalId: z.string().optional(),
  }),
  propose_changes: z.object({
    title: z.string().optional(),
    reason: z.string(),
    ops: z.array(operationSchema).min(1).max(50),
  }),
  apply_changes: z.object({
    proposalId: z.string(),
    timeoutMs: z.number().int().min(1000).max(60000).optional(),
  }),
  check_content: z.object({}),
  check_save_compat: z.object({
    paths: z.array(z.string()).min(1).max(50),
  }),
  run_project_checks: z.object({
    checks: z.array(z.enum(["typecheck", "test", "validate:content"])).min(1),
  }),
} as const;
