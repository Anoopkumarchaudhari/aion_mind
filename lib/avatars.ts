export type ProfileAvatar = {
  id: string;
  label: string;
  emoji: string;
  gradient: string;
};

/** 10 preset avatars users can pick. Stored by id; rendered as a gradient + emoji. */
export const PROFILE_AVATARS: ProfileAvatar[] = [
  { id: "fox", label: "Fox", emoji: "🦊", gradient: "linear-gradient(135deg, #f97316, #fb7185)" },
  { id: "panda", label: "Panda", emoji: "🐼", gradient: "linear-gradient(135deg, #64748b, #0f172a)" },
  { id: "owl", label: "Owl", emoji: "🦉", gradient: "linear-gradient(135deg, #a855f7, #6366f1)" },
  { id: "tiger", label: "Tiger", emoji: "🐯", gradient: "linear-gradient(135deg, #f59e0b, #ef4444)" },
  { id: "cat", label: "Cat", emoji: "🐱", gradient: "linear-gradient(135deg, #22d3ee, #2563eb)" },
  { id: "lion", label: "Lion", emoji: "🦁", gradient: "linear-gradient(135deg, #fbbf24, #f97316)" },
  { id: "frog", label: "Frog", emoji: "🐸", gradient: "linear-gradient(135deg, #34d399, #10b981)" },
  { id: "penguin", label: "Penguin", emoji: "🐧", gradient: "linear-gradient(135deg, #38bdf8, #0ea5e9)" },
  { id: "unicorn", label: "Unicorn", emoji: "🦄", gradient: "linear-gradient(135deg, #f472b6, #a855f7)" },
  { id: "octopus", label: "Octopus", emoji: "🐙", gradient: "linear-gradient(135deg, #c084fc, #ec4899)" }
];

export const DEFAULT_AVATAR_ID = PROFILE_AVATARS[0].id;

export function getProfileAvatar(id: string | null | undefined): ProfileAvatar {
  return PROFILE_AVATARS.find((avatar) => avatar.id === id) ?? PROFILE_AVATARS[0];
}
