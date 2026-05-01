"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Trash2, RefreshCw, Search, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildApiUrl } from '@/lib/api';

interface CustomerBalance {
  customerId: string;
  customerIntId: number;
  customerName: string;
  phone: string;
  paymentType: string;
  totalBilled: number;
  totalPaid: number;
  balance: number;
}

interface LedgerEntry {
  month: string;
  billed: number;
  appliedToMonth: number;
  dueForMonth: number;
  runningBalance: number;
  status: 'settled' | 'due' | 'advance';
}

interface PaymentRecord {
  _id: string;
  amount: number;
  date: string;
  note: string;
}

const fmtMonthLabel = (m: string) => {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1, 15).toLocaleString('en-PK', { month: 'long', year: 'numeric' });
};

export default function PaymentsTab() {
  const [balances, setBalances] = useState<CustomerBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CustomerBalance | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [finalBalance, setFinalBalance] = useState(0);
  const [isLoadingDrawer, setIsLoadingDrawer] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Payment form
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Filters
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<'all' | 'cash' | 'account'>('all');

  // Deletion with mandatory reason
  const [deleteTarget, setDeleteTarget] = useState<{ paymentId: string; amount: number; note: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchBalances = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(buildApiUrl('api/payments/balances'));
      if (res.ok) {
        const data = await res.json();
        setBalances(data.data || []);
      }
    } catch { /* ignore */ } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchBalances(); }, [fetchBalances]);

  const fetchDrawerData = useCallback(async (customerId: string) => {
    setIsLoadingDrawer(true);
    try {
      const [ledgerRes, paymentsRes] = await Promise.all([
        fetch(buildApiUrl(`api/payments/ledger/${customerId}`)),
        fetch(buildApiUrl(`api/payments?customerObjectId=${customerId}`)),
      ]);
      if (ledgerRes.ok) {
        const d = await ledgerRes.json();
        setLedger((d.data?.ledger || []).slice().reverse());
        setFinalBalance(d.data?.finalBalance ?? 0);
      }
      if (paymentsRes.ok) {
        const d = await paymentsRes.json();
        setPayments(d.data || []);
      }
    } catch { /* ignore */ } finally {
      setIsLoadingDrawer(false);
    }
  }, []);

  const openDrawer = (bal: CustomerBalance) => {
    setSelected(bal);
    setDrawerOpen(true);
    setAmount('');
    setNote('');
    fetchDrawerData(bal.customerId);
  };

  const handleAddPayment = async () => {
    if (!selected || !amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
    setIsSaving(true);
    try {
      const res = await fetch(buildApiUrl('api/payments'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerObjectId: selected.customerId, amount: Number(amount), note }),
      });
      if (res.ok) {
        setAmount('');
        setNote('');
        await fetchDrawerData(selected.customerId);
        await fetchBalances();
      }
    } catch { /* ignore */ } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!selected || !deleteTarget || !deleteReason.trim()) return;
    setIsDeleting(true);
    try {
      const res = await fetch(buildApiUrl(`api/payments/${deleteTarget.paymentId}`), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deleteReason.trim() }),
      });
      if (res.ok) {
        setDeleteTarget(null);
        setDeleteReason('');
        await fetchDrawerData(selected.customerId);
        await fetchBalances();
      }
    } catch { /* ignore */ } finally {
      setIsDeleting(false);
    }
  };

  // Refresh selected card after balances reload
  useEffect(() => {
    if (selected) {
      const fresh = balances.find(b => b.customerId === selected.customerId);
      if (fresh) setSelected(fresh);
    }
  }, [balances]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = balances.filter(b => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!b.customerName.toLowerCase().includes(q) && !String(b.customerIntId).includes(q)) return false;
    }
    if (paymentTypeFilter !== 'all' && b.paymentType !== paymentTypeFilter) return false;
    return true;
  });

  const fmtPKT = (dateStr: string) =>
    new Date(dateStr).toLocaleString('en-PK', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi',
    });

  return (
    <div className="p-3 sm:p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Payments &amp; Balances</h2>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchBalances} disabled={isLoading}>
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Payment type filter */}
      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground shrink-0">Type</span>
        {(['all', 'cash', 'account'] as const).map(t => (
          <label key={t} className="flex items-center gap-1.5 cursor-pointer select-none">
            <Checkbox
              checked={paymentTypeFilter === t}
              onCheckedChange={() => setPaymentTypeFilter(t)}
              className="h-3.5 w-3.5"
            />
            <span className="text-sm">{t === 'all' ? 'All' : t === 'cash' ? 'Cash' : 'Account'}</span>
          </label>
        ))}
      </div>

      {/* Customer list */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No customers found.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(b => {
            const owing = b.balance > 0;
            const advance = b.balance < 0;
            return (
              <button
                key={b.customerId}
                onClick={() => openDrawer(b)}
                className="w-full text-left rounded-xl border bg-card p-3 hover:bg-muted/50 transition-colors active:bg-muted"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      <span className="text-muted-foreground text-xs mr-1">#{b.customerIntId}</span>
                      {b.customerName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Billed: <span className="tabular-nums">Rs {b.totalBilled.toLocaleString()}</span>
                      {' · '}
                      Paid: <span className="tabular-nums font-semibold text-green-600 dark:text-green-400">Rs {b.totalPaid.toLocaleString()}</span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right min-w-[72px]">
                    {owing || advance ? (
                      <>
                        <p className={cn('text-sm font-bold tabular-nums leading-tight', owing ? 'text-destructive' : 'text-green-600 dark:text-green-400')}>
                          Rs {(owing ? b.balance : Math.abs(b.balance)).toLocaleString()}
                        </p>
                        <p className={cn('text-[10px] font-semibold uppercase tracking-wide leading-tight', owing ? 'text-destructive/70' : 'text-green-600/70 dark:text-green-400/70')}>
                          {owing ? 'DUE' : 'ADV'}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs font-semibold text-muted-foreground">Settled</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Customer Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 overflow-hidden">
          <SheetHeader className="px-4 pt-5 pb-3 border-b shrink-0">
            <SheetTitle className="text-base">
              {selected ? `${selected.customerName} (#${selected.customerIntId})` : ''}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {isLoadingDrawer ? (
              <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
            ) : (
              <>
                {/* Current status banner */}
                <div className={cn(
                  'rounded-xl p-3 flex items-center gap-3',
                  finalBalance < 0 && 'bg-destructive/10 border border-destructive/20',
                  finalBalance > 0 && 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800',
                  finalBalance === 0 && 'bg-muted/40 border',
                )}>
                  {finalBalance < 0
                    ? <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                    : finalBalance > 0
                      ? <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                      : <CheckCircle2 className="h-5 w-5 text-muted-foreground shrink-0" />
                  }
                  <div>
                    <p className={cn(
                      'text-sm font-semibold',
                      finalBalance < 0 && 'text-destructive',
                      finalBalance > 0 && 'text-green-600 dark:text-green-400',
                      finalBalance === 0 && 'text-muted-foreground',
                    )}>
                      {finalBalance < 0
                        ? `Rs ${Math.abs(finalBalance).toLocaleString()} total due`
                        : finalBalance > 0
                          ? `Rs ${finalBalance.toLocaleString()} advance`
                          : 'All settled'}
                    </p>
                    {finalBalance > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">Will apply to next delivery month</p>
                    )}
                  </div>
                </div>

                {/* Monthly ledger */}
                {ledger.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Monthly Ledger</p>
                    {ledger.map(entry => (
                      <div key={entry.month} className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{fmtMonthLabel(entry.month)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Billed: <span className="tabular-nums">Rs {entry.billed.toLocaleString()}</span>
                            {entry.appliedToMonth > 0 && (
                              <>{' · '}Paid: <span className="tabular-nums font-semibold text-green-600 dark:text-green-400">Rs {entry.appliedToMonth.toLocaleString()}</span></>
                            )}
                          </p>
                        </div>
                        <div className="shrink-0 text-right min-w-[64px]">
                          {entry.status === 'settled' ? (
                            <p className="text-xs font-semibold text-green-600 dark:text-green-400">✓ Settled</p>
                          ) : entry.status === 'due' ? (
                            <>
                              <p className="text-sm font-bold tabular-nums text-destructive leading-tight">Rs {entry.dueForMonth.toLocaleString()}</p>
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-destructive/70 leading-tight">DUE</p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-bold tabular-nums text-green-600 dark:text-green-400 leading-tight">Rs {Math.abs(entry.runningBalance).toLocaleString()}</p>
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-green-600/70 dark:text-green-400/70 leading-tight">ADV</p>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Payment Form */}
                <div className="rounded-xl border p-3 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Record Payment</p>
                  <div className="space-y-1">
                    <Label className="text-xs">Amount (Rs)</Label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="0"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Note (optional)</Label>
                    <Input
                      placeholder="e.g. Cash received"
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <Button
                    className="w-full h-9"
                    onClick={handleAddPayment}
                    disabled={isSaving || !amount || Number(amount) <= 0}
                  >
                    {isSaving ? 'Saving...' : 'Add Payment'}
                  </Button>
                </div>

                {/* Payment history */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment Records</p>
                  {payments.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No payments recorded.</p>
                  ) : (
                    payments.map(p => (
                      <div key={p._id} className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold tabular-nums text-green-600 dark:text-green-400">Rs {p.amount.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">{fmtPKT(p.date)}{p.note ? ` · ${p.note}` : ''}</p>
                        </div>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                          onClick={() => { setDeleteTarget({ paymentId: p._id, amount: p.amount, note: p.note }); setDeleteReason(''); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete reason dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) { setDeleteTarget(null); setDeleteReason(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Delete Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
              Rs {deleteTarget?.amount.toLocaleString()}
              {deleteTarget?.note && <span className="text-muted-foreground"> · {deleteTarget.note}</span>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Reason for deletion <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g. Entered by mistake"
                value={deleteReason}
                onChange={e => setDeleteReason(e.target.value)}
                className="h-9"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">This reason will be visible to the customer.</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { setDeleteTarget(null); setDeleteReason(''); }}>
              Cancel
            </Button>
            <Button
              variant="destructive" size="sm"
              onClick={confirmDelete}
              disabled={isDeleting || !deleteReason.trim()}
            >
              {isDeleting ? 'Deleting...' : 'Delete Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
