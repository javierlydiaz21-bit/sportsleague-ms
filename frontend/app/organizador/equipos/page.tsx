import type { Metadata } from "next";
import TeamsSection from "@/components/organizer/teams";

export const metadata: Metadata = { title: "Equipos y jugadores" };

export default function Page() {
  return <TeamsSection />;
}
