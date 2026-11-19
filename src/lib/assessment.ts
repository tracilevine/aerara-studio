import "server-only";

/** The structured assessment saved in the client workspace. Each section's text is light markdown. */
export type AssessmentContent = {
  sections: {
    snapshot: string;
    wheelhouse: string;
    brand: string;
    technology: string;
    soul: string | null;
    strategy: string;
    questions: string;
  };
  wheelhouse_lists: { own: string[]; support: string[]; delegate: string[] };
  open_questions: string[];
  audit: {
    category: string; current_state: string; evidence: string; client_perspective: string;
    gaps: string; maturity: number | null; recommendations: string; priority: "high" | "medium" | "low";
  }[];
  tools: {
    category: string; name: string; purpose: string; cost: string; pain_points: string;
    recommendation: "keep" | "improve" | "consolidate" | "replace" | "remove" | "evaluate";
  }[];
  recommendations: {
    title: string; category: string; issue: string; evidence: string; solution: string; benefit: string;
    priority: "high" | "medium" | "low"; effort: "low" | "medium" | "high"; estimated_cost: string; dependencies: string;
  }[];
  roadmap: {
    phase: "30" | "60" | "90"; title: string; outcome: string; priority: "high" | "medium" | "low";
    owner_type: "advisor" | "client"; effort: string; estimated_cost: string; depends_on: string; success_criteria: string;
  }[];
  questions: string[];
};

export const SECTION_TITLES: [keyof AssessmentContent["sections"], string][] = [
  ["snapshot", "1. Business Snapshot & Vision"],
  ["wheelhouse", "2. Wheelhouse & Delegation"],
  ["brand", "3. Brand Positioning"],
  ["technology", "4. Technology & Operations"],
  ["soul", "5. Astrological & Soul Blueprint"],
  ["strategy", "6. 30/60/90-Day Strategy"],
  ["questions", "7. First-Meeting Questions"],
];

export const AUDIT_CATEGORIES = [
  "Purpose and vision",
  "Business model and offers",
  "Brand and positioning",
  "Marketing and visibility",
  "Customer journey",
  "Technology and operations",
  "Financial sustainability",
  "Delegation and founder capacity",
];
