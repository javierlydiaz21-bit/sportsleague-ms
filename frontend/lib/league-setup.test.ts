// Pruebas de la lógica del flujo de ligas: `npm test` (node:test, sin dependencias).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  firstOpenStage,
  leagueStatus,
  matchesOutside,
  normalizeName,
  seasonsToRecalculate,
  setupStages,
  similarLeague,
  validateCategory,
  validateLeague,
  validateRule,
  validateSeason,
  type SetupData,
} from "./league-setup.ts";

const empty: SetupData = { seasons: [], categories: [], teamsPerCategory: {}, matchesPerSeason: {}, referees: 0 };
const rule = { pointsWin: 3, pointsDraw: 1, tiebreakerCriteria: "diferencia_de_goles" };
const state = (d: SetupData) => Object.fromEntries(setupStages(d).map((s) => [s.id, s.state]));

describe("etapas de la configuración guiada", () => {
  it("una liga recién creada tiene todo pendiente y se retoma en Temporada", () => {
    const stages = setupStages(empty);
    assert.deepEqual(state(empty), {
      temporada: "pendiente",
      categorias: "pendiente",
      reglamento: "pendiente",
      equipos: "pendiente",
      calendario: "pendiente",
      revision: "pendiente",
    });
    assert.equal(firstOpenStage(stages), "temporada");
    assert.deepEqual(leagueStatus(stages), { done: 0, total: 5, ready: false });
  });

  it("avanza con los datos guardados y marca lo que requiere atención", () => {
    const d: SetupData = {
      ...empty,
      seasons: [{ id: 1, year: 2026 }],
      categories: [
        { id: 1, name: "Sub-15", rule },
        { id: 2, name: "Sub-17", rule: null },
      ],
      teamsPerCategory: { 1: 4, 2: 1 },
    };
    const s = state(d);
    assert.equal(s.temporada, "completada");
    assert.equal(s.categorias, "completada");
    assert.equal(s.reglamento, "atencion");
    assert.equal(s.equipos, "atencion");
    assert.equal(s.calendario, "pendiente");
    // Sub-15 ya tiene equipos suficientes: su calendario se puede generar
    assert.equal(setupStages(d).find((x) => x.id === "calendario")?.detail, "Genera el calendario");
    assert.equal(firstOpenStage(setupStages(d)), "reglamento");
  });

  it("un calendario sin árbitros requiere atención; con árbitros la liga queda lista para operar", () => {
    const base: SetupData = {
      seasons: [{ id: 1, year: 2026 }],
      categories: [{ id: 1, name: "Libre", rule }],
      teamsPerCategory: { 1: 4 },
      matchesPerSeason: { 1: 6 },
      referees: 0,
    };
    assert.equal(state(base).calendario, "atencion");
    const ready = setupStages({ ...base, referees: 2 });
    assert.equal(ready.find((x) => x.id === "revision")?.detail, "Lista para operar");
    assert.deepEqual(leagueStatus(ready), { done: 5, total: 5, ready: true });
  });
});

describe("nombres parecidos", () => {
  it("compara sin tildes, mayúsculas ni espacios de sobra", () => {
    assert.equal(normalizeName("  Liga  de MONTERÍA "), "liga de monteria");
  });

  it("avisa con nombres iguales o casi iguales, no con nombres distintos", () => {
    const mine = [{ id: 1, name: "Liga Barrial de Montería" }];
    assert.equal(similarLeague("liga barrial de monteria", mine)?.id, 1);
    assert.equal(similarLeague("Liga Barial de Montería", mine)?.id, 1);
    assert.equal(similarLeague("Liga de Medellín", mine), undefined);
    assert.equal(similarLeague("", mine), undefined);
  });
});

describe("validaciones de los formularios", () => {
  it("liga: nombre obligatorio de 2 a 80 caracteres y deporte admitido", () => {
    assert.equal(validateLeague("  ", "futbol"), "Escribe el nombre de tu liga.");
    assert.equal(validateLeague("A", "futbol"), "El nombre debe tener al menos 2 caracteres.");
    assert.equal(validateLeague("x".repeat(81), "futbol"), "El nombre puede tener hasta 80 caracteres.");
    assert.equal(validateLeague("Liga UCC", "tenis"), "Elige el deporte de la liga.");
    assert.equal(validateLeague("Liga UCC", "voley"), null);
  });

  it("temporada: año válido, fin posterior al inicio y año coherente con las fechas", () => {
    assert.equal(validateSeason(1999, "2026-01-01", "2026-06-01"), "Escribe un año entre 2000 y 2100.");
    assert.equal(validateSeason(2026, "", "2026-06-01"), "Elige la fecha de inicio y la de fin.");
    assert.equal(validateSeason(2026, "2026-06-01", "2026-06-01"), "La fecha de fin debe ser posterior a la de inicio.");
    assert.match(validateSeason(2030, "2026-01-01", "2026-06-01") ?? "", /debe coincidir/);
    assert.equal(validateSeason(2026, "2026-10-01", "2027-02-28"), null);
  });

  it("categoría: nombre único en la liga y rango de edad coherente", () => {
    assert.equal(validateCategory("sub-17", 15, 17, ["Sub-17"]), "Ya existe la categoría sub-17 en esta liga.");
    assert.equal(validateCategory("Sub-15", 15, 13, []), "La edad mínima no puede ser mayor que la máxima.");
    assert.equal(validateCategory("Sub-15", 1, 15, []), "Las edades deben estar entre 3 y 99 años.");
    assert.equal(validateCategory("Sub-15", 13.5, 15, []), "Escribe las edades como números enteros.");
    assert.equal(validateCategory("Sub-15", 13, 15, ["Sub-17"]), null);
  });

  it("reglamento: victoria de 1 a 10, empate hasta la victoria y desempate admitido", () => {
    assert.match(validateRule(0, 0, "diferencia_de_goles") ?? "", /victoria/);
    assert.match(validateRule(2, 3, "diferencia_de_goles") ?? "", /empate/);
    assert.equal(validateRule(3, 1, "sorteo"), "Elige un criterio de desempate.");
    assert.equal(validateRule(2, 1, "partidos_ganados"), null);
  });
});

describe("avisos de edición", () => {
  const calendar = [
    { scheduledAt: "2026-10-17T20:00:00.000Z" },
    { scheduledAt: "2026-11-07T20:00:00.000Z" },
  ];

  it("detecta partidos que quedarían fuera de las fechas nuevas (el último día cuenta)", () => {
    assert.equal(matchesOutside(calendar, "2026-10-17", "2026-11-07").length, 0);
    assert.equal(matchesOutside(calendar, "2026-10-18", "2026-12-01").length, 1);
    assert.equal(matchesOutside(calendar, "2026-11-08", "2026-12-01").length, 2);
  });

  it("recalcula solo las temporadas con partidos finalizados de esa categoría", () => {
    const teams = [
      { id: 1, categoryId: 10 },
      { id: 2, categoryId: 10 },
      { id: 3, categoryId: 20 },
    ];
    const matches = {
      5: [{ homeTeam: 1, status: "finalizado" }],
      6: [{ homeTeam: 1, status: "programado" }],
      7: [{ homeTeam: 3, status: "finalizado" }],
    };
    assert.deepEqual(seasonsToRecalculate(10, teams, matches), [5]);
    assert.deepEqual(seasonsToRecalculate(20, teams, matches), [7]);
    assert.deepEqual(seasonsToRecalculate(30, teams, matches), []);
  });
});
