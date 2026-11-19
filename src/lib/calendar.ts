import "server-only";

// Google Calendar, read-only, via the calendar's "Secret address in iCal format".
// $0, no OAuth app. Works with whatever booking tool writes to the calendar.

export type CalEvent = { uid: string; title: string; start: string; end: string | null; attendees: string[]; location: string | null; link: string | null };

export function calendarConfigured() { return !!process.env.GOOGLE_CALENDAR_ICS_URL; }

function unfold(ics: string) { return ics.replace(/\r?\n[ \t]/g, ""); }

function parseDate(v: string, params: string): string | null {
  // 20261118T150000Z | 20261118T100000 (with TZID) | 20261118 (all-day)
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00", s = "00", z] = m;
  if (z) return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)).toISOString();
  const tz = params.match(/TZID=([^;:]+)/)?.[1];
  if (!tz) return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)).toISOString();
  // Wall time in tz → UTC
  const guess = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const p = Object.fromEntries(fmt.formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
  const asTz = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return new Date(guess - (asTz - guess)).toISOString();
}

const unescape = (s: string) => s.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");

/** Upcoming single events in the next `days` days. Recurring series are listed by their first instance only. */
export async function upcomingEvents(days = 21): Promise<{ events: CalEvent[]; error?: string }> {
  const url = process.env.GOOGLE_CALENDAR_ICS_URL;
  if (!url) return { events: [] };
  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return { events: [], error: `Calendar feed returned ${res.status}` };
    const text = unfold(await res.text());
    const now = Date.now(); const until = now + days * 864e5;
    const events: CalEvent[] = [];
    for (const block of text.split("BEGIN:VEVENT").slice(1)) {
      const body = block.split("END:VEVENT")[0];
      const lines = body.split(/\r?\n/);
      const prop = (name: string) => {
        const l = lines.find((x) => x.startsWith(name + ":") || x.startsWith(name + ";"));
        if (!l) return null;
        const i = l.indexOf(":");
        return { params: l.slice(0, i), value: l.slice(i + 1) };
      };
      if (prop("STATUS")?.value === "CANCELLED") continue;
      const ds = prop("DTSTART"); if (!ds) continue;
      const start = parseDate(ds.value, ds.params); if (!start) continue;
      const t = Date.parse(start);
      if (t < now || t > until) continue;
      const de = prop("DTEND");
      events.push({
        uid: prop("UID")?.value ?? start,
        title: unescape(prop("SUMMARY")?.value ?? "(busy)"),
        start, end: de ? parseDate(de.value, de.params) : null,
        location: prop("LOCATION") ? unescape(prop("LOCATION")!.value) : null,
        link: unescape(body.match(/https:\/\/meet\.google\.com\/[a-z-]+/)?.[0] ?? "") || null,
        attendees: lines.filter((l) => l.startsWith("ATTENDEE")).map((l) => (l.match(/mailto:([^\s;]+)/i)?.[1] ?? "").toLowerCase()).filter(Boolean),
      });
    }
    events.sort((a, b) => a.start.localeCompare(b.start));
    return { events };
  } catch (e) {
    return { events: [], error: e instanceof Error ? e.message : "Calendar unavailable" };
  }
}

/** Match an event to a client by attendee email, then by name in the title. */
export function matchClient(e: CalEvent, clients: { id: string; name: string; email: string | null }[]) {
  const byEmail = clients.find((c) => c.email && e.attendees.includes(c.email.toLowerCase()));
  if (byEmail) return byEmail;
  const title = e.title.toLowerCase();
  return clients.find((c) => c.name && title.includes(c.name.toLowerCase())) ??
    clients.find((c) => { const first = c.name?.split(" ")[0]?.toLowerCase(); const last = c.name?.split(" ").slice(-1)[0]?.toLowerCase(); return first && last && first !== last && title.includes(first) && title.includes(last); });
}
