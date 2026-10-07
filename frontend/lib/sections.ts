// Secciones del panel de organizadores, en el orden en que se arma una liga.

export type SectionId = "ligas" | "equipos" | "arbitros" | "calendario" | "partidos" | "estadisticas" | "publico";

export interface Section {
  id: SectionId;
  href: string;
  label: string;
  short: string;
  desc: string;
  intro: string;
  service: string;
}

export const SECTIONS: Section[] = [
  {
    id: "ligas",
    href: "/ligas",
    label: "Ligas y reglamento",
    short: "Ligas",
    desc: "Temporadas, categorías y cómo se cuentan los puntos.",
    intro: "Define las ligas, sus temporadas, las categorías y cómo se cuentan los puntos.",
    service: "League Service",
  },
  {
    id: "equipos",
    href: "/equipos",
    label: "Equipos y jugadores",
    short: "Equipos",
    desc: "Plantillas y elegibilidad por edad.",
    intro: "Al fichar a un jugador se compara su edad con el rango de su categoría (consulta al League Service).",
    service: "Team Service",
  },
  {
    id: "arbitros",
    href: "/arbitros",
    label: "Árbitros",
    short: "Árbitros",
    desc: "Zona, categorías y días disponibles.",
    intro:
      "Al publicar una jornada, cada partido recibe un árbitro de la misma zona, certificado en la categoría y disponible ese día.",
    service: "Referee Service",
  },
  {
    id: "calendario",
    href: "/calendario",
    label: "Calendario",
    short: "Calendario",
    desc: "Genera la temporada y cambia sedes.",
    intro: "Cada temporada tiene un calendario. Al publicarlo, cada jornada se envía a los árbitros y a los equipos.",
    service: "Fixture Service",
  },
  {
    id: "partidos",
    href: "/partidos",
    label: "Partidos y actas",
    short: "Partidos",
    desc: "Partidos en curso y corrección de actas.",
    intro:
      "Sigue los partidos en curso y corrige el acta de los que ya terminaron. Los eventos los registra el árbitro desde su app.",
    service: "Live Score Service",
  },
  {
    id: "estadisticas",
    href: "/estadisticas",
    label: "Estadísticas",
    short: "Estadísticas",
    desc: "Tabla, goleadores, tarjetas y rendimiento.",
    intro: "Se recalculan cada vez que termina un partido o se corrige un acta.",
    service: "Statistics y Analytics",
  },
  {
    id: "publico",
    href: "/publico",
    label: "Sitio público",
    short: "Sitio público",
    desc: "Lo que ven los equipos y los seguidores.",
    intro: "",
    service: "Web pública",
  },
];

export const section = (id: SectionId) => SECTIONS.find((s) => s.id === id)!;
