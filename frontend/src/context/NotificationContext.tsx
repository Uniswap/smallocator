import { createContext, useContext, ReactNode } from 'react'

interface NotificationContextType {
  showNotification: (notification: {
    type: 'success' | 'error' | 'warning' | 'info'
    title: string
    message: string
  }) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const showNotification = (notification: {
    type: 'success' | 'error' | 'warning' | 'info'
    title: string
    message: string
  }) => {
    // For now, just console.log the notification
    // You can implement a proper notification system later
    console.log('Notification:', notification)
  }

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotification() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider')
  }
  return context
}
