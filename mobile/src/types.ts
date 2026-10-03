export type Profile = {
  heightCm?: number | null;
  bio?: string;
  education?: string;
  occupation?: string;
  languages?: string;
  drinking?: string;
  relationshipStatus?: string;
  name: string;
  dob: string;
  city: string;
  gender: string;
  seeking: string[];
  minAge: number;
  maxAge: number;
  localOnly: boolean;
  children: string;
  smoking: string;
  noSmoking: boolean;
};
export type Card = {
  about: string;
  values: string[];
  interests: string[];
  communication: string;
};
export type Progress = { completed: number; required: number; ready: boolean };
export type User = {
  email: string;
  emailVerified: boolean;
  verificationRequired: boolean;
  id: string;
  handle: string;
  profile: Profile;
  card: Card | null;
  approved: boolean;
  aiConsent: boolean;
  progress: Progress;
  aiConfigured: boolean;
};
export type Person = {
  heightCm?: number | null;
  bio?: string;
  education?: string;
  occupation?: string;
  languages?: string;
  drinking?: string;
  relationshipStatus?: string;
  photos?: { id: string; slot: number }[];
  photoVerified?: boolean;
  id: string;
  name: string;
  age: number;
  city: string;
  gender: string;
  children: string;
  smoking: string;
  card: Card | null;
};
export type Comparison = { reasons: string[]; discuss: string[] };
export type Match = { person: Person; comparison: Comparison };
export type Intro = {
  unread: number;
  id: string;
  person: Person;
  acceptedByMe: boolean;
  connected: boolean;
  comparison: Comparison | null;
};
export type Message = {
  id: number;
  role?: string;
  sender?: string;
  text: string;
  created: string;
};
export const GENDERS = ["Woman", "Man", "Nonbinary"];
export const VALUES = [
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
export const INTERESTS = [
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
export const STYLES = ["Talk it through", "Pause then talk", "Write then talk"];
export const CHILDREN = ["Want children", "Do not want children", "Undecided"];
