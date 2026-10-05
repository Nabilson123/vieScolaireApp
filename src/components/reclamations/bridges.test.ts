import { describe, expect, it } from 'vitest'
import type { Teacher } from '../../data/teachers'
import type { LogicalGroup } from '../../utils/suiviClasseGroups'
import { availableBridges, findGroupForClasse, findTeacherFor } from './bridges'

const group = (key: string, niveauxBruts: string[]) => ({ key, label: key, niveauxBruts }) as unknown as LogicalGroup
const groups = [group('CE2', ['CE2']), group('1-3APIC', ['1APIC', '2APIC', '3APIC'])]
const teacher = (id: string, prenom: string, nom: string) => ({ id, prenom, nom }) as unknown as Teacher
const teachers = [teacher('t1', 'Doha', 'KARMOUCHI'), teacher('t2', 'Khadija', 'AZIRI')]

describe('findGroupForClasse', () => {
  it('trouve le groupe du primaire par niveau et celui du collège fusionné', () => {
    expect(findGroupForClasse(groups, 'CE2-B')?.key).toBe('CE2')
    expect(findGroupForClasse(groups, '2APIC-A')?.key).toBe('1-3APIC')
  })

  it("n'a pas de groupe pour la maternelle", () => {
    expect(findGroupForClasse(groups, 'GS-A')).toBeUndefined()
  })
})

describe('findTeacherFor', () => {
  it('reconnaît le nom exact, avec ou sans « Prof. » et quelle que soit la casse', () => {
    expect(findTeacherFor('Doha KARMOUCHI', teachers)?.id).toBe('t1')
    expect(findTeacherFor('Prof. doha karmouchi', teachers)?.id).toBe('t1')
  })

  it('ne devine pas une saisie libre', () => {
    expect(findTeacherFor('Administration', teachers)).toBeUndefined()
    expect(findTeacherFor('', teachers)).toBeUndefined()
  })
})

describe('availableBridges', () => {
  it('propose uniquement les ponts qui ont un sens', () => {
    expect(availableBridges({ type: 'Notes', enseignant: 'Doha KARMOUCHI' }, 'CE2-B', groups, teachers)).toEqual(['action_classe', 'suivi_prof', 'rdv'])
    expect(availableBridges({ type: 'Hygiène / Locaux', enseignant: '' }, 'GS-A', groups, teachers)).toEqual(['incident', 'rdv'])
    expect(availableBridges({ type: 'Cantine', enseignant: 'Personnel cantine' }, 'CE2-B', groups, teachers)).toEqual(['action_classe', 'rdv'])
  })
})
