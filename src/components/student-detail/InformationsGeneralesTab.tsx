import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { IdCard, GraduationCap, UtensilsCrossed, Users, Pencil, AlertTriangle, Phone, Check, X as XIcon, FileCheck2, Mail, Send, Link2, Download, DoorOpen } from 'lucide-react'
import type { Student } from '../../data/students'
import { defaultIdentity, TRANSPORT_PARENTS } from '../../data/studentIdentity'
import { useStudentIdentities } from '../../services/studentIdentityService'
import { calculateAge, telHref } from '../../utils/identityHelpers'
import type { CantineInfo } from '../../data/studentDetails'
import { updateStudentCantine } from '../../services/studentDetailsService'
import StudentIdentityEditModal from './StudentIdentityEditModal'
import CantineDechargeEditModal from './CantineDechargeEditModal'
import DechargePrintPreviewModal from '../decharge-print/DechargePrintPreviewModal'
import DeclarerSortieAnticipeeModal from './DeclarerSortieAnticipeeModal'
import SortieAnticipeePrintPreviewModal from '../sortie-anticipee-print/SortieAnticipeePrintPreviewModal'
import TransportSortieWhatsAppModal from '../transport/TransportSortieWhatsAppModal'
import { useParents, useParentStudentLinks, useInviteParent, useLinkParentToStudent } from '../../services/parentsService'
import { useTransportLignes } from '../../services/transportLignesService'
import { useChauffeurs } from '../../services/chauffeursService'
import { useAidesMaitresses } from '../../services/aidesMaitressesService'
import { useServicesCapacite } from '../../services/servicesCapaciteService'
import { resolveStudentTransport } from '../../utils/transportStudentResolver'
import { buildSortieAnticipeeTransportMessage } from '../../utils/whatsapp'

interface InformationsGeneralesTabProps {
  student: Student
  cantine: CantineInfo
  onStudentUpdated: (student: Student) => void
}

function ligneBadgeInfo(value: string | null): { label: string; className: string } {
  if (value === TRANSPORT_PARENTS) return { label: 'Amené(e) par les parents', className: 'bg-amber-50 text-amber-600' }
  if (value) return { label: `Ligne ${value}`, className: 'bg-sky-50 text-sky-600' }
  return { label: 'Non affecté', className: 'bg-slate-100 text-slate-400' }
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm text-slate-800">{value || <span className="text-slate-300">Non renseigné</span>}</p>
    </div>
  )
}

function ParentAccountStatus({
  email,
  nomComplet,
  telephone,
  studentId,
  relation,
}: {
  email: string
  nomComplet: string
  telephone: string
  studentId: string
  relation: string
}) {
  const { data: parents = [] } = useParents()
  const { data: links = [] } = useParentStudentLinks()
  const invite = useInviteParent()
  const link = useLinkParentToStudent()

  if (!email) return null

  const parent = parents.find((p) => p.email.toLowerCase() === email.toLowerCase())
  const hasLink = parent ? links.some((l) => l.parentId === parent.id && l.studentId === studentId) : false

  if (parent && hasLink) {
    return (
      <span className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${parent.actif ? 'text-emerald-600' : 'text-slate-400'}`}>
        <Check className="h-3.5 w-3.5" />
        {parent.actif ? 'Compte portail actif' : 'Compte désactivé'}
      </span>
    )
  }

  if (parent && !hasLink) {
    return (
      <button
        type="button"
        disabled={link.isPending}
        onClick={() => link.mutate({ parentId: parent.id, studentId, relation })}
        className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline disabled:opacity-50"
      >
        <Link2 className="h-3.5 w-3.5" />
        {link.isPending ? 'Liaison…' : 'Lier ce compte existant'}
      </button>
    )
  }

  return (
    <button
      type="button"
      disabled={invite.isPending || link.isPending}
      onClick={async () => {
        const created = await invite.mutateAsync({ email, nomComplet, telephone })
        await link.mutateAsync({ parentId: created.id, studentId, relation })
      }}
      className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline disabled:opacity-50"
    >
      <Send className="h-3.5 w-3.5" />
      {invite.isPending || link.isPending ? 'Invitation…' : 'Inviter ce parent'}
    </button>
  )
}

function FlagBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
        active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
      }`}
    >
      {active ? <Check className="h-3.5 w-3.5" /> : <XIcon className="h-3.5 w-3.5" />}
      {label}
    </span>
  )
}

