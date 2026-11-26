"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { STUDIO_TABS, type StudioTab } from "./studio-tab-constants";

export { STUDIO_TABS, type StudioTab };

export function useStudioTab(defaultTab: StudioTab = "split") {
  return useQueryState("tab", parseAsStringLiteral(STUDIO_TABS).withDefault(defaultTab));
}
