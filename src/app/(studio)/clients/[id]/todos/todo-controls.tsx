"use client";

import { useActionState, useState, useTransition } from "react";
import { addClientTodos, setClientTodoCompleted } from "@/app/actions";

export function AddTodos({ clientId }: { clientId: string }) {
  const [titles, setTitles] = useState("");
  const [state, submit, pending] = useActionState<{ error?: string; added?: number }, FormData>(async (_previous, form) => {
    try {
      const result = await addClientTodos(clientId, form);
      if (result.added) setTitles("");
      return result;
    } catch {
      return { error: "Couldn’t save the to-dos." };
    }
  }, {});

  return (
    <form action={submit} className="space-y-3">
      <label className="block text-sm font-medium" htmlFor="todo-titles">Add to-dos</label>
      <textarea id="todo-titles" name="titles" rows={3} className="input w-full" value={titles}
        disabled={pending} required placeholder="One to-do per line" onChange={(event) => setTitles(event.target.value)} />
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Adding…" : "Add to checklist"}</button>
        <span role="status" className={`text-sm ${state.error ? "text-[#9A4B36]" : "text-ink-soft"}`}>
          {state.error ?? (state.added ? `Added ${state.added} ${state.added === 1 ? "to-do" : "to-dos"}.` : "")}
        </span>
      </div>
    </form>
  );
}

export function TodoCheckbox({ clientId, id, title, completed }: { clientId: string; id: string; title: string; completed: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="flex items-start gap-3">
      <input type="checkbox" aria-label={`Complete ${title}`} checked={completed} disabled={pending}
        className="mt-1 size-4 accent-plum"
        onChange={(event) => {
          const checked = event.target.checked;
          setError("");
          start(async () => {
            try {
              const result = await setClientTodoCompleted(clientId, id, checked);
              setError(result?.error ?? "");
            } catch {
              setError("Couldn’t update the to-do.");
            }
          });
        }} />
      <div>
        <p className={completed ? "text-ink-soft line-through" : "font-medium"}>{title}</p>
        {error && <p role="alert" className="text-xs text-[#9A4B36]">{error}</p>}
      </div>
    </div>
  );
}
