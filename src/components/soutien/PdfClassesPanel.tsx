import { useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import { useStudentExtras } from '../../services/studentDetailsService'
import { useStudentIdentities } from '../../services/studentIdentityService'
import { useStudents } from '../../services/studentsService'
import { useSoutienInscriptions, useSoutienSeances } from '../../services/soutienService'
import { niveauFromClasse } from '../../utils/alertEngine'
import { rapportDeLEcole } from '../../utils/soutienContexte'
import SoutienPrintPreviewModal from '../soutien-print/SoutienPrintPreviewModal'

/**
 * PDF de la vie scolaire : une page par classe avec les élèves au transport, ceux qui sortent seul(e) et ceux qui suivent
 * le soutien (avec la réponse des parents). Toutes les classes concernées, un niveau ou une seule classe.
 */
export default function PdfClassesPanel() {
  // Abonnements : le rapport lit les instantanés de ces données, qui doivent être chargées et rester à jour.
  const { data: students = [] } = useStudents()
  const { data: identities } = useStudentIdentities()
  const { data: extras } = useStudentExtras()
  const { data: seances = [] } = useSoutienSeances()
  const { data: inscriptions = [] } = useSoutienInscriptions()

  const [portee, setPortee] = useState('toutes')
  const [apercu, setApercu] = useState(false)

  const tout = useMemo(
    () => rapportDeLEcole(),
    [students, identities, extras, seances, inscriptions],
  )
  const niveaux = [...new Set(tout.map((r) => niveauFromClasse(r.classe)))]
  const rapports = tout.filter((r) => portee === 'toutes' || (portee.startsWith('niveau:') ? niveauFromClasse(r.classe) === portee.slice(7) : r.classe === portee.slice(7)))
  const libellePortee = portee === 'toutes' ? 'Toutes les classes' : portee.slice(portee.indexOf(':') + 1)

  return (
    <div>
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <FileText className="h-5 w-5 text-violet-500" />
          PDF par classe
        </h2>
        <p className="text-xs text-slate-500">
          Une page par classe : élèves au transport, élèves qui sortent seul(e) et élèves inscrits au soutien avec la réponse des parents. Les classes sans élève concerné n'ont pas de page.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={portee} onChange={(e) => setPortee(e.target.value)} aria-label="Portée du PDF" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none">
          <option value="toutes">Toutes les classes concernées ({tout.length})</option>
          <optgroup label="Un niveau">
            {niveaux.map((n) => (
              <option key={n} value={`niveau:${n}`}>
                {n}
              </option>
            ))}
          </optgroup>
          <optgroup label="Une classe">
            {tout.map((r) => (
              <option key={r.classe} value={`classe:${r.classe}`}>
                {r.classe}
              </option>
            ))}
          </optgroup>
        </select>
        <button
          type="button"
          onClick={() => setApercu(true)}
          disabled={rapports.length === 0}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FileText className="h-4 w-4" />
          Aperçu et PDF ({rapports.length} page{rapports.length > 1 ? 's' : ''} ou plus)
        </button>
      </div>

      {rapports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">Aucune classe n'a d'élève au transport, en sortie seul(e) ou au soutien.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Classe</th>
                <th className="px-3 py-3 text-center">Transport</th>
                <th className="px-3 py-3 text-center">Sortie seul(e)</th>
                <th className="px-3 py-3 text-center">Soutien</th>
              </tr>
            </thead>
            <tbody>
              {rapports.map((r) => (
                <tr key={r.classe} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2.5 font-semibold text-slate-800">{r.classe}</td>
                  <td className="px-3 py-2.5 text-center text-slate-600">{r.transport.length}</td>
                  <td className="px-3 py-2.5 text-center text-slate-600">{r.sortieSeul.length}</td>
                  <td className="px-3 py-2.5 text-center text-slate-600">{r.soutien.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {apercu && <SoutienPrintPreviewModal rapports={rapports} portee={libellePortee} onClose={() => setApercu(false)} />}
    </div>
  )
}
