import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { FileEdit, Search, Plus, Download, ArrowLeft, Send, CheckCircle2, Undo2, Megaphone, Trash2, X } from 'lucide-react'
import {
  NOTE_TYPES,
  NOTE_TYPE_CONFIG,
  NOTE_STATUT_LABELS,
  COUPON_TYPE_LABELS,
  requiresValidation,
  canDraftType,
  canValidateType,
  canDiffuserType,
  type NoteService,
  type NoteType,
  type NoteAudience,
  type NoteCibleType,
  type NoteStatut,
  type CouponType,
} from '../data/notesService'
import { roleLabel } from '../services/profileTypesService'
import {
  useNotesService,
  useAddNoteService,
  useUpdateNoteService,
  useSubmitForValidation,
  useValidateNote,
  useReturnToBrouillon,
  useDiffuserNote,
  useDeleteNoteService,
  resolveDestinataires,
} from '../services/notesServiceService'
import { getSignatairesForType } from '../services/signatureService'
import DestinatairesPicker from '../components/notes-service/DestinatairesPicker'
import PrintableNoteService from '../components/notes-service/PrintableNoteService'
import NoteServicePrintPreviewModal from '../components/notes-service/NoteServicePrintPreviewModal'
import RichTextEditor from '../components/notes-service/RichTextEditor'
import { countNoteParagraphs } from '../utils/noteServiceHtml'
import { getProfilesSnapshot } from '../services/profilesService'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import { useIsViewedYearEditable } from '../services/viewedYear'
import ReadOnlyYearBanner from '../components/ReadOnlyYearBanner'
import NoEditAccessBanner from '../components/NoEditAccessBanner'
import { isWithinPeriod } from '../utils/period'

type EmptyNote = {
  type: NoteType
  audience: NoteAudience
  cibleType: NoteService['cibleType']
  cibleNiveau: string | null
  cibleClasse: string | null
  cibleEleveIds: string[]
  ciblePersonneIds: string[]
  objet: string
  corps: string
  couponActif: boolean
  couponType: CouponType | null
  couponDateLimite: string | null
  signataireId: string | null
}

function emptyNote(): EmptyNote {
  return {
    type: 'INFORMATION',
    audience: 'PARENTS',
    cibleType: 'etablissement',
    cibleNiveau: null,
    cibleClasse: null,
    cibleEleveIds: [],
    ciblePersonneIds: [],
    objet: '',
    corps: '',
    couponActif: false,
    couponType: null,
    couponDateLimite: null,
    signataireId: null,
  }
}

