import martialJson from "../../content/martial-arts.json";
import spellJson from "../../content/spells.json";
import imprintJson from "../../content/imprints.json";
import specialtyJson from "../../content/specialties.json";
import ultimateJson from "../../content/ultimates.json";
import styleJson from "../../content/style-actions.json";
import bondJson from "../../content/bonds.json";
import expansionJson from "../../content/expansions.json";
import type {
  AnyContentCard,
  BondDefinition,
  ContentCatalog,
  ImprintCard,
  MartialCard,
  SpecialtyCard,
  SpellCard,
  StyleActionCard,
  StyleDefinition,
  UltimateCard,
} from "../types";

export const catalog: ContentCatalog = {
  martialArts: martialJson.items as MartialCard[],
  spells: spellJson.items as SpellCard[],
  imprints: imprintJson.items as ImprintCard[],
  specialties: specialtyJson.items as SpecialtyCard[],
  ultimates: ultimateJson.items as UltimateCard[],
  styleActions: styleJson.items as StyleActionCard[],
  styles: styleJson.styles as StyleDefinition[],
  bonds: bondJson.items as BondDefinition[],
  expansions: expansionJson.items,
  byId: new Map(),
};

const allCards: AnyContentCard[] = [
  ...catalog.martialArts,
  ...catalog.spells,
  ...catalog.imprints,
  ...catalog.specialties,
  ...catalog.ultimates,
  ...catalog.styleActions,
  ...catalog.bonds,
];

for (const card of allCards) {
  if (catalog.byId.has(card.id)) {
    throw new Error(`Duplicate content id: ${card.id}`);
  }
  catalog.byId.set(card.id, card);
}

export const BASE_MARTIAL_ID = "martial.常规攻击";
export const BASE_SPELL_ID = "spell.灵迹";
export const CHOICE_BASE_SPELL_IDS = ["spell.凝爆", "spell.超感"] as const;
