import type { Metadata } from "next";
import LeaguesSection from "@/components/organizer/leagues";

export const metadata: Metadata = { title: "Mis ligas" };

export default function Page() {
  return <LeaguesSection />;
}
