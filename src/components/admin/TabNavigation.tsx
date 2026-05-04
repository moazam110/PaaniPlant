"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Truck, BarChart3, Users, UserCheck, Repeat, MoreVertical, LogOut, Moon, Sun, UserCog, Bell, Wallet, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { format, startOfMonth, subMonths, addMonths } from 'date-fns';

interface PaymentNotif {
  _id: string;
  source: 'payment';
  type: 'payment_added' | 'payment_deleted';
  customerName: string;
  customerIntId?: number;
  amount: number;
  note: string;
  deleteReason?: string;
  isReadByAdmin: boolean;
  createdAt: string;
}

interface PriceNotif {
  _id: string;
  source: 'price';
  type: 'price_change';
  customerName: string;
  customerIntId?: number;
  data: { oldPrice: number; newPrice: number };
  isReadByAdmin: boolean;
  createdAt: string;
}

interface PaymentTypeNotif {
  _id: string;
  source: 'paymentType';
  type: 'payment_type_change';
  customerName: string;
  customerIntId?: number;
  data: { oldType: string; newType: string };
  isReadByAdmin: boolean;
  createdAt: string;
}

interface InfoUpdateNotif {
  _id: string;
  source: 'infoUpdate';
  type: 'info_update';
  customerName: string;
  customerIntId?: number;
  data: { changedFields: string[]; oldValues: Record<string, string | number>; newValues: Record<string, string | number> };
  isReadByAdmin: boolean;
  createdAt: string;
}

const INFO_FIELD_LABELS: Record<string, string> = { name: 'Name', phone: 'Phone', address: 'Address', defaultCans: 'Default Cans' };

