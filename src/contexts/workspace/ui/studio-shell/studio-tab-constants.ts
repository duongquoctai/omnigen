export const STUDIO_TABS = ["split", "mix", "history"] as const;
export type StudioTab = (typeof STUDIO_TABS)[number];
