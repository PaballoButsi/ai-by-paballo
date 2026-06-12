export type Persona = "professional" | "coach" | "friend";

export type Profile = {
  name: string;
  jobTitle: string;
  industry: string;
  workHours: string;
  persona: Persona;
};

export const INDUSTRIES = [
  "Tech",
  "Finance",
  "Education",
  "Healthcare",
  "Marketing",
  "Other",
] as const;

export const DEFAULT_PROFILE: Profile = {
  name: "Paballo Butsi",
  jobTitle: "",
  industry: "Tech",
  workHours: "09:00 - 17:00",
  persona: "professional",
};

export const PROFILE_STORAGE_KEY = "smartwork.profile.v1";

export function loadProfile(): Profile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<Profile>;
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(p: Profile) {
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(p));
  } catch {
    // ignore quota
  }
}

export const PERSONA_META: Record<
  Persona,
  { label: string; description: string; promptAddendum: string }
> = {
  professional: {
    label: "Professional",
    description: "Formal, concise, and to the point.",
    promptAddendum: "Keep your tone formal, professional, and concise.",
  },
  coach: {
    label: "Coach",
    description: "Motivational and encouraging.",
    promptAddendum:
      "Be motivational and encouraging in your tone. Celebrate small wins and push the user toward action.",
  },
  friend: {
    label: "Friend",
    description: "Casual, warm, and conversational.",
    promptAddendum:
      "Be warm, casual, and conversational like a knowledgeable friend. Use plain language.",
  },
};