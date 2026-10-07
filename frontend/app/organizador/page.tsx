import type { Metadata } from "next";
import OrganizerHome from "@/components/organizer/home";

export const metadata: Metadata = { title: "Panel de organizadores" };

export default function Page() {
  return <OrganizerHome />;
}
