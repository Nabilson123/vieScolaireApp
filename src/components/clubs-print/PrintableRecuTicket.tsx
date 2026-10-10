import { useLayoutEffect, useRef, useState } from 'react'
import { MODE_REGLEMENT_LABELS } from '../../data/clubs'
import { useAssociationIdentity } from '../../services/schoolIdentityService'
import type { DonneesRecu } from '../../utils/clubsContexte'
import { formatDH, libelleEcheance } from '../../utils/clubsFinance'
import { dateCourte } from './clubsPrintKit'

const PX_PAR_MM = 96 / 25.4
/** Rouleau de 80 mm (EPSON TM-T20II) : 72 mm sont réellement imprimés, le reste est la marge que l'imprimante ne sait pas couvrir. */
const PAPIER_MM = 80
const MARGE_MM = 4
const POLICE_PX = 12
/** Blanc sous le dernier trait, pour que la coupe du rouleau ne morde pas sur le texte. */
const BAS_MM = 8

const capitaliser = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

function Trait({ plein = false }: { plein?: boolean }) {
  return <div style={{ borderTop: `${plein ? 2 : 1}px ${plein ? 'solid' : 'dashed'} #000`, margin: '5px 0' }} />
}

function Ligne({ gauche, droite, gras = false }: { gauche: string; droite: string; gras?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontWeight: gras ? 800 : 400 }}>
      <span style={{ minWidth: 0 }}>{gauche}</span>
      <span style={{ whiteSpace: 'nowrap' }}>{droite}</span>
    </div>
  )
}

/**
 * Reçu de paiement des clubs pour imprimante thermique à rouleau de 80 mm : noir et blanc, une seule colonne de 72 mm, sans
 * fond ni couleur. La hauteur de la page d'impression est ajustée au contenu pour que le rouleau ne soit ni gaspillé ni coupé.
 */
