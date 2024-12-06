import { ReactNode } from 'react';
import { NotificationContext } from './notification-context';

export function NotificationProvider({ children }: { children: ReactNode }) {
  const showNotification = (notification: {
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }) => {
    // For now, just console.log the notification
    // You can implement a proper notification system later
    console.log('Notification:', notification);
  };

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}
