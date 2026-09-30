import type { CSSProperties } from 'react'
import SchoolLogo from '../../print/SchoolLogo'
import type { Student } from '../../../data/students'
import { TRANSPORT_PARENTS, type StudentIdentity } from '../../../data/studentIdentity'
import type { CantineInfo } from '../../../data/studentDetails'
import { calculateAge } from '../../../utils/identityHelpers'
import { computeAssiduiteBadge } from '../../../utils/studentAggregation'
import { INK, MUTED, PAGE_BG, INDIGO, TEAL, RED, PAGE_FONT } from '../../print/reportTheme'
import PaginatedPrintDocument, { type PaginatedBlock } from '../../print/PaginatedPrintDocument'

interface PrintableIdentityProps {
  student: Student
  identity: StudentIdentity
  cantine: CantineInfo
}

const CARD: CSSProperties = { background: '#FFFFFF', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }
const PADDING_X = 46
const PADDING_Y = 36
const GAP = 16

function ligneLabel(ligne: string | null): string {
  return ligne === TRANSPORT_PARENTS ? 'Parents' : ligne ?? ''
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[105px_1fr] text-[10.5px]">
      <div style={{ color: MUTED }}>{label}</div>
      <div className="font-semibold">{value || '—'}</div>
    </div>
  )
}

function todayFR() {
  return new Date().toLocaleDateString('fr-FR')
}

