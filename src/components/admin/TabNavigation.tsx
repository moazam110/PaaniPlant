"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Truck, BarChart3, Users, UserCheck, Repeat, MoreVertical, LogOut, Moon, Sun, UserCog, Bell } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useTheme } from '@/contexts/ThemeContext';
import { API_BASE_URL } from '@/lib/api';

interface PriceNotification {
  _id: string;
  customerName: string;
  customerIntId?: number;
  data: { oldPrice: number; newPrice: number };
  isReadByAdmin: boolean;
  createdAt: string;
}

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
  onSignOut?: () => void;
}

const tabs = [
  { id: 'delivery', label: 'Delivery', icon: Truck },
  { id: 'recurring', label: 'Recurring', icon: Repeat },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'staff', label: 'Staff', icon: UserCheck },
];

export default function TabNavigation({ activeTab, onTabChange, children, onSignOut }: TabNavigationProps) {
  // Convert children to array
  const childrenArray = React.Children.toArray(children);
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  // Staff access dialog state
  const [showStaffDialog, setShowStaffDialog] = useState(false);
  const [staffEmail, setStaffEmail] = useState('staff@paani.com');
  const [staffPassword, setStaffPassword] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Notification state
  const [notifications, setNotifications] = useState<PriceNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const [notifPage, setNotifPage] = useState(1);
  const [notifHasMore, setNotifHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const wsRef = useRef<WebSocket | null>(null);

  const fetchNotifications = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      const res = await fetch(`${API_BASE_URL}/api/notifications/admin?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (page === 1) {
          setNotifications(data.notifications || []);
        } else {
          setNotifications(prev => [...prev, ...(data.notifications || [])]);
        }
        setUnreadCount(data.unreadCount || 0);
        setNotifHasMore(data.pagination?.hasMore || false);
        setNotifPage(page);
      }
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchNotifications(1);

    // WebSocket subscription for real-time price change events
    try {
      const ws = new WebSocket(API_BASE_URL.replace(/^http/, 'ws'));
      wsRef.current = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'subscribe', room: 'priceChange' }));
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'update') {
            fetchNotifications(1);
          }
        } catch { /* ignore */ }
      };
      ws.onerror = () => { /* non-critical */ };
    } catch { /* non-critical */ }

    return () => {
      wsRef.current?.close();
    };
  }, [fetchNotifications]);

  // Client-side filter: matches customerIntId (partial) or customerName (case-insensitive)
  const filteredNotifications = filterCustomerId.trim()
    ? notifications.filter((n: PriceNotification) => {
        const q = filterCustomerId.trim().toLowerCase();
        const idMatch = n.customerIntId !== undefined && String(n.customerIntId).includes(q);
        const nameMatch = n.customerName?.toLowerCase().includes(q);
        return idMatch || nameMatch;
      })
    : notifications;

  const handleLoadMore = async () => {
    if (isLoadingMore || !notifHasMore) return;
    setIsLoadingMore(true);
    await fetchNotifications(notifPage + 1);
    setIsLoadingMore(false);
  };

  const handleBellOpen = async (open: boolean) => {
    setBellOpen(open);
    if (open) {
      setFilterCustomerId('');
      fetchNotifications(1);
      if (unreadCount > 0) {
        try {
          await fetch(`${API_BASE_URL}/api/notifications/admin/read-all`, { method: 'PUT' });
          setUnreadCount(0);
          setNotifications((prev: PriceNotification[]) => prev.map((n: PriceNotification) => ({ ...n, isReadByAdmin: true })));
        } catch { /* non-critical */ }
      }
    }
  };

  const handleStaffAuthentication = () => {
    setIsAuthenticating(true);
    
    // Simulate authentication delay
    setTimeout(() => {
      if (staffEmail === 'staff@paani.com' && staffPassword === 'staffpaani@123') {
        // Store staff access for admin
        localStorage.setItem('admin_staff_access', JSON.stringify({
          grantedAt: new Date().toISOString(),
          sessionId: `admin_staff_${Date.now()}`
        }));
        
        // Close dialog and open staff dashboard
        setShowStaffDialog(false);
        setStaffPassword('');
        setIsAuthenticating(false);
        
        // Open staff dashboard
        window.open('/staff', '_blank');
      } else {
        // Invalid credentials
        alert('Invalid staff credentials. Please try again.');
        setIsAuthenticating(false);
        setStaffPassword('');
      }
    }, 500);
  };

  const handleTabClick = (tabId: string) => {
    if (tabId === 'staff') {
      // Check if admin has staff access, if not show dialog for credentials
      const staffAccess = localStorage.getItem('admin_staff_access');
      if (staffAccess) {
        // Admin already has staff access, open staff dashboard
        window.open('/staff', '_blank');
      } else {
        // Show staff credentials dialog
        setShowStaffDialog(true);
      }
      return;
    }
    onTabChange(tabId);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab Navigation */}
      <div className="border-b bg-background relative">
        <nav className="flex pr-20 md:pr-24">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center py-3 px-1 md:px-2",
                  "min-h-[60px]",
                  isActive
                    ? "text-primary border-b-2 border-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 md:h-5 md:w-5 mb-1" />
                <span className="text-[10px] md:text-xs font-medium">{tab.label}</span>
              </button>
            );
          })}
        </nav>
        {/* Notification Bell + 3 Dots Menu - Top Right - Mobile Responsive */}
        <div className="absolute top-0 right-0 h-full flex items-center gap-0.5 pr-1 md:pr-2 z-10">
          {/* Price Change Notification Bell */}
          <Popover open={bellOpen} onOpenChange={handleBellOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10 relative">
                <Bell className="h-4 w-4 md:h-5 md:w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="px-4 py-3 border-b">
                <span className="font-semibold text-sm">Price Change Notifications</span>
              </div>
              {/* Filter by Customer ID */}
              <div className="px-3 py-2 border-b">
                <Input
                  placeholder="Filter by ID or name..."
                  value={filterCustomerId}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterCustomerId(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="max-h-72 overflow-y-auto">
                {filteredNotifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No notifications</p>
                ) : (
                  <>
                    {filteredNotifications.map((n: PriceNotification) => (
                      <div
                        key={n._id}
                        className={cn(
                          'px-4 py-3 border-b last:border-b-0 text-sm',
                          !n.isReadByAdmin && 'bg-blue-50 dark:bg-blue-950/30'
                        )}
                      >
                        <div className="font-medium">
                          {n.customerName}{n.customerIntId ? ` (#${n.customerIntId})` : ''}
                        </div>
                        <div className="text-muted-foreground mt-0.5">
                          Price changed: <span className="line-through">Rs {n.data.oldPrice}</span> → <span className="text-primary font-medium">Rs {n.data.newPrice}</span> per can
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(n.createdAt).toLocaleString('en-PK', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </div>
                      </div>
                    ))}
                    {notifHasMore && (
                      <button
                        onClick={handleLoadMore}
                        disabled={isLoadingMore}
                        className="w-full py-2 text-xs text-primary hover:bg-muted/50 transition-colors disabled:opacity-50"
                      >
                        {isLoadingMore ? 'Loading...' : '↓ Load More'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10">
                <MoreVertical className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={toggleTheme}>
                {theme === 'dark' ? (
                  <>
                    <Sun className="mr-2 h-4 w-4" />
                    Light Mode
                  </>
                ) : (
                  <>
                    <Moon className="mr-2 h-4 w-4" />
                    Dark Mode
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/admin/customer-access')}>
                <UserCog className="mr-2 h-4 w-4" />
                Customer Access
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSignOut} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Show delivery content */}
        {activeTab === 'delivery' && childrenArray[0]}
        
        {/* Show recurring content (index 1) */}
        {activeTab === 'recurring' && childrenArray[1]}
        {/* Show stats content (index 2) */}
        {activeTab === 'stats' && childrenArray[2]}
        
        {/* Show customers content (index 3) */}
        {activeTab === 'customers' && childrenArray[3]}
        
        {/* Staff tab opens separately, no content */}
      </div>

      {/* Staff Access Dialog */}
      <Dialog open={showStaffDialog} onOpenChange={setShowStaffDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Staff Dashboard Access</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="staff-email">Staff Email</Label>
              <Input
                id="staff-email"
                type="email"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                placeholder=""
                disabled={isAuthenticating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-password">Staff Password</Label>
              <Input
                id="staff-password"
                type="password"
                value={staffPassword}
                onChange={(e) => setStaffPassword(e.target.value)}
                placeholder=""
                disabled={isAuthenticating}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isAuthenticating) {
                    handleStaffAuthentication();
                  }
                }}
              />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowStaffDialog(false);
                  setStaffPassword('');
                }}
                disabled={isAuthenticating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleStaffAuthentication}
                disabled={isAuthenticating || !staffPassword}
              >
                {isAuthenticating ? 'Authenticating...' : 'Access Staff Dashboard'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}