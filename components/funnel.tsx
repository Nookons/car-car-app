"use client";

import * as React from "react";
import { trackVisitOnce } from "@/lib/track";

/** Один визит на вкладку — и никакого другого шума. */
export function Funnel() {
  React.useEffect(() => {
    trackVisitOnce();
  }, []);
  return null;
}