// transform:scale() ne change que le rendu visuel, jamais la place réservée dans la mise en page —
// sans compensation, l'aperçu (mis à l'échelle 0.6) laisserait un vide sous lui égal à 40% de sa
// hauteur réelle. Cette hauteur varie désormais avec le nombre de pages A4 (corps de note paginé
// depuis que les notes longues peuvent s'étaler sur plusieurs pages), donc une marge négative fixe
// ne suffit plus : on mesure la vraie hauteur rendue et on calcule la compensation en conséquence.
function ScaledPreview({ scale, children }: { scale: number; children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useLayoutEffect(() => {
    const el = innerRef.current
    if (!el) return
    const measure = () => setHeight(el.getBoundingClientRect().height / scale)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [scale])

  return (
    <div style={{ height: height * scale || undefined }}>
      <div ref={innerRef} style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
        {children}
      </div>
    </div>
  )
}

// Miroir de cibleLabel() dans PrintableNoteService.tsx, appliqué à la cible en cours de saisie
// (form, pas encore une NoteService enregistrée) — pour le bouton "Insérer les destinataires"
// de l'éditeur riche, qui reprend ce libellé court plutôt que de le retaper.
function cibleLabelFor(audience: NoteAudience, cibleType: NoteCibleType, cibleNiveau: string | null, cibleClasse: string | null, cibleEleveIds: string[], ciblePersonneIds: string[]): string {
  if (audience !== 'PARENTS') {
    if (cibleType === 'etablissement') return audience === 'ENSEIGNANTS' ? 'Tous les enseignants' : audience === 'ADMINISTRATIF' ? 'Tout le personnel' : "Tout l'établissement"
    return `${ciblePersonneIds.length} destinataire(s)`
  }
  if (cibleType === 'etablissement') return "Tout l'établissement"
  if (cibleType === 'niveau') return cibleNiveau ?? '—'
  if (cibleType === 'classe') return cibleClasse ?? '—'
  return `${cibleEleveIds.length} élève(s)`
}

export default function NotesServiceGlobal() {
  const { data: notes = [] } = useNotesService()
  const profile = useCurrentProfile()
  const canEditYear = useIsViewedYearEditable()
  const canEditModule = getModuleAccess(profile, 'notesService').canEdit
  const isEditable = canEditYear && canEditModule
  const deleteMutation = useDeleteNoteService()

  const [view, setView] = useState<'liste' | 'editeur'>('liste')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [printNote, setPrintNote] = useState<NoteService | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'TOUS' | NoteType>('TOUS')
  const [statutFilter, setStatutFilter] = useState<'TOUS' | NoteStatut>('TOUS')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')

  const editingNote = editingId ? notes.find((n) => n.id === editingId) : null

  const q = search.toLowerCase()
  const filtered = notes.filter((n) => {
    const matchesSearch = !q || n.reference.toLowerCase().includes(q) || n.objet.toLowerCase().includes(q)
    const matchesType = typeFilter === 'TOUS' || n.type === typeFilter
    const matchesStatut = statutFilter === 'TOUS' || n.statut === statutFilter
    const matchesPeriod = isWithinPeriod(n.createdAt.slice(0, 10), periodStart, periodEnd)
    return matchesSearch && matchesType && matchesStatut && matchesPeriod
  })

  if (view === 'editeur') {
    return (
      <NoteEditor
        note={editingNote ?? null}
        isEditable={isEditable}
        onBack={() => {
          setView('liste')
          setEditingId(null)
        }}
        onOpenExisting={(id) => setEditingId(id)}
        onDownload={(n) => setPrintNote(n)}
      />
    )
  }

  return (
    <div className="mx-auto max-w-[1800px] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            Notes de service
            <FileEdit className="h-6 w-6 text-slate-800" />
          </h1>
          <p className="max-w-xl text-sm text-slate-500">Communications écrites de la Vie scolaire.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingId(null)
            setView('editeur')
          }}
          disabled={!isEditable}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Nouvelle note
        </button>
      </div>

      {!canEditYear && <ReadOnlyYearBanner />}
      {canEditYear && !canEditModule && <NoEditAccessBanner />}

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher réf., objet..."
            className="w-full text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Période du :</span>
          <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none" />
          <span className="text-sm text-slate-500">au :</span>
          <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'TOUS' | NoteType)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none">
          <option value="TOUS">Tous les types</option>
          {NOTE_TYPES.map((t) => (
            <option key={t} value={t}>
              {NOTE_TYPE_CONFIG[t].label}
            </option>
          ))}
        </select>
        <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value as 'TOUS' | NoteStatut)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none">
          <option value="TOUS">Tous les statuts</option>
          {(Object.keys(NOTE_STATUT_LABELS) as NoteStatut[]).map((s) => (
            <option key={s} value={s}>
              {NOTE_STATUT_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">Aucune note ne correspond à ces filtres.</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Réf.</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Objet</th>
                <th className="px-4 py-3">Destinataires</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Créée le</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((n) => {
                const typeConfig = NOTE_TYPE_CONFIG[n.type]
                const { count } = resolveDestinataires(n)
                return (
                  <tr
                    key={n.id}
                    className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                    onClick={() => {
                      setEditingId(n.id)
                      setView('editeur')
                    }}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{n.reference}</td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={typeConfig.bordered ? { background: '#fff', color: '#141414', border: '1px solid #cfcfcf' } : { background: typeConfig.color, color: typeConfig.textOnColor }}
                      >
                        {typeConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{n.objet || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{count}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{NOTE_STATUT_LABELS[n.statut]}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{new Date(n.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setPrintNote(n)
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        {isEditable && (
                          <>
                            {confirmDeleteId === n.id ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    deleteMutation.mutate(n.id)
                                    setConfirmDeleteId(null)
                                  }}
                                  className="rounded-lg bg-rose-600 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-rose-700"
                                >
                                  Confirmer
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  title="Annuler"
                                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setConfirmDeleteId(n.id)
                                }}
                                title="Supprimer"
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {printNote && <NoteServicePrintPreviewModal note={printNote} onClose={() => setPrintNote(null)} />}
    </div>
  )
}

function NoteEditor({
  note,
  isEditable,
  onBack,
  onOpenExisting,
  onDownload,
}: {
  note: NoteService | null
  isEditable: boolean
  onBack: () => void
  onOpenExisting: (id: string) => void
  onDownload: (note: NoteService) => void
}) {
  const profile = useCurrentProfile()
  const addMutation = useAddNoteService()
  const updateMutation = useUpdateNoteService()
  const submitMutation = useSubmitForValidation()
  const validateMutation = useValidateNote()
  const returnMutation = useReturnToBrouillon()
  const diffuserMutation = useDiffuserNote()
  const deleteMutation = useDeleteNoteService()

  const [form, setForm] = useState<EmptyNote>(
    note
      ? {
          type: note.type,
          audience: note.audience,
          cibleType: note.cibleType,
          cibleNiveau: note.cibleNiveau,
          cibleClasse: note.cibleClasse,
          cibleEleveIds: note.cibleEleveIds ?? [],
          ciblePersonneIds: note.ciblePersonneIds ?? [],
          objet: note.objet,
          corps: note.corps,
          couponActif: note.couponActif,
          couponType: note.couponType,
          couponDateLimite: note.couponDateLimite,
          signataireId: note.signataireId,
        }
      : emptyNote()
  )

  const locked = note ? note.statut === 'DIFFUSEE' || note.statut === 'ANNULEE' : false
  const isNew = !note

  const patch = (p: Partial<EmptyNote>) => setForm((prev) => ({ ...prev, ...p }))

  const signataires = getSignatairesForType(form.type)
  const canDraft = profile ? canDraftType(profile.role, form.type) : false

  const previewNote: NoteService = {
    id: note?.id ?? 'preview',
    reference: note?.reference ?? 'VS-—',
    type: form.type,
    audience: form.audience,
    cibleType: form.cibleType,
    cibleNiveau: form.cibleNiveau,
    cibleClasse: form.cibleClasse,
    cibleEleveIds: form.cibleEleveIds,
    ciblePersonneIds: form.ciblePersonneIds,
    objet: form.objet,
    corps: form.corps,
    couponActif: form.couponActif,
    couponType: form.couponType,
    couponDateLimite: form.couponDateLimite,
    signataireId: form.signataireId,
    statut: note?.statut ?? 'BROUILLON',
    dateDiffusion: note?.dateDiffusion ?? null,
    rectificatifDeId: note?.rectificatifDeId ?? null,
    historique: note?.historique ?? [],
    createdBy: note?.createdBy ?? null,
    createdAt: note?.createdAt ?? new Date().toISOString(),
  }

  const signataireProfile = getProfilesSnapshot().find((p) => p.id === form.signataireId)
  const signataire = signataireProfile
    ? { nomComplet: signataireProfile.nomComplet, role: signataireProfile.role, signatureImage: signataireProfile.signatureImage }
    : undefined

  const handleSaveDraft = () => {
    if (isNew) {
      addMutation.mutate(form, {
        onSuccess: (created) => onOpenExisting(created.id),
      })
    } else if (note) {
      updateMutation.mutate({ id: note.id, ...form })
    }
  }

  const canSubmit = form.objet.trim().length > 0 && form.corps.replace(/<[^>]*>/g, '').trim().length > 0 && resolveDestinataires(form).count > 0 && !!form.signataireId

  return (
    <div className="mx-auto max-w-[1800px] p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Retour à la liste
        </button>
        {note && (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{NOTE_STATUT_LABELS[note.statut]}</span>
            <button type="button" onClick={() => onDownload(note)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              <Download className="h-3.5 w-3.5" />
              Télécharger
            </button>
          </div>
        )}
      </div>

      {locked && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Cette note est diffusée et verrouillée. Pour la corriger, créez une nouvelle note en la référençant comme rectificatif.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[45%_55%]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Type de note *</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {NOTE_TYPES.map((t) => {
                const cfg = NOTE_TYPE_CONFIG[t]
                const active = form.type === t
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={locked}
                    onClick={() => patch({ type: t, signataireId: null })}
                    className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      active ? 'border-indigo-400 ring-1 ring-indigo-400' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className="mb-1 inline-block rounded-full px-2 py-0.5 text-[10px]"
                      style={cfg.bordered ? { background: '#fff', color: '#141414', border: '1px solid #cfcfcf' } : { background: cfg.color, color: cfg.textOnColor }}
                    >
                      {cfg.label}
                    </span>
                    <p className="text-[11px] font-normal text-slate-500">{cfg.usage}</p>
                  </button>
                )
              })}
            </div>
            {!canDraft && <p className="mt-2 text-xs text-rose-600">Votre rôle ne permet pas de rédiger ce type de note.</p>}
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Audience *</label>
            <select
              value={form.audience}
              disabled={locked}
              onChange={(e) => patch({ audience: e.target.value as NoteAudience, cibleType: 'etablissement', cibleNiveau: null, cibleClasse: null, cibleEleveIds: [], ciblePersonneIds: [] })}
              className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none disabled:opacity-50"
            >
              <option value="PARENTS">Parents</option>
              <option value="ENSEIGNANTS">Personnel enseignant</option>
              <option value="ADMINISTRATIF">Personnel administratif & Vie scolaire</option>
              <option value="TOUS">Tous</option>
            </select>
            <DestinatairesPicker
              audience={form.audience}
              cibleType={form.cibleType}
              cibleNiveau={form.cibleNiveau}
              cibleClasse={form.cibleClasse}
              cibleEleveIds={form.cibleEleveIds}
              ciblePersonneIds={form.ciblePersonneIds}
              onChange={patch}
            />
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Référence</label>
            <input value={note?.reference ?? 'Générée à l\'enregistrement'} disabled className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500" />

            <label className="mb-1.5 mt-3 block text-sm font-semibold text-slate-700">Objet * ({form.objet.length}/120)</label>
            <input
              value={form.objet}
              disabled={locked}
              maxLength={120}
              onChange={(e) => patch({ objet: e.target.value })}
              placeholder="ex: Nouveaux horaires du portail parents"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none disabled:opacity-50"
            />

          </section>
        </div>

        <div className="flex justify-center overflow-x-auto rounded-2xl border border-slate-100 bg-slate-100/50 p-6">
          <ScaledPreview scale={0.6}>
            <PrintableNoteService note={previewNote} signataire={signataire} />
          </ScaledPreview>
        </div>
      </div>

      {/* Le corps est volontairement sorti de la grille 45/55 ci-dessus et occupe toute la largeur
          de la page — l'aperçu en direct reste visible plus haut pendant la rédaction des champs
          courts (type, audience, objet), mais la zone de rédaction elle-même a besoin de bien plus
          d'espace que 45% de la page pour rester confortable. */}
      <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Corps *</label>
        <RichTextEditor
          value={form.corps}
          onChange={(corps) => patch({ corps })}
          disabled={locked}
          placeholder="Rédigez le corps de la note..."
          cibleLabel={cibleLabelFor(form.audience, form.cibleType, form.cibleNiveau, form.cibleClasse, form.cibleEleveIds, form.ciblePersonneIds)}
        />
        {countNoteParagraphs(form.corps) > 4 && <p className="mt-1 text-xs text-amber-600">Règle de rédaction : une note tient sur une page (4 paragraphes maximum recommandés).</p>}
      </section>

      <div className="mt-6 space-y-4 lg:w-[45%]">
        <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={form.couponActif} disabled={locked} onChange={(e) => patch({ couponActif: e.target.checked, couponType: e.target.checked ? 'accuse_lecture' : null })} className="h-4 w-4 rounded border-slate-300" />
            Coupon-réponse
          </label>
            {form.couponActif && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <select
                  value={form.couponType ?? 'accuse_lecture'}
                  disabled={locked}
                  onChange={(e) => patch({ couponType: e.target.value as CouponType })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none disabled:opacity-50"
                >
                  {(Object.keys(COUPON_TYPE_LABELS) as CouponType[]).map((ct) => (
                    <option key={ct} value={ct}>
                      {COUPON_TYPE_LABELS[ct]}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={form.couponDateLimite ?? ''}
                  disabled={locked}
                  onChange={(e) => patch({ couponDateLimite: e.target.value })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none disabled:opacity-50"
                />
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Signataire *</label>
            <select
              value={form.signataireId ?? ''}
              disabled={locked}
              onChange={(e) => patch({ signataireId: e.target.value || null })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none disabled:opacity-50"
            >
              <option value="">Sélectionner...</option>
              {signataires.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nomComplet} — {roleLabel(s.role)}
                </option>
              ))}
            </select>
            {signataires.length === 0 && <p className="mt-1.5 text-xs text-amber-600">Aucun profil n'est habilité à signer ce type de note.</p>}
          </section>

          {isEditable && !locked && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={handleSaveDraft} disabled={!canDraft} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                Enregistrer le brouillon
              </button>
              {note && note.statut === 'BROUILLON' && (
                <>
                  {requiresValidation(note.type) ? (
                    <button
                      type="button"
                      disabled={!canSubmit}
                      onClick={() => submitMutation.mutate(note)}
                      className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                      Soumettre pour validation
                    </button>
                  ) : (
                    canDiffuserType(profile?.role ?? 'Autre', note.type) && (
                      <button
                        type="button"
                        disabled={!canSubmit}
                        onClick={() => {
                          if (confirm(`Diffuser à ${resolveDestinataires(note).count} destinataires ?`)) diffuserMutation.mutate(note)
                        }}
                        className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Megaphone className="h-4 w-4" />
                        Diffuser à {resolveDestinataires(note).count} destinataires
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Supprimer ce brouillon ?')) deleteMutation.mutate(note.id, { onSuccess: onBack })
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Supprimer
                  </button>
                </>
              )}
              {note && note.statut === 'EN_ATTENTE_VALIDATION' && profile && canValidateType(profile.role, note.type) && (
                <>
                  <button type="button" onClick={() => validateMutation.mutate(note)} className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white">
                    <CheckCircle2 className="h-4 w-4" />
                    Valider
                  </button>
                  <button type="button" onClick={() => returnMutation.mutate(note)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                    <Undo2 className="h-3.5 w-3.5" />
                    Renvoyer en brouillon
                  </button>
                </>
              )}
              {note && note.statut === 'VALIDEE' && profile && canDiffuserType(profile.role, note.type) && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Diffuser à ${resolveDestinataires(note).count} destinataires ?`)) diffuserMutation.mutate(note)
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  <Megaphone className="h-4 w-4" />
                  Diffuser à {resolveDestinataires(note).count} destinataires
                </button>
              )}
            </div>
          )}
        </div>
    </div>
  )
}
