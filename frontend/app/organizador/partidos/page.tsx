import type { Metadata } from "next";
import MatchesSection from "@/components/organizer/matches";

export const metadata: Metadata = { title: "Partidos y actas" };

export default function Page() {
  return <MatchesSection />;
}
