import { useEffect, useState, type ReactNode } from 'react'
import { X, Briefcase } from 'lucide-react'
import {
  ALL_NIVEAUX,
  PLATEFORME_OPTIONS,
  STATUT_OPTIONS,
  TYPE_OPTIONS,
  type Teacher,
} from '../data/teachers'
import { useMatieresConfig } from '../services/matieresConfigService'
import { useClasses } from '../services/classesService'

interface TeacherFormModalProps {
  onClose: () => void
  onSubmit: (data: Omit<Teacher, 'id'>) => void
  initial?: Teacher
}

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export default function TeacherFormModal({ onClose, onSubmit, initial }: TeacherFormModalProps) {
  const { data: matieresConfig = [] } = useMatieresConfig()
  const { data: allClassesData = [] } = useClasses()

  const [prenom, setPrenom] = useState(initial?.prenom ?? '')
  const [nom, setNom] = useState(initial?.nom ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [telephoneMobile, setTelephoneMobile] = useState(initial?.telephoneMobile ?? '')
  const [telephoneDomicile, setTelephoneDomicile] = useState(initial?.telephoneDomicile ?? '')
  const [matricule, setMatricule] = useState(initial?.matricule ?? '')
  const [plateforme, setPlateforme] = useState(initial?.plateforme ?? '')
  const [idMeeting, setIdMeeting] = useState(initial?.idMeeting ?? '')
  const [lienVisio, setLienVisio] = useState(initial?.lienVisio ?? '')
  const [statut, setStatut] = useState<Teacher['statut']>(initial?.statut ?? 'Permanent')
  const [type, setType] = useState<Teacher['type']>(initial?.type ?? 'Principal')
  const [niveaux, setNiveaux] = useState<string[]>(initial?.niveaux ?? [])
  const [matieres, setMatieres] = useState<string[]>(initial?.matieres ?? [])
  const [classes, setClasses] = useState<string[]>(initial?.classes ?? [])

  const classesForNiveaux = allClassesData.filter((c) => niveaux.includes(c.niveau))
  const matieresForNiveaux = matieresConfig.filter((m) => niveaux.some((n) => m.parNiveau[n]?.active)).map((m) => m.nom)

  useEffect(() => {
    setClasses((prev) => prev.filter((nom) => classesForNiveaux.some((c) => c.nom === nom)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [niveaux, allClassesData])

  useEffect(() => {
    setMatieres((prev) => prev.filter((nom) => matieresForNiveaux.includes(nom)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [niveaux, matieresConfig])

  const isEdit = !!initial

  const canSubmit =
    prenom.trim() && nom.trim() && email.trim() && niveaux.length > 0 && matieres.length > 0

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit({
      prenom: prenom.trim(),
      nom: nom.trim(),
      email: email.trim(),
      telephoneMobile: telephoneMobile.trim(),
      telephoneDomicile: telephoneDomicile.trim(),
      matricule: matricule.trim(),
      plateforme,
      idMeeting: idMeeting.trim(),
      lienVisio: lienVisio.trim(),
      statut,
      type,
      niveaux,
      matieres,
      classes,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Briefcase className="h-5 w-5 text-indigo-500" />
            {isEdit ? 'Modifier le profil de l’enseignant' : 'Inscrire un Enseignant'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom*">
              <input
                type="text"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                placeholder="Ex: Khadija"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
              />
            </Field>
            <Field label="Nom de famille*">
              <input
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex: ALAMI"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="E-mail*">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alami@ecole.ma"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
              />
            </Field>
            <Field label="Numéro de téléphone">
              <div className="flex items-center gap-1.5">
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-500">MA</span>
                <input
                  type="tel"
                  value={telephoneMobile}
                  onChange={(e) => setTelephoneMobile(e.target.value)}
                  placeholder="0655-456041"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                />
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Numéro de téléphone du domicile">
              <div className="flex items-center gap-1.5">
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-500">MA</span>
                <input
                  type="tel"
                  value={telephoneDomicile}
                  onChange={(e) => setTelephoneDomicile(e.target.value)}
                  placeholder="0522-XXXXXX"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                />
              </div>
            </Field>
            <Field label="Matricule">
              <input
                type="text"
                value={matricule}
                onChange={(e) => setMatricule(e.target.value)}
                placeholder="Matricule"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Sélectionner la plateforme">
              <select
                value={plateforme}
                onChange={(e) => setPlateforme(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                <option value="">Vous devez choisir la plateforme!</option>
                {PLATEFORME_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ID Meeting">
              <input
                type="text"
                value={idMeeting}
                onChange={(e) => setIdMeeting(e.target.value)}
                placeholder="Vous devez choisir la plateforme!"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
              />
            </Field>
          </div>

          <Field label="Lien de la réunion virtuelle">
            <input
              type="text"
              value={lienVisio}
              onChange={(e) => setLienVisio(e.target.value)}
              placeholder="Vous devez choisir la plateforme!"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Statut">
              <select
                value={statut}
                onChange={(e) => setStatut(e.target.value as Teacher['statut'])}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                {STATUT_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Type">
              <select
                value={type}
                onChange={(e) => setType(e.target.value as Teacher['type'])}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">
              Niveaux* <span className="font-normal text-emerald-500">(Cochez un ou plusieurs niveaux)</span>
            </p>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2">
              {ALL_NIVEAUX.map((n) => (
                <Checkbox key={n} label={n} checked={niveaux.includes(n)} onChange={() => setNiveaux((v) => toggleValue(v, n))} />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">
              Matières* <span className="font-normal text-emerald-500">(Cochez une ou plusieurs matières)</span>
            </p>
            {niveaux.length === 0 ? (
              <p className="text-xs text-slate-400">Sélectionnez d’abord un niveau pour voir ses matières.</p>
            ) : (
              <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                {matieresForNiveaux.map((m) => (
                  <Checkbox key={m} label={m} checked={matieres.includes(m)} onChange={() => setMatieres((v) => toggleValue(v, m))} />
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">Classes</p>
            {niveaux.length === 0 ? (
              <p className="text-xs text-slate-400">Sélectionnez d’abord un niveau pour voir ses classes.</p>
            ) : (
              <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                {classesForNiveaux.map((c) => (
                  <Checkbox key={c.nom} label={c.nom} checked={classes.includes(c.nom)} onChange={() => setClasses((v) => toggleValue(v, c.nom))} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Valider
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label>
      {children}
    </div>
  )
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-1.5 text-sm text-slate-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400"
      />
      {label}
    </label>
  )
}
