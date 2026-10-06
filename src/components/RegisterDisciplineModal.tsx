import { useState } from 'react'
import { X, ShieldCheck, ThumbsUp, ThumbsDown, ClipboardList, AlertTriangle } from 'lucide-react'
import { getStudentsSnapshot } from '../services/studentsService'
import StudentMultiPicker from './StudentMultiPicker'
import { buildDisciplinePayloads, nouveauGroupeId, type DisciplinePayload } from '../utils/disciplineIncident'
import { teacherName } from '../data/teachers'
import { getTeachersSnapshot } from '../services/teachersService'
import { getStudentExtraSnapshot } from '../services/studentDetailsService'
import { DISCIPLINE_TYPES, SANCTION_LEVELS, SANCTION_POINTS, type SanctionLevel } from '../data/disciplineTypes'
import TeacherSearchSelect from './TeacherSearchSelect'

interface RegisterDisciplineModalProps {
  onClose: () => void
  /** Une fiche par élève imputé (un fait collectif en produit plusieurs, liées par un même groupe). */
  onSubmit: (payloads: DisciplinePayload[]) => void | Promise<void>
}

interface Category {
  label: string
  points: number
}

const AUTRE_INCIDENT = 'Autre incident'

// SANCTION_LEVELS est déjà déclaré du plus léger au plus lourd (voir disciplineTypes.ts) — les
// listes par fiche (DisciplineType.sanctions) ne respectent pas forcément cet ordre selon la façon
// dont elles ont été composées, donc on retrie systématiquement avant affichage.
function sortBySeverity(levels: readonly SanctionLevel[]): SanctionLevel[] {
  return [...levels].sort((a, b) => SANCTION_LEVELS.indexOf(a) - SANCTION_LEVELS.indexOf(b))
}

