import { describe, expect, it } from 'vitest'
import { toWhatsAppPhone, buildWhatsAppLink, buildRemplacementMessage, buildRdvMessage, buildReclamationMessage } from './whatsapp'

describe('toWhatsAppPhone', () => {
  it('converts a local Moroccan number (leading 0) to international format', () => {
    expect(toWhatsAppPhone('0655-456041')).toBe('212655456041')
  })

  it('strips spaces and other separators', () => {
    expect(toWhatsAppPhone('06 55 45 60 41')).toBe('212655456041')
  })

  it('leaves an already-international number untouched', () => {
    expect(toWhatsAppPhone('212655456041')).toBe('212655456041')
  })

  it('returns null for an empty number', () => {
    expect(toWhatsAppPhone('')).toBeNull()
    expect(toWhatsAppPhone('   ')).toBeNull()
  })
})

describe('buildWhatsAppLink', () => {
  it('builds a wa.me link with the phone and URL-encoded message', () => {
    const link = buildWhatsAppLink('0655456041', 'Bonjour & bienvenue')
    expect(link).toBe('https://wa.me/212655456041?text=Bonjour%20%26%20bienvenue')
  })

  it('returns null when the phone number is invalid', () => {
    expect(buildWhatsAppLink('', 'test')).toBeNull()
  })
})

describe('buildRemplacementMessage', () => {
  it('includes all key info: date, créneau, classe, matière', () => {
    const message = buildRemplacementMessage({
      teacherName: 'Youssef Tazi',
      date: '2026-08-10',
      creneau: '08:30 - 10:00',
      classe: '3APIC-A',
      matiere: 'Mathématiques',
    })
    expect(message).toContain('Youssef Tazi')
    expect(message).toContain('08:30 - 10:00')
    expect(message).toContain('3APIC-A')
    expect(message).toContain('Mathématiques')
  })

  it('includes consignes only when provided', () => {
    const withConsignes = buildRemplacementMessage({
      teacherName: 'A',
      date: '2026-08-10',
      creneau: '2h',
      classe: 'CE1-A',
      matiere: 'Français',
      consignes: 'Faire les exercices p.12',
    })
    expect(withConsignes).toContain('Faire les exercices p.12')

    const withoutConsignes = buildRemplacementMessage({
      teacherName: 'A',
      date: '2026-08-10',
      creneau: '2h',
      classe: 'CE1-A',
      matiere: 'Français',
    })
    expect(withoutConsignes).not.toContain('Consignes')
  })
})

describe('buildRdvMessage', () => {
  const base = { date: '2026-10-05', heure: '10:00', duree: 30, motif: "Difficultés d'assiduité" }

  it('inclut élève, date, demandeur, enseignants concernés, sujet et animateur', () => {
    const message = buildRdvMessage({
      studentName: 'Loujaine HAMZAOUI',
      classe: 'CE1-A',
      record: { ...base, enseignants: ['Saida AMGHAR', 'Sara ERRAIDI'], demandeur: { type: 'parent1', nom: 'Said HAMZAOUI' }, animateur: 'Nabil Lahrache' },
    })
    expect(message).toBe(
      [
        '*Rendez-vous parent*',
        '*Élève :* Loujaine HAMZAOUI (CE1-A)',
        '*Date :* lundi 05/10/2026 à 10:00 (30 min)',
        '*Demandé par :* Parent 1 — Said HAMZAOUI',
        '*Enseignants concernés :* Saida AMGHAR, Sara ERRAIDI',
        "*Sujet :* Difficultés d'assiduité",
        '*Animé par :* Nabil Lahrache',
      ].join('\n')
    )
  })

  it('accorde le libellé au singulier pour un seul enseignant', () => {
    const message = buildRdvMessage({ studentName: 'A B', classe: 'CE1-A', record: { ...base, enseignants: ['Saida AMGHAR'] } })
    expect(message).toContain('*Enseignant concerné :* Saida AMGHAR')
  })

  it("omet le demandeur et l'animateur quand ils ne sont pas renseignés", () => {
    const message = buildRdvMessage({ studentName: 'A B', classe: 'CE1-A', record: { ...base, enseignants: ['Saida AMGHAR'] } })
    expect(message).not.toContain('Demandé par')
    expect(message).not.toContain('Animé par')
  })

  it("indique l'administration seule quand aucun enseignant n'est concerné", () => {
    const message = buildRdvMessage({ studentName: 'A B', classe: '', record: { ...base, enseignants: [], demandeur: { type: 'administration', nom: '' } } })
    expect(message).toContain('*Élève :* A B\n')
    expect(message).toContain('*Demandé par :* Administration')
    expect(message).toContain('*Enseignant concerné :* aucun (rencontre avec l’administration)')
  })
})

describe('buildReclamationMessage', () => {
  const info = {
    parentNom: 'Meryem EDDGHOUGHI',
    studentName: 'Yazid BARGUIGA',
    classe: 'CE4-B',
    categorie: 'Comportement',
    objet: 'Comportement de l’enseignante',
    date: '2026-09-23',
    responsable: 'Nabil Lahrache',
    echeance: '2026-10-08',
    resolution: 'Un entretien a eu lieu avec l’enseignante.',
  }

  it("accusé de réception : objet en gras et délai de 72 heures", () => {
    const message = buildReclamationMessage('accuse', info)
    expect(message.startsWith('Bonjour Meryem EDDGHOUGHI,\n')).toBe(true)
    expect(message).toContain('réclamation du 23/09/2026 concernant Yazid BARGUIGA (CE4-B) : *Comportement de l’enseignante*')
    expect(message).toContain('sous 72 heures')
    expect(message.endsWith('Direction de la Vie Scolaire — Groupe Scolaire Mondrian')).toBe(true)
  })

  it("accusé de réception : le délai annoncé suit le niveau de la réclamation", () => {
    expect(buildReclamationMessage('accuse', { ...info, delaiJours: 1 })).toContain('sous 24 heures')
    expect(buildReclamationMessage('accuse', { ...info, delaiJours: 5 })).toContain('sous 5 jours')
  })

  it('prise en charge : responsable, action selon la catégorie et échéance', () => {
    const message = buildReclamationMessage('prise_en_charge', info)
    expect(message).toContain('est prise en charge par Nabil Lahrache')
    expect(message).toContain("vérifications nécessaires auprès de l'équipe éducative")
    expect(message).toContain('au plus tard le 08/10/2026')
  })

  it("prise en charge : omet l'action (catégorie sans modèle) et l'échéance absente", () => {
    const message = buildReclamationMessage('prise_en_charge', { ...info, categorie: 'Autre', echeance: undefined, responsable: undefined })
    expect(message).toContain('est prise en charge.')
    expect(message).not.toContain('au plus tard')
    expect(message).not.toContain('vérifications')
  })

  it('résolution : reprend la solution saisie', () => {
    const message = buildReclamationMessage('resolution', info)
    expect(message).toContain("voici la réponse de l'établissement :\n\nUn entretien a eu lieu avec l’enseignante.")
  })

  it('salue sans nom quand le parent est inconnu', () => {
    expect(buildReclamationMessage('accuse', { ...info, parentNom: '  ' }).startsWith('Bonjour,\n')).toBe(true)
  })
})
