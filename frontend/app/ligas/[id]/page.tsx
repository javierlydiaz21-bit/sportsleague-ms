import type { Metadata } from "next";
import LeagueSetupSection from "@/components/organizer/league-setup";

export const metadata: Metadata = { title: "Configurar liga" };

/** Configuración guiada de una liga; ?etapa= retoma una etapa y ?nueva=1 confirma la creación. */
export default async function Page({ params, searchParams }: PageProps<"/ligas/[id]">) {
  const { id } = await params;
  const { etapa, nueva } = await searchParams;
  return <LeagueSetupSection id={Number(id)} stage={typeof etapa === "string" ? etapa : undefined} created={nueva === "1"} />;
}