const MERITE_CATEGORIES: Category[] = [
  { label: 'Participation active', points: 1 },
  { label: 'Entraide / Camaraderie', points: 1 },
  { label: 'Devoirs parfaits', points: 1 },
  { label: 'Respect rigoureux du règlement', points: 1 },
  { label: 'Travail exceptionnel', points: 2 },
  { label: 'Progrès remarquable', points: 2 },
  { label: 'Fonction de délégué assumée avec sérieux', points: 2 },
  { label: "Aide à l'organisation d'un événement scolaire", points: 2 },
  { label: 'Acte de civisme ou de générosité exceptionnel', points: 3 },
  { label: "Représentation brillante de l'établissement (concours/compétition)", points: 3 },
  { label: 'Autre mérite', points: 1 },
]

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function RegisterDisciplineModal({ onClose, onSubmit }: RegisterDisciplineModalProps) {
  const professeurs = getTeachersSnapshot()

  // Plusieurs élèves peuvent avoir fait la même chose (une fiche chacun), et un incident peut viser d'autres élèves
  // (victimes) : ils sont seulement mentionnés, sans sanction ni point.
  const [authorIds, setAuthorIds] = useState<string[]>([])
  const [victimIds, setVictimIds] = useState<string[]>([])
  const [sanctionByStudent, setSanctionByStudent] = useState<Record<string, SanctionLevel>>({})
  const [saving, setSaving] = useState(false)
  const [nature, setNature] = useState<'merite' | 'incident'>('incident')

  const [meriteCategory, setMeriteCategory] = useState(MERITE_CATEGORIES[0].label)
  const [customMerite, setCustomMerite] = useState('')

  const [typeCode, setTypeCode] = useState<string>(DISCIPLINE_TYPES[0].code)
  const [customIncident, setCustomIncident] = useState('')
  const [sanction, setSanction] = useState<SanctionLevel>(sortBySeverity(DISCIPLINE_TYPES[0].sanctions)[0])
  // Toutes les étapes cochées par défaut (la procédure complète est le cas le plus fréquent) —
  // l'utilisateur décoche seulement celles qui ne s'appliquaient pas à ce fait précis.
  const [stepsDone, setStepsDone] = useState<number[]>(DISCIPLINE_TYPES[0].procedure.map((_, i) => i))
  const [stepDetails, setStepDetails] = useState<Record<number, string>>({})
  const [detailsPrintable, setDetailsPrintable] = useState(false)

  const [description, setDescription] = useState('')
  const [author, setAuthor] = useState(professeurs[0] ? teacherName(professeurs[0]) : '')
  const [date, setDate] = useState(todayISO())
  const [retenueDate, setRetenueDate] = useState('')
  const [retenueDuree, setRetenueDuree] = useState('')
  const [privationActivite, setPrivationActivite] = useState('')
  const [privationDuree, setPrivationDuree] = useState('')

  const isAutreMerite = meriteCategory === 'Autre mérite'
  const selectedMerite = MERITE_CATEGORIES.find((c) => c.label === meriteCategory) ?? MERITE_CATEGORIES[0]
  const isAutreIncident = typeCode === AUTRE_INCIDENT
  const selectedType = DISCIPLINE_TYPES.find((t) => t.code === typeCode)
  const availableSanctions = sortBySeverity(selectedType ? selectedType.sanctions : SANCTION_LEVELS)
  const allStudents = getStudentsSnapshot()
  const nameOf = (id: string) => allStudents.find((st) => st.id === id)?.name ?? ''
  // Un engagement parental est un document contractuel où l'élève et les parents s'engagent à ne
  // plus reproduire le fait — le refaire est donc plus grave qu'une simple répétition et mérite un
  // avertissement distinct, plus visible que le bandeau de récidive générique ci-dessous.
  // extra.discipline est toujours préfixé (nouvelle entrée en tête, cf. saveDisciplineEntries), donc le
  // premier engagement trouvé est le plus récent.
  const recidives = authorIds.map((id) => {
    const prior = selectedType ? getStudentExtraSnapshot(id).discipline.filter((d) => d.typeCode === selectedType.code) : []
    return { id, name: nameOf(id), count: prior.length, brokenEngagement: prior.find((d) => d.sanction === 'Engagement parental') }
  })
  const several = authorIds.length > 1
  const effectiveSanctions = authorIds.map((id) => sanctionByStudent[id] ?? sanction)
  const anyRetenue = effectiveSanctions.includes('Retenue')
  const anyPrivation = effectiveSanctions.includes('Privation d’activités périscolaires/sportives')

  const handleTypeChange = (code: string) => {
    setTypeCode(code)
    const type = DISCIPLINE_TYPES.find((t) => t.code === code)
    setSanction(type ? sortBySeverity(type.sanctions)[0] : 'Avertissement écrit')
    setStepsDone(type ? type.procedure.map((_, i) => i) : [])
    setSanctionByStudent({})
    setStepDetails({})
    setDetailsPrintable(false)
  }

  const toggleStep = (idx: number) => {
    setStepsDone((prev) => (prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx].sort((a, b) => a - b)))
  }

  const updateStepDetail = (idx: number, value: string) => {
    setStepDetails((prev) => ({ ...prev, [idx]: value }))
  }

  const hasAnyStepDetail = Object.values(stepDetails).some((v) => v.trim())

  const canSubmit =
    authorIds.length > 0 &&
    !saving &&
    (nature === 'merite' ? !isAutreMerite || customMerite.trim() !== '' : !isAutreIncident || customIncident.trim() !== '')

  const handleSubmit = async () => {
    if (!canSubmit) return
    const common = { authorIds, victimIds: nature === 'incident' ? victimIds : [], description: description.trim(), author, date, groupeId: authorIds.length > 1 ? nouveauGroupeId() : undefined }
    const payloads =
      nature === 'merite'
        ? buildDisciplinePayloads({ ...common, nature, title: isAutreMerite ? customMerite.trim() : meriteCategory, meritePoints: selectedMerite.points })
        : buildDisciplinePayloads({
            ...common,
            nature,
            title: isAutreIncident ? customIncident.trim() : (selectedType?.label ?? typeCode),
            incident: {
              typeCode: isAutreIncident ? undefined : typeCode,
              sanction,
              sanctionByStudent,
              stepsDone,
              stepDetails,
              detailsPrintable,
              retenueDate,
              retenueDuree,
              privationActivite,
              privationDuree,
            },
          })
    setSaving(true)
    try {
      await onSubmit(payloads)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            Enregistrer un Fait Disciplinaire
            <ShieldCheck className="h-5 w-5 text-indigo-500" />
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
          <StudentMultiPicker
            label="Élève(s) concerné(s)"
            selectedIds={authorIds}
            onChange={(ids) => {
              setAuthorIds(ids)
              // Un élève retiré ne garde pas une sanction propre en réserve.
              setSanctionByStudent((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => ids.includes(id))))
            }}
            excludeIds={victimIds}
            hint={authorIds.length > 1 ? 'Chaque élève aura sa propre fiche dans son dossier (points et conduite calculés pour chacun).' : "Plusieurs élèves ont fait la même chose ? Ajoutez-les ici, même s'ils sont dans des classes différentes."}
          />

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nature du fait</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setNature('merite')}
                className={`flex items-center gap-2.5 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  nature === 'merite'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                    nature === 'merite' ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'
                  }`}
                >
                  {nature === 'merite' && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                <ThumbsUp className="h-4 w-4 text-emerald-600" />
                Encouragement / Mérite
              </button>
              <button
                type="button"
                onClick={() => setNature('incident')}
                className={`flex items-center gap-2.5 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  nature === 'incident'
                    ? 'border-rose-500 bg-rose-50 text-rose-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                    nature === 'incident' ? 'border-rose-500 bg-rose-500' : 'border-slate-300'
                  }`}
                >
                  {nature === 'incident' && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                <ThumbsDown className="h-4 w-4 text-rose-600" />
                Incident / Sanction
              </button>
            </div>
          </div>

          {nature === 'merite' ? (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Catégorie du mérite</label>
                <select
                  value={meriteCategory}
                  onChange={(e) => {
                    setMeriteCategory(e.target.value)
                    setCustomMerite('')
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                >
                  {MERITE_CATEGORIES.map((c) => (
                    <option key={c.label} value={c.label}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  Impact sur la note : +{selectedMerite.points} point(s)
                </p>
              </div>

              {isAutreMerite && (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Précisez le mérite</label>
                  <input
                    type="text"
                    value={customMerite}
                    onChange={(e) => setCustomMerite(e.target.value)}
                    placeholder="ex : Geste solidaire envers un camarade..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Type d'incident (Cahier de Procédures)
                </label>
                <select
                  value={typeCode}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                >
                  {DISCIPLINE_TYPES.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.code} — {t.label}
                    </option>
                  ))}
                  <option value={AUTRE_INCIDENT}>Autre incident (hors cahier)</option>
                </select>
              </div>

              {isAutreIncident && (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Précisez l'incident</label>
                  <input
                    type="text"
                    value={customIncident}
                    onChange={(e) => setCustomIncident(e.target.value)}
                    placeholder="ex : Chahut dans les couloirs..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                  />
                </div>
              )}

              <div className="rounded-lg border border-rose-100 bg-rose-50/40 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-600">Élève(s) victime(s) — optionnel</p>
                <StudentMultiPicker
                  label="Victime"
                  tone="rose"
                  selectedIds={victimIds}
                  onChange={setVictimIds}
                  excludeIds={authorIds}
                  hint="Si le fait vise un autre élève (ex. frapper un camarade). La victime est mentionnée dans son dossier, sans sanction ni point ; ses parents ne sont pas notifiés automatiquement."
                />
              </div>

              {selectedType && (
                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                  <div className="mb-1.5 flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <ClipboardList className="h-3.5 w-3.5" />
                      Procédure de référence ({selectedType.code})
                    </div>
                    <span className="text-[11px] font-medium text-slate-400">
                      {stepsDone.length}/{selectedType.procedure.length} effectuée{stepsDone.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="mb-2 text-[11px] text-slate-400">Décochez les étapes qui n'étaient pas nécessaires pour ce cas.</p>
                  <ul className="space-y-1.5">
                    {selectedType.procedure.map((step, idx) => {
                      const done = stepsDone.includes(idx)
                      return (
                        <li key={idx}>
                          <label className="flex cursor-pointer items-start gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={done}
                              onChange={() => toggleStep(idx)}
                              className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
                            />
                            <span className={done ? 'text-slate-600' : 'text-slate-400 line-through'}>{step}</span>
                          </label>
                          {done && (
                            <input
                              type="text"
                              value={stepDetails[idx] ?? ''}
                              onChange={(e) => updateStepDetail(idx, e.target.value)}
                              placeholder="Détails (optionnel) : ex. témoins identifiés, ce qu'ils ont dit..."
                              className="mt-1 ml-[22px] w-[calc(100%-22px)] rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                            />
                          )}
                        </li>
                      )
                    })}
                  </ul>
                  {hasAnyStepDetail && (
                    <label className="mt-2.5 flex items-center gap-2 rounded-md border border-amber-100 bg-amber-50/60 px-2.5 py-1.5 text-[11px] text-amber-700">
                      <input
                        type="checkbox"
                        checked={detailsPrintable}
                        onChange={(e) => setDetailsPrintable(e.target.checked)}
                        className="h-3.5 w-3.5 shrink-0 rounded border-amber-300 text-amber-600 focus:ring-amber-400"
                      />
                      Inclure ces détails sur la notification imprimée remise à la famille (par défaut : réservés au dossier interne)
                    </label>
                  )}
                </div>
              )}

              {recidives.map((r) =>
                r.brokenEngagement ? (
                  <div key={r.id} className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Récidive après engagement parental{several ? ` — ${r.name}` : ''} : cet élève avait signé un engagement parental le{' '}
                      {new Date(r.brokenEngagement.date + 'T00:00:00').toLocaleDateString('fr-FR')} pour ce même type de
                      fait (« {selectedType!.code} ») et le refait aujourd'hui — la promesse n'a pas été tenue.
                      Envisager une sanction plus lourde (Exclusion ou Conseil de discipline).
                    </span>
                  </div>
                ) : (
                  r.count > 0 && (
                    <div key={r.id} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        Récidive{several ? ` — ${r.name}` : ''} : {r.count} fait{r.count > 1 ? 's' : ''} « {selectedType!.code} » déjà
                        enregistré{r.count > 1 ? 's' : ''} pour cet élève cette année — envisager une sanction plus
                        lourde.
                      </span>
                    </div>
                  )
                ),
              )}

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Sanction retenue</label>
                <select
                  value={sanction}
                  onChange={(e) => setSanction(e.target.value as SanctionLevel)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                >
                  {availableSanctions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  Impact sur la note : {SANCTION_POINTS[sanction]} point(s)
                  {several ? ' — proposée à tous les élèves, modifiable pour chacun ci-dessous.' : ''}
                </p>
              </div>

              {several && (
                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Sanction par élève</p>
                  <ul className="space-y-1.5">
                    {authorIds.map((id) => {
                      const value = sanctionByStudent[id] ?? sanction
                      return (
                        <li key={id} className="flex items-center justify-between gap-3">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{nameOf(id)}</span>
                          <select
                            value={value}
                            onChange={(e) => {
                              const next = e.target.value as SanctionLevel
                              setSanctionByStudent((prev) => {
                                const copy = { ...prev }
                                if (next === sanction) delete copy[id]
                                else copy[id] = next
                                return copy
                              })
                            }}
                            className="w-56 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
                          >
                            {availableSanctions.map((sv) => (
                              <option key={sv} value={sv}>
                                {sv} ({SANCTION_POINTS[sv]})
                              </option>
                            ))}
                          </select>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {anyRetenue && (
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Date de la retenue</label>
                    <input
                      type="date"
                      value={retenueDate}
                      onChange={(e) => setRetenueDate(e.target.value)}
                      min={date}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Durée</label>
                    <input
                      type="text"
                      value={retenueDuree}
                      onChange={(e) => setRetenueDuree(e.target.value)}
                      placeholder="ex : 2h, mercredi après-midi..."
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {anyPrivation && (
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Activité concernée</label>
                    <input
                      type="text"
                      value={privationActivite}
                      onChange={(e) => setPrivationActivite(e.target.value)}
                      placeholder="ex : Club de football, sortie scolaire..."
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Durée de la privation</label>
                    <input
                      type="text"
                      value={privationDuree}
                      onChange={(e) => setPrivationDuree(e.target.value)}
                      placeholder="ex : 2 semaines, du 01/10 au 15/10..."
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Commentaire / Détails du rapport
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Décrivez l'incident ou l'encouragement de façon précise..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Enseignant</label>
              <TeacherSearchSelect teachers={professeurs} valueBy="name" value={author} onChange={setAuthor} clearable={false} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
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
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enregistrer le rapport
          </button>
        </div>
      </div>
    </div>
  )
}
