import MessageWhatsAppModal from './MessageWhatsAppModal'

interface PartagerRdvModalProps {
  message: string
  justCreated: boolean
  onClose: () => void
}

/** Message d'un rendez-vous parent à partager par WhatsApp — voir `MessageWhatsAppModal`. */
export default function PartagerRdvModal({ message, justCreated, onClose }: PartagerRdvModalProps) {
  return (
    <MessageWhatsAppModal
      message={message}
      onClose={onClose}
      label="Informations du rendez-vous"
      banner={justCreated ? 'Rendez-vous enregistré. Copiez le message ci-dessous pour le partager.' : undefined}
    />
  )
}
