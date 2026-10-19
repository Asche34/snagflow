/**
 * UI labels switch on org_settings.terminology so the whole product can say
 * "punch" or "defect" instead of "snag" (spec sections 5 and 10).
 */
export const TERMINOLOGY = ["snag", "punch", "defect", "issue"] as const;
export type Terminology = (typeof TERMINOLOGY)[number];

export type TerminologyLabels = {
  /** singular, lowercase */
  singular: string;
  /** plural, lowercase */
  plural: string;
  /** Report title fragment, e.g. "Punch List Report" */
  reportTitle: string;
};

export function terminologyLabels(t: Terminology): TerminologyLabels {
  switch (t) {
    case "punch":
      return { singular: "punch item", plural: "punch items", reportTitle: "Punch List Report" };
    case "defect":
      return { singular: "defect", plural: "defects", reportTitle: "Defect Report" };
    case "issue":
      return { singular: "issue", plural: "issues", reportTitle: "Issue Report" };
    case "snag":
    default:
      return { singular: "snag", plural: "snags", reportTitle: "Snag Report" };
  }
}
