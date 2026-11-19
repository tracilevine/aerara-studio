// Tally intake: normalization, section mapping, and consent detection.
// Form: "AERARA Client Preparation Intake" (vXDAE8).

export type IntakeResponse = { questionId: string; label: string; answer: string | string[] | null };

export const AERARA_FORM_ID = "vXDAE8";

/** Question IDs from the live form, grouped into advisor-facing sections. Unknown IDs fall into "Other". */
export const SECTIONS: { key: string; title: string; ids: string[]; sensitive?: boolean }[] = [
  { key: "identity", title: "Client identity", ids: ["5EY2aZ", "dQoPJd", "YVbd7W"] },
  { key: "birth", title: "Birth details (private)", ids: ["D0oeRN", "lVjR8N", "R8QLq4"], sensitive: true },
  { key: "story", title: "Business story & purpose", ids: ["olZO8O", "GYV0OL", "N8x02j"] },
  { key: "offer", title: "Offerings & ideal customers", ids: ["O8Z0xY", "Voa8WM"] },
  { key: "vision", title: "Vision, season & goals", ids: ["P8N0ZB", "r2QE82", "zWAe50"] },
  { key: "values", title: "Values & boundaries", ids: ["4PYjlA"] },
  { key: "challenges", title: "Challenges & constraints", ids: ["jGrx8J", "E8G0oB", "2OYr9D", "x97Z8v"] },
  {
    key: "wheelhouse", title: "Wheelhouse & delegation",
    ids: ["R8QLqj", "olZO8x", "GYV0Ok", "O8Z0xg", "Voa8Wy", "P8N0Ze", "E8G0or", "r2QE8R", "4PYjlY", "jGrx84", "2OYr99", "ZPAJbB", "x97Z85"],
  },
  { key: "brand", title: "Brand identity", ids: ["qjqP89", "Q8q0NG", "92YlAV", "e9GEgk", "Wl60av", "aZ1Gpb", "6rYxEJ", "74YZrR"] },
  { key: "tech", title: "Website & technology", ids: ["bNMOQZ", "M825pA", "B8YBWK", "kO4ZBe", "vqa25D", "1GYEol"] },
  { key: "ops", title: "Operations", ids: ["AWY8ez", "K840KV", "L5j0Lp", "p4NVpB", "J8r0vR"] },
  { key: "soul", title: "Optional: astrology, Kabbalah, Human Design", ids: ["gWV464", "yebD5x", "XO7qPY", "8jYe4P", "0oYPRj"] },
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

type ApiQuestion = { id: string; label: string };
type ApiSubmission = { id: string; isCompleted?: boolean; submittedAt?: string; responses: { questionId: string; answer: unknown }[] };

/** Tally REST API / export shape: { questions, submissions } */
export function fromApi(questions: ApiQuestion[], s: ApiSubmission) {
  const labels = new Map(questions.map((q) => [q.id, decode(q.label)]));
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
    items: s.ids.map((id) => {
      used.add(id);
      return byId.get(id) ?? { questionId: id, label: "(question not in this submission)", answer: null };
    }),
  }));
  const other = responses.filter((r) => !used.has(r.questionId));
  if (other.length) out.push({ key: "other", title: "Other", ids: other.map((o) => o.questionId), items: other });
  return out;
}
