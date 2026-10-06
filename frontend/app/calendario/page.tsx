import { redirect } from "next/navigation";

/** Recibe ?temporada=1 y lleva a /temporadas/1. */
export default async function CalendarioSearch({ searchParams }: PageProps<"/calendario">) {
  const { temporada } = await searchParams;
  const id = Number(Array.isArray(temporada) ? temporada[0] : temporada);
  redirect(Number.isInteger(id) && id > 0 ? `/temporadas/${id}` : "/");
}
