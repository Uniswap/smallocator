import { createContext } from 'react';

interface NotificationContextType {
  showNotification: (notification: {
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    stage?: 'initiated' | 'submitted' | 'confirmed';
    txHash?: string;
    autoHide?: boolean;
  }) => void;
}

export const NotificationContext = createContext<
  NotificationContextType | undefined
>(undefined);
