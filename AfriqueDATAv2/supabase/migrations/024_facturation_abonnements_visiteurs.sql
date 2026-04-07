-- Affichage abonnements (montant FC / mois), facturation / caisse, visiteurs (catégorie), participations (formation)

-- Abonnements : montants pour afficher les mois équivalents (montant / tarif mensuel)
ALTER TABLE abonnements ADD COLUMN IF NOT EXISTS montant_total_fc NUMERIC(12,2);
ALTER TABLE abonnements ADD COLUMN IF NOT EXISTS tarif_mensuel_reference_fc NUMERIC(12,2);

COMMENT ON COLUMN abonnements.montant_total_fc IS 'Montant payé en FC (affiche les mois si tarif_mensuel_reference_fc renseigné)';
COMMENT ON COLUMN abonnements.tarif_mensuel_reference_fc IS 'Prix d''un mois en FC pour calculer mois = floor(montant / tarif)';

-- Visiteurs : catégorie (tableau de bord / exports)
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS categorie TEXT;

-- Participations : formation / modules (facturation inscription)
ALTER TABLE participations ADD COLUMN IF NOT EXISTS module_formation TEXT;
ALTER TABLE participations ADD COLUMN IF NOT EXISTS date_debut_formation DATE;
ALTER TABLE participations ADD COLUMN IF NOT EXISTS encaissement_type TEXT DEFAULT 'inscription_activite';

ALTER TABLE participations DROP CONSTRAINT IF EXISTS participations_encaissement_type_check;
ALTER TABLE participations ADD CONSTRAINT participations_encaissement_type_check CHECK (encaissement_type IN (
    'inscription_activite',
    'inscription_formation',
    'module_word',
    'module_excel',
    'module_powerpoint',
    'module_ia',
    'module_certification',
    'location_salle',
    'photocopie',
    'pratique',
    'autre'
  ));

COMMENT ON COLUMN participations.encaissement_type IS 'Catégorie d''encaissement pour ventilation';

-- Journal de caisse (encaissements ventilés + décaissements)
CREATE TABLE IF NOT EXISTS cash_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  jour DATE NOT NULL DEFAULT (CURRENT_DATE AT TIME ZONE 'UTC')::DATE,
  sens TEXT NOT NULL CHECK (sens IN ('encaissement', 'decaissement')),
  categorie TEXT NOT NULL CHECK (categorie IN (
    'abonnement',
    'inscription_formation',
    'module',
    'location_salle',
    'photocopie',
    'pratique',
    'autre'
  )),
  module_name TEXT CHECK (module_name IS NULL OR module_name IN ('word', 'excel', 'powerpoint', 'ia', 'certification')),
  montant_fc NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (montant_fc >= 0),
  montant_usd NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (montant_usd >= 0),
  libelle TEXT,
  nom_complet TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES admin_profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cash_ledger_jour ON cash_ledger(jour);
CREATE INDEX IF NOT EXISTS idx_cash_ledger_sens ON cash_ledger(sens);

ALTER TABLE cash_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all cash_ledger" ON cash_ledger FOR ALL USING (is_admin());

COMMENT ON TABLE cash_ledger IS 'Encaissements ventilés et décaissements journaliers (FC + USD)';
