import SchoolLogo from '../print/SchoolLogo'
import { useSchoolIdentity } from '../../services/schoolIdentityService'
import type { Student } from '../../data/students'
import type { StudentIdentity } from '../../data/studentIdentity'

interface PrintableSortieAnticipeeProps {
  student: Student
  identity: StudentIdentity
  date: string
  heure: string
  recuperePar: string
  lienParente: string
  motif: string
  verifIdentite: boolean
  verifAccordResponsable: boolean
  verifSurListe: boolean
  reference: string
}

const INK = 'oklch(0.24 0.01 260)'
/** Assombri depuis 0.55 (trop clair à l'impression physique, texte qui « ressort mal ») — reste
 * nettement plus léger que INK pour garder la hiérarchie visuelle, mais lisible sur papier. */
const MUTED = 'oklch(0.46 0.01 260)'
/** Texte secondaire/arabe — même raison, consolidé depuis plusieurs nuances ad-hoc (0.45/0.5) trop
 * claires pour l'impression. */
const MUTED_AR = 'oklch(0.42 0.01 260)'
const BLUE = 'oklch(0.42 0.12 250)'
const BLUE_MARK = 'oklch(0.5 0.14 250)'

function todayFR(): string {
  return new Date().toLocaleDateString('fr-FR')
}

function dateLongue(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function dateCourte(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR')
}

/** `initiales()` n'est pas partagée dans ce codebase — dupliquée par fichier par convention
 * (ex. PrintableDechargeParentale.tsx). */
function initiales(prenom: string, nom: string): string {
  return `${prenom.trim().charAt(0)}${nom.trim().charAt(0)}`.toUpperCase()
}

function BilingualLabel({ fr, ar }: { fr: string; ar: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10.5px] font-extrabold" style={{ color: BLUE }}>
        {fr}
      </span>
      <span className="text-[10px]" style={{ color: MUTED_AR }}>
        {ar}
      </span>
    </div>
  )
}

