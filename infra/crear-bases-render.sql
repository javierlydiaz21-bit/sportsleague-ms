-- Render permite una sola instancia gratuita de Postgres por cuenta.
-- Dentro de esa instancia se crea una base de datos independiente por microservicio
-- (database per service). Ejecuta cada linea por separado, conectado a la instancia.
CREATE DATABASE league_db;
CREATE DATABASE team_db;
CREATE DATABASE fixture_db;
CREATE DATABASE referee_db;
CREATE DATABASE live_score_db;
CREATE DATABASE statistics_db;
CREATE DATABASE notification_db;
CREATE DATABASE analytics_db;
CREATE DATABASE gateway_db;
