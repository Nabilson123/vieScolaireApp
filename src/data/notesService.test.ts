import { describe, expect, it } from 'vitest'
import { canDraftType, canValidateType, nextNoteReference, requiresValidation, type NoteService } from './notesService'

function fakeNote(reference: string): NoteService {
  return {
    id: reference,
    reference,
    type: 'INFORMATION',
    audience: 'PARENTS',
    cibleType: 'etablissement',
    cibleNiveau: null,
    cibleClasse: null,
    cibleEleveIds: null,
    ciblePersonneIds: null,
    objet: '',
    corps: '',
    couponActif: false,
    couponType: null,
    couponDateLimite: null,
    signataireId: null,
    statut: 'BROUILLON',
    dateDiffusion: null,
    rectificatifDeId: null,
    historique: [],
    createdBy: null,
    createdAt: new Date().toISOString(),
  }
}

describe('nextNoteReference', () => {
  it('starts at 001 when there are no existing notes', () => {
    const year = new Date().getFullYear()
    expect(nextNoteReference([])).toBe(`VS-${year}-001`)
  })

  it('increments the max suffix for the current year', () => {
    const year = new Date().getFullYear()
    const existing = [fakeNote(`VS-${year}-001`), fakeNote(`VS-${year}-007`), fakeNote(`VS-${year}-003`)]
    expect(nextNoteReference(existing)).toBe(`VS-${year}-008`)
  })

  it('ignores references from other years', () => {
    const year = new Date().getFullYear()
    const existing = [fakeNote(`VS-${year - 1}-099`)]
    expect(nextNoteReference(existing)).toBe(`VS-${year}-001`)
  })
})

describe('requiresValidation', () => {
  it('is the only type that skips validation', () => {
    expect(requiresValidation('RAPPEL')).toBe(false)
    expect(requiresValidation('INFORMATION')).toBe(true)
    expect(requiresValidation('AVERTISSEMENT')).toBe(true)
    expect(requiresValidation('CONVOCATION')).toBe(true)
    expect(requiresValidation('ATTESTATION')).toBe(true)
  })
})

describe('canDraftType', () => {
  it('lets Direction and CPE draft every type', () => {
    for (const type of ['INFORMATION', 'RAPPEL', 'AVERTISSEMENT', 'CONVOCATION', 'ATTESTATION'] as const) {
      expect(canDraftType('Direction', type)).toBe(true)
      expect(canDraftType('CPE', type)).toBe(true)
    }
  })

  it('restricts AED to Rappel only', () => {
    expect(canDraftType('AED', 'RAPPEL')).toBe(true)
    expect(canDraftType('AED', 'INFORMATION')).toBe(false)
    expect(canDraftType('AED', 'AVERTISSEMENT')).toBe(false)
  })

  it('restricts Secrétariat to Attestation only', () => {
    expect(canDraftType('Secrétariat', 'ATTESTATION')).toBe(true)
    expect(canDraftType('Secrétariat', 'RAPPEL')).toBe(false)
  })

  it('gives Surveillant and Autre no drafting rights', () => {
    expect(canDraftType('Surveillant', 'RAPPEL')).toBe(false)
    expect(canDraftType('Autre', 'INFORMATION')).toBe(false)
  })
})

describe('canValidateType', () => {
  it('lets Direction validate every type', () => {
    for (const type of ['INFORMATION', 'RAPPEL', 'AVERTISSEMENT', 'CONVOCATION', 'ATTESTATION'] as const) {
      expect(canValidateType('Direction', type)).toBe(true)
    }
  })

  it('restricts CPE to Information and Rappel', () => {
    expect(canValidateType('CPE', 'INFORMATION')).toBe(true)
    expect(canValidateType('CPE', 'RAPPEL')).toBe(true)
    expect(canValidateType('CPE', 'AVERTISSEMENT')).toBe(false)
    expect(canValidateType('CPE', 'CONVOCATION')).toBe(false)
  })

  it('restricts Secrétariat to Attestation only', () => {
    expect(canValidateType('Secrétariat', 'ATTESTATION')).toBe(true)
    expect(canValidateType('Secrétariat', 'INFORMATION')).toBe(false)
  })

  it('gives AED no validation rights', () => {
    expect(canValidateType('AED', 'RAPPEL')).toBe(false)
  })
})
