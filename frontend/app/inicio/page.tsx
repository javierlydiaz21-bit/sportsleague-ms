import type { Metadata } from "next";
import PanelHome from "@/components/organizer/home";

export const metadata: Metadata = { title: "Inicio" };

export default function Page() {
  return <PanelHome />;
}
