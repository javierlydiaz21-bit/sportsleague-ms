import type { Metadata } from "next";
import NewLeagueSection from "@/components/organizer/league-new";

export const metadata: Metadata = { title: "Nueva liga" };

export default function Page() {
  return <NewLeagueSection />;
}
