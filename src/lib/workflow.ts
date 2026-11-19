// Where each client is in the advisory workflow, derived from their records (no manual upkeep).
export const STAGES = [
  "Awaiting intake", "Intake received", "Assessment review", "Blueprint & recommendations", "Roadmap", "Implementation",
] as const;

type Rows = {
  submissions: { client_id: string; reviewed: boolean }[];
  assessments: { client_id: string; status: string }[];
  recommendations: { client_id: string; status: string }[];
  tasks: { client_id: string; status: string }[];
};

export function clientStage(id: string, r: Rows) {
  const subs = r.submissions.filter((s) => s.client_id === id);
  const as = r.assessments.filter((a) => a.client_id === id);
  const recs = r.recommendations.filter((x) => x.client_id === id);
  const tasks = r.tasks.filter((t) => t.client_id === id);
  const done = tasks.filter((t) => t.status === "completed").length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  let stage: (typeof STAGES)[number];
  if (tasks.length) stage = "Implementation";
  else if (recs.some((x) => x.status === "approved")) stage = "Roadmap";
  else if (as.some((a) => a.status === "approved")) stage = "Blueprint & recommendations";
  else if (as.length) stage = "Assessment review";
  else if (subs.length) stage = "Intake received";
  else stage = "Awaiting intake";
  return { stage, stageIndex: STAGES.indexOf(stage), progress, tasksDone: done, tasksTotal: tasks.length };
}
