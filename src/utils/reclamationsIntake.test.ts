import { describe, expect, it } from 'vitest'
import { parseParentMessage, suggestCategory, type IntakeContext } from './reclamationsIntake'

const ctx: IntakeContext = {
  students: [
    { id: '1', name: 'Ziyad CHAIHAB', classe: 'CE4-A' },
    { id: '2', name: 'Noura FATHY', classe: 'CE3-B' },
    { id: '3', name: 'Ilyass CHIKHAOUI', classe: 'CE3-B' },
    { id: '4', name: 'Sara KAIZAR', classe: '3APIC-A' },
    { id: '5', name: 'Sara KAIZAR', classe: '2APIC-A' },
    { id: '6', name: 'Mohamed ESSADSSI AL IDRISSI', classe: 'CE3-B' },
  ],
  teacherNames: ['Nouhaila EL MANGADI', 'Doha KARMOUCHI', 'Khadija AZIRI'],
  parentNamesOf: (id) => (id === '1' ? ['Soukaina BAYAZID'] : []),
}

describe('suggestCategory', () => {
  it('reconnaît les motifs courants', () => {
    expect(suggestCategory("Le bus du transport scolaire est arrivé très en retard").category).toBe('Transport')
    expect(suggestCategory('Le plat de la cantine était froid').category).toBe('Cantine')
    expect(suggestCategory('Ma fille est victime de harcèlement et de moqueries').category).toBe('Harcèlement / Intimidation')
    expect(suggestCategory('Il a frappé un camarade pendant la récréation').category).toBe('Comportement')
    expect(suggestCategory('La classe est surchargée, trop d’élèves').category).toBe('Communication / Administration')
  })

  it("ne force rien quand aucun mot-clé ne ressort", () => {
    expect(suggestCategory('Merci de me rappeler').category).toBe('Autre')
    expect(suggestCategory('Merci de me rappeler').confidence).toBe('low')
  })
})

describe('parseParentMessage', () => {
  it("nettoie le markdown et lit l'objet étiqueté", () => {
    const r = parseParentMessage('**Objet : Réclamation concernant un incident pendant la séance d’anglais**\nLa maman a réclamé que le bus est dangereux.', ctx)
    expect(r.items).toHaveLength(1)
    expect(r.items[0].objet).toBe('Réclamation concernant un incident pendant la séance d’anglais')
    expect(r.items[0].description).toBe('La maman a réclamé que le bus est dangereux.')
  })

  it('découpe plusieurs « Objet : » en plusieurs réclamations', () => {
    const r = parseParentMessage('Bonjour\nObjet : Cantine froide\nLe plat est servi froid.\nObjet : Retard du bus\nLe bus arrive à 8h30.', ctx)
    expect(r.items.map((i) => i.objet)).toEqual(['Cantine froide', 'Retard du bus'])
    expect(r.items[0].category).toBe('Cantine')
    expect(r.items[1].category).toBe('Transport')
  })

  it("reconnaît l'élève, le parent et propose la catégorie", () => {
    const r = parseParentMessage("Bonjour, mon fils Ziyad CHAIHAB a un niveau scolaire faible, son enseignant ne l'aide pas. Soukaina BAYAZID", ctx)
    expect(r.studentId).toBe('1')
    expect(r.parentNom).toBe('Soukaina BAYAZID')
    expect(r.items[0].category).toBe('Pédagogie / Enseignement')
  })

  it('reconnaît un nom écrit dans un autre ordre et sans accents', () => {
    expect(parseParentMessage('Ma fille fathy noura ne mange pas', ctx).studentId).toBe('2')
  })

  it("ne choisit jamais seul entre deux élèves cités", () => {
    const r = parseParentMessage('CHIKHAOUI Ilyass a frappé Noura FATHY', ctx)
    expect(r.studentId).toBeNull()
    expect(r.studentCandidates.map((s) => s.id).sort()).toEqual(['2', '3'])
  })

  it('laisse choisir entre deux homonymes', () => {
    const r = parseParentMessage('Réclamation pour Sara KAIZAR', ctx)
    expect(r.studentId).toBeNull()
    expect(r.studentCandidates).toHaveLength(2)
  })

  it("propose un élève au nom incomplet sans le sélectionner d'office", () => {
    const r = parseParentMessage('Mohamed ESSADSSI est en difficulté', ctx)
    expect(r.studentCandidates.map((s) => s.id)).toEqual(['6'])
    expect(r.studentId).toBeNull()
  })

  it("ne propose pas d'élève sur un simple prénom courant", () => {
    expect(parseParentMessage('Mohamed est triste', ctx).studentCandidates).toHaveLength(0)
  })

  it("trouve l'enseignant par son nom complet, ou par son nom de famille seul (confiance faible)", () => {
    const full = parseParentMessage('Nouhaila EL MANGADI a crié sur les élèves', ctx).items[0]
    expect(full.concernant).toBe('Nouhaila EL MANGADI')
    expect(full.concernantConfidence).toBe('high')
    const lastName = parseParentMessage('Mme KARMOUCHI crie sur les élèves', ctx).items[0]
    expect(lastName.concernant).toBe('Doha KARMOUCHI')
    expect(lastName.concernantConfidence).toBe('low')
  })

  it('propose un service quand aucun nom de personne ne ressort', () => {
    const item = parseParentMessage('Le plat de la cantine était froid', ctx).items[0]
    expect(item.concernant).toBe('Personnel de la cantine')
    expect(item.concernantConfidence).toBe('low')
  })

  it("lit la date et l'auteur d'un en-tête WhatsApp", () => {
    const r = parseParentMessage('[30/09/2026 09:12] Soukaina BAYAZID: Bonjour, le bus du transport est arrivé en retard pour Ziyad CHAIHAB', ctx)
    expect(r.date).toBe('2026-09-30')
    expect(r.parentNom).toBe('Soukaina BAYAZID')
    expect(r.items[0].description.startsWith('Bonjour')).toBe(true)
    expect(r.items[0].category).toBe('Transport')
  })

  it("ignore un numéro de téléphone comme nom d'auteur", () => {
    expect(parseParentMessage('[30/09/2026 09:12] +212 6 12 34 56 78: Le plat est froid', ctx).parentNom).toBe('')
  })

  it('lit une date écrite dans le texte', () => {
    expect(parseParentMessage('Le 12/09/2026, mon fils a été puni.', ctx).date).toBe('2026-09-12')
  })

  it('un texte sans structure devient une seule réclamation', () => {
    const r = parseParentMessage('Merci de me rappeler au plus vite. Je suis inquiet.', ctx)
    expect(r.items).toHaveLength(1)
    expect(r.items[0].objet).toBe('Merci de me rappeler au plus vite.')
    expect(r.items[0].category).toBe('Autre')
  })
})
