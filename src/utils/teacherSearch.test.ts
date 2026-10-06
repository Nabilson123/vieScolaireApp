import { describe, expect, it } from 'vitest'
import type { Teacher } from '../data/teachers'
import { searchTeachers } from './teacherSearch'

const t = (id: string, prenom: string, nom: string, matieres: string[] = []): Teacher => ({ id, prenom, nom, matieres, niveaux: [], classes: [] }) as unknown as Teacher

const teachers = [
  t('1', 'Saida', 'AMGHAR', ['Mathématiques']),
  t('2', 'Abdelaziz', 'AMEUR', ['Physique-Chimie']),
  t('3', 'Hafsa', 'IDLAHCEN', ['Français', 'Arabe']),
  t('4', 'Nadia', 'ADNINE', ['Histoire-Géographie']),
  t('5', 'Zineb', 'SAIDI', []),
]

describe('searchTeachers', () => {
  it('sans saisie : tous les enseignants par ordre alphabétique du prénom', () => {
    expect(searchTeachers(teachers, '').map((x) => x.id)).toEqual(['2', '3', '4', '1', '5'])
  })

  it('cherche dans le nom, sans tenir compte des accents ni de la casse', () => {
    expect(searchTeachers(teachers, 'idlahcen').map((x) => x.id)).toEqual(['3'])
    expect(searchTeachers(teachers, 'AMEUR abdel').map((x) => x.id)).toEqual(['2'])
  })

  it('cherche aussi dans les matières', () => {
    expect(searchTeachers(teachers, 'mathematiques').map((x) => x.id)).toEqual(['1'])
    expect(searchTeachers(teachers, 'arabe').map((x) => x.id)).toEqual(['3'])
    expect(searchTeachers(teachers, 'hafsa francais').map((x) => x.id)).toEqual(['3'])
  })

  it('les noms dont un mot commence par la saisie passent avant les simples inclusions', () => {
    // « said » commence « Saida » comme « SAIDI » : les deux passent d'abord, par ordre alphabétique.
    expect(searchTeachers(teachers, 'said').map((x) => x.id)).toEqual(['1', '5'])
    // « ama » commence « Amal » mais n'est qu'au milieu de « KAMAL » : Amal passe d'abord.
    const list = [t('a', 'Nada', 'KAMAL'), t('b', 'Amal', 'ZIANI')]
    expect(searchTeachers(list, 'ama').map((x) => x.id)).toEqual(['b', 'a'])
  })

  it('aucun résultat et plafond', () => {
    expect(searchTeachers(teachers, 'zzz')).toEqual([])
    expect(searchTeachers(teachers, '', { limit: 2 })).toHaveLength(2)
  })
})