export default function PrintableIdentity({ student, identity, cantine }: PrintableIdentityProps) {
  const age = calculateAge(identity.dateNaissance)
  const nom = identity.nom || student.name.split(' ').slice(1).join(' ')
  const prenom = identity.prenom || student.name.split(' ')[0]
  const badge = computeAssiduiteBadge(student.taux)

  const blocks: PaginatedBlock[] = [
    {
      key: 'banner',
      node: (
        <div className="flex items-center gap-4 rounded-2xl p-3.5" style={{ background: 'linear-gradient(135deg, #EDEBFB, #EAF6F4)' }}>
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-[3px] border-white text-[20px] font-bold"
            style={{ background: PAGE_BG, color: INDIGO, boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}
          >
            {initials(student.name)}
          </div>
          <div className="flex-1">
            <p className="text-[16px] font-bold">{student.name}</p>
            <p className="text-[11px]" style={{ color: '#5C5E63' }}>
              Classe {student.classe}
              {age !== null ? ` · ${age} ans` : ''}
            </p>
          </div>
          <div className="rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold" style={{ color: badge.color }}>
            {badge.label}
          </div>
        </div>
      ),
    },
    {
      key: 'identite-scolarite-cantine',
      node: (
        <div className="grid grid-cols-2 gap-3.5">
          <div className="p-3.5" style={CARD}>
            <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.05em]" style={{ color: INDIGO }}>
              🪪 Identité
            </p>
            <div className="flex flex-col gap-1.5">
              <FieldRow label="Nom" value={nom} />
              <FieldRow label="Prénom" value={prenom} />
              <FieldRow label="Genre" value={student.sexe === 'F' ? 'Fille' : 'Garçon'} />
              <FieldRow
                label="Date de naissance"
                value={identity.dateNaissance ? `${identity.dateNaissance}${age !== null ? ` (${age} ans)` : ''}` : ''}
              />
              <FieldRow label="Lieu de naissance" value={identity.lieuNaissance} />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="p-3.5" style={CARD}>
              <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.05em]" style={{ color: INDIGO }}>
                🏫 Scolarité
              </p>
              <div className="flex flex-col gap-1.5">
                <FieldRow label="Classe" value={student.classe} />
                <FieldRow label="Code Massar" value={identity.codeMassar} />
                <FieldRow label="Date d'entrée" value={identity.dateEntree} />
              </div>
            </div>
            <div className="p-3.5" style={CARD}>
              <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.05em]" style={{ color: TEAL }}>
                🍽️ Cantine &amp; Transport
              </p>
              <div className="mb-2.5 flex gap-2.5">
                <div className="flex-1 rounded-[10px] p-2 text-center" style={{ background: '#EAF6F4' }}>
                  <div className="text-[9px]" style={{ color: '#6E7075' }}>
                    Cantine
                  </div>
                  <div className="text-[12px] font-bold" style={{ color: TEAL }}>
                    {identity.cantine ? 'Oui' : 'Non'}
                  </div>
                </div>
                <div className="flex-1 rounded-[10px] p-2 text-center" style={{ background: '#EAF6F4' }}>
                  <div className="text-[9px]" style={{ color: '#6E7075' }}>
                    Transport
                  </div>
                  <div className="text-[12px] font-bold" style={{ color: TEAL }}>
                    {identity.transport ? 'Oui' : 'Non'}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="rounded-lg p-1.5 text-center" style={{ background: '#F7F6F5' }}>
                  <div className="text-[8px]" style={{ color: MUTED }}>
                    Garde matin
                  </div>
                  <div className="text-[10.5px] font-bold">{identity.gardeMatin ? 'Oui' : 'Non'}</div>
                </div>
                <div className="rounded-lg p-1.5 text-center" style={{ background: '#F7F6F5' }}>
                  <div className="text-[8px]" style={{ color: MUTED }}>
                    Garde midi
                  </div>
                  <div className="text-[10.5px] font-bold">{identity.gardeMidi ? 'Oui' : 'Non'}</div>
                </div>
                <div className="rounded-lg p-1.5 text-center" style={{ background: '#F7F6F5' }}>
                  <div className="text-[8px]" style={{ color: MUTED }}>
                    Garde après-midi
                  </div>
                  <div className="text-[10.5px] font-bold">{identity.gardeApresMidi ? 'Oui' : 'Non'}</div>
                </div>
              </div>
              {identity.transport && (identity.transportLigne || identity.transportSortie17h) && (
                <div className="mt-2 flex flex-col gap-1 border-t pt-1.5 text-[9.5px]" style={{ borderColor: '#EBEAE9', color: MUTED }}>
                  {identity.transportLigne && (
                    <div>
                      Ligne matin : <strong style={{ color: INK }}>{ligneLabel(identity.transportLigne)}</strong>
                      {' · '}Ligne soir :{' '}
                      <strong style={{ color: INK }}>
                        {identity.transportLigneSoir ? ligneLabel(identity.transportLigneSoir) : `= matin (${ligneLabel(identity.transportLigne)})`}
                      </strong>
                    </div>
                  )}
                  {identity.transportSortie17h && (
                    <div>
                      Sortie 17h — Motif :{' '}
                      <strong style={{ color: INK }}>
                        {identity.transportMotifException === 'Autre'
                          ? identity.transportMotifAutre || 'Autre'
                          : identity.transportMotifException || '—'}
                      </strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'contacts',
      node: (
        <div>
          <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.05em]" style={{ color: '#6E7075' }}>
            👨‍👩‍👧 Contacts Parents
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { name: [identity.parent1Nom, identity.parent1Prenom].filter(Boolean).join(' ') || '—', phone: identity.parent1Tel || '—' },
              { name: [identity.parent2Nom, identity.parent2Prenom].filter(Boolean).join(' ') || '—', phone: identity.parent2Tel || '—' },
            ].map((p, idx) => (
              <div key={idx} className="flex items-center gap-2.5 p-2.5" style={CARD}>
                <div className="h-[34px] w-[34px] shrink-0 rounded-full" style={{ background: '#EDEBFB' }} />
                <div>
                  <p className="text-[11.5px] font-bold">{p.name}</p>
                  <p className="text-[10px]" style={{ color: '#6E7075' }}>
                    {p.phone}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: 'decharge-responsables',
      node: (
        <div className="grid grid-cols-2 gap-3.5">
          <div className="p-3" style={CARD}>
            <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.05em]" style={{ color: RED }}>
              🔒 Décharge &amp; Sortie
            </p>
            <div className="flex flex-col gap-1 text-[10.5px]">
              <div>
                <span style={{ color: MUTED }}>Décharge signée : </span>
                <strong style={{ color: cantine.dechargeSignee ? '#1F9D6B' : RED }}>{cantine.dechargeSignee ? 'Oui' : 'Non'}</strong>
              </div>
              <div>
                <span style={{ color: MUTED }}>Sortie : </span>
                <strong>{cantine.modaliteSortie || '—'}</strong>
              </div>
            </div>
          </div>
          {cantine.responsables.length === 0 ? (
            <div
              className="flex items-center justify-center rounded-[14px] border-[1.5px] border-dashed p-3 text-center text-[10px]"
              style={{ background: '#F7F6F5', borderColor: '#D9D6D3', color: MUTED }}
            >
              Aucun responsable ajouté
            </div>
          ) : (
            <div className="p-3" style={CARD}>
              <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.05em]" style={{ color: '#6E7075' }}>
                Responsables habilités
              </p>
              <div className="flex flex-col gap-1">
                {cantine.responsables.map((r, idx) => (
                  <p key={idx} className="text-[10px]">
                    <span className="font-semibold">{r.name}</span>{' '}
                    <span style={{ color: MUTED }}>
                      ({r.relation}) — {r.phone}
                    </span>
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    },
  ]

  return (
    <PaginatedPrintDocument
      blocks={blocks}
      paddingXPx={PADDING_X}
      paddingYPx={PADDING_Y}
      gapPx={GAP}
      pageStyle={{ background: PAGE_BG, color: INK, fontFamily: PAGE_FONT }}
      renderHeader={(pageIndex) => (
        <header className="relative flex items-start justify-between border-b-2 pb-3" style={{ borderColor: INK }}>
          <div className="flex flex-col gap-0.5">
            <p className="text-[19px] font-bold tracking-tight">Groupe Scolaire Mondrian</p>
            <p className="text-[10px] uppercase tracking-[0.08em]" style={{ color: MUTED }}>
              École de la Bienveillance
            </p>
          </div>
          <div className="flex flex-col items-end gap-0.5 text-right">
            <p className="text-[12.5px] font-bold">
              Fiche d'Identité de l'Élève{pageIndex > 0 ? ' — suite' : ''}
            </p>
            <p className="text-[10px]" style={{ color: MUTED }}>
              Édité le {todayFR()}
            </p>
          </div>
          {pageIndex === 0 && (
            <div className="absolute left-1/2 -top-[34px] -translate-x-1/2">
              <SchoolLogo size={78} />
            </div>
          )}
        </header>
      )}
      renderFooter={(pageIndex, pageCount) => (
        <>
          {pageIndex === pageCount - 1 && (
            <div className="flex justify-end">
              <div
                className="flex h-[100px] w-[100px] items-center justify-center rounded-full border-2 border-dashed text-center text-[8.5px] uppercase"
                style={{ borderColor: '#B0B2B6', color: '#94969B' }}
              >
                Cachet de
                <br />
                l'établissement
              </div>
            </div>
          )}
          <div className="border-t pt-1.5 text-[8.5px]" style={{ borderColor: '#EBEAE9', color: '#A6A8AC' }}>
            <div className="flex justify-between">
              <span>Groupe Scolaire Mondrian — Fiche d'identité de l'élève</span>
              <span>
                Page {pageIndex + 1} / {pageCount}
              </span>
            </div>
            <div className="mt-0.5 font-semibold uppercase tracking-wide">Direction de la Vie Scolaire</div>
          </div>
        </>
      )}
    />
  )
}
