import PrintableGardePlanning, { type GardePrintAgent } from './PrintableGardePlanning'
import type { GardePeriode } from '../../services/gardePeriodesService'
import type { GardeAffectation } from '../../services/gardeAffectationsService'
import type { GardeCreneau } from '../../services/gardeCreneauxService'
import type { GardeEvenement } from '../../services/gardeEvenementsService'
import type { GardeFamille } from '../../services/gardeFamillesService'
import type { GardeVendredi } from '../../services/gardeVendrediService'
import type { GardePeriodeAgent } from '../../services/gardePeriodeAgentsService'
import type { GardeVendrediPresence } from '../../services/gardeVendrediPresenceService'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { sanitizeFileName } from '../print/printFileName'

interface GardePrintPreviewModalProps {
  periode: GardePeriode
  agents: GardePrintAgent[]
  creneaux: GardeCreneau[]
  affectations: GardeAffectation[]
  evenements: GardeEvenement[]
  familles: GardeFamille[]
  vendredi: GardeVendredi[]
  periodeAgents: GardePeriodeAgent[]
  presence: GardeVendrediPresence[]
  onClose: () => void
}

export default function GardePrintPreviewModal({
  periode,
  agents,
  creneaux,
  affectations,
  evenements,
  familles,
  vendredi,
  periodeAgents,
  presence,
  onClose,
}: GardePrintPreviewModalProps) {
  return (
    <PrintPreviewShell
      subtitle={`Planning du Service Garde — ${periode.nom}`}
      printLabel="Imprimer / Télécharger"
      onClose={onClose}
      fileName={sanitizeFileName(`Planning_Garde_${periode.nom}`)}
    >
      <PrintableGardePlanning
        periode={periode}
        agents={agents}
        creneaux={creneaux}
        affectations={affectations}
        evenements={evenements}
        familles={familles}
        vendredi={vendredi}
        periodeAgents={periodeAgents}
        presence={presence}
      />
    </PrintPreviewShell>
  )
}
