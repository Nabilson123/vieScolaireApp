import SchoolLogo from '../print/SchoolLogo'
import { useSchoolIdentity } from '../../services/schoolIdentityService'
import type { Student } from '../../data/students'
import type { StudentIdentity } from '../../data/studentIdentity'
import type { CantineInfo } from '../../data/studentDetails'

interface PrintableDechargeParentaleProps {
  student: Student
  identity: StudentIdentity
  cantine: CantineInfo
}

const MODALITE_LABEL_AR: Record<string, string> = {
  'Sortie accompagnée': 'خروج مرفوق',
  "Sortie seul(e) (Accord signé)": 'خروج بمفرده (بموافقة موقعة)',
  'Maintien sur place (Interdiction)': 'البقاء في المؤسسة (ممنوع الخروج)',
  // Valeur historique antérieure au référentiel actuel à 3 options (CantineDechargeEditModal.tsx),
  // toujours présente sur des fiches existantes — traduite pour ne pas dégrader ces fiches-là.
  'Sortie libre': 'خروج حر',
}

/** Les 3 options réellement proposées aujourd'hui (CantineDechargeEditModal.tsx:11). Une fiche plus
 * ancienne peut porter une valeur hors de cette liste (ex. "Sortie libre") : dans ce cas elle est
 * ajoutée comme 4ᵉ case pour rester fidèle à ce qui est effectivement enregistré, sans jamais la
 * proposer comme un choix permanent qui n'existe plus dans l'app. */
const KNOWN_MODALITES = ['Sortie accompagnée', "Sortie seul(e) (Accord signé)", 'Maintien sur place (Interdiction)']

const RELATION_LABEL_AR: Record<string, string> = {
  Père: 'أب',
  Mère: 'أم',
  'Tuteur légal': 'الوصي القانوني',
  'Grand-parent': 'الجد/الجدة',
  Oncle: 'العم/الخال',
  Tante: 'العمة/الخالة',
  Autre: 'أخرى',
}

const INK = 'oklch(0.24 0.01 260)'
const MUTED = 'oklch(0.55 0.01 260)'
const BLUE = 'oklch(0.42 0.12 250)'
const BLUE_MARK = 'oklch(0.5 0.14 250)'
const BLUE_SOFT = 'oklch(0.97 0.015 250)'

function todayFR(): string {
  return new Date().toLocaleDateString('fr-FR')
}

/** Toujours en majuscules dans les fiches élèves de cette appli (ex. "Ahmed hatim MAAMOURI") — le
 * dernier segment est donc fiable pour dériver une désignation "Famille X" en l'absence d'un champ
 * nom de famille dédié dans le modèle. Même précédent que PrintableCompteRenduRdv.tsx. */
function familleDe(studentName: string): string {
  const tokens = studentName.trim().split(/\s+/)
  return `Famille ${tokens[tokens.length - 1] ?? studentName}`
}

/** `initials()` n'est pas partagée dans ce codebase — dupliquée localement par fichier par
 * convention (ex. PrintableIdentity.tsx:22). Ici : 1ʳᵉ lettre du prénom + 1ʳᵉ lettre du nom. */
function initiales(prenom: string, nom: string): string {
  return `${prenom.trim().charAt(0)}${nom.trim().charAt(0)}`.toUpperCase()
}

function BilingualLabel({ fr, ar }: { fr: string; ar: string }) {
  return (
    <div className="text-[8px] font-semibold uppercase" style={{ letterSpacing: '0.04em', color: MUTED }}>
      {fr}
      <span dir="rtl" className="ml-1.5 normal-case" style={{ fontWeight: 400 }}>
        — {ar}
      </span>
    </div>
  )
}

