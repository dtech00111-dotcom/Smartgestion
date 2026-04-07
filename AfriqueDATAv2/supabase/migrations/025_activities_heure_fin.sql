-- Heure de fin explicite pour les activités (en complément de duree_minutes, conservée pour compatibilité)

ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS heure_fin TIME;

UPDATE activities
SET heure_fin = (heure_debut + (duree_minutes * INTERVAL '1 minute'))::time
WHERE heure_fin IS NULL;

COMMENT ON COLUMN activities.heure_fin IS 'Heure de fin de la séance ; duree_minutes reste synchronisé côté application';