export default function InformationsGeneralesTab({ student, cantine, onStudentUpdated }: InformationsGeneralesTabProps) {
  const { data: identities } = useStudentIdentities()
  const identity = identities?.[student.id] ?? defaultIdentity
  const { data: lignes = [] } = useTransportLignes()
  const { data: chauffeurs = [] } = useChauffeurs()
  const { data: aides = [] } = useAidesMaitresses()
  const { data: capacite } = useServicesCapacite()
  const [editing, setEditing] = useState(false)
  const [editingDecharge, setEditingDecharge] = useState(false)
  const [showDechargePrint, setShowDechargePrint] = useState(false)
  const [showDeclareSortie, setShowDeclareSortie] = useState(false)
  type SortiePrintData = {
    date: string
    heure: string
    recuperePar: string
    lienParente: string
    motif: string
    verifIdentite: boolean
    verifAccordResponsable: boolean
    verifSurListe: boolean
    reference: string
  }
  const [sortiePrintData, setSortiePrintData] = useState<SortiePrintData | null>(null)
  // Sortie anticipée déclarée mais dont l'aperçu d'impression est retardé le temps que le staff
  // gère (ou ignore) le popup WhatsApp de prévenance du transport — évite d'empiler les deux modaux.
  const [pendingSortiePrint, setPendingSortiePrint] = useState<SortiePrintData | null>(null)
  const age = calculateAge(identity.dateNaissance)
  const queryClient = useQueryClient()

  const handleSaveDecharge = async (updated: CantineInfo) => {
    await updateStudentCantine(student.id, updated)
    await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
    setEditingDecharge(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              student.sexe === 'F' ? 'bg-pink-50 text-pink-600' : 'bg-sky-50 text-sky-600'
            }`}
          >
            {student.sexe === 'F' ? 'Fille' : 'Garçon'}
          </span>
          {!identity.codeMassar && (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              Code Massar manquant
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Pencil className="h-3.5 w-3.5" />
          Modifier
        </button>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <IdCard className="h-4 w-4 text-indigo-500" />
          <h3 className="text-sm font-bold text-slate-800">Identité</h3>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <InfoRow label="Nom" value={identity.nom} />
          <InfoRow label="Prénom" value={identity.prenom} />
          <InfoRow label="Nom (ar)" value={identity.nomAr} />
          <InfoRow label="Prénom (ar)" value={identity.prenomAr} />
          <InfoRow label="Date de naissance" value={identity.dateNaissance ? `${identity.dateNaissance}${age !== null ? ` (${age} ans)` : ''}` : ''} />
          <InfoRow label="Lieu de naissance" value={identity.lieuNaissance} />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-indigo-500" />
          <h3 className="text-sm font-bold text-slate-800">Scolarité</h3>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <InfoRow label="Classe" value={student.classe} />
          <InfoRow label="Code Massar" value={identity.codeMassar} />
          <InfoRow label="Date d'entrée" value={identity.dateEntree} />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <UtensilsCrossed className="h-4 w-4 text-indigo-500" />
          <h3 className="text-sm font-bold text-slate-800">Cantine &amp; Transport</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <FlagBadge label="Cantine" active={identity.cantine} />
          <FlagBadge label="Garde matin" active={identity.gardeMatin} />
          <FlagBadge label="Garde midi" active={identity.gardeMidi} />
          <FlagBadge label="Garde après-midi" active={identity.gardeApresMidi} />
          <FlagBadge label="Transport" active={identity.transport} />
        </div>
        {identity.transport && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-sm">
            <span className="text-slate-500">Ligne (matin) :</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ligneBadgeInfo(identity.transportLigne).className}`}>
              {ligneBadgeInfo(identity.transportLigne).label}
            </span>
            <span className="text-slate-500">Ligne (soir) :</span>
            {identity.transportLigneSoir ? (
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ligneBadgeInfo(identity.transportLigneSoir).className}`}>
                {ligneBadgeInfo(identity.transportLigneSoir).label}
              </span>
            ) : identity.transportLigne ? (
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ligneBadgeInfo(identity.transportLigne).className}`}>
                {`= matin (${ligneBadgeInfo(identity.transportLigne).label})`}
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-400">Non affecté</span>
            )}
            {identity.transportSortie17h && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-600">
                Sortie 17h
                {identity.transportMotifException
                  ? ` — ${identity.transportMotifException === 'Autre' ? identity.transportMotifAutre || 'Autre' : identity.transportMotifException}`
                  : ''}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-indigo-500" />
          <h3 className="text-sm font-bold text-slate-800">Contacts parents</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { nom: identity.parent1Nom, prenom: identity.parent1Prenom, tel: identity.parent1Tel, email: identity.parent1Email, label: 'Parent 1' },
            { nom: identity.parent2Nom, prenom: identity.parent2Prenom, tel: identity.parent2Tel, email: identity.parent2Email, label: 'Parent 2' },
          ].map((p) => (
            <div key={p.label} className="rounded-xl bg-slate-50 p-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{p.label}</p>
              {p.nom || p.prenom ? (
                <>
                  <p className="text-sm font-semibold text-slate-800">
                    {p.prenom} {p.nom}
                  </p>
                  {p.tel && (
                    <a href={telHref(p.tel)} className="mt-1 flex items-center gap-1.5 text-sm text-indigo-600 hover:underline">
                      <Phone className="h-3.5 w-3.5" />
                      {p.tel}
                    </a>
                  )}
                  {p.email && (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                      <Mail className="h-3.5 w-3.5" />
                      {p.email}
                    </p>
                  )}
                  <ParentAccountStatus
                    email={p.email}
                    nomComplet={`${p.prenom} ${p.nom}`.trim()}
                    telephone={p.tel}
                    studentId={student.id}
                    relation={p.label}
                  />
                </>
              ) : (
                <p className="text-sm text-slate-300">Non renseigné</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-800">Décharge Parentale & Mode de Sortie</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDeclareSortie(true)}
              className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
            >
              <DoorOpen className="h-3.5 w-3.5" />
              Sortie anticipée
            </button>
            <button
              type="button"
              onClick={() => setShowDechargePrint(true)}
              className="flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100"
            >
              <Download className="h-3.5 w-3.5" />
              Imprimer / Télécharger
            </button>
            <button
              type="button"
              onClick={() => setEditingDecharge(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <Pencil className="h-3.5 w-3.5" />
              Modifier
            </button>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-slate-500">Décharge parentale signée :</span>
          {cantine.dechargeSignee ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
              OUI (VALIDÉE LE {cantine.dechargeDate})
            </span>
          ) : (
            <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600">NON</span>
          )}
        </div>
        <div className="mb-4 flex items-center justify-between text-sm">
          <span className="text-slate-500">Modalité de sortie :</span>
          <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-600">
            {cantine.modaliteSortie.toUpperCase()}
          </span>
        </div>

        <p className="mb-2 text-xs font-semibold text-slate-500">Responsables habilités à récupérer l'élève :</p>
        {cantine.responsables.length === 0 ? (
          <p className="py-2 text-center text-xs text-slate-400">Aucun responsable ajouté.</p>
        ) : (
          <div className="space-y-2">
            {cantine.responsables.map((r) => (
              <div
                key={r.name}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {r.name} <span className="font-normal text-slate-400">({r.relation})</span>
                  </p>
                  <p className="text-xs text-slate-500">Téléphone : {r.phone}</p>
                </div>
                <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-600">
                  HABILITÉ À RÉCUPÉRER
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingDecharge && (
        <CantineDechargeEditModal cantine={cantine} onClose={() => setEditingDecharge(false)} onSave={handleSaveDecharge} />
      )}

      {showDechargePrint && (
        <DechargePrintPreviewModal
          student={student}
          identity={identity}
          cantine={cantine}
          onClose={() => setShowDechargePrint(false)}
        />
      )}

      {showDeclareSortie && (
        <DeclarerSortieAnticipeeModal
          studentId={student.id}
          classe={student.classe}
          studentName={student.name}
          identity={identity}
          cantine={cantine}
          onClose={() => setShowDeclareSortie(false)}
          onDeclared={(input) => {
            setShowDeclareSortie(false)
            const transport = resolveStudentTransport(student, identity, lignes, chauffeurs, aides, capacite)
            if (identity.transport && transport.ligneSoirNom && !transport.soirParents) {
              setPendingSortiePrint(input)
            } else {
              setSortiePrintData(input)
            }
          }}
        />
      )}

      {pendingSortiePrint &&
        (() => {
          const transport = resolveStudentTransport(student, identity, lignes, chauffeurs, aides, capacite)
          return (
            <TransportSortieWhatsAppModal
              mode="sortie"
              studentName={student.name}
              ligneSoirNom={transport.ligneSoirNom}
              chauffeurNom={transport.chauffeurSoir?.nom ?? null}
              chauffeurTel={transport.chauffeurSoir?.telephone ?? null}
              aideNom={transport.aideSoir?.nom ?? null}
              aideTel={transport.aideSoir?.telephone ?? null}
              groupeUrl={capacite?.transportWhatsappGroupeUrl ?? ''}
              message={buildSortieAnticipeeTransportMessage({
                studentName: student.name,
                sexe: student.sexe,
                classe: student.classe,
                ligneSoirNom: transport.ligneSoirNom,
                heure: pendingSortiePrint.heure,
                date: pendingSortiePrint.date,
              })}
              onClose={() => {
                setSortiePrintData(pendingSortiePrint)
                setPendingSortiePrint(null)
              }}
            />
          )
        })()}

      {sortiePrintData && (
        <SortieAnticipeePrintPreviewModal
          student={student}
          identity={identity}
          date={sortiePrintData.date}
          heure={sortiePrintData.heure}
          recuperePar={sortiePrintData.recuperePar}
          lienParente={sortiePrintData.lienParente}
          motif={sortiePrintData.motif}
          verifIdentite={sortiePrintData.verifIdentite}
          verifAccordResponsable={sortiePrintData.verifAccordResponsable}
          verifSurListe={sortiePrintData.verifSurListe}
          reference={sortiePrintData.reference}
          onClose={() => setSortiePrintData(null)}
        />
      )}

      {editing && (
        <StudentIdentityEditModal
          student={student}
          identity={identity}
          onClose={() => setEditing(false)}
          onSaved={(updatedStudent) => {
            onStudentUpdated(updatedStudent)
          }}
        />
      )}
    </div>
  )
}
