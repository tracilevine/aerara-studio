// Tally intake: normalization, section mapping, and consent detection.
// Form: "AERARA Client Preparation Intake" (vXDAE8).

export type IntakeResponse = { questionId: string; label: string; answer: string | string[] | null };

export const AERARA_FORM_ID = "vXDAE8";

/** Tally page order, including IDs retained from earlier form versions. */
export const SECTIONS: { key: string; title: string; ids: string[]; sensitive?: boolean }[] = [
  { key: "identity", title: "Client identity", ids: ["5EY2aZ", "dQoPJd", "YVbd7W"] },
  { key: "birth", title: "Birth details", ids: ["D0oeRN", "lVjR8N", "R8QLq4"], sensitive: true },
  {
    key: "story", title: "Your story",
    ids: ["olZO8O", "O8Z0xY", "Voa8WM", "4PYjlA", "jGrx8J", "GYV0OL", "N8x02j", "P8N0ZB", "r2QE82", "E8G0oB", "2OYr9D", "x97Z8v"],
  },
  {
    key: "wheelhouse", title: "Your wheelhouse",
    ids: ["R8QLqj", "olZO8x", "GYV0Ok", "O8Z0xg", "Voa8Wy", "P8N0Ze", "E8G0or", "r2QE8R", "x97Z85", "4PYjlY", "jGrx84", "2OYr99", "ZPAJbB"],
  },
  {
    key: "brand", title: "Your brand",
    ids: ["qjqP89", "e9GEgk", "6rYxEJ", "Q8q0NG", "92YlAV", "Wl60av", "aZ1Gpb", "74YZrR"],
  },
  {
    key: "tech", title: "Your tools",
    ids: ["bNMOQZ", "B8YBWK", "1GYEol", "M825pA", "kO4ZBe", "vqa25D"],
  },
  { key: "ops", title: "Operations", ids: ["AWY8ez", "K840KV", "L5j0Lp", "p4NVpB", "J8r0vR"] },
  {
    key: "soul", title: "Optional reflections",
    ids: ["gWV464", "zWAe50", "yebD5x", "XO7qPY", "8jYe4P", "0oYPRj"], sensitive: true,
  },
];

/** Wheelhouse dropdown questions (activity areas). */
export const WHEELHOUSE_IDS = ["R8QLqj", "olZO8x", "GYV0Ok", "O8Z0xg", "Voa8Wy", "P8N0Ze", "E8G0or", "r2QE8R"];

export const Q = {
  name: "5EY2aZ", business: "dQoPJd", email: "YVbd7W",
  birthDate: "D0oeRN", birthTime: "lVjR8N", birthPlace: "R8QLq4",
  website: "bNMOQZ", spiritualOptIn: "gWV464", story: "olZO8O", season: "P8N0ZB",
  vision: "r2QE82", challenge: "jGrx8J",
};

export const SENSITIVE_IDS = new Set(SECTIONS.filter((s) => s.sensitive).flatMap((s) => s.ids));

export const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

export function answerText(a: IntakeResponse["answer"]): string {
  if (a == null) return "";
  return Array.isArray(a) ? a.join(", ") : String(a);
}

export function get(responses: IntakeResponse[], id: string): string {
  return answerText(responses.find((r) => r.questionId === id)?.answer ?? null).trim();
}

/** Opt-in is only true for an explicit affirmative answer. Anything else = no consent. */
export function spiritualConsent(responses: IntakeResponse[]): boolean {
  const v = get(responses, Q.spiritualOptIn).toLowerCase();
  return v.includes("interested") && !v.includes("not interested");
}

// ── Normalizers for the three ways a submission can arrive ──

type ApiQuestion = { id: string; label: string | null };
type ApiSubmission = { id: string; isCompleted?: boolean; submittedAt?: string; responses: { questionId: string; answer: unknown }[] };

/** Tally REST API / export shape: { questions, submissions } */
export function fromApi(questions: ApiQuestion[], s: ApiSubmission) {
  const labels = new Map(questions.map((q) => [q.id, decode(q.label ?? q.id)]));
  return {
    submissionId: s.id,
    submittedAt: s.submittedAt ?? null,
    completed: s.isCompleted !== false,
    responses: s.responses.map((r) => ({
      questionId: r.questionId,
      label: labels.get(r.questionId) ?? r.questionId,
      answer: normalizeAnswer(r.answer),
    })) as IntakeResponse[],
  };
}

type WebhookField = { key: string; label: string; type: string; value: unknown; options?: { id: string; text: string }[] };

/** Tally webhook shape: { eventType, data: { submissionId, formId, createdAt, fields } } */
export function fromWebhook(data: { submissionId?: string; responseId?: string; formId: string; createdAt?: string; fields: WebhookField[] }) {
  return {
    submissionId: data.submissionId ?? data.responseId ?? "",
    submittedAt: data.createdAt ?? null,
    completed: true,
    responses: data.fields
      .filter((f) => /^question_[A-Za-z0-9]+$/.test(f.key)) // skip per-option checkbox sub-fields
      .map((f) => {
        let v: unknown = f.value;
        if (f.options && Array.isArray(v)) {
          const byId = new Map(f.options.map((o) => [o.id, o.text]));
          v = (v as string[]).map((id) => byId.get(id) ?? id);
        }
        return { questionId: f.key.replace(/^question_/, ""), label: decode(f.label ?? f.key), answer: normalizeAnswer(v) };
      }) as IntakeResponse[],
  };
}

function normalizeAnswer(v: unknown): string | string[] | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x)));
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Group responses into sections for display; unmapped questions go to "Other". */
export function sectioned(responses: IntakeResponse[]) {
  const byId = new Map(responses.map((r) => [r.questionId, r]));
  const used = new Set<string>();
  const out = SECTIONS.map((s) => ({
    ...s,
    items: s.ids.flatMap((id) => {
      used.add(id);
      const response = byId.get(id);
      return response ? [response] : [];
    }),
  })).filter((s) => s.items.length > 0);
  const other = responses.filter((r) => !used.has(r.questionId));
  if (other.length) out.push({ key: "other", title: "Other", ids: other.map((o) => o.questionId), items: other });
  return out;
}
