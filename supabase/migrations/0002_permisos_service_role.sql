-- La Edge Function usa la service_role. Si el proyecto se creó sin "Automatically expose new tables",
-- las tablas nuevas no reciben permisos por defecto: se otorgan aquí solo a service_role (anon y authenticated siguen sin acceso).
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
