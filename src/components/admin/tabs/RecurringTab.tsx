"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/api';
import type { Customer } from '@/types';
import { ArrowUpAZ, ArrowDownAZ, PlusCircle, Pencil, Trash2, CalendarClock, ListFilter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type RecurringType = 'daily' | 'weekly' | 'one_time' | 'alternating_days';

interface RecurringRequest {
  _id?: string;
  customerId: string;
  customerIntId?: number;
  customerName: string;
  address: string;
  type: RecurringType;
  cans: number;
  days?: number[]; // 0-6 for Sun-Sat
  date?: string; // ISO date for one-time
  time: string; // HH:mm
  nextRun: string; // ISO
  priority: 'normal' | 'urgent';
}

// Compute the next run time based on recurrence settings
const computeNextRun = (payload: { type: RecurringType; days?: number[]; date?: string; time: string; }): string => {
  const now = new Date();
  const [h, m] = (payload.time || '09:00').split(':').map(n => parseInt(n || '0', 10));
  if (payload.type === 'one_time' && payload.date) {
    // Parse yyyy-mm-dd as local date to preserve selected time exactly
    const parts = String(payload.date).split('-').map(x => parseInt(x, 10));
    const year = parts[0];
    const monthZero = (parts[1] || 1) - 1;
    const day = parts[2] || 1;
    const dLocal = new Date(year, monthZero, day, h, m, 0, 0);
    return dLocal.toISOString();
  }
  if (payload.type === 'daily') {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    return d.toISOString();
  }
  if (payload.type === 'alternating_days') {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 2); // Every other day
    return d.toISOString();
  }
  // weekly
  const days = (payload.days || []).slice().sort();
  if (days.length === 0) {
    const d = new Date(); d.setHours(h, m, 0, 0); if (d <= now) d.setDate(d.getDate() + 7); return d.toISOString();
  }
  const today = now.getDay();
  for (let i = 0; i < 7; i++) {
    const cand = new Date();
    cand.setDate(now.getDate() + i);
    const dow = (today + i) % 7;
    if (days.includes(dow)) {
      cand.setHours(h, m, 0, 0);
      if (cand > now) return cand.toISOString();
    }
  }
  const cand = new Date(); cand.setDate(now.getDate() + 7); cand.setHours(h, m, 0, 0); return cand.toISOString();
};

// Ensure time string is always in 24-hour HH:mm format
const normalizeTime24 = (raw: string): string => {
  try {
    if (!raw) return '09:00';
    const trimmed = String(raw).trim();
    // Handle AM/PM variants like "1:05 PM"
    const ampm = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (ampm) {
      let hh = parseInt(ampm[1] || '0', 10);
      const mm = parseInt(ampm[2] || '0', 10);
      const suffix = (ampm[4] || '').toUpperCase();
      if (suffix === 'PM' && hh < 12) hh += 12;
      if (suffix === 'AM' && hh === 12) hh = 0;
      const h2 = hh.toString().padStart(2, '0');
      const m2 = mm.toString().padStart(2, '0');
      return `${h2}:${m2}`;
    }
    // Handle HH:mm or HH:mm:ss
    const parts = trimmed.split(':');
    if (parts.length >= 2) {
      let hh = parseInt(parts[0] || '0', 10);
      let mm = parseInt(parts[1] || '0', 10);
      if (isNaN(hh)) hh = 0; if (isNaN(mm)) mm = 0;
      hh = Math.max(0, Math.min(23, hh));
      mm = Math.max(0, Math.min(59, mm));
      const h2 = hh.toString().padStart(2, '0');
      const m2 = mm.toString().padStart(2, '0');
      return `${h2}:${m2}`;
    }
    return '09:00';
  } catch {
    return '09:00';
  }
};

