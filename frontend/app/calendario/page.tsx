import { redirect } from "next/navigation";

/** Recibe el formulario de la portada (?temporada=1) y lleva a /calendario/1. */
export default async function CalendarioSearch({ searchParams }: PageProps<"/calendario">) {
  const { temporada } = await searchParams;
  const id = Number(Array.isArray(temporada) ? temporada[0] : temporada);
  redirect(Number.isInteger(id) && id > 0 ? `/calendario/${id}` : "/");
}