export default function PrintableSortieAnticipee({
  student,
  identity,
  date,
  heure,
  recuperePar,
  lienParente,
  motif,
  verifIdentite,
  verifAccordResponsable,
  verifSurListe,
  reference,
}: PrintableSortieAnticipeeProps) {
  const { data: school } = useSchoolIdentity()
  const hasNomAr = identity.nomAr.trim() || identity.prenomAr.trim()
  const eleveAr = `${identity.prenomAr} ${identity.nomAr}`.trim()

  const champs: [string, string, string][] = [
    ['Récupéré par · استلمه', recuperePar || '—', lienParente || '—'],
    ['Motif · السبب', motif || '— non renseigné', ''],
    ['Autorisé par · بترخيص من', 'Direction de la Vie Scolaire', 'إدارة الحياة المدرسية'],
  ]

  const verifications = [
    { label: 'Identité vérifiée (CIN / pièce)', labelAr: 'التحقق من الهوية', ok: verifIdentite },
    { label: 'Personne inscrite sur la liste des habilités', labelAr: 'مدرج في لائحة المؤهلين', ok: verifSurListe },
    { label: 'Accord du responsable légal obtenu', labelAr: 'موافقة الولي', ok: verifAccordResponsable },
  ]

  const parents = [
    { label: 'Parent 1', nom: identity.parent1Nom, prenom: identity.parent1Prenom, tel: identity.parent1Tel },
    { label: 'Parent 2', nom: identity.parent2Nom, prenom: identity.parent2Prenom, tel: identity.parent2Tel },
  ].filter((p) => p.nom.trim() || p.prenom.trim())

  return (
    <div
      id="printable-sortie-anticipee"
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
          <p className="text-[12.5px] font-bold">Autorisation de Sortie Anticipée</p>
          <p dir="rtl" className="text-[11px]" style={{ color: MUTED_AR }}>
            رخصة الخروج المبكر
          </p>
          <p className="text-[10px]" style={{ color: MUTED }}>
            Édité le {todayFR()} · N° {reference}
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

        <div className="flex flex-col justify-center gap-1" style={{ width: 250, flexShrink: 0, background: 'oklch(0.96 0.03 70)', borderRadius: 12, padding: '10px 14px' }}>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[8px] font-extrabold uppercase" style={{ letterSpacing: '0.06em', color: 'oklch(0.5 0.13 60)' }}>
              Sortie autorisée
            </span>
            <span className="text-[9.5px]" style={{ color: MUTED }}>
              وقت الخروج
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[34px] font-extrabold leading-none" style={{ color: 'oklch(0.5 0.13 60)' }}>
              {heure}
            </span>
            <span className="text-[12px] font-bold" style={{ color: 'oklch(0.42 0.01 260)' }}>
              {dateCourte(date)}
            </span>
          </div>
          <div className="text-[10px]" style={{ color: MUTED_AR }}>
            {dateLongue(date)}
          </div>
        </div>
      </div>

      <div className="grid overflow-hidden rounded-[12px] border bg-white" style={{ gridTemplateColumns: 'repeat(3, 1fr)', borderColor: 'oklch(0.91 0.005 90)' }}>
        {champs.map(([label, valeur, sous], i) => (
          <div key={label} className="flex flex-col gap-0.5 px-3.5 py-2.5" style={{ borderRight: i < 2 ? '1px solid oklch(0.95 0.005 90)' : 'none' }}>
            <div className="text-[8px] uppercase" style={{ letterSpacing: '0.05em', color: MUTED }}>
              {label}
            </div>
            <div className="text-[13px] font-extrabold">{valeur}</div>
            {sous && (
              <div className="text-[9.5px]" style={{ color: MUTED_AR }}>
                {sous}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5 rounded-[12px] border bg-white px-4 py-3" style={{ borderColor: 'oklch(0.91 0.005 90)' }}>
        <p className="text-[13px] leading-[1.6]">
          Je soussigné(e) <b>{recuperePar || '—'}</b>, {lienParente || '—'} de l'élève <b>{student.name}</b>, classe{' '}
          <b>{student.classe}</b>, certifie avoir récupéré l'enfant au sein de l'établissement le <b>{dateLongue(date)}</b> à{' '}
          <b>{heure}</b>, pour le motif suivant : <b>{motif || '—'}</b>. Je décharge l'établissement de toute responsabilité à
          compter de cette heure de sortie.
        </p>
        <p dir="rtl" className="text-[13px] leading-[1.9]" style={{ textAlign: 'right', color: 'oklch(0.35 0.01 260)' }}>
          أنا الموقع(ة) أدناه <b>{recuperePar || '—'}</b>، أشهد بأنني استلمت التلميذ(ة) <b>{eleveAr || student.name}</b>، القسم{' '}
          <b>{student.classe}</b>، من المؤسسة بتاريخ <b>{dateCourte(date)}</b> على الساعة <b>{heure}</b>، للسبب التالي:{' '}
          <b>{motif || '—'}</b>. وأعفي المؤسسة من كل مسؤولية بعد هذه الساعة.
        </p>
      </div>

      <div className="flex gap-2.5">
        <div className="flex-1 overflow-hidden rounded-[12px] border bg-white" style={{ borderColor: 'oklch(0.91 0.005 90)' }}>
          <BilingualLabel fr="Vérifications effectuées" ar="التحقق" />
          <div className="flex flex-col gap-1.5 px-3.5 pb-2.5 pt-1">
            {verifications.map((v) => (
              <div key={v.label} className="flex items-center gap-2.5">
                <span
                  className="flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-[4px] text-[9px] font-extrabold text-white"
                  style={{ border: `1.5px solid ${v.ok ? BLUE_MARK : 'oklch(0.8 0.01 260)'}`, background: v.ok ? BLUE_MARK : 'white' }}
                >
                  {v.ok ? '✓' : ''}
                </span>
                <span className="flex-1 text-[11px] font-bold">{v.label}</span>
                <span className="text-[11px]" style={{ color: MUTED_AR }}>
                  {v.labelAr}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col overflow-hidden rounded-[12px] border bg-white" style={{ width: 250, flexShrink: 0, borderColor: 'oklch(0.91 0.005 90)' }}>
          <div className="flex items-baseline gap-2" style={{ padding: '7px 14px', background: 'oklch(0.96 0.02 165)' }}>
            <span className="text-[10.5px] font-extrabold" style={{ color: 'oklch(0.45 0.13 160)' }}>
              Contacts parents
            </span>
            <span className="text-[10px]" style={{ color: MUTED_AR }}>
              هاتف الوالدين
            </span>
          </div>
          <div className="flex flex-col gap-1.5 px-3 py-2">
            {parents.length === 0 ? (
              <p className="text-[9.5px] italic" style={{ color: MUTED }}>
                Aucun contact parent renseigné.
              </p>
            ) : (
              parents.map((p) => (
                <div key={p.label} className="flex items-center gap-2 rounded-[9px] px-2.5 py-1.5" style={{ background: 'oklch(0.985 0.003 90)' }}>
                  <span
                    className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold"
                    style={{ background: 'oklch(0.95 0.015 250)', color: BLUE }}
                  >
                    {initiales(p.prenom, p.nom)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11.5px] font-bold">
                      {p.prenom} {p.nom}
                    </div>
                    <div className="text-[10.5px]" style={{ color: MUTED_AR }}>
                      {p.tel}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1 rounded-[12px] border px-4 py-2.5" style={{ borderColor: 'oklch(0.93 0.005 90)', background: 'oklch(0.985 0.003 90)' }}>
        <div className="text-[9px] font-extrabold uppercase" style={{ letterSpacing: '0.06em', color: MUTED }}>
          Rappel réglementaire · تذكير تنظيمي
        </div>
        <div className="text-[9.5px] leading-[1.5]" style={{ color: 'oklch(0.42 0.01 260)' }}>
          Toute sortie anticipée doit être demandée par le responsable légal et validée par la
          Direction de la Vie Scolaire. Le surveillant vérifie l'identité de la personne qui
          récupère l'élève et sa présence sur la liste des personnes habilitées. Cette autorisation
          est conservée au dossier de l'élève.
        </div>
        <div dir="rtl" className="text-[10px] leading-[1.75]" style={{ textAlign: 'right', color: 'oklch(0.42 0.01 260)' }}>
          يجب أن يطلب الولي كل خروج مبكر وأن تصادق عليه إدارة الحياة المدرسية. يتحقق المراقب من هوية
          الشخص الذي يستلم التلميذ(ة) ومن وجوده في لائحة الأشخاص المؤهلين. تُحفظ هذه الرخصة في ملف
          التلميذ(ة).
        </div>
      </div>

      <div className="flex flex-col overflow-hidden rounded-[12px] border bg-white" style={{ flex: 1, minHeight: 0, borderColor: 'oklch(0.91 0.005 90)' }}>
        <div className="flex items-baseline gap-2" style={{ padding: '7px 14px', background: 'oklch(0.97 0.012 250)' }}>
          <span className="text-[10.5px] font-extrabold" style={{ color: BLUE }}>
            Observations du surveillant
          </span>
          <span className="text-[10px]" style={{ color: MUTED_AR }}>
            ملاحظات المراقب
          </span>
        </div>
        <div className="flex flex-1 flex-col" style={{ padding: '8px 14px 6px' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ flex: 1, minHeight: 26, borderBottom: '1px solid oklch(0.92 0.005 90)' }} />
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 text-[9px]" style={{ padding: '5px 14px 8px', color: MUTED }}>
          <span>
            Autorisation n° {reference} · enregistrée dans l'application le {dateCourte(date)} à {heure} · conservée au dossier
            de l'élève.
          </span>
          <span>{reference}</span>
        </div>
      </div>

      <div className="flex flex-col gap-[5px]">
        <div className="flex items-baseline gap-2">
          <span className="text-[9px] font-extrabold uppercase" style={{ letterSpacing: '0.08em', color: MUTED }}>
            Signatures
          </span>
          <span className="text-[9.5px]" style={{ color: MUTED }}>
            التوقيعات
          </span>
        </div>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {[
            { role: 'Signature de la personne qui récupère l’élève', roleAr: 'توقيع المستلم', nom: recuperePar || '—' },
            { role: "Signature du surveillant / de l'administration", roleAr: 'توقيع المراقب / الإدارة', nom: 'Direction de la Vie Scolaire' },
          ].map((sg) => (
            <div key={sg.role} className="flex flex-col gap-1 rounded-[10px] border bg-white px-3.5 pb-2.5 pt-2" style={{ borderColor: 'oklch(0.91 0.005 90)' }}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10.5px] font-bold">{sg.role}</span>
                <span className="text-[10.5px]" style={{ color: MUTED }}>
                  {sg.roleAr}
                </span>
              </div>
              <div className="text-[9px]" style={{ color: 'oklch(0.4 0.01 260)' }}>
                {sg.nom}
              </div>
              <div style={{ height: 62, borderBottom: '1px solid oklch(0.86 0.005 90)' }} />
              <div className="text-[8px]" style={{ color: MUTED }}>
                Signature · Date
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className="flex justify-center gap-2.5 border-t pt-1.5 text-center text-[8.5px] font-semibold uppercase"
        style={{ borderColor: 'oklch(0.9 0.005 90)', letterSpacing: '0.08em', color: MUTED }}
      >
        <span>Direction de la Vie Scolaire</span>
        <span className="normal-case" style={{ letterSpacing: 0 }}>
          إدارة الحياة المدرسية
        </span>
      </div>
    </div>
  )
}
