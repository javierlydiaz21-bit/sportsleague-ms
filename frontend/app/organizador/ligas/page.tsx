import type { Metadata } from "next";
import LeaguesSection from "@/components/organizer/leagues";

export const metadata: Metadata = { title: "Ligas y reglamento" };

export default function Page() {
  return <LeaguesSection />;
}