export default function PrintableRecuTicket({ recu }: { recu: DonneesRecu }) {
  const { reglement: r } = recu
  const annule = r.statut === 'annule'
  const association = useAssociationIdentity()

  const ref = useRef<HTMLDivElement>(null)
  const [hauteurMm, setHauteurMm] = useState(200)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const mesurer = () => setHauteurMm(Math.ceil(el.getBoundingClientRect().height / PX_PAR_MM) + 2)
    mesurer()
    const observateur = new ResizeObserver(mesurer)
    observateur.observe(el)
    return () => observateur.disconnect()
  }, [recu])

  // Une mensualité supprimée après l'annulation du règlement n'a plus de ligne : on garde le total cohérent.
  const ecart = r.montantCentimes - recu.lignes.reduce((n, l) => n + l.montantCentimes, 0)
  const parEleve = new Map<string, { classe: string; lignes: typeof recu.lignes }>()
  for (const l of recu.lignes) {
    const e = parEleve.get(l.studentNom) ?? { classe: l.classe, lignes: [] }
    e.lignes.push(l)
    parEleve.set(l.studentNom, e)
  }

  return (
    <>
      <style>{`@media print { @page { size: ${PAPIER_MM}mm ${hauteurMm}mm; margin: 0; } .print-ticket { box-shadow: none !important; } }`}</style>
      <div
        ref={ref}
        className="print-ticket"
        style={{
          width: `${PAPIER_MM}mm`,
          boxSizing: 'border-box',
          padding: `3mm ${MARGE_MM}mm ${BAS_MM}mm`,
          background: '#fff',
          color: '#000',
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontSize: POLICE_PX,
          lineHeight: 1.3,
          boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
        }}
      >
        {association.logo && (
          // Une imprimante thermique ne rend que du noir et du blanc : un jaune ou un gris clair ne sortirait qu'en points épars.
          // Le logo est donc passé en noir et blanc pur (gris, assombri, puis seuil) : toute couleur devient pleine, le fond reste blanc.
          <img src={association.logo} alt="Logo" style={{ display: 'block', margin: '0 auto 4px', maxHeight: '20mm', maxWidth: '44mm', objectFit: 'contain', filter: 'grayscale(1) brightness(0.62) contrast(100)' }} />
        )}
        <p style={{ textAlign: 'center', fontSize: POLICE_PX + 2, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1.15 }}>{association.nom}</p>
        <Trait />
        <p style={{ textAlign: 'center', fontWeight: 700 }}>Reçu de paiement — Clubs</p>
        <p style={{ textAlign: 'center', fontSize: POLICE_PX + 5, fontWeight: 800, letterSpacing: '0.02em' }}>{r.numero}</p>

        {annule && (
          <div style={{ border: '2px solid #000', padding: '3px 4px', margin: '5px 0', textAlign: 'center', fontWeight: 800 }}>
            REÇU ANNULÉ{r.annuleLe ? ` le ${dateCourte(r.annuleLe.slice(0, 10))}` : ''}
            {r.motifAnnulation && <div style={{ fontWeight: 400, fontSize: POLICE_PX - 1 }}>Motif : {r.motifAnnulation}</div>}
            <div style={{ fontWeight: 400, fontSize: POLICE_PX - 1 }}>Ce reçu n'a plus de valeur.</div>
          </div>
        )}

        <Trait />
        <Ligne gauche="Date" droite={dateCourte(r.dateReglement)} />
        <Ligne gauche="Paiement" droite={MODE_REGLEMENT_LABELS[r.mode]} />
        {r.reference && <p style={{ textAlign: 'right', fontSize: POLICE_PX - 1 }}>{r.reference}</p>}
        <p style={{ marginTop: 3 }}>Famille</p>
        <p style={{ fontWeight: 800 }}>{r.familleLibelle}</p>

        <Trait />
        <p style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: POLICE_PX - 1 }}>
          Détail ({recu.lignes.length} mensualité{recu.lignes.length !== 1 ? 's' : ''})
        </p>
        {[...parEleve.entries()].map(([nom, e]) => (
          <div key={nom} style={{ marginTop: 4, textDecoration: annule ? 'line-through' : undefined }}>
            <p style={{ fontWeight: 700 }}>
              {nom}
              {e.classe ? ` (${e.classe})` : ''}
            </p>
            {e.lignes.map((l, i) => (
              <Ligne key={i} gauche={`${l.clubNom} · ${libelleEcheance(l)}`} droite={formatDH(l.montantCentimes)} />
            ))}
          </div>
        ))}
        {annule && ecart > 0 && (
          <div style={{ marginTop: 4, textDecoration: 'line-through', fontStyle: 'italic' }}>
            <Ligne gauche="Mensualité(s) supprimée(s) depuis" droite={formatDH(ecart)} />
          </div>
        )}

        <Trait plein />
        <Ligne gauche="TOTAL" droite={formatDH(r.montantCentimes)} gras />
        <p style={{ marginTop: 4, fontSize: POLICE_PX - 1 }}>Arrêté le présent reçu à la somme de</p>
        <p style={{ fontWeight: 700 }}>{capitaliser(recu.enLettres)}</p>

        {!annule && (
          <>
            <Trait />
            <p style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: POLICE_PX - 1 }}>Solde restant après ce règlement</p>
            {recu.soldeParClub.length === 0 ? (
              <p>Aucune autre mensualité.</p>
            ) : (
              recu.soldeParClub.map((s) => (
                <div key={s.clubNom} style={{ marginTop: 3 }}>
                  <p style={{ fontWeight: 700 }}>{s.clubNom}</p>
                  <Ligne gauche="Reste dû à ce jour" droite={formatDH(s.resteEchuCentimes)} />
                  <Ligne gauche="Mois à venir" droite={formatDH(s.resteAVenirCentimes)} />
                </div>
              ))
            )}
            <Trait plein />
            <Ligne gauche="DÛ À CE JOUR" droite={formatDH(recu.resteEchuTotalCentimes)} gras />
            <Ligne gauche="Mois à venir" droite={formatDH(recu.resteAVenirTotalCentimes)} />
          </>
        )}

        <Trait />
        <p style={{ textAlign: 'center', fontSize: POLICE_PX - 1 }}>Reçu à conserver.</p>
        <p style={{ textAlign: 'center', fontSize: POLICE_PX - 2 }}>Édité le {new Date().toLocaleDateString('fr-FR')}</p>
      </div>
    </>
  )
}
