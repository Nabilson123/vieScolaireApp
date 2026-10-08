import { describe, expect, it } from 'vitest'
import { toWhatsAppPhone, buildWhatsAppLink, buildRemplacementMessage, buildRdvMessage, buildReclamationMessage, buildSoutienMessage, buildSoutienTransportMessage } from './whatsapp'

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

  it('relance : redemande si la réponse a convenu, sans rappeler la solution', () => {
    const message = buildReclamationMessage('relance', info)
    expect(message.startsWith('Bonjour Meryem EDDGHOUGHI,\n')).toBe(true)
    expect(message).toContain('au sujet de votre réclamation du 23/09/2026')
    expect(message).toContain('vous a-t-elle convenu')
    expect(message).not.toContain(info.resolution as string)
    expect(message.endsWith('Direction de la Vie Scolaire — Groupe Scolaire Mondrian')).toBe(true)
  })

  it('version arabe : texte du modèle traduit, objet et nom de l’élève inchangés', () => {
    const message = buildReclamationMessage('accuse', info, 'ar')
    expect(message.startsWith('السلام عليكم Meryem EDDGHOUGHI،\n')).toBe(true)
    expect(message).toContain('لقد توصلنا بشكايتكم بتاريخ 23/09/2026 بخصوص التلميذ(ة) Yazid BARGUIGA (CE4-B) : *Comportement de l’enseignante*')
    expect(message).toContain('في أجل أقصاه 72 ساعة')
    expect(message.endsWith('إدارة الحياة المدرسية — مجموعة مدارس موندريان')).toBe(true)
    expect(message).not.toContain('Bonjour')
  })

  it('version arabe : délai selon le niveau, prise en charge avec action et échéance, solution telle que saisie', () => {
    expect(buildReclamationMessage('accuse', { ...info, delaiJours: 1 }, 'ar')).toContain('24 ساعة')
    expect(buildReclamationMessage('accuse', { ...info, delaiJours: 5 }, 'ar')).toContain('5 أيام')
    const pec = buildReclamationMessage('prise_en_charge', info, 'ar')
    expect(pec).toContain('قيد المعالجة من طرف Nabil Lahrache')
    expect(pec).toContain('نجري التحريات اللازمة لدى الطاقم التربوي.')
    expect(pec).toContain('سنعود إليكم في أجل أقصاه 08/10/2026.')
    expect(buildReclamationMessage('resolution', info, 'ar')).toContain(info.resolution as string)
    expect(buildReclamationMessage('resolution', { ...info, resolution: '' }, 'ar')).toContain('(الجواب قيد الإعداد)')
    expect(buildReclamationMessage('relance', info, 'ar')).toContain('هل كان جواب المؤسسة مناسبًا لكم؟')
  })

  it('français + arabe : le français d’abord, puis un filet, puis l’arabe', () => {
    const message = buildReclamationMessage('accuse', info, 'both')
    const [fr, ar] = message.split('\n\n──────────\n\n')
    expect(fr).toBe(buildReclamationMessage('accuse', info, 'fr'))
    expect(ar).toBe(buildReclamationMessage('accuse', info, 'ar'))
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

describe('buildSoutienMessage', () => {
  const info = {
    parentNom: 'Mme SAIDI',
    studentName: 'Baker SAIDI',
    studentNameAr: 'بكر السعيدي',
    classe: 'CE1-A',
    matiere: 'Mathématiques',
    matiereAr: 'الرياضيات',
    jour: 'LUNDI' as const,
    heureDebut: '16:30',
    heureFin: '17:30',
    aPartirDu: '2026-10-12',
    jusquAu: '2026-11-02',
    enseignant: 'Sara ERRAIDI',
    salle: 'Salle 4',
    aTransportSoir: false,
  }
  const avecCar = { ...info, aTransportSoir: true, ligneSoir: 'A', heureDepart: '16:00' }

  it('confirmation : créneau, période, enseignant et salle', () => {
    const m = buildSoutienMessage('confirmation', info)
    expect(m).toContain('Bonjour Mme SAIDI,')
    expect(m).toContain('*Baker SAIDI* (CE1-A) est inscrit(e) au soutien scolaire en *Mathématiques*')
    expect(m).toContain('chaque lundi de 16:30 à 17:30')
    expect(m).toContain('*À partir du :* 12/10/2026 jusqu\'au 02/11/2026')
    expect(m).toContain('*Enseignant :* Sara ERRAIDI')
    expect(m).toContain('*Salle :* Salle 4')
  })

  it('sans transport : réponse OUI / NON et aucune mention du car', () => {
    const m = buildSoutienMessage('confirmation', info)
    expect(m).toContain('*OUI*')
    expect(m).not.toContain('car')
    expect(m).not.toContain('transport')
  })

  it('avec le car du soir : précise que le transport n’est plus assuré s’il reste, et demande RESTE / TRANSPORT', () => {
    const m = buildSoutienMessage('confirmation', avecCar)
    expect(m).toContain('(ligne A, départ à 16:00)')
    expect(m).toContain('après le départ du car')
    expect(m).toContain("le transport du soir ne sera pas assuré par le service transport")
    expect(m).toContain('*RESTE*')
    expect(m).toContain('*TRANSPORT*')
    expect(m).not.toContain('*OUI*')
  })

  it('séance qui finit avant le car : pas de mention « après le départ du car »', () => {
    const m = buildSoutienMessage('confirmation', { ...avecCar, heureFin: '15:30', heureDebut: '14:30' })
    expect(m).not.toContain('après le départ du car')
    expect(m).toContain('ne sera pas assuré')
  })

  it('changement : annonce le nouveau créneau et annule la réponse précédente', () => {
    const m = buildSoutienMessage('changement', info)
    expect(m).toContain('a été modifié')
    expect(m).toContain('*Nouveau créneau :*')
    expect(m).toContain('annule votre réponse précédente')
  })

  it('période ouverte : pas de « jusqu\'au » ; parent inconnu : « Bonjour, »', () => {
    const m = buildSoutienMessage('confirmation', { ...info, jusquAu: null, parentNom: ' ' })
    expect(m).not.toContain("jusqu'au")
    expect(m.startsWith('Bonjour,\n')).toBe(true)
  })

  it('arabe : nom et matière en arabe, jour en arabe, jamais de français du modèle', () => {
    const m = buildSoutienMessage('confirmation', avecCar, 'ar')
    expect(m).toContain('*بكر السعيدي*')
    expect(m).toContain('*الرياضيات*')
    expect(m).toContain('كل الاثنين من 16:30 إلى 17:30')
    expect(m).toContain('*يبقى*')
    expect(m).toContain('*النقل*')
    expect(m).not.toContain('Bonjour')
  })

  it('arabe : repli sur le nom et la matière français quand l’arabe manque', () => {
    const m = buildSoutienMessage('confirmation', { ...info, studentNameAr: '', matiereAr: undefined }, 'ar')
    expect(m).toContain('*Baker SAIDI*')
    expect(m).toContain('*Mathématiques*')
    expect(m).toContain('*نعم*')
  })

  it('les deux langues : français, filet, arabe', () => {
    const m = buildSoutienMessage('confirmation', info, 'both')
    const [fr, ar] = m.split('\n\n──────────\n\n')
    expect(fr).toContain('Bonjour Mme SAIDI,')
    expect(ar).toContain('السلام عليكم')
  })
})

describe('buildSoutienMessage — annulation', () => {
  const info = {
    parentNom: 'Mme SAIDI',
    studentName: 'Baker SAIDI',
    studentNameAr: 'بكر السعيدي',
    classe: 'CE1-A',
    matiere: 'Mathématiques',
    matiereAr: 'الرياضيات',
    jour: 'LUNDI' as const,
    heureDebut: '16:30',
    heureFin: '17:30',
    aPartirDu: '2026-10-12',
    aTransportSoir: false,
    datesAnnulees: ['2026-10-12'],
    prochaine: '2026-10-19',
  }

  it('une séance annulée : date, pas de réponse demandée, prochaine séance annoncée', () => {
    const m = buildSoutienMessage('annulation', info)
    expect(m).toContain('La séance de soutien scolaire en *Mathématiques* de *Baker SAIDI* (CE1-A) prévue le *lundi 12/10* (de 16:30 à 17:30) est annulée.')
    expect(m).toContain('Il n\'y a donc pas de soutien ce jour-là.')
    expect(m).toContain('La prochaine séance a lieu le 19/10/2026.')
    expect(m).not.toContain('*OUI*')
    expect(m).not.toContain('*RESTE*')
  })

  it('plusieurs séances annulées (vacances) : pluriel', () => {
    const m = buildSoutienMessage('annulation', { ...info, datesAnnulees: ['2026-10-26', '2026-11-02'], prochaine: null })
    expect(m).toContain('Les séances de soutien scolaire en *Mathématiques*')
    expect(m).toContain('*lundi 26/10*, *lundi 02/11*')
    expect(m).toContain('sont annulées.')
    expect(m).not.toContain('prochaine séance')
  })

  it('élève au car du soir : il le prend comme d’habitude', () => {
    const m = buildSoutienMessage('annulation', { ...info, aTransportSoir: true, ligneSoir: 'A', heureDepart: '16:00' })
    expect(m).toContain('prendra donc le car du soir comme d\'habitude (ligne A, départ à 16:00)')
    expect(m).not.toContain('pas de soutien')
  })

  it('arabe : jour et matière en arabe', () => {
    const m = buildSoutienMessage('annulation', { ...info, aTransportSoir: true, ligneSoir: 'A', heureDepart: '16:00' }, 'ar')
    expect(m).toContain('*الرياضيات*')
    expect(m).toContain('*الاثنين 12/10*')
    expect(m).toContain('ملغاة')
    expect(m).toContain('الخط A')
    expect(m).not.toContain('Bonjour')
  })

  it('les deux langues : français puis arabe', () => {
    const m = buildSoutienMessage('annulation', info, 'both')
    const [fr, ar] = m.split('\n\n──────────\n\n')
    expect(fr).toContain('est annulée')
    expect(ar).toContain('ملغاة')
  })
})

describe('buildSoutienTransportMessage', () => {
  it('liste les élèves par ligne avec le jour et la date en arabe', () => {
    const m = buildSoutienTransportMessage({
      date: '2026-10-14',
      lignes: [
        { ligne: 'A', eleves: [{ name: 'Baker SAIDI', classe: 'PS-A' }] },
        { ligne: 'C', eleves: [{ name: 'Adam BELGRAINI', classe: '1APIC-A' }, { name: 'Omar AKIL', classe: '1APIC-A' }] },
      ],
    })
    expect(m).toContain('يوم الأربعاء 14/10/2026')
    expect(m).toContain('خط A :\n- Baker SAIDI (PS-A)')
    expect(m).toContain('خط C :\n- Adam BELGRAINI (1APIC-A)\n- Omar AKIL (1APIC-A)')
    expect(m).toContain('ولن يستقلوا حافلة النقل هذا المساء')
    expect(m.startsWith('السلام عليكم')).toBe(true)
  })
})
