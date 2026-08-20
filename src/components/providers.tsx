"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { AppProvider } from "@/components/app-provider";

export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider><AppProvider>{children}</AppProvider></SessionProvider>;
}
