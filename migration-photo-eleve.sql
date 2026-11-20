-- À exécuter UNE SEULE FOIS, uniquement si tu avais déjà exécuté l'ancien supabase.sql.
alter table eleves add column if not exists photo_path text;

drop view if exists v_eleves_stats;
create view v_eleves_stats as
select e.*,
  count(j.id) filter (where j.type='Retard') as retards,
  count(j.id) filter (where j.type='Absence') as absences,
  count(j.id) filter (where j.type='Absence' and j.justifie='Non') as absences_nj,
  count(j.id) filter (where j.type='Renvoi') as renvois
from eleves e left join journal j on j.eleve_id = e.id
group by e.id;

revoke all on v_eleves_stats from anon, authenticated;
grant all on v_eleves_stats to service_role;