export default function RecurringTab() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [recurringRequests, setRecurringRequests] = useState<RecurringRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<{ daily: boolean; weekly: boolean; one_time: boolean; alternating_days: boolean }>({ daily: true, weekly: true, one_time: true, alternating_days: true });
  const [addressSortOrder, setAddressSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState<{ daily: boolean; weekly: boolean; one_time: boolean; alternating_days: boolean; addrOrder: 'asc' | 'desc' | null }>({ daily: true, weekly: true, one_time: true, alternating_days: true, addrOrder: null });

  // Form state
  const [form, setForm] = useState<{ customerId: string; type: RecurringType; days: number[]; date: string; time: string; priority: 'normal' | 'urgent'; cans: number }>(
    { customerId: '', type: 'daily', days: [], date: '', time: '09:00', priority: 'normal', cans: 1 }
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Prevent duplicate client-side triggers within a short window
  const clientTriggerCacheRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    let isActive = true;
    const loadFromLocal = (): RecurringRequest[] => {
      try {
        const raw = localStorage.getItem('paani_recurring_requests');
        if (!raw) return [];
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
      } catch { return []; }
    };
    const saveToLocal = (arr: RecurringRequest[]) => {
      try { localStorage.setItem('paani_recurring_requests', JSON.stringify(arr)); } catch {}
    };
    const ensureLocalSync = (serverData: RecurringRequest[] | null) => {
      if (serverData && serverData.length) {
        saveToLocal(serverData);
        return serverData;
      }
      const local = loadFromLocal();
      return local;
    };

    const fetchAll = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [custRes, recRes] = await Promise.all([
          fetch(buildApiUrl(API_ENDPOINTS.CUSTOMERS)),
          fetch(buildApiUrl(API_ENDPOINTS.RECURRING_REQUESTS)),
        ]);
        if (custRes.ok) {
          const c = await custRes.json();
          if (isActive) setAllCustomers(c);
        }
        if (recRes.ok) {
          const r = (await recRes.json()) as RecurringRequest[];
          const synced = ensureLocalSync(r);
          if (isActive) setRecurringRequests(synced);
          // Attempt client-side due processing (non-blocking)
          if (isActive) {
            try { triggerDueIfNeeded(synced); } catch {}
          }
        } else {
          const local = ensureLocalSync(null);
          if (isActive) setRecurringRequests(local);
        }
      } catch (e) {
        const local = ensureLocalSync(null);
        if (isActive) setRecurringRequests(local);
        if (isActive) setError('Failed to load data (using offline storage)');
      } finally {
        if (isActive) setIsLoading(false);
      }
    };
    fetchAll();
    
    // No separate refresh interval - admin dashboard refreshes every 3 seconds
    // Recurring data will be updated through the main admin dashboard refresh system
    return () => { isActive = false; };
  }, []);

  const customersOptions = useMemo(() => {
    return allCustomers.map(c => ({
      value: String((c as any)._id || (c as any).customerId),
      label: (c as any).id ? `${(c as any).id} - ${c.name}` : c.name,
      intId: (c as any).id,
      name: c.name,
      address: c.address,
    }));
  }, [allCustomers]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const allowTypes: RecurringType[] = ([] as RecurringType[]).concat(
      filterType.daily ? ['daily'] : [],
      filterType.weekly ? ['weekly'] : [],
      filterType.one_time ? ['one_time'] : [],
      filterType.alternating_days ? ['alternating_days'] : [],
    );
    const typesActive = allowTypes.length > 0;
    const prelim = recurringRequests.filter(r => {
      if (typesActive && !allowTypes.includes(r.type)) return false;
      if (!s) return true;
      const idName = r.customerIntId ? `${r.customerIntId} - ${r.customerName}` : r.customerName;
      return idName.toLowerCase().includes(s);
    });
    if (!addressSortOrder) return prelim;
    const dir = addressSortOrder === 'asc' ? 1 : -1;
    return [...prelim].sort((a, b) => {
      const aAddr = (a.address || '').toLowerCase();
      const bAddr = (b.address || '').toLowerCase();
      if (aAddr < bAddr) return -1 * dir;
      if (aAddr > bAddr) return 1 * dir;
      const ta = a.nextRun ? new Date(a.nextRun).getTime() : 0;
      const tb = b.nextRun ? new Date(b.nextRun).getTime() : 0;
      return ta - tb;
    });
  }, [recurringRequests, search, filterType, addressSortOrder]);

  const resetForm = () => setForm({ customerId: '', type: 'daily', days: [], date: '', time: '09:00', priority: 'normal', cans: 1 });

  const createRecurring = async () => {
    if (!form.customerId) return;
    // Client-side validation
    if (form.type === 'weekly' && (!form.days || form.days.length === 0)) {
      toast({ variant: 'destructive', title: 'Missing days', description: 'Please select at least one day for weekly recurrence.' });
      return;
    }
    if (form.type === 'one_time' && !form.date) {
      toast({ variant: 'destructive', title: 'Missing date', description: 'Please pick a date for one-time recurrence.' });
      return;
    }
    // Duplicate prevention (same customer + same type)
    const duplicate = recurringRequests.some(r => String(r.customerId) === String(form.customerId) && r.type === form.type && (!isEditing || r._id !== editingId));
    if (duplicate) {
      toast({ variant: 'destructive', title: 'Duplicate recurring request', description: 'A recurring request with the same customer and type already exists.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const body = { ...form, time: normalizeTime24(form.time) };
      if (isEditing && editingId) {
        const res = await fetch(buildApiUrl(`${API_ENDPOINTS.RECURRING_REQUESTS}/${editingId}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const updated = await res.json();
          setRecurringRequests(prev => {
            const next = prev.map(r => (r._id === editingId ? updated : r));
            try { localStorage.setItem('paani_recurring_requests', JSON.stringify(next)); } catch {}
            return next;
          });
        } else {
          // Offline/local fallback update
          setRecurringRequests(prev => {
            const cust = customersOptions.find(o => o.value === body.customerId);
            const updated: RecurringRequest = {
              _id: editingId,
              customerId: String(body.customerId),
              customerIntId: cust?.intId,
              customerName: cust?.name || '',
              address: cust?.address || '',
              type: body.type,
              cans: body.cans,
              days: body.type === 'weekly' ? body.days : [],
              date: body.type === 'one_time' ? body.date : '',
              time: normalizeTime24(body.time),
              nextRun: computeNextRun(body),
              priority: body.priority,
            };
            const next = prev.map(r => (r._id === editingId ? updated : r));
            try { localStorage.setItem('paani_recurring_requests', JSON.stringify(next)); } catch {}
            return next;
          });
        }
        toast({ title: 'Updated', description: 'Recurring request updated successfully.' });
      } else {
        const res = await fetch(buildApiUrl(API_ENDPOINTS.RECURRING_REQUESTS), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const created = await res.json();
          setRecurringRequests(prev => {
            const next = [created, ...prev];
            try { localStorage.setItem('paani_recurring_requests', JSON.stringify(next)); } catch {}
            return next;
          });
        } else {
          // Offline/local fallback create
          const cust = customersOptions.find(o => o.value === body.customerId);
          const fallback: RecurringRequest = {
            _id: `local_${Date.now()}`,
            customerId: String(body.customerId),
            customerIntId: cust?.intId,
            customerName: cust?.name || '',
            address: cust?.address || '',
            type: body.type,
            cans: body.cans,
            days: body.type === 'weekly' ? body.days : [],
            date: body.type === 'one_time' ? body.date : '',
            time: normalizeTime24(body.time),
            nextRun: computeNextRun(body),
            priority: body.priority,
          };
          setRecurringRequests(prev => {
            const next = [fallback, ...prev];
            try { localStorage.setItem('paani_recurring_requests', JSON.stringify(next)); } catch {}
            return next;
          });
        }
        toast({ title: 'Created', description: 'Recurring request created successfully.' });
      }
      setIsOpen(false);
      setIsEditing(false);
      setEditingId(null);
      resetForm();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Action failed', description: e instanceof Error ? e.message : 'Could not save recurring request.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteRecurring = async (id: string) => {
    try {
      if (!confirm('Delete this recurring request?')) return;
      const res = await fetch(buildApiUrl(`${API_ENDPOINTS.RECURRING_REQUESTS}/${id}`), { method: 'DELETE' });
      if (res.ok) {
        setRecurringRequests(prev => {
          const next = prev.filter(r => r._id !== id);
          try { localStorage.setItem('paani_recurring_requests', JSON.stringify(next)); } catch {}
          return next;
        });
        toast({ title: 'Deleted', description: 'Recurring request removed.' });
      } else {
        // Offline/local fallback delete
        setRecurringRequests(prev => {
          const next = prev.filter(r => r._id !== id);
          try { localStorage.setItem('paani_recurring_requests', JSON.stringify(next)); } catch {}
          return next;
        });
        toast({ title: 'Deleted (local)', description: 'Recurring request removed locally.' });
      }
    } catch {}
  };

  // Client-side fallback autopilot: create delivery when nextRun is due, then advance nextRun
  const triggerDueIfNeeded = async (list: RecurringRequest[]) => {
    const now = Date.now();
    for (const r of list) {
      if (!r.nextRun) continue;
      const dueAt = new Date(r.nextRun).getTime();
      if (isNaN(dueAt)) continue;
      if (dueAt > now) continue;
      const key = String(r._id || `${r.customerId}-${r.type}`);
      const last = clientTriggerCacheRef.current.get(key) || 0;
      if (now - last < 4 * 60 * 1000) continue; // debounce 4 minutes

      // Mark as attempted early to minimize races
      clientTriggerCacheRef.current.set(key, now);

      try {
        // Create delivery request
        const body = {
          customerId: r.customerId,
          customerName: r.customerName,
          address: r.address,
          cans: r.cans,
          orderDetails: '',
          priority: r.priority || 'normal',
        } as any;
        const createRes = await fetch(buildApiUrl(API_ENDPOINTS.DELIVERY_REQUESTS), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!createRes.ok) {
          // If server rejected (e.g., active exists), still advance nextRun to avoid piling up
          // Fall through to advance nextRun
        }

        // Advance or clear nextRun on the recurring rule
        if (r._id) {
          if (r.type === 'one_time') {
            // Remove one-time after firing
            await fetch(buildApiUrl(`${API_ENDPOINTS.RECURRING_REQUESTS}/${r._id}`), { method: 'DELETE' });
            setRecurringRequests(prev => {
              const next = prev.filter(x => x._id !== r._id);
              try { localStorage.setItem('paani_recurring_requests', JSON.stringify(next)); } catch {}
              return next;
            });
          } else {
            // Advance strictly based on previous nextRun to preserve time-of-day
            const prev = r.nextRun ? new Date(r.nextRun) : null;
            let nextRun: string = computeNextRun({ type: r.type, days: r.days, date: r.date, time: r.time });
            if (prev && !isNaN(prev.getTime())) {
              const hours = prev.getHours();
              const minutes = prev.getMinutes();
              if (r.type === 'daily') {
                const n = new Date(prev); n.setDate(prev.getDate() + 1); n.setHours(hours, minutes, 0, 0); nextRun = n.toISOString();
              } else if (r.type === 'weekly') {
                const allowed = Array.isArray(r.days) ? r.days.slice().sort() : [];
                if (allowed.length === 0) {
                  const n = new Date(prev); n.setDate(prev.getDate() + 7); n.setHours(hours, minutes, 0, 0); nextRun = n.toISOString();
                } else {
                  const prevDow = prev.getDay();
                  let found: Date | null = null;
                  for (let i = 1; i <= 7; i++) {
                    const candDow = (prevDow + i) % 7;
                    if (allowed.includes(candDow)) {
                      const n = new Date(prev); n.setDate(prev.getDate() + i); n.setHours(hours, minutes, 0, 0); found = n; break;
                    }
                  }
                  if (found) nextRun = found.toISOString();
                }
              } else if (r.type === 'alternating_days') {
                const n = new Date(prev);
                n.setDate(prev.getDate() + 2); // Every other day
                n.setHours(hours, minutes, 0, 0);
                nextRun = n.toISOString();
              }
            }
            const updRes = await fetch(buildApiUrl(`${API_ENDPOINTS.RECURRING_REQUESTS}/${r._id}`), {
              method: 'PUT', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nextRun })
            });
            if (updRes.ok) {
              const updated = await updRes.json();
              setRecurringRequests(prev => {
                const next = prev.map(x => x._id === r._id ? updated : x);
                try { localStorage.setItem('paani_recurring_requests', JSON.stringify(next)); } catch {}
                return next;
              });
            }
          }
        }
      } catch {
        // ignore errors; will retry on next cycle
      }
    }
  };

  return (
    <div className="p-3 space-y-3">
      {error && (
        <div className="p-2 text-sm rounded bg-red-100 text-red-700 border border-red-200">{error}</div>
      )}
      <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
        <Button onClick={() => setIsOpen(true)}><PlusCircle className="h-4 w-4 mr-2" /> Create Recurring Request</Button>
        <div className="flex-1 flex items-center justify-end gap-2">
          <Input placeholder="Search id-name..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-64" />
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" title="Filters"><ListFilter className="h-4 w-4" /></Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <Checkbox id="rflt-daily" checked={filterDraft.daily} onCheckedChange={(v) => setFilterDraft(p => ({ ...p, daily: !!v }))} />
                    <Label htmlFor="rflt-daily">Daily</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="rflt-weekly" checked={filterDraft.weekly} onCheckedChange={(v) => setFilterDraft(p => ({ ...p, weekly: !!v }))} />
                    <Label htmlFor="rflt-weekly">Weekly</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="rflt-onetime" checked={filterDraft.one_time} onCheckedChange={(v) => setFilterDraft(p => ({ ...p, one_time: !!v }))} />
                    <Label htmlFor="rflt-onetime">One-Time</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="rflt-alternating" checked={filterDraft.alternating_days} onCheckedChange={(v) => setFilterDraft(p => ({ ...p, alternating_days: !!v }))} />
                    <Label htmlFor="rflt-alternating">Alternating Days</Label>
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block">Address Sort</Label>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant={filterDraft.addrOrder === 'asc' ? 'default' : 'outline'} size="sm" onClick={() => setFilterDraft(prev => ({ ...prev, addrOrder: prev.addrOrder === 'asc' ? null : 'asc' }))}>
                      <ArrowUpAZ className="h-4 w-4 mr-1" /> Asc
                    </Button>
                    <Button type="button" variant={filterDraft.addrOrder === 'desc' ? 'default' : 'outline'} size="sm" onClick={() => setFilterDraft(prev => ({ ...prev, addrOrder: prev.addrOrder === 'desc' ? null : 'desc' }))}>
                      <ArrowDownAZ className="h-4 w-4 mr-1" /> Desc
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setFilterDraft({ daily: true, weekly: true, one_time: true, alternating_days: true, addrOrder: null })}>Clear</Button>
                  <Button onClick={() => { setFilterType({ daily: filterDraft.daily, weekly: filterDraft.weekly, one_time: filterDraft.one_time, alternating_days: filterDraft.alternating_days }); setAddressSortOrder(filterDraft.addrOrder); setIsFilterOpen(false); }}>Apply</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden grid gap-2">
        {isLoading ? (
          <div className="p-3 text-center text-muted-foreground text-sm border rounded">Loading recurring requests...</div>
        ) : filtered.length === 0 ? (
          <div className="p-3 text-center text-muted-foreground text-sm border rounded">No recurring requests found.</div>
        ) : (
          filtered.map((r) => {
            const idName = r.customerIntId ? `${r.customerIntId} - ${r.customerName}` : r.customerName;
            const typeLabel = r.type === 'daily' ? 'Daily' : r.type === 'weekly' ? 'Weekly' : r.type === 'alternating_days' ? 'Alternating Days' : 'One-Time';
            const daysOrDate = r.type === 'daily' ? 'Every Day' : r.type === 'weekly' ? (r.days || []).map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ') : r.type === 'alternating_days' ? 'Every Other Day' : (r.date ? new Date(r.date).toLocaleDateString() : '-');
            const nextLabel = r.nextRun ? `${new Date(r.nextRun).toLocaleDateString(undefined, { month: 'short', day: '2-digit' })} ${r.time}` : '-';
            return (
              <Card key={r._id || `${idName}-${r.time}`} className="h-full flex flex-col">
                <CardHeader className="py-3">
                  <CardTitle className="text-base font-semibold">{idName}</CardTitle>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">{typeLabel}</Badge>
                    <Badge variant="outline" className="text-xs capitalize">{r.priority}</Badge>
                    <Badge variant="outline" className="text-xs">{r.cans} cans</Badge>
                  </div>
                </CardHeader>
                <CardContent className="py-2 flex-1 text-sm">
                  <div className="space-y-1">
                    <div><span className="text-muted-foreground">Days/Date:</span> {daysOrDate}</div>
                    <div><span className="text-muted-foreground">Time:</span> {r.time}</div>
                    <div><span className="text-muted-foreground">Next:</span> {nextLabel}</div>
                  </div>
                </CardContent>
                <CardFooter className="mt-auto pt-0 gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => {
                    setIsEditing(true);
                    setEditingId(r._id || null);
                    setForm({
                      customerId: String(r.customerId),
                      type: r.type,
                      days: r.days || [],
                      date: r.date || '',
                      time: r.time,
                      priority: r.priority,
                      cans: r.cans || 1,
                    });
                    setIsOpen(true);
                  }}>Edit</Button>
                  <Button size="sm" variant="destructive" className="flex-1" onClick={() => r._id && deleteRecurring(r._id)}>Delete</Button>
                </CardFooter>
              </Card>
            );
          })
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID - Customer</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Days / Date</TableHead>
              <TableHead>Cans</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Next Run</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Loading recurring requests...</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No recurring requests found.</TableCell>
              </TableRow>
            ) : filtered.map((r) => {
              const idName = r.customerIntId ? `${r.customerIntId} - ${r.customerName}` : r.customerName;
              const typeLabel = r.type === 'daily' ? 'Daily' : r.type === 'weekly' ? 'Weekly' : r.type === 'alternating_days' ? 'Alternating Days' : 'One-Time';
              const daysOrDate = r.type === 'daily' ? 'Every Day' : r.type === 'weekly' ? (r.days || []).map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ') : r.type === 'alternating_days' ? 'Every Other Day' : (r.date ? new Date(r.date).toLocaleDateString() : '-');
              const timeLabel = r.time;
              const nextLabel = r.nextRun ? `${new Date(r.nextRun).toLocaleDateString(undefined, { month: 'short', day: '2-digit' })} ${r.time}` : '-';
              return (
                <TableRow key={r._id || idName}>
                  <TableCell>{idName}</TableCell>
                  <TableCell>{typeLabel}</TableCell>
                  <TableCell>{daysOrDate}</TableCell>
                  <TableCell>{r.cans}</TableCell>
                  <TableCell>{timeLabel}</TableCell>
                  <TableCell>{nextLabel}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => {
                      setIsEditing(true);
                      setEditingId(r._id || null);
                      setForm({
                        customerId: String(r.customerId),
                        type: r.type,
                        days: r.days || [],
                        date: r.date || '',
                        time: r.time,
                        priority: r.priority,
                        cans: r.cans || 1,
                      });
                      setIsOpen(true);
                    }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => r._id && deleteRecurring(r._id)} className="text-red-600"><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Create Recurring Dialog */}
      <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) { setIsEditing(false); setEditingId(null); resetForm(); } }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Recurring Request' : 'Create Recurring Request'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Customer</Label>
              <Select value={form.customerId} onValueChange={(v) => setForm(prev => ({ ...prev, customerId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer (id - name)" />
                </SelectTrigger>
                <SelectContent>
                  {customersOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm(prev => ({ ...prev, type: v as RecurringType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="one_time">One-Time</SelectItem>
                    <SelectItem value="alternating_days">Alternating Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Time (24-hour)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={(form.time || '09:00').split(':')[0]?.padStart(2, '0')}
                    onValueChange={(v) => {
                      const [, mRaw] = (form.time || '09:00').split(':');
                      const mm = (mRaw || '00').padStart(2, '0');
                      setForm(prev => ({ ...prev, time: normalizeTime24(`${v}:${mm}`) }));
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="HH" /></SelectTrigger>
                    <SelectContent className="max-h-64">
                      {Array.from({ length: 24 }).map((_, i) => {
                        const hh = i.toString().padStart(2, '0');
                        return <SelectItem key={hh} value={hh}>{hh}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                  <Select
                    value={(form.time || '09:00').split(':')[1]?.padStart(2, '0')}
                    onValueChange={(v) => {
                      const [hRaw] = (form.time || '09:00').split(':');
                      const hh = (hRaw || '09').padStart(2, '0');
                      setForm(prev => ({ ...prev, time: normalizeTime24(`${hh}:${v}`) }));
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="mm" /></SelectTrigger>
                    <SelectContent className="max-h-64">
                      {Array.from({ length: 60 }).map((_, i) => {
                        const mm = i.toString().padStart(2, '0');
                        return <SelectItem key={mm} value={mm}>{mm}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            {form.type === 'weekly' && (
              <div>
                <Label>Days</Label>
                <div className="grid grid-cols-7 gap-2 text-sm">
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, idx) => (
                    <label key={d} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={form.days.includes(idx)}
                        onChange={(e) => setForm(prev => ({ ...prev, days: e.target.checked ? [...prev.days, idx] : prev.days.filter(x => x !== idx) }))}
                      />
                      {d}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {form.type === 'one_time' && (
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value }))} />
              </div>
            )}
            {form.type === 'alternating_days' && (
              <div>
                <Label>Next Run</Label>
                <p className="text-sm text-muted-foreground">This recurring request will run every other day.</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm(prev => ({ ...prev, priority: v as 'normal' | 'urgent' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cans</Label>
                <Input type="number" min={1} value={form.cans} onChange={(e) => setForm(prev => ({ ...prev, cans: Math.max(1, Number(e.target.value || 1)) }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { resetForm(); setIsEditing(false); setEditingId(null); setIsOpen(false); }}>Cancel</Button>
              <Button disabled={isSubmitting} onClick={createRecurring}><CalendarClock className="h-4 w-4 mr-1" /> {isEditing ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


