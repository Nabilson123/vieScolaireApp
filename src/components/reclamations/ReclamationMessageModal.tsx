import type { ReclamationRecord } from '../../data/studentDetails'
import { getStudentIdentitySnapshot } from '../../services/studentIdentityService'
import { buildReclamationMessage, type ReclamationMessageKind } from '../../utils/whatsapp'
import { cleanReclamationText } from '../../utils/reclamationsLogic'
import { delaiResolutionAutorise } from '../../utils/reclamationsPolicy'
import MessageWhatsAppModal, { type WhatsAppRecipient } from '../MessageWhatsAppModal'

export const MESSAGE_KIND_LABELS: Record<ReclamationMessageKind, string> = {
  accuse: 'Accusé de réception',
  prise_en_charge: 'Prise en charge',
  resolution: 'Réponse',
  relance: 'Suivi de la famille',
}

const MESSAGE_TITLES: Record<ReclamationMessageKind, string> = {
  accuse: 'Accusé de réception au parent',
  prise_en_charge: 'Prise en charge — message au parent',
  resolution: 'Réponse au parent',
  relance: 'Suivi — message à la famille',
}

/** Quel message proposer quand on ne précise pas : celui qui correspond à l'état de la réclamation. */
export function messageKindForStatut(statut: ReclamationRecord['statut']): ReclamationMessageKind {
  return statut === 'En attente' ? 'accuse' : statut === 'En cours' ? 'prise_en_charge' : 'resolution'
}

interface ReclamationMessageModalProps {
  reclamation: ReclamationRecord
  studentId: string
  studentName: string
  classe: string
  kind: ReclamationMessageKind
  banner?: string
  /** Appelé quand le message est copié ou ouvert dans WhatsApp. */
  onShared?: (kind: ReclamationMessageKind) => void
  onClose: () => void
}

/** Texte pré-rédigé et numéros des parents de la fiche élève (le parent réclamant en premier) pour un message
 * à la famille — partagé par le message d'une réclamation et par l'envoi groupé des accusés. */
export function buildReclamationOutbound(
  reclamation: ReclamationRecord,
  studentId: string,
  studentName: string,
  classe: string,
  kind: ReclamationMessageKind
): { message: string; recipients: WhatsAppRecipient[] } {
  const identity = getStudentIdentitySnapshot(studentId)
  const parents = [
    { nom: `${identity.parent1Prenom} ${identity.parent1Nom}`.trim(), fallback: 'Parent 1', phone: identity.parent1Tel },
    { nom: `${identity.parent2Prenom} ${identity.parent2Nom}`.trim(), fallback: 'Parent 2', phone: identity.parent2Tel },
  ].filter((p) => p.phone?.trim())
  const claimant = parents.filter((p) => p.nom && p.nom === reclamation.parentNom)
  const recipients: WhatsAppRecipient[] = [...claimant, ...parents.filter((p) => !claimant.includes(p))].map((p) => ({
    label: p.nom || p.fallback,
    phone: p.phone,
  }))

  const message = buildReclamationMessage(kind, {
    parentNom: reclamation.parentNom,
    studentName,
    classe,
    categorie: reclamation.type,
    objet: cleanReclamationText(reclamation.objet),
    date: reclamation.date,
    responsable: reclamation.responsable,
    echeance: reclamation.echeance,
    resolution: reclamation.resolution,
    delaiJours: delaiResolutionAutorise(reclamation),
  })
  return { message, recipients }
}

/** Message au parent d'une réclamation : texte pré-rédigé selon l'étape, numéros des parents de la fiche
 * élève (le parent réclamant en premier) pour ouvrir WhatsApp directement. */
export default function ReclamationMessageModal({ reclamation, studentId, studentName, classe, kind, banner, onShared, onClose }: ReclamationMessageModalProps) {
  const { message, recipients } = buildReclamationOutbound(reclamation, studentId, studentName, classe, kind)

  return (
    <MessageWhatsAppModal
      message={message}
      onClose={onClose}
      title={MESSAGE_TITLES[kind]}
      label="Message au parent"
      banner={banner}
      recipients={recipients}
      onShared={onShared ? () => onShared(kind) : undefined}
    />
  )
}