export default function PrintableDechargeParentale({ student, identity, cantine }: PrintableDechargeParentaleProps) {
  const { data: school } = useSchoolIdentity()
  const hasNomAr = identity.nomAr.trim() || identity.prenomAr.trim()
  const eleveAr = `${identity.prenomAr} ${identity.nomAr}`.trim()
  const signataireParent = familleDe(student.name)

  const parents = [
    { label: 'Parent 1', nom: identity.parent1Nom, prenom: identity.parent1Prenom, tel: identity.parent1Tel },
    { label: 'Parent 2', nom: identity.parent2Nom, prenom: identity.parent2Prenom, tel: identity.parent2Tel },
  ].filter((p) => p.nom.trim() || p.prenom.trim())

  const modalitesList = KNOWN_MODALITES.includes(cantine.modaliteSortie) ? KNOWN_MODALITES : [...KNOWN_MODALITES, cantine.modaliteSortie]

  const BLANK_ROWS = 2
  const responsableRows = [
    ...cantine.responsables.map((r) => ({ nom: r.name, lien: r.relation, tel: r.phone })),
    ...Array.from({ length: BLANK_ROWS }, () => ({ nom: '', lien: '', tel: '' })),
  ]

  return (
    <div
      id="printable-decharge-parentale"
      className="print-page flex flex-col gap-2.5"
      style={{ padding: '26px 40px 22px', background: 'oklch(0.99 0.003 90)', color: INK, fontFamily: 'Helvetica, Arial, sans-serif' }}
    >
      <header className="relative flex items-start justify-between border-b-2 pb-3" style={{ borderColor: INK }}>
        <div className="flex flex-col gap-0.5">
          <p className="text-[19px] font-bold leading-none" style={{ letterSpacing: '-0.01em' }}>
            {school?.nom ?? 'Groupe Scolaire Mondrian'}
          </p>
          {school?.nomAr && (
            <p dir="rtl" className="text-[11px]" style={{ color: MUTED }}>
              {school.nomAr}
            </p>
          )}
        </div>
        <div className="absolute" style={{ left: 357, top: -24, transform: 'translateX(-50%)' }}>
          <SchoolLogo size={72} />
        </div>
        <div className="flex flex-col gap-0.5 text-right">
          <p className="text-[12.5px] font-bold">Décharge Parentale & Mode de Sortie</p>
          <p dir="rtl" className="text-[11px]" style={{ color: 'oklch(0.45 0.01 260)' }}>
            تنازل الوالدين وطريقة الخروج
          </p>
          <p className="text-[10px]" style={{ color: MUTED }}>
            Édité le {todayFR()}
          </p>
        </div>
      </header>

      <div className="flex gap-2.5">
        <div className="flex flex-1 flex-col gap-1.5 rounded-[12px] px-3.5 py-2.5" style={{ background: 'oklch(0.96 0.02 250)' }}>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[8px] font-extrabold uppercase" style={{ letterSpacing: '0.06em', color: BLUE }}>
              Élève
            </span>
            <span className="text-[9.5px]" style={{ color: MUTED }}>
              التلميذ(ة)
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[20px] font-extrabold">{student.name}</span>
            <span className="rounded-full bg-white px-2.5 py-0.5 text-[11.5px] font-extrabold" style={{ color: BLUE }}>
              {student.classe}
            </span>
          </div>
          {hasNomAr && (
            <p dir="rtl" className="text-[13px]" style={{ color: 'oklch(0.4 0.01 260)' }}>
              {eleveAr}
            </p>
          )}
          <div className="mt-0.5 flex gap-2">
            <div className="flex-1 rounded-[9px] bg-white px-2.5 py-1.5">
              <div className="text-[8px] uppercase" style={{ letterSpacing: '0.05em', color: MUTED }}>
                Né(e) le <span dir="rtl">· تاريخ الازدياد</span>
              </div>
              <div className="text-[13px] font-extrabold">{identity.dateNaissance || '—'}</div>
            </div>
            <div className="flex-1 rounded-[9px] bg-white px-2.5 py-1.5">
              <div className="text-[8px] uppercase" style={{ letterSpacing: '0.05em', color: MUTED }}>
                Code Massar <span dir="rtl">· رمز مسار</span>
              </div>
              <div className="text-[13px] font-extrabold" style={{ letterSpacing: '0.02em' }}>
                {identity.codeMassar || '—'}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 rounded-[12px] border bg-white px-3.5 py-2.5" style={{ width: 290, flexShrink: 0, borderColor: 'oklch(0.91 0.005 90)' }}>
          <BilingualLabel fr="Parents / Responsables légaux" ar="الوالدان" />
          {parents.length === 0 ? (
            <p className="text-[9.5px] italic" style={{ color: MUTED }}>
              Aucun contact parent renseigné. — لا توجد معلومات عن الوالدين.
            </p>
          ) : (
            parents.map((p) => (
              <div key={p.label} className="flex items-center gap-2.5 rounded-[9px] px-2.5 py-1.5" style={{ background: 'oklch(0.985 0.003 90)' }}>
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10.5px] font-extrabold"
                  style={{ background: 'oklch(0.95 0.015 250)', color: BLUE }}
                >
                  {initiales(p.prenom, p.nom)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-bold">
                    {p.prenom} {p.nom}
                  </div>
                  <div className="text-[11px]" style={{ color: 'oklch(0.45 0.01 260)' }}>
                    {p.tel}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 rounded-[12px] border bg-white px-4 py-2.5" style={{ borderColor: 'oklch(0.91 0.005 90)' }}>
        <p className="text-[13px] leading-[1.55]" style={{ textAlign: 'justify' }}>
          Je soussigné(e), parent ou responsable légal de l'élève <b>{student.name}</b>, classe{' '}
          <b>{student.classe}</b>, né(e) le <b>{identity.dateNaissance || '—'}</b>, code Massar{' '}
          <b>{identity.codeMassar || '—'}</b>, autorise l'établissement à appliquer la modalité de
          sortie indiquée ci-dessous, ainsi que la remise de mon enfant aux personnes habilitées
          listées ci-dessous.
        </p>
        <p dir="rtl" className="text-[13px] leading-[1.8]" style={{ textAlign: 'right', color: 'oklch(0.35 0.01 260)' }}>
          أنا الموقع(ة) أدناه، ولي أمر التلميذ(ة) <b>{eleveAr || student.name}</b>، القسم{' '}
          <b>{student.classe}</b>، المزداد(ة) في <b>{identity.dateNaissance || '—'}</b>، رمز مسار{' '}
          <b>{identity.codeMassar || '—'}</b>، أفوض المؤسسة التعليمية بتطبيق طريقة الخروج المشار
          إليها أدناه، وتسليم ابني/ابنتي للأشخاص المؤهلين المذكورين أدناه.
        </p>
      </div>

      <div className="flex gap-2.5">
        <div className="flex-1 overflow-hidden rounded-[12px] border bg-white" style={{ borderColor: 'oklch(0.91 0.005 90)' }}>
          <div className="flex items-baseline gap-1.5 px-3.5 py-1.5" style={{ background: 'oklch(0.97 0.012 250)' }}>
            <span className="text-[10px] font-extrabold" style={{ color: BLUE }}>
              Modalité de sortie
            </span>
            <span className="text-[9.5px]" style={{ color: MUTED }}>
              طريقة الخروج
            </span>
          </div>
          <div className="flex flex-col gap-1.5 px-3.5 py-2.5">
            {modalitesList.map((m) => {
              const on = m === cantine.modaliteSortie
              return (
                <div
                  key={m}
                  className="flex items-center gap-2.5 rounded-[9px] px-2.5 py-1.5"
                  style={{ border: `1.3px solid ${on ? BLUE_MARK : 'oklch(0.93 0.005 90)'}`, background: on ? BLUE_SOFT : 'white' }}
                >
                  <span
                    className="flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-[4px] text-[9px] font-extrabold text-white"
                    style={{ border: `1.5px solid ${on ? BLUE_MARK : 'oklch(0.8 0.01 260)'}`, background: on ? BLUE_MARK : 'white' }}
                  >
                    {on ? '✓' : ''}
                  </span>
                  <span className="flex-1 text-[11px]" style={{ fontWeight: on ? 800 : 400, color: on ? 'oklch(0.35 0.12 250)' : MUTED }}>
                    {m}
                  </span>
                  <span className="text-[11px]" style={{ color: on ? 'oklch(0.35 0.12 250)' : MUTED }}>
                    {MODALITE_LABEL_AR[m] ?? ''}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col overflow-hidden rounded-[12px] border bg-white" style={{ width: 290, flexShrink: 0, borderColor: 'oklch(0.91 0.005 90)' }}>
          <div className="flex items-baseline gap-1.5 px-3.5 py-1.5" style={{ background: 'oklch(0.96 0.02 165)' }}>
            <span className="text-[10px] font-extrabold" style={{ color: 'oklch(0.45 0.13 160)' }}>
              Décharge signée
            </span>
            <span className="text-[9.5px]" style={{ color: MUTED }}>
              تم توقيع التنازل
            </span>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-1 p-2.5">
            <div className="text-[22px] font-extrabold leading-none" style={{ color: cantine.dechargeSignee ? 'oklch(0.5 0.15 160)' : 'oklch(0.55 0.19 25)' }}>
              {cantine.dechargeSignee ? 'OUI' : 'NON'}
            </div>
            <div className="text-[10px]" style={{ color: MUTED }}>
              {cantine.dechargeSignee ? `Signée le ${cantine.dechargeDate}` : 'En attente de signature'}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col overflow-hidden rounded-[12px] border bg-white" style={{ borderColor: 'oklch(0.91 0.005 90)' }}>
        <div className="flex items-baseline gap-2.5 px-4 py-2.5" style={{ background: 'oklch(0.96 0.02 250)' }}>
          <span className="text-[13px] font-extrabold" style={{ color: BLUE }}>
            Responsables habilités à récupérer l'élève
          </span>
          <span dir="rtl" className="text-[12px]" style={{ color: 'oklch(0.4 0.01 260)' }}>
            الأشخاص المؤهلون لاستلام التلميذ(ة)
          </span>
        </div>
        <div
          className="px-4 py-1.5 text-[9px] font-extrabold uppercase"
          style={{ display: 'grid', gridTemplateColumns: '38px 1fr 170px 170px', letterSpacing: '0.06em', color: 'oklch(0.42 0.01 260)', borderBottom: '1.3px solid oklch(0.9 0.005 90)' }}
        >
          <span>N°</span>
          <span>
            Nom <span dir="rtl">· الاسم</span>
          </span>
          <span>
            Lien de parenté <span dir="rtl">· صلة القرابة</span>
          </span>
          <span>
            Téléphone <span dir="rtl">· الهاتف</span>
          </span>
        </div>
        {responsableRows.map((r, i) => (
          <div
            key={i}
            className="px-4 pb-1"
            style={{
              display: 'grid',
              gridTemplateColumns: '38px 1fr 170px 170px',
              alignItems: 'end',
              height: 42,
              borderBottom: i < responsableRows.length - 1 ? '1px solid oklch(0.93 0.005 90)' : 'none',
            }}
          >
            <span className="text-[13px] font-extrabold" style={{ color: 'oklch(0.62 0.01 260)' }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="text-[12px] font-bold">{r.nom || ' '}</span>
            <span className="text-[12px]">
              {r.lien || ' '}
              {RELATION_LABEL_AR[r.lien] && (
                <span dir="rtl" className="ml-1.5" style={{ color: MUTED }}>
                  — {RELATION_LABEL_AR[r.lien]}
                </span>
              )}
            </span>
            <span className="text-[12px]">{r.tel || ' '}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 px-4 py-2 text-[9.5px] italic" style={{ color: MUTED }}>
          <span>Lignes à compléter à la main par les parents.</span>
          <span dir="rtl">أسطر يملؤها الوالدان بخط اليد.</span>
        </div>
      </div>

      <div className="flex flex-col gap-1 rounded-[12px] border px-4 py-2.5" style={{ borderColor: 'oklch(0.93 0.005 90)', background: 'oklch(0.985 0.003 90)' }}>
        <div className="text-[9px] font-extrabold uppercase" style={{ letterSpacing: '0.06em', color: MUTED }}>
          Rappel réglementaire · تذكير تنظيمي
        </div>
        <div className="text-[9.5px] leading-[1.5]" style={{ color: 'oklch(0.42 0.01 260)' }}>
          Cette décharge est valable pour l'année scolaire en cours. Toute modification de la
          modalité de sortie ou de la liste des personnes habilitées doit être signalée par écrit à
          la Direction de la Vie Scolaire. L'établissement décline toute responsabilité après la
          remise de l'élève à une personne figurant sur cette liste.
        </div>
        <div dir="rtl" className="text-[10px] leading-[1.7]" style={{ textAlign: 'right', color: 'oklch(0.42 0.01 260)' }}>
          هذا التنازل صالح للسنة الدراسية الجارية. يجب إبلاغ إدارة الحياة المدرسية كتابةً بأي تغيير
          في طريقة الخروج أو في لائحة الأشخاص المؤهلين. تُخلي المؤسسة مسؤوليتها بعد تسليم التلميذ(ة)
          لأحد الأشخاص المذكورين في هذه اللائحة.
        </div>
      </div>

      <div className="flex flex-col gap-[5px]" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div className="flex items-baseline gap-2">
          <span className="text-[9px] font-extrabold uppercase" style={{ letterSpacing: '0.08em', color: MUTED }}>
            Signatures
          </span>
          <span className="text-[9.5px]" style={{ color: MUTED }}>
            التوقيعات
          </span>
        </div>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(2, 1fr)', flex: 1, minHeight: 0 }}>
          {[
            { role: 'Signature du parent / responsable légal', roleAr: 'توقيع الولي', nom: signataireParent },
            { role: "Signature et cachet de l'établissement", roleAr: 'توقيع وخاتم المؤسسة', nom: 'Direction de la Vie Scolaire' },
          ].map((sg) => (
            <div key={sg.role} className="flex flex-col gap-1 rounded-[10px] border bg-white px-3.5 pb-2.5 pt-2" style={{ borderColor: 'oklch(0.91 0.005 90)' }}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10.5px] font-bold">{sg.role}</span>
                <span className="text-[10.5px]" style={{ color: MUTED }}>
                  {sg.roleAr}
                </span>
              </div>
              <div className="text-[9px]" style={{ color: 'oklch(0.6 0.01 260)' }}>
                {sg.nom}
              </div>
              <div style={{ flex: 1, minHeight: 34, borderBottom: '1px solid oklch(0.86 0.005 90)' }} />
              <div className="text-[8px]" style={{ color: 'oklch(0.62 0.01 260)' }}>
                Signature · Date
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className="flex justify-center gap-2.5 border-t pt-1.5 text-center text-[8.5px] font-semibold uppercase"
        style={{ borderColor: 'oklch(0.9 0.005 90)', letterSpacing: '0.08em', color: 'oklch(0.62 0.01 260)' }}
      >
        <span>Direction de la Vie Scolaire</span>
        <span className="normal-case" style={{ letterSpacing: 0 }}>
          إدارة الحياة المدرسية
        </span>
      </div>
    </div>
  )
}
