import { useState } from 'react'
import { Bus, DoorOpen, FileText, GraduationCap, MessageCircle } from 'lucide-react'
import { useSoutienInscriptions, useSoutienSeances } from '../../services/soutienService'
import { aujourdhuiLocalISO, seanceTerminee } from '../../utils/soutienSeances'
import ConfirmationsPanel from './ConfirmationsPanel'
import PdfClassesPanel from './PdfClassesPanel'
import SeancesPanel from './SeancesPanel'
import SortiesDuJourPanel from './SortiesDuJourPanel'
import SortiesSeulPanel from './SortiesSeulPanel'

type Volet = 'seances' | 'confirmations' | 'jour' | 'sorties' | 'pdf'

/** Onglet « Soutien & Sorties » d'Emplois du Temps : séances de soutien, confirmations des parents, sorties seul(e) et PDF par classe. */
export default function SoutienSortiesTab({ isEditable }: { isEditable: boolean }) {
  const [volet, setVolet] = useState<Volet>('seances')
  const { data: seances = [] } = useSoutienSeances()
  const { data: inscriptions = [] } = useSoutienInscriptions()

  const enCours = new Set(seances.filter((s) => !seanceTerminee(s, aujourdhuiLocalISO())).map((s) => s.id))
  const aConfirmer = inscriptions.filter((i) => enCours.has(i.seanceId) && i.statut === 'a_confirmer').length

  const volets: { key: Volet; label: string; icon: typeof GraduationCap; badge?: number }[] = [
    { key: 'seances', label: 'Séances', icon: GraduationCap },
    { key: 'confirmations', label: 'Confirmations', icon: MessageCircle, badge: aConfirmer },
    { key: 'jour', label: 'Sorties du soir', icon: Bus },
    { key: 'sorties', label: 'Sorties seul(e)', icon: DoorOpen },
    { key: 'pdf', label: 'PDF par classe', icon: FileText },
  ]

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2 rounded-xl bg-slate-100 p-1 sm:inline-flex">
        {volets.map(({ key, label, icon: Icon, badge }) => (
          <button
            key={key}
            type="button"
            onClick={() => setVolet(key)}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
              volet === key ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {!!badge && <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700">{badge}</span>}
          </button>
        ))}
      </div>

      {volet === 'seances' && <SeancesPanel isEditable={isEditable} />}
      {volet === 'confirmations' && <ConfirmationsPanel isEditable={isEditable} />}
      {volet === 'jour' && <SortiesDuJourPanel />}
      {volet === 'sorties' && <SortiesSeulPanel isEditable={isEditable} />}
      {volet === 'pdf' && <PdfClassesPanel />}
    </div>
  )
}
