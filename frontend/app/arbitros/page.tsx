import type { Metadata } from "next";
import RefereesSection from "@/components/organizer/referees";

export const metadata: Metadata = { title: "Árbitros" };

export default function Page() {
  return <RefereesSection />;
}
