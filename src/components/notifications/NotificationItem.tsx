
"use client";

import React from 'react';
import type { AdminNotification } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';

interface NotificationItemProps {
  notification: AdminNotification;
  // onMarkAsRead: (notificationId: string) => void; // For future use
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification }) => {
  const timeAgo = notification.timestamp ? formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true }) : '';

  const getIcon = () => {
    switch (notification.type) {
      case 'requestCancelled':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'newCustomer':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'requestCreated':
        return <Info className="h-5 w-5 text-blue-500" />;
      case 'generic':
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  return (
    <div
      className={cn(
        "p-3 hover:bg-muted/50 border-b last:border-b-0",
        // !notification.isRead && "bg-primary/10" // Example for unread styling
      )}
      // onClick={() => onMarkAsRead(notification.notificationId)} // For future use
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
        <div className="flex-grow">
          <p className="text-sm text-foreground">{notification.message}</p>
          <p className="text-xs text-muted-foreground">{timeAgo}</p>
        </div>
        {/* {!notification.isRead && (
          <div className="h-2 w-2 rounded-full bg-primary self-center flex-shrink-0" title="Unread"></div>
        )} */}
      </div>
    </div>
  );
};

export default NotificationItem;
    
