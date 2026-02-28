import { forwardRef, useImperativeHandle, useState } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

const ICONS = { success: CheckCircle, error: XCircle, info: Info }
const COLORS = {
  success: 'bg-cyber-green/10 border-cyber-green/30 text-cyber-green',
  error:   'bg-cyber-red/10   border-cyber-red/30   text-cyber-red',
  info:    'bg-cyber-accent/10 border-cyber-accent/30 text-cyber-accent',
}

const Notifications = forwardRef((_, ref) => {
  const [items, setItems] = useState([])

  useImperativeHandle(ref, () => ({
    add(msg, type = 'info', duration = 4500) {
      const id = Date.now()
      setItems(prev => [...prev, { id, msg, type }])
      setTimeout(() => setItems(prev => prev.filter(i => i.id !== id)), duration)
    },
  }))

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-80">
      {items.map(({ id, msg, type }) => {
        const Icon = ICONS[type]
        return (
          <div
            key={id}
            className={`flex items-start gap-3 p-3.5 rounded-xl border text-sm font-medium
                        shadow-xl backdrop-blur-sm animate-slideIn ${COLORS[type]}`}
          >
            <Icon size={16} className="mt-0.5 shrink-0" />
            <span className="flex-1 leading-snug">{msg}</span>
            <button
              onClick={() => setItems(prev => prev.filter(i => i.id !== id))}
              className="opacity-60 hover:opacity-100 transition-opacity shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
})

Notifications.displayName = 'Notifications'
export default Notifications
