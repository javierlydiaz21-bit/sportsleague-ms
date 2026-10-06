import { redirect } from "next/navigation";

/** Ruta anterior del calendario: ahora vive en la pagina de la temporada. */
export default async function CalendarioPage({ params }: PageProps<"/calendario/[seasonId]">) {
  const { seasonId } = await params;
  redirect(`/temporadas/${seasonId}#calendario`);
}
