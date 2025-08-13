"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/api';
import type { Customer } from '@/types';
import { ArrowUpAZ, ArrowDownAZ, PlusCircle, Pencil, Trash2, CalendarClock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type RecurringType = 'daily' | 'weekly' | 'one_time';

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

export default function RecurringTab() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [recurringRequests, setRecurringRequests] = useState<RecurringRequest[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<{ daily: boolean; weekly: boolean; one_time: boolean }>({ daily: true, weekly: true, one_time: true });
  const [addressSortOrder, setAddressSortOrder] = useState<'asc' | 'desc' | null>(null);

  // Form state
  const [form, setForm] = useState<{ customerId: string; type: RecurringType; days: number[]; date: string; time: string; priority: 'normal' | 'urgent'; cans: number }>(
    { customerId: '', type: 'daily', days: [], date: '', time: '09:00', priority: 'normal', cans: 1 }
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch customers and recurring
    (async () => {
      try {
        const [custRes, recRes] = await Promise.all([
          fetch(buildApiUrl(API_ENDPOINTS.CUSTOMERS)),
          fetch(buildApiUrl(API_ENDPOINTS.RECURRING_REQUESTS)),
        ]);
        if (custRes.ok) setAllCustomers(await custRes.json());
        if (recRes.ok) setRecurringRequests(await recRes.json());
      } catch (e) {}
    })();
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
    );
    const prelim = recurringRequests.filter(r => {
      if (!allowTypes.includes(r.type)) return false;
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
      const body = { ...form };
      if (isEditing && editingId) {
        const res = await fetch(buildApiUrl(`${API_ENDPOINTS.RECURRING_REQUESTS}/${editingId}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed to update recurring');
        const updated = await res.json();
        setRecurringRequests(prev => prev.map(r => (r._id === editingId ? updated : r)));
        toast({ title: 'Updated', description: 'Recurring request updated successfully.' });
      } else {
        const res = await fetch(buildApiUrl(API_ENDPOINTS.RECURRING_REQUESTS), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed to create recurring');
        const created = await res.json();
        setRecurringRequests(prev => [created, ...prev]);
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
        setRecurringRequests(prev => prev.filter(r => r._id !== id));
        toast({ title: 'Deleted', description: 'Recurring request removed.' });
      } else {
        toast({ variant: 'destructive', title: 'Delete failed', description: 'Could not delete recurring request.' });
      }
    } catch {}
  };

  return (
    <div className="p-3 space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
        <Button onClick={() => setIsOpen(true)}><PlusCircle className="h-4 w-4 mr-2" /> Create Recurring Request</Button>
        <div className="flex-1 flex flex-col sm:flex-row gap-2 items-center justify-end">
          <Input placeholder="Search id-name..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-64" />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox id="flt-daily" checked={filterType.daily} onCheckedChange={(v) => setFilterType(p => ({ ...p, daily: !!v }))} />
              <Label htmlFor="flt-daily">Daily</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="flt-weekly" checked={filterType.weekly} onCheckedChange={(v) => setFilterType(p => ({ ...p, weekly: !!v }))} />
              <Label htmlFor="flt-weekly">Weekly</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="flt-onetime" checked={filterType.one_time} onCheckedChange={(v) => setFilterType(p => ({ ...p, one_time: !!v }))} />
              <Label htmlFor="flt-onetime">One-Time</Label>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant={addressSortOrder === 'asc' ? 'default' : 'outline'} size="sm" onClick={() => setAddressSortOrder(prev => (prev === 'asc' ? null : 'asc'))}>
                <ArrowUpAZ className="h-4 w-4 mr-1" /> Asc
              </Button>
              <Button type="button" variant={addressSortOrder === 'desc' ? 'default' : 'outline'} size="sm" onClick={() => setAddressSortOrder(prev => (prev === 'desc' ? null : 'desc'))}>
                <ArrowDownAZ className="h-4 w-4 mr-1" /> Desc
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
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
            {filtered.map((r) => {
              const idName = r.customerIntId ? `${r.customerIntId} - ${r.customerName}` : r.customerName;
              const typeLabel = r.type === 'daily' ? 'Daily' : r.type === 'weekly' ? 'Weekly' : 'One-Time';
              const daysOrDate = r.type === 'daily' ? 'Every Day' : r.type === 'weekly' ? (r.days || []).map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ') : (r.date ? new Date(r.date).toLocaleDateString() : '-');
              const timeLabel = r.time;
              const nextLabel = r.nextRun ? new Date(r.nextRun).toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';
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
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Time</Label>
                <Input type="time" value={form.time} onChange={(e) => setForm(prev => ({ ...prev, time: e.target.value }))} />
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


