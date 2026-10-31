import { SeochoApp } from "@/components/seocho-app";
import { ElevenLabsProvider } from "@/components/elevenlabs-provider";
import { createSeedStore } from "@/lib/demo-data";

const staticPaths = [
  [], ["start"], ["senior"], ["senior", "schedule"],
  ["senior", "request", "voice"], ["senior", "request", "manual"],
  ["senior", "request", "review"], ["senior", "request", "new"],
  ["volunteer"], ["volunteer", "calendar"], ["volunteer", "requests"],
  ["volunteer", "history"], ["volunteer", "rewards"], ["partner"],
  ["partner", "requests", "new"], ["admin"], ["safety"],
];

export function generateStaticParams() {
  const requestPaths = createSeedStore().requests.flatMap(({ id }) => [
    { slug: ["activities", id] },
    { slug: ["volunteer", "requests", id, "propose"] },
  ]);
  return [...staticPaths.map((slug) => ({ slug })), ...requestPaths];
}

export default function Page() {
  return <ElevenLabsProvider><SeochoApp connectedMode={false} voiceConfigured={false} agentLabel="" /></ElevenLabsProvider>;
}
