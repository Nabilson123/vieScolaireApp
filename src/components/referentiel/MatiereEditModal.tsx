import { useState } from 'react'
import { X } from 'lucide-react'
import { NIVEAUX, type MatiereConfig, type MatiereNiveauConfig } from '../../data/referentiel'
import { useSchoolIdentity } from '../../services/schoolIdentityService'
import { useAddMatiere, useUpdateMatiereInfo, useUpdateMatiereNiveauConfig } from '../../services/matieresConfigService'

function defaultNiveauConfig(): MatiereNiveauConfig {
  return { active: true, coefficient: 2, exporterMassar: true, afficherBulletin: true, exporterParChapitres: false, horsMaxExamens: false }
}

function defaultParNiveau(): Record<string, MatiereNiveauConfig> {
  const map: Record<string, MatiereNiveauConfig> = {}
  NIVEAUX.forEach((n) => {
    map[n] = defaultNiveauConfig()
  })
  return map
}

interface MatiereEditModalProps {
  matiere: MatiereConfig | null
  onClose: () => void
  onSaved: () => void
}

export default function MatiereEditModal({ matiere, onClose, onSaved }: MatiereEditModalProps) {
  const { data: schoolIdentity } = useSchoolIdentity()
  const mode = matiere ? 'edit' : 'add'
  const [step, setStep] = useState<1 | 2>(1)
  const [nom, setNom] = useState(matiere?.nom ?? '')
  const [nomAr, setNomAr] = useState(matiere?.nomAr ?? '')
  const [code, setCode] = useState(matiere?.code ?? '')
  const [rtl, setRtl] = useState(matiere?.rtl ?? false)
  const [parNiveau, setParNiveau] = useState<Record<string, MatiereNiveauConfig>>(matiere?.parNiveau ?? defaultParNiveau())

  const addMatiere = useAddMatiere()
  const updateMatiereInfo = useUpdateMatiereInfo()
  const updateMatiereNiveauConfig = useUpdateMatiereNiveauConfig()

  const patchNiveau = (niveau: string, patch: Partial<MatiereNiveauConfig>) => {
    setParNiveau((prev) => ({ ...prev, [niveau]: { ...prev[niveau], ...patch } }))
  }

  const handleValidate = async () => {
    const id = mode === 'add' ? await addMatiere.mutateAsync({ nom, code }) : (matiere as MatiereConfig).id
    await updateMatiereInfo.mutateAsync({ id, nom, nomAr, code, rtl })
    await updateMatiereNiveauConfig.mutateAsync({ matiereId: id, parNiveau })
    onSaved()
    onClose()
  }

  if (step === 1) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-bold text-slate-900">{mode === 'add' ? 'Ajouter une matière' : 'Modifier une matière'}</h2>
            <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Matière</label>
              <input value={nom} onChange={(e) => setNom(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Matière (ar)</label>
              <input dir="rtl" value={nomAr} onChange={(e) => setNomAr(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Code matière</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={rtl} onChange={(e) => setRtl(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
              De droite à gauche
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Annuler
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!nom.trim()}
              className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Suivant
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">École :</span>
          <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600">{schoolIdentity?.nom ?? ''}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-56 py-2 text-left text-xs font-semibold text-slate-500" />
                {NIVEAUX.map((n) => (
                  <th key={n} className="border-b-2 border-slate-200 px-2 py-2 text-center text-xs font-bold text-slate-700">
                    {n}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-2 text-sm font-semibold text-slate-700">Active</td>
                {NIVEAUX.map((n) => (
                  <td key={n} className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => patchNiveau(n, { active: !parNiveau[n]?.active })}
                      className={`mx-auto flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                        parNiveau[n]?.active ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                      }`}
                    />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <td className="py-2 text-sm font-semibold text-slate-700">Coefficient</td>
                {NIVEAUX.map((n) => (
                  <td key={n} className="px-2 py-1.5 text-center">
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={parNiveau[n]?.coefficient ?? 0}
                      onChange={(e) => patchNiveau(n, { coefficient: Number(e.target.value) })}
                      className="w-14 rounded-lg border border-slate-200 px-1.5 py-1 text-center text-sm"
                    />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 text-sm font-semibold text-slate-700">À exporter pour massar</td>
                {NIVEAUX.map((n) => (
                  <td key={n} className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={parNiveau[n]?.exporterMassar ?? false}
                      onChange={(e) => patchNiveau(n, { exporterMassar: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                    />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <td className="py-2 text-sm font-semibold text-slate-700">Afficher dans le bulletin</td>
                {NIVEAUX.map((n) => (
                  <td key={n} className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={parNiveau[n]?.afficherBulletin ?? false}
                      onChange={(e) => patchNiveau(n, { afficherBulletin: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                    />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 text-sm font-semibold text-slate-700">Exporter par chapitres</td>
                {NIVEAUX.map((n) => (
                  <td key={n} className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={parNiveau[n]?.exporterParChapitres ?? false}
                      onChange={(e) => patchNiveau(n, { exporterParChapitres: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                    />
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 text-sm font-semibold text-slate-700">N'est pas compté dans le nombre maximum d'examens</td>
                {NIVEAUX.map((n) => (
                  <td key={n} className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={parNiveau[n]?.horsMaxExamens ?? false}
                      onChange={(e) => patchNiveau(n, { horsMaxExamens: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button type="button" onClick={handleValidate} className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600">
            Valider
          </button>
        </div>
      </div>
    </div>
  )
}
