export type ProfileAvatar = {
  id: string;
  label: string;
  emoji: string;
  gradient: string;
};

/** Preset profile avatars. Stored by id; rendered as a gradient + emoji. */
export const PROFILE_AVATARS: ProfileAvatar[] = [
  { id: "man", label: "Man", emoji: "👨", gradient: "linear-gradient(135deg, #3b82f6, #6366f1)" },
  { id: "woman", label: "Woman", emoji: "👩", gradient: "linear-gradient(135deg, #ec4899, #a855f7)" }
];

export const DEFAULT_AVATAR_ID = PROFILE_AVATARS[0].id;

export function getProfileAvatar(id: string | null | undefined): ProfileAvatar {
  return PROFILE_AVATARS.find((avatar) => avatar.id === id) ?? PROFILE_AVATARS[0];
}
