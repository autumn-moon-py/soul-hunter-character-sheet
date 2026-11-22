export type AttributeId = "body" | "mind" | "soul";

export type Grade = "E" | "D" | "C" | "B" | "A" | "S" | "SS" | "SSS" | "SSS+";

export type SkillId =
  | "athletics"
  | "operation"
  | "stealth"
  | "investigation"
  | "insight"
  | "persuasion"
  | "hunter-lore";

export interface AttributeValues {
  body: number;
  mind: number;
  soul: number;
}

export interface SoulHunterIdentity {
  name: string;
  codename: string;
  /** 本地压缩后的头像 data URL，随角色存档与 HTML 导出 */
  avatar?: string;
  gender?: string;
  age?: string;
  appearance?: string;
  personality?: string;
  background?: string;
}

export interface SoulHunterBond {
  category: string;
  name: string;
  description?: string;
  experienceTag?: string;
}

export interface SoulHunterAbility {
  name: string;
  description: string;
  defect?: string;
  specialization?: string;
  /** 第二项灵能力专精，心魂 SSS+ 时获得 */
  specialization2?: string;
}

export interface SoulHunterStyle {
  mode?: "preset" | "combined";
  styleId?: string;
  /** 组合风格由 2 个以上基础风格拼成 */
  styleIds?: string[];
  name?: string;
  actionIds: string[];
}

export interface SoulHunterSelections {
  martialArtIds: string[];
  spellIds: string[];
  specialtyIds: string[];
  imprintIds: string[];
  ultimateTier1Id?: string;
  ultimateTier2Id?: string;
}

export interface SoulHunterSoulWeapon {
  name: string;
  form?: string;
  appearance?: string;
}

export interface SoulHunterResources {
  hpCurrent?: number;
  mpCurrent?: number;
  stylePoints?: number;
  itemPoints?: number;
  exp?: number;
  [key: string]: number | undefined;
}

export interface SoulHunterCharacter {
  schemaVersion: 1;
  id: string;
  /** 存档名，留空时使用真名 */
  saveName?: string;
  identity: SoulHunterIdentity;
  bond?: SoulHunterBond;
  insight: number;
  attributes: AttributeValues;
  /** 自由分配的技能点；基础值由属性推导，不存这里 */
  skills: Partial<Record<SkillId, number>>;
  ability: SoulHunterAbility;
  style: SoulHunterStyle;
  selections: SoulHunterSelections;
  soulWeapon?: SoulHunterSoulWeapon;
  experienceTags: string[];
  /** 狩魂者口袋：自由记录的携带物 */
  pockets?: string;
  resources: SoulHunterResources;
  expansions: string[];
}

export interface Quotas {
  /** 常规攻击之外的武技数量 */
  martialArts: number;
  /** 天生术法之外的自选术法数量 */
  spells: number;
  specialties: number;
  ultimates: number;
  imprints: number;
  abilityTags: number;
  abilityChars: number;
  experienceTags: number;
  /** 风格动作 + 通用超灵觉醒 */
  styleActions: number;
}

export interface DerivedStats {
  insight: number;
  grades: Record<AttributeId, Grade>;
  strengths: Record<AttributeId, number>;
  hpMax: number;
  mpMax: number;
  /** 道具点上限，受专长影响 */
  itemPointsMax: number;
  defense: number;
  skillBase: Record<SkillId, number>;
  skills: Record<SkillId, number>;
  skillPointsTotal: number;
  skillPointsSpent: number;
  skillPointsRemaining: number;
  quotas: Quotas;
  /** 当前角色应具备的天生术法 ID */
  baseSpellIds: string[];
  /** 当前灵识/属性解锁的里程碑 */
  unlocked: string[];
}

export type IssueLevel = "error" | "warning" | "info";

export interface ValidationIssue {
  level: IssueLevel;
  code: string;
  message: string;
  path?: string;
}

export interface ContentCardBase {
  id: string;
  kind: string;
  name: string;
  expansion?: string | null;
}

export interface MartialCard extends ContentCardBase {
  kind: "martial";
  secret: boolean;
  support: boolean;
  cost: string;
  target: string;
  effect: string;
  flavor?: string;
}

export interface SpellCard extends ContentCardBase {
  kind: "spell";
  secret: boolean;
  category: string;
  type: string;
  cost: string;
  target: string;
  effect: string;
  flavor?: string;
}

export interface ImprintCard extends ContentCardBase {
  kind: "imprint";
  description: string;
}

export interface SpecialtyCard extends ContentCardBase {
  kind: "specialty";
  description: string;
}

export interface UltimateCard extends ContentCardBase {
  kind: "ultimate";
  tier: 1 | 2;
  soul: string;
  domain: string;
  description: string;
  effect: string;
}

export interface StyleActionCard extends ContentCardBase {
  kind: "styleAction";
  style: string;
  cost: number;
  effect: string;
}

export interface StyleDefinition {
  id: string;
  kind: "style";
  name: string;
  expansion?: string | null;
  description?: string;
  actionIds: string[];
  costs: number[];
}

export interface BondDefinition {
  id: string;
  kind: "bond";
  category: string;
  roll: number;
  name: string;
  description: string;
  /** 规则书 2.6 给出的羁绊示例经历标签 */
  experienceTag?: string;
  expansion?: string | null;
}

export type AnyContentCard =
  | MartialCard
  | SpellCard
  | ImprintCard
  | SpecialtyCard
  | UltimateCard
  | StyleActionCard
  | BondDefinition;

export interface ContentCatalog {
  martialArts: MartialCard[];
  spells: SpellCard[];
  imprints: ImprintCard[];
  specialties: SpecialtyCard[];
  ultimates: UltimateCard[];
  styleActions: StyleActionCard[];
  styles: StyleDefinition[];
  bonds: BondDefinition[];
  expansions: Array<{ id: string; name: string }>;
  byId: Map<string, AnyContentCard>;
}
