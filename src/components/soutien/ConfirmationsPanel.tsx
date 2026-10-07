import { useMemo, useState } from 'react'
import { Bus, Info, MessageCircle, RotateCcw } from 'lucide-react'
import { JOURS_SOUTIEN, statutSoutienLabel, type SoutienInscription, type SoutienSeance, type StatutSoutien } from '../../data/soutien'
import { getStudentsSnapshot } from '../../services/studentsService'
import { useSetSoutienStatut, useSoutienInscriptions, useSoutienSeances } from '../../services/soutienService'
import { alerteCar } from '../../utils/soutien'
import { transportInfoOf } from '../../utils/soutienContexte'
import { aujourdhuiLocalISO, compterStatuts, libelleCreneau, seanceTerminee } from '../../utils/soutienSeances'
import BulkSoutienMessagesModal from './BulkSoutienMessagesModal'
import SoutienMessageModal from './SoutienMessageModal'

type FiltreEtat = 'tous' | StatutSoutien | 'pas_prevenus'

const STATUT_STYLE: Record<StatutSoutien, string> = {
  a_confirmer: 'bg-amber-50 text-amber-700 ring-amber-200',
  reste: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  ne_reste_pas: 'bg-slate-100 text-slate-600 ring-slate-200',
}

function dateHeure(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} à ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const SELECT = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none'

/**
 * Réponses des parents au soutien : une ligne par élève inscrit avec son état (à confirmer, reste, part en transport), le
 * car du soir et le message envoyé. Les parents répondent par WhatsApp : la vie scolaire note leur réponse ici.
 */