type UnifiedNotif = PaymentNotif | PriceNotif | PaymentTypeNotif | InfoUpdateNotif;

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
  { id: 'payments', label: 'Payments', icon: Wallet },
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
  const [notifications, setNotifications] = useState<UnifiedNotif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'all' | 'payments' | 'price' | 'paymentType' | 'infoUpdate'>('all');
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [fullMonthFilter, setFullMonthFilter] = useState(false);
  const [fullMonthDate, setFullMonthDate] = useState<Date>(() => startOfMonth(subMonths(new Date(), 1)));
  const NOTIF_MONTH_MIN = new Date(2026, 3, 1); // April 2026
  const fullMonthFilterRef = useRef(fullMonthFilter);
  const fullMonthDateRef = useRef(fullMonthDate);
  fullMonthFilterRef.current = fullMonthFilter;
  fullMonthDateRef.current = fullMonthDate;
  const wsRef = useRef<WebSocket | null>(null);

  const fetchNotifications = useCallback(async (intId?: number, month?: string) => {
    try {
      const idParam = intId !== undefined ? `&customerIntId=${intId}` : '';
      const monthParam = month ? `&month=${month}` : '';
      const limit = month ? 500 : 100;
      const [payRes, priceRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/payment-notifications/admin?limit=${limit}${idParam}${monthParam}`),
        fetch(`${API_BASE_URL}/api/notifications/admin?limit=${limit}${idParam}${monthParam}`),
      ]);
      const merged: UnifiedNotif[] = [];
      if (payRes.ok) {
        const d = await payRes.json();
        (d.data || []).forEach((n: PaymentNotif) => merged.push({ ...n, source: 'payment' as const }));
      }
      if (priceRes.ok) {
        const d = await priceRes.json();
        (d.notifications || []).forEach((n: any) => {
          if (n.type === 'payment_type_change') {
            merged.push({ ...n, source: 'paymentType' as const });
          } else if (n.type === 'info_update') {
            merged.push({ ...n, source: 'infoUpdate' as const });
          } else {
            merged.push({ ...n, source: 'price' as const });
          }
        });
      }
      merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(merged);
      setUnreadCount(merged.filter(n => !n.isReadByAdmin).length);
    } catch {
      // non-critical
    }
  }, []);

  // Re-fetch server-side when numeric customer ID is typed; reads month from refs (always fresh)
  useEffect(() => {
    if (!bellOpen) return;
    const q = filterCustomerId.trim();
    const month = fullMonthFilterRef.current ? format(fullMonthDateRef.current, 'yyyy-MM') : undefined;
    if (q === '') { fetchNotifications(undefined, month); return; }
    if (!/^\d+$/.test(q)) return; // non-numeric: client-side filter only
    const timer = setTimeout(() => fetchNotifications(parseInt(q), month), 300);
    return () => clearTimeout(timer);
  }, [filterCustomerId, bellOpen, fetchNotifications]);

  useEffect(() => {
    fetchNotifications();

    // WebSocket subscription for real-time updates
    try {
      const ws = new WebSocket(API_BASE_URL.replace(/^http/, 'ws'));
      wsRef.current = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'subscribe', room: 'priceChange' }));
        ws.send(JSON.stringify({ type: 'subscribe', room: 'paymentActivity' }));
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'update') {
            fetchNotifications();
          }
        } catch { /* ignore */ }
      };
      ws.onerror = () => { /* non-critical */ };
    } catch { /* non-critical */ }

    return () => {
      wsRef.current?.close();
    };
  }, [fetchNotifications]);

  // Client-side filter: search + type tab
  const filteredNotifications = notifications.filter((n: UnifiedNotif) => {
    const q = filterCustomerId.trim().toLowerCase();
    const isNumericQuery = /^\d+$/.test(q);
    const matchesSearch = !q ||
      (n.customerIntId !== undefined && (isNumericQuery ? String(n.customerIntId) === q : String(n.customerIntId).includes(q))) ||
      (!isNumericQuery && n.customerName?.toLowerCase().includes(q));
    const matchesFilter =
      notifFilter === 'all' ||
      (notifFilter === 'payments' && n.source === 'payment') ||
      (notifFilter === 'price' && n.source === 'price') ||
      (notifFilter === 'paymentType' && n.source === 'paymentType') ||
      (notifFilter === 'infoUpdate' && n.source === 'infoUpdate');
    return matchesSearch && matchesFilter;
  });

  const handleBellOpen = async (open: boolean) => {
    setBellOpen(open);
    if (open) {
      setFilterCustomerId('');
      setNotifFilter('all');
      setFullMonthFilter(false);
      setFullMonthDate(startOfMonth(subMonths(new Date(), 1)));
      fetchNotifications();
      if (unreadCount > 0) {
        try {
          await Promise.all([
            fetch(`${API_BASE_URL}/api/notifications/admin/read-all`, { method: 'PUT' }),
            fetch(`${API_BASE_URL}/api/payment-notifications/admin/read-all`, { method: 'PUT' }),
          ]);
          setUnreadCount(0);
          setNotifications(prev => prev.map(n => ({ ...n, isReadByAdmin: true })));
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
                <p className="font-semibold text-sm mb-2">Notifications</p>
                {/* Filter tabs */}
                <div className="flex flex-wrap gap-1">
                  {(['all', 'payments', 'price', 'paymentType', 'infoUpdate'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setNotifFilter(f)}
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full border transition-colors',
                        notifFilter === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {f === 'all' ? 'All' : f === 'payments' ? 'Payments' : f === 'price' ? 'Price' : f === 'paymentType' ? 'Type' : 'Info'}
                    </button>
                  ))}
                </div>
              </div>
              {/* Filter by ID or name + Full Month */}
              <div className="px-3 py-2 border-b space-y-2">
                <Input
                  placeholder="Filter by ID or name..."
                  value={filterCustomerId}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterCustomerId(e.target.value)}
                  className="h-8 text-sm"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={fullMonthFilter}
                      onChange={e => {
                        const checked = e.target.checked;
                        setFullMonthFilter(checked);
                        const q = filterCustomerId.trim();
                        const intId = /^\d+$/.test(q) ? parseInt(q) : undefined;
                        fetchNotifications(intId, checked ? format(fullMonthDate, 'yyyy-MM') : undefined);
                      }}
                      className="h-3.5 w-3.5 accent-primary"
                    />
                    <span className="text-xs font-medium">Full Month</span>
                  </label>
                  {fullMonthFilter && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          const nd = startOfMonth(subMonths(fullMonthDate, 1));
                          setFullMonthDate(nd);
                          const q = filterCustomerId.trim();
                          const intId = /^\d+$/.test(q) ? parseInt(q) : undefined;
                          fetchNotifications(intId, format(nd, 'yyyy-MM'));
                        }}
                        disabled={fullMonthDate <= NOTIF_MONTH_MIN}
                        className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </button>
                      <span className="text-xs font-semibold min-w-[64px] text-center tabular-nums">
                        {format(fullMonthDate, 'MMM yyyy')}
                      </span>
                      <button
                        onClick={() => {
                          const nd = startOfMonth(addMonths(fullMonthDate, 1));
                          setFullMonthDate(nd);
                          const q = filterCustomerId.trim();
                          const intId = /^\d+$/.test(q) ? parseInt(q) : undefined;
                          fetchNotifications(intId, format(nd, 'yyyy-MM'));
                        }}
                        disabled={startOfMonth(addMonths(fullMonthDate, 1)) > startOfMonth(new Date())}
                        className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {filteredNotifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No notifications</p>
                ) : filteredNotifications.map((n: UnifiedNotif) => (
                  <div
                    key={n._id}
                    className={cn(
                      'px-4 py-3 border-b last:border-b-0 text-sm',
                      n.source === 'payment' && n.type === 'payment_deleted' && 'bg-destructive/5',
                      !n.isReadByAdmin && 'bg-primary/5',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {n.source === 'payment' ? (
                          <>
                            <p className={cn('text-xs font-semibold', n.type === 'payment_deleted' ? 'text-destructive' : 'text-green-600 dark:text-green-400')}>
                              {n.type === 'payment_added' ? '+ Payment Added' : '− Payment Deleted'}
                            </p>
                            <p className="text-xs text-foreground mt-0.5">
                              <span className="font-medium">{n.customerIntId ? `#${n.customerIntId} ` : ''}{n.customerName}</span>
                              {' · Rs '}{n.amount.toLocaleString()}
                            </p>
                            {n.note && <p className="text-xs text-muted-foreground mt-0.5">Note: {n.note}</p>}
                            {n.type === 'payment_deleted' && n.deleteReason && (
                              <p className="text-xs text-destructive/80 mt-0.5 font-medium">Reason: {n.deleteReason}</p>
                            )}
                          </>
                        ) : n.source === 'paymentType' ? (
                          <>
                            <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">Payment Type Changed</p>
                            <p className="text-xs text-foreground mt-0.5">
                              <span className="font-medium">{n.customerIntId ? `#${n.customerIntId} ` : ''}{n.customerName}</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                              {n.data.oldType} → {n.data.newType}
                            </p>
                          </>
                        ) : n.source === 'infoUpdate' ? (
                          <>
                            <p className="text-xs font-semibold text-violet-600 dark:text-violet-400">Profile Updated</p>
                            <p className="text-xs text-foreground mt-0.5">
                              <span className="font-medium">{n.customerIntId ? `#${n.customerIntId} ` : ''}{n.customerName}</span>
                            </p>
                            <div className="mt-0.5 space-y-0.5">
                              {n.data.changedFields.map((f: string) => (
                                <p key={f} className="text-xs text-muted-foreground">
                                  {INFO_FIELD_LABELS[f] ?? f}: <span className="line-through opacity-60">{String(n.data.oldValues[f] ?? '')}</span> → <span className="font-medium text-foreground">{String(n.data.newValues[f] ?? '')}</span>
                                </p>
                              ))}
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-semibold text-primary">Price Updated</p>
                            <p className="text-xs text-foreground mt-0.5">
                              <span className="font-medium">{n.customerIntId ? `#${n.customerIntId} ` : ''}{n.customerName}</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Rs {n.data.oldPrice} → Rs {n.data.newPrice} per can
                            </p>
                          </>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(n.createdAt).toLocaleString('en-PK', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>
                      {!n.isReadByAdmin && <span className="shrink-0 h-2 w-2 rounded-full bg-primary mt-1" />}
                    </div>
                  </div>
                ))}
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

        {/* Show payments content (index 4) */}
        {activeTab === 'payments' && childrenArray[4]}

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