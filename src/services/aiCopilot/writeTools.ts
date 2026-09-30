import { RECLAMATION_CATEGORIES } from '../../data/studentDetails'
import type { Profile } from '../../data/profiles'
import { getModuleAccess } from '../permissions'
import { getStudentsSnapshot } from '../studentsService'
import type { GeminiFunctionDeclaration } from './types'

export interface WriteTool {
  schema: GeminiFunctionDeclaration
  /** Filtre appliqué avant même d'inclure le schéma dans la requête au modèle — un outil non
   * autorisé n'est pas seulement refusé à l'exécution, il n'est jamais proposé au modèle. */
  moduleGate: (profile: Profile | undefined, canEditYear: boolean) => boolean
  describe: (input: Record<string, unknown>) => string
}

function studentLabel(studentId: string): string {
  const s = getStudentsSnapshot().find((x) => x.id === studentId)
  return s ? `${s.name} (${s.classe})` : studentId
}

const marquerAppelParentFait: WriteTool = {
  schema: {
    name: 'marquer_appel_parent_fait',
    description: "Marque l'appel aux parents d'un élève comme effectué aujourd'hui. Nécessite confirmation de l'utilisateur avant exécution.",
    parameters: {
      type: 'object',
      properties: {
        studentId: { type: 'string', description: 'Obtenu via rechercher_eleve' },
        parentAppele: { type: 'string', description: "Qui a été joint (ex : 'Père', 'Mère', nom complet)" },
        note: { type: 'string', description: "Résumé optionnel de l'appel" },
      },
      required: ['studentId', 'parentAppele'],
    },
  },
  // Même gating que le bouton "Marquer appelé" existant de CockpitLive.tsx : uniquement
  // l'éditabilité de l'année, aucune clé de module dédiée n'existe pour les appels-parents.
  moduleGate: (_profile, canEditYear) => canEditYear,
  describe: (input) => {
    const note = input.note ? String(input.note).trim() : ''
    return `Marquer l'appel aux parents de ${studentLabel(String(input.studentId))} comme fait aujourd'hui — parent joint : ${input.parentAppele}${note ? `, note : « ${note} »` : ''}.`
  },
}

const declarerSortieAnticipee: WriteTool = {
  schema: {
    name: 'declarer_sortie_anticipee',
    description: "Déclare une sortie anticipée pour un élève. Nécessite confirmation de l'utilisateur avant exécution.",
    parameters: {
      type: 'object',
      properties: {
        studentId: { type: 'string', description: 'Obtenu via rechercher_eleve' },
        date: { type: 'string', description: "Date au format AAAA-MM-JJ, aujourd'hui par défaut" },
        heure: { type: 'string', description: 'Heure au format HH:MM' },
        recuperePar: { type: 'string', description: "Personne qui récupère l'élève" },
        motif: { type: 'string', description: 'Motif de la sortie' },
      },
      required: ['studentId', 'date', 'heure', 'recuperePar', 'motif'],
    },
  },
  moduleGate: (profile, canEditYear) => canEditYear && getModuleAccess(profile, 'absences').canEdit,
  describe: (input) =>
    `Déclarer une sortie anticipée pour ${studentLabel(String(input.studentId))} le ${input.date} à ${input.heure}, récupéré(e) par ${input.recuperePar} (motif : ${input.motif}).`,
}

const creerReclamation: WriteTool = {
  schema: {
    name: 'creer_reclamation',
    description: "Crée une ou plusieurs réclamations pour un élève. Nécessite confirmation de l'utilisateur avant exécution.",
    parameters: {
      type: 'object',
      properties: {
        studentId: { type: 'string', description: 'Obtenu via rechercher_eleve' },
        parentNom: { type: 'string', description: 'Nom du parent réclamant' },
        date: { type: 'string', description: "Date au format AAAA-MM-JJ, aujourd'hui par défaut" },
        items: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              category: { type: 'string', enum: RECLAMATION_CATEGORIES },
              objet: { type: 'string', description: 'Objet court de la réclamation' },
              description: { type: 'string', description: 'Description détaillée' },
              concernant: { type: 'string', description: 'Enseignant ou personnel concerné' },
            },
            required: ['category', 'objet', 'description', 'concernant'],
          },
        },
      },
      required: ['studentId', 'parentNom', 'items'],
    },
  },
  moduleGate: (profile, canEditYear) => canEditYear && getModuleAccess(profile, 'reclamations').canEdit,
  describe: (input) => {
    const items = (input.items as { objet: string; category: string }[] | undefined) ?? []
    const list = items.map((it) => `« ${it.objet} » (${it.category})`).join(', ')
    return `Créer ${items.length > 1 ? `${items.length} réclamations` : 'une réclamation'} pour ${studentLabel(String(input.studentId))} au nom de ${input.parentNom} : ${list}.`
  },
}

export const WRITE_TOOLS: Record<string, WriteTool> = {
  marquer_appel_parent_fait: marquerAppelParentFait,
  declarer_sortie_anticipee: declarerSortieAnticipee,
  creer_reclamation: creerReclamation,
}
