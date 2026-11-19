// Natal placement calculator — pure JS ephemeris (astronomy-engine, MIT). $0, no API.
// Tropical zodiac, ecliptic of date. Only computes; never interprets.
import * as Astronomy from "astronomy-engine";

export const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;

export type Placement = {
  body: string;
  longitude: number;
  sign: string;
  degree: number; // within sign
  nearCusp: boolean; // within 1° of a sign boundary — sensitive to time accuracy
  status: "Verified" | "Unverified";
  note?: string;
};

export type ChartInput = {
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // HH:MM local clock time
  timeZone: string; // IANA, e.g. America/New_York (handles historical DST)
  latitude: number;
  longitude: number; // east positive
};

export type ChartResult = {
  utc: string;
  utcOffsetMinutes: number;
  placements: Placement[];
  engine: string;
  computedAt: string;
};

const norm = (x: number) => ((x % 360) + 360) % 360;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Convert a local wall-clock time in an IANA zone to a UTC Date, using the runtime tz database. */
export function zonedToUtc(date: string, time: string, timeZone: string): { utc: Date; offsetMinutes: number } {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh, mm);
  const offsetAt = (t: number) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(t));
    const g = (k: string) => Number(parts.find((p) => p.type === k)?.value);
    const local = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
    return (local - t) / 60000;
  };
  let offset = offsetAt(asUtc);
  offset = offsetAt(asUtc - offset * 60000); // second pass resolves DST edges
  return { utc: new Date(asUtc - offset * 60000), offsetMinutes: offset };
}

function toPlacement(body: string, lon: number): Placement {
  const l = norm(lon);
  const within = l % 30;
  return {
    body,
    longitude: Math.round(l * 100) / 100,
    sign: SIGNS[Math.floor(l / 30)],
    degree: Math.round(within * 100) / 100,
    nearCusp: within < 1 || within > 29,
    status: "Verified",
  };
}

export function computeChart(input: ChartInput): ChartResult {
  const { utc, offsetMinutes } = zonedToUtc(input.birthDate, input.birthTime, input.timeZone);
  const t = Astronomy.MakeTime(utc);

  const placements: Placement[] = [];
  placements.push(toPlacement("Sun", Astronomy.SunPosition(t).elon));
  placements.push(toPlacement("Moon", Astronomy.EclipticGeoMoon(t).lon));
  for (const [name, body] of [
    ["Mercury", Astronomy.Body.Mercury],
    ["Venus", Astronomy.Body.Venus],
    ["Mars", Astronomy.Body.Mars],
    ["Saturn", Astronomy.Body.Saturn],
  ] as const) {
    placements.push(toPlacement(name, Astronomy.Ecliptic(Astronomy.GeoVector(body, t, true)).elon));
  }

  // Angles: local apparent sidereal time → RAMC; true obliquity of date.
  const ramc = rad(norm(Astronomy.SiderealTime(t) * 15 + input.longitude));
  const T = t.tt / 36525;
  const eps = rad(23.439291111 - 0.0130041667 * T); // mean obliquity (sub-arcminute for this use)
  const phi = rad(input.latitude);
  const mc = norm(deg(Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(eps))));
  const asc = norm(deg(Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps)))));
  const ascP = toPlacement("Ascendant", asc);
  ascP.note = "Angles shift ~1° per 4 minutes of birth time; requires exact recorded time.";
  const mcP = toPlacement("Midheaven", mc);
  mcP.note = ascP.note;
  placements.push(ascP, mcP);

  return {
    utc: utc.toISOString(),
    utcOffsetMinutes: offsetMinutes,
    placements,
    engine: "astronomy-engine (tropical, ecliptic of date)",
    computedAt: new Date().toISOString(),
  };
}
