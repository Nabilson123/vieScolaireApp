import { describe, expect, it } from 'vitest'
import { creneauDuRemplacement, heuresEntre, type SlotInfo } from './remplacementCreneau'

const slot = (subject: string, teacherName: string, start: string, end: string, hours: number): SlotInfo => ({ subject, teacherName, start, end, hours })

const jour: SlotInfo[] = [
  slot('Anglais', 'Widad DIBOUN', '08:00', '09:00', 1),
  slot('Mathématiques', 'Saida AMGHAR', '09:00', '10:00', 1),
  slot('Anglais', 'Widad DIBOUN', '14:00', '15:00', 1),
  slot('Français', 'Sara ERRAIDI', '10:40', '12:20', 1.67),
]

describe('heuresEntre', () => {
  it('durée en heures, arrondie au centième', () => {
    expect(heuresEntre('10:40', '11:40')).toBe(1)
    expect(heuresEntre('10:40', '12:20')).toBe(1.67)
    expect(heuresEntre('09:00', '09:30')).toBe(0.5)
  })
})

describe('creneauDuRemplacement', () => {
  it('l’heure enregistrée avec le remplacement fait foi', () => {
    expect(creneauDuRemplacement({ matiere: 'Anglais', profRemplace: 'Widad DIBOUN', heures: 0.5, start: '08:00', end: '08:30' }, jour)).toEqual({ start: '08:00', end: '08:30', derived: false })
  })

  it('sans heure enregistrée : retrouvée dans le cours (même matière, même professeur, même durée)', () => {
    expect(creneauDuRemplacement({ matiere: 'Français', profRemplace: 'Sara ERRAIDI', heures: 1.67 }, jour)).toEqual({ start: '10:40', end: '12:20', derived: true })
    expect(creneauDuRemplacement({ matiere: 'Français', profRemplace: 'Sara ERRAIDI', heures: 1.6666666 }, jour)?.derived).toBe(true)
  })

  it('plusieurs cours possibles : on ne devine pas', () => {
    expect(creneauDuRemplacement({ matiere: 'Anglais', profRemplace: 'Widad DIBOUN', heures: 1 }, jour)).toBeNull()
  })

  it('durée différente (portion de séance), autre professeur ou autre matière : rien', () => {
    expect(creneauDuRemplacement({ matiere: 'Français', profRemplace: 'Sara ERRAIDI', heures: 1 }, jour)).toBeNull()
    expect(creneauDuRemplacement({ matiere: 'Français', profRemplace: 'Autre PROF', heures: 1.67 }, jour)).toBeNull()
    expect(creneauDuRemplacement({ matiere: 'Physique', profRemplace: 'Sara ERRAIDI', heures: 1.67 }, jour)).toBeNull()
    expect(creneauDuRemplacement({ matiere: 'Français', profRemplace: 'Sara ERRAIDI', heures: 1.67 }, [])).toBeNull()
  })
})
