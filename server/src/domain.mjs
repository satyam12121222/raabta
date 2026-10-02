export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function check(ok, message, status = 400) {
  if (!ok) throw new AppError(status, message);
}
export function text(value, name, min = 1, max = 300) {
  check(typeof value === "string", `${name} is required.`);
  const s = value.trim();
  check(
    s.length >= min && s.length <= max,
    `${name} must be ${min}–${max} characters.`,
  );
  return s;
}
export function choice(value, allowed, name) {
  check(allowed.includes(value), `Choose a valid ${name}.`);
  return value;
}
export const genders = ["Woman", "Man", "Nonbinary"];
export const values = [
  "Kindness",
  "Honesty",
  "Family",
  "Independence",
  "Ambition",
  "Curiosity",
  "Stability",
  "Adventure",
  "Creativity",
  "Community",
];
export const interests = [
  "Books",
  "Music",
  "Coffee",
  "Fitness",
  "Movies",
  "Travel",
  "Cooking",
  "Gaming",
  "Art",
  "Outdoors",
  "Sports",
  "Technology",
];
export const styles = ["Talk it through", "Pause then talk", "Write then talk"];
export const children = ["Want children", "Do not want children", "Undecided"];
export function list(value, allowed, name, min = 1, max = 6) {
  check(Array.isArray(value), `Choose ${name}.`);
  const unique = [...new Set(value)];
  check(
    unique.length >= min &&
      unique.length <= max &&
      unique.every((v) => allowed.includes(v)),
    `Choose ${min}–${max} valid ${name}.`,
  );
  return unique;
}
export function age(dob, now = new Date()) {
  const d = new Date(dob + "T00:00:00Z");
  return (
    now.getUTCFullYear() -
    d.getUTCFullYear() -
    (now.getUTCMonth() < d.getUTCMonth() ||
    (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate())
      ? 1
      : 0)
  );
}
export function validateProfile(p, now = new Date()) {
  const dob = text(p.dob, "Date of birth", 10, 10);
  const d = new Date(dob + "T00:00:00Z");
  check(
    /^\d{4}-\d{2}-\d{2}$/.test(dob) &&
      !isNaN(d) &&
      d.toISOString().slice(0, 10) === dob,
    "Enter a real date of birth as YYYY-MM-DD.",
  );
  check(
    age(dob, now) >= 18 && age(dob, now) <= 100,
    "Raabta is for adults aged 18 and above.",
  );
  check(
    Number.isInteger(p.minAge) &&
      Number.isInteger(p.maxAge) &&
      p.minAge >= 18 &&
      p.maxAge <= 100 &&
      p.minAge <= p.maxAge,
    "Choose a valid adult age range.",
  );
  return {
    name: text(p.name, "Name", 2, 40),
    dob,
    city: text(p.city, "City", 2, 60),
    gender: choice(p.gender, genders, "gender"),
    seeking: list(p.seeking, genders, "partner genders", 1, 3),
    minAge: p.minAge,
    maxAge: p.maxAge,
    localOnly: p.localOnly !== false,
    children: choice(p.children, children, "children preference"),
    smoking: choice(p.smoking, ["No", "Yes"], "smoking preference"),
    noSmoking: p.noSmoking === true,
  };
}
export function validateCard(c) {
  return {
    about: text(c.about, "Introduction", 20, 600),
    values: list(c.values, values, "values", 2, 5),
    interests: list(c.interests, interests, "interests", 2, 6),
    communication: choice(c.communication, styles, "communication preference"),
  };
}
export function qualify(turns, requiredDays = 7) {
  const days = new Map();
  for (const t of turns) {
    if (t.role !== "user") continue;
    const x = days.get(t.day) || { count: 0, chars: 0 };
    if (t.text.trim().length >= 40) {
      x.count++;
      x.chars += t.text.trim().length;
    }
    days.set(t.day, x);
  }
  const completed = [...days.values()].filter(
    (x) => x.count >= 2 && x.chars >= 120,
  ).length;
  return {
    completed,
    required: requiredDays,
    ready: completed >= requiredDays,
  };
}
export function compatible(a, b, now = new Date()) {
  if (!a.card || !b.card || !a.approved || !b.approved) return null;
  const x = a.profile,
    y = b.profile,
    aa = age(x.dob, now),
    ba = age(y.dob, now);
  if (
    !x.seeking.includes(y.gender) ||
    !y.seeking.includes(x.gender) ||
    ba < x.minAge ||
    ba > x.maxAge ||
    aa < y.minAge ||
    aa > y.maxAge
  )
    return null;
  const sameCity = x.city.trim().toLowerCase() === y.city.trim().toLowerCase();
  if ((x.localOnly || y.localOnly) && !sameCity) return null;
  if (
    (x.noSmoking && y.smoking === "Yes") ||
    (y.noSmoking && x.smoking === "Yes")
  )
    return null;
  if (
    x.children !== "Undecided" &&
    y.children !== "Undecided" &&
    x.children !== y.children
  )
    return null;
  const sharedValues = a.card.values.filter((v) => b.card.values.includes(v));
  const sharedInterests = a.card.interests.filter((v) =>
    b.card.interests.includes(v),
  );
  if (sharedValues.length < 2) return null;
  const reasons = [
    `You both value ${sharedValues.join(" and ").toLowerCase()}.`,
  ];
  if (sharedInterests.length)
    reasons.push(`Shared interests: ${sharedInterests.join(", ")}.`);
  if (a.card.communication === b.card.communication)
    reasons.push(`You both prefer: ${a.card.communication.toLowerCase()}.`);
  if (sameCity) reasons.push(`You both live in ${x.city}.`);
  const discuss = [];
  if (x.children !== y.children)
    discuss.push("Your plans about children need a conversation.");
  if (a.card.communication !== b.card.communication)
    discuss.push("You describe different communication preferences.");
  return {
    rank: sharedValues.length * 3 + sharedInterests.length + (sameCity ? 1 : 0),
    reasons,
    discuss,
  };
}
export function publicProfile(u) {
  return {
    id: u.id,
    name: u.profile.name,
    age: age(u.profile.dob),
    city: u.profile.city,
    gender: u.profile.gender,
    children: u.profile.children,
    smoking: u.profile.smoking,
    card: u.card,
  };
}
