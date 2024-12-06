import { createContext } from 'react';

interface NotificationContextType {
  showNotification: (notification: {
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }) => void;
}

export const NotificationContext = createContext<
  NotificationContextType | undefined
>(undefined);
