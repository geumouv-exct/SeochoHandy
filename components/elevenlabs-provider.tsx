"use client";

import { ConversationProvider } from "@elevenlabs/react";
import type { ReactNode } from "react";

export function ElevenLabsProvider({ children }: { children: ReactNode }) {
  return <ConversationProvider>{children}</ConversationProvider>;
}
