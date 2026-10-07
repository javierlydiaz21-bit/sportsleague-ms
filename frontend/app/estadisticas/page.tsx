import type { Metadata } from "next";
import StatisticsSection from "@/components/organizer/statistics";

export const metadata: Metadata = { title: "Estadísticas" };

export default function Page() {
  return <StatisticsSection />;
}