export default function ConfirmationsPanel({ isEditable }: { isEditable: boolean }) {
  const { data: seances = [] } = useSoutienSeances()
  const { data: inscriptions = [] } = useSoutienInscriptions()
  const setStatut = useSetSoutienStatut()

  const [seanceId, setSeanceId] = useState('')
  const [classe, setClasse] = useState('')
  const [etat, setEtat] = useState<FiltreEtat>('tous')
  const [message, setMessage] = useState<{ inscription: SoutienInscription; seance: SoutienSeance; studentName: string } | null>(null)
  const [enSerie, setEnSerie] = useState<string[] | null>(null)

  const aujourdhui = aujourdhuiLocalISO()
  const rows = useMemo(() => {
    const seanceParId = new Map(seances.map((s) => [s.id, s]))
    const students = new Map(getStudentsSnapshot().map((s) => [s.id, s]))
    return inscriptions
      .map((inscription) => ({ inscription, seance: seanceParId.get(inscription.seanceId), student: students.get(inscription.studentId) }))
      .filter((r): r is { inscription: SoutienInscription; seance: SoutienSeance; student: NonNullable<typeof r.student> } => !!r.seance && !!r.student && !seanceTerminee(r.seance, aujourdhui))
      .map((r) => {
        const transport = transportInfoOf(r.student.id)
        return { ...r, transport, car: alerteCar(r.seance, transport) }
      })
      .sort(
        (a, b) =>
          JOURS_SOUTIEN.indexOf(a.seance.jour) - JOURS_SOUTIEN.indexOf(b.seance.jour) ||
          a.seance.heureDebut.localeCompare(b.seance.heureDebut) ||
          a.student.classe.localeCompare(b.student.classe, 'fr') ||
          a.student.name.localeCompare(b.student.name, 'fr'),
      )
  }, [seances, inscriptions])

  const classes = [...new Set(rows.map((r) => r.student.classe))].sort((a, b) => a.localeCompare(b, 'fr'))
  const visibles = rows.filter(
    (r) =>
      (!seanceId || r.seance.id === seanceId) &&
      (!classe || r.student.classe === classe) &&
      (etat === 'tous' || (etat === 'pas_prevenus' ? !r.inscription.messageEnvoyeLe : r.inscription.statut === etat)),
  )
  const comptes = compterStatuts(visibles.map((r) => r.inscription))
  const aPrevenir = visibles.filter((r) => r.inscription.statut === 'a_confirmer')

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
        Aucun élève inscrit au soutien pour le moment. Inscrivez des élèves dans l'onglet « Séances ».
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-2.5 text-xs text-sky-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Les parents répondent par WhatsApp : notez ici leur réponse. Un élève qui prend le car du soir et reste au soutien n'est plus pris en charge par le service transport ce jour-là — c'est une simple mention, aucune liste de car n'est modifiée.
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select value={seanceId} onChange={(e) => setSeanceId(e.target.value)} className={SELECT} aria-label="Séance">
          <option value="">Toutes les séances</option>
          {seances
            .filter((s) => !seanceTerminee(s, aujourdhui))
            .sort((a, b) => JOURS_SOUTIEN.indexOf(a.jour) - JOURS_SOUTIEN.indexOf(b.jour) || a.heureDebut.localeCompare(b.heureDebut))
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.matiere} — {libelleCreneau(s)}
              </option>
            ))}
        </select>
        <select value={classe} onChange={(e) => setClasse(e.target.value)} className={SELECT} aria-label="Classe">
          <option value="">Toutes les classes</option>
          {classes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={etat} onChange={(e) => setEtat(e.target.value as FiltreEtat)} className={SELECT} aria-label="État">
          <option value="tous">Tous les états</option>
          <option value="a_confirmer">À confirmer</option>
          <option value="reste">Restent au soutien</option>
          <option value="ne_reste_pas">Ne restent pas / partent en transport</option>
          <option value="pas_prevenus">Pas encore prévenus</option>
        </select>
        <button
          type="button"
          onClick={() => setEnSerie(aPrevenir.map((r) => r.inscription.id))}
          disabled={aPrevenir.length === 0}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <MessageCircle className="h-4 w-4" />
          Messages en série ({aPrevenir.length})
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5 text-[11px] font-semibold">
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">{comptes.a_confirmer} à confirmer</span>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{comptes.reste} restent</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{comptes.ne_reste_pas} ne restent pas</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Élève</th>
              <th className="px-3 py-3">Séance</th>
              <th className="px-3 py-3">Car du soir</th>
              <th className="px-3 py-3">Message</th>
              <th className="px-3 py-3">Réponse des parents</th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                  Aucun élève ne correspond à ces filtres.
                </td>
              </tr>
            )}
            {visibles.map(({ inscription: i, seance, student, transport, car }) => (
              <tr key={i.id} className="border-b border-slate-50 align-top last:border-0">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800">{student.name}</p>
                  <p className="text-xs text-slate-400">{student.classe}</p>
                </td>
                <td className="px-3 py-3">
                  <p className="font-medium text-slate-700">{seance.matiere}</p>
                  <p className="text-xs text-slate-500">{libelleCreneau(seance)}</p>
                </td>
                <td className="px-3 py-3 text-xs">
                  {transport.aTransportSoir ? (
                    <div className="space-y-1">
                      <p className="flex items-center gap-1 font-medium text-slate-700">
                        <Bus className="h-3.5 w-3.5 text-slate-400" />
                        Ligne {transport.ligneSoir} · départ {transport.heureDepart}
                      </p>
                      {car ? (
                        <p className="font-semibold text-amber-700">Fin du soutien après le car : s'il reste, pas de car ce jour-là.</p>
                      ) : (
                        <p className="text-slate-400">Le soutien finit avant le car.</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-xs">
                  {i.messageEnvoyeLe ? <p className="text-slate-600">Envoyé le {dateHeure(i.messageEnvoyeLe)}</p> : <p className="font-medium text-amber-600">Pas encore prévenu</p>}
                  <button
                    type="button"
                    onClick={() => setMessage({ inscription: i, seance, studentName: student.name })}
                    className="mt-1 inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    <MessageCircle className="h-3 w-3" />
                    {i.messageEnvoyeLe ? 'Renvoyer' : 'Envoyer'}
                  </button>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['reste', 'ne_reste_pas'] as StatutSoutien[]).map((s) => {
                      const actif = i.statut === s
                      return (
                        <button
                          key={s}
                          type="button"
                          disabled={!isEditable}
                          onClick={() => setStatut.mutate({ id: i.id, statut: s })}
                          aria-pressed={actif}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 disabled:cursor-not-allowed ${actif ? STATUT_STYLE[s] : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50'}`}
                        >
                          {statutSoutienLabel(s, transport.aTransportSoir)}
                        </button>
                      )
                    })}
                    {i.statut !== 'a_confirmer' ? (
                      <button
                        type="button"
                        title="Remettre en attente"
                        aria-label="Remettre en attente"
                        disabled={!isEditable}
                        onClick={() => setStatut.mutate({ id: i.id, statut: 'a_confirmer' })}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 disabled:opacity-40"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${STATUT_STYLE.a_confirmer}`}>À confirmer</span>
                    )}
                  </div>
                  {i.reponduLe && <p className="mt-1 text-[11px] text-slate-400">Noté le {dateHeure(i.reponduLe)}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {message && <SoutienMessageModal inscription={message.inscription} seance={message.seance} studentName={message.studentName} onClose={() => setMessage(null)} />}
      {enSerie && <BulkSoutienMessagesModal ids={enSerie} isEditable={isEditable} onClose={() => setEnSerie(null)} />}
    </div>
  )
}
