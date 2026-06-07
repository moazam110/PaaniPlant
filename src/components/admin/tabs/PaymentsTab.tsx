"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Trash2, RefreshCw, Search, CheckCircle2, AlertCircle, TrendingUp, FileText, FileSpreadsheet, ChevronLeft, ChevronRight, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildApiUrl } from '@/lib/api';
import { format, startOfMonth, subMonths, addMonths, getMonth, getYear } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

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
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<'all' | 'cash' | 'account' | null>('all');
  const [showSettled, setShowSettled] = useState(false);

  // Full Month filter
  const [fullMonthFilter, setFullMonthFilter] = useState(false);
  const [fullMonthDate, setFullMonthDate] = useState<Date>(() => startOfMonth(subMonths(new Date(), 1)));

  // Deletion with mandatory reason
  const [deleteTarget, setDeleteTarget] = useState<{ paymentId: string; amount: number; note: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const savedScrollY = useRef(0);

  // Collections Report
  const COLLECTIONS_MIN = new Date(2026, 3, 1); // April 1 2026
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [colFrom, setColFrom] = useState<Date | undefined>();
  const [colTo, setColTo] = useState<Date | undefined>();
  const [colFromOpen, setColFromOpen] = useState(false);
  const [colToOpen, setColToOpen] = useState(false);
  const [colType, setColType] = useState<'cash' | 'account' | null>(null);
  const [colRows, setColRows] = useState<{ serial: number; customerIntId: number; customerName: string; amount: number; date: string; note: string }[]>([]);
  const [colLoading, setColLoading] = useState(false);
  const [colGenerated, setColGenerated] = useState(false);
  const [colAccountBalances, setColAccountBalances] = useState<CustomerBalance[]>([]);

  const fetchCollections = async () => {
    if (!colFrom || !colTo || !colType) return;
    setColLoading(true);
    try {
      const from = format(colFrom, 'yyyy-MM-dd');
      const to = format(colTo, 'yyyy-MM-dd');
      const res = await fetch(buildApiUrl(`api/payments/collections-report?from=${from}&to=${to}&paymentType=${colType}`));
      if (res.ok) {
        const d = await res.json();
        setColRows(d.data || []);
        setColGenerated(true);
      }
      // For account type: fetch previous month's FIFO balance (auto-detected, not from filter dates)
      if (colType === 'account') {
        const prevMonth = format(subMonths(startOfMonth(new Date()), 1), 'yyyy-MM');
        const bRes = await fetch(buildApiUrl(`api/payments/balances?maxMonth=${prevMonth}`));
        if (bRes.ok) {
          const bd = await bRes.json();
          setColAccountBalances(bd.data || []);
        }
      }
    } catch { /* ignore */ } finally {
      setColLoading(false);
    }
  };

  const fmtPKTShort = (dateStr: string) =>
    new Date(dateStr).toLocaleString('en-PK', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi',
    });

  // Cash → to-date balance from main balances state
  // Account → previous month FIFO balance from colAccountBalances (auto-detected month)
  const getColRemaining = (customerIntId: number) => {
    if (colType === 'account') {
      return colAccountBalances.find(b => b.customerIntId === customerIntId)?.balance ?? 0;
    }
    return balances.find(b => b.customerIntId === customerIntId)?.balance ?? 0;
  };

  const fmtRemainingLabel = (bal: number) => {
    if (bal === 0) return 'Settled';
    if (bal > 0) return `Rs ${bal.toLocaleString()}`; // owing
    return `Rs ${Math.abs(bal).toLocaleString()} Adv`;  // advance
  };

  const handleCollectionsExport = async (type: 'pdf' | 'excel') => {
    if (colRows.length === 0) return;
    const total = colRows.reduce((s, r) => s + r.amount, 0);
    const typeLabel = colType === 'cash' ? 'Cash' : 'Account';
    const periodLabel = `${format(colFrom!, 'MMM d, yyyy')} – ${format(colTo!, 'MMM d, yyyy')}`;

    if (type === 'excel') {
      const XLSX = await import('xlsx');
      const header = [
        ['The Paani™ — Collections Report'],
        [`Type: ${typeLabel}   |   Period: ${periodLabel}`],
        [`Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')}`],
        [],
        ['#', 'Customer ID', 'Customer Name', 'Amount (Rs)', colType === 'account' ? 'Remaining - Prev Month (Rs)' : 'Remaining (Rs)', 'Date & Time', 'Remarks'],
      ];
      const rows = colRows.map(r => {
        const bal = getColRemaining(r.customerIntId);
        return [r.serial, r.customerIntId, r.customerName, r.amount, bal === 0 ? '—' : (bal > 0 ? bal : `${Math.abs(bal)} Adv`), fmtPKTShort(r.date), r.note || ''];
      });
      rows.push(['', '', 'TOTAL', total, '', '', '']);
      const ws = (await import('xlsx')).utils.aoa_to_sheet([...header, ...rows]);
      ws['!cols'] = [{ wch: 4 }, { wch: 10 }, { wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 28 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Collections');
      XLSX.writeFile(wb, `PaaniPlant_Collections_${format(colFrom!, 'yyyy-MM-dd')}_to_${format(colTo!, 'yyyy-MM-dd')}.xlsx`);
    } else {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const lx = 40;

      doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(63, 81, 181);
      doc.text('The Paani™', lx, 36);
      doc.setFontSize(11); doc.setTextColor(63, 81, 181);
      doc.text('Collections Report', pageW - lx, 36, { align: 'right' });
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(90);
      doc.text(`Type: ${typeLabel}   ·   Period: ${periodLabel}`, lx, 50);
      doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')}`, pageW - lx, 50, { align: 'right' });
      doc.setDrawColor(63, 81, 181); doc.setLineWidth(0.5); doc.line(lx, 56, pageW - lx, 56);

      const GREEN: [number, number, number] = [22, 130, 80];
      const RED: [number, number, number] = [190, 40, 40];
      const GRAY: [number, number, number] = [150, 150, 150];

      const body = colRows.map(r => {
        const bal = getColRemaining(r.customerIntId);
        const remColor = bal > 0 ? RED : bal < 0 ? GREEN : GRAY;
        return [
          { content: String(r.serial), styles: { halign: 'center' as const } },
          { content: String(r.customerIntId), styles: { halign: 'center' as const } },
          r.customerName,
          { content: `Rs ${r.amount.toLocaleString()}`, styles: { halign: 'left' as const, textColor: GREEN } },
          { content: fmtRemainingLabel(bal), styles: { halign: 'left' as const, textColor: remColor } },
          fmtPKTShort(r.date),
          r.note || '',
        ];
      });
      autoTable(doc, {
        startY: 64,
        head: [['#', 'Cust. ID', 'Customer Name', 'Amount', colType === 'account' ? 'Remaining\n(Prev Month)' : 'Remaining', 'Date & Time', 'Remarks']],
        body,
        foot: [['', '', 'TOTAL', `Rs ${total.toLocaleString()}`, '', '', '']],
        showFoot: 'lastPage',
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [63, 81, 181], textColor: 255, fontStyle: 'bold' },
        footStyles: { fontStyle: 'bold', textColor: GREEN, fillColor: [235, 238, 255] as [number, number, number] },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 40 },
          3: { cellWidth: 58, halign: 'left' as const },
          4: { cellWidth: 58, halign: 'left' as const },
          5: { cellWidth: 88 },
        },
        alternateRowStyles: { fillColor: [248, 249, 255] },
        willDrawCell: (data: any) => {
          if (data.section === 'head') return;
          if (data.column.index !== 3 && data.column.index !== 4) return;
          const text: string = Array.isArray(data.cell.text) ? data.cell.text.join('') : '';
          if (!text.startsWith('Rs ')) return;
          (data.cell as any)._rsOriginal = text;
          (data.cell as any)._rsColor = data.cell.styles?.textColor;
          data.cell.text = []; // suppress autotable text draw
        },
        didDrawCell: (data: any) => {
          const saved: string = (data.cell as any)._rsOriginal;
          if (!saved) return;
          const numStr = saved.substring(3);
          const isBold = data.section === 'foot';
          const px = data.cell.x + 4;
          const cy = data.cell.y + data.cell.height / 2;
          doc.setFontSize(8);
          doc.setFont('helvetica', isBold ? 'bold' : 'normal');
          // Draw "Rs" in black
          doc.setTextColor(0, 0, 0);
          doc.text('Rs', px, cy, { baseline: 'middle' });
          // Draw number in original cell color
          const rsW = doc.getTextWidth('Rs ');
          const c = (data.cell as any)._rsColor;
          if (Array.isArray(c) && c.length === 3) {
            doc.setTextColor(c[0] as number, c[1] as number, c[2] as number);
          } else {
            doc.setTextColor(...GREEN);
          }
          doc.text(numStr, px + rsW, cy, { baseline: 'middle' });
        },
      });
      doc.save(`PaaniPlant_Collections_${format(colFrom!, 'yyyy-MM-dd')}_to_${format(colTo!, 'yyyy-MM-dd')}.pdf`);
    }
  };

  const fetchBalances = useCallback(async (maxMonth?: string) => {
    setIsLoading(true);
    try {
      const url = maxMonth
        ? buildApiUrl(`api/payments/balances?maxMonth=${maxMonth}`)
        : buildApiUrl('api/payments/balances');
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setBalances(data.data || []);
      }
    } catch { /* ignore */ } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (fullMonthFilter) {
      fetchBalances(format(fullMonthDate, 'yyyy-MM'));
    } else {
      fetchBalances();
    }
  }, [fetchBalances, fullMonthFilter, fullMonthDate]);

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
    savedScrollY.current = window.scrollY;
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
    const isSettled = b.balance === 0;
    // Always hide settled unless Settled checkbox is on
    if (isSettled && !showSettled) return false;
    // null type + Settled = "only settled" mode — exclude non-settled
    if (!isSettled && paymentTypeFilter === null && showSettled) return false;
    // Type filter applies to all remaining rows
    if (paymentTypeFilter !== null && paymentTypeFilter !== 'all' && b.paymentType !== paymentTypeFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!b.customerName.toLowerCase().includes(q) && !String(b.customerIntId).includes(q)) return false;
    }
    return true;
  });

  const FULL_MONTH_MIN = new Date(2026, 3, 1); // April 2026

  const fmtPKT = (dateStr: string) =>
    new Date(dateStr).toLocaleString('en-PK', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi',
    });

  const fmtMonthFull = (m: string) => {
    const [y, mo] = m.split('-');
    return new Date(Number(y), Number(mo) - 1, 15).toLocaleString('en-US', { month: 'long', year: 'numeric' });
  };

  const handleExport = async (type: 'pdf' | 'excel') => {
    const maxMonth = fullMonthFilter ? format(fullMonthDate, 'yyyy-MM') : undefined;
    const url = maxMonth
      ? buildApiUrl(`api/payments/ledger-bulk?maxMonth=${maxMonth}`)
      : buildApiUrl('api/payments/ledger-bulk');
    const res = await fetch(url);
    if (!res.ok) return;
    const { data } = await res.json();

    // Build per-customer groups
    interface MonthRow { month: string; paid: number; remaining: number; }
    interface CustomerGroup { serial: number; name: string; intId: number; phone: string; months: MonthRow[]; totalPaid: number; totalRemaining: number; }
    const groups: CustomerGroup[] = [];
    let serial = 1;
    for (const customer of (data as any[])) {
      if (paymentTypeFilter !== null && paymentTypeFilter !== 'all' && customer.paymentType !== paymentTypeFilter) continue;
      const months: MonthRow[] = customer.months.map((m: any) => ({ month: fmtMonthFull(m.month), paid: m.paid as number, remaining: m.remaining as number }));
      if (months.length === 0) continue;
      groups.push({
        serial: serial++,
        name: customer.customerName,
        intId: customer.customerIntId,
        phone: customer.phone || '',
        months,
        totalPaid: months.reduce((s, m) => s + m.paid, 0),
        totalRemaining: months.reduce((s, m) => s + m.remaining, 0),
      });
    }

    const grandPaid = groups.reduce((s, g) => s + g.totalPaid, 0);
    const grandRemaining = groups.reduce((s, g) => s + g.totalRemaining, 0);
    const typeLabel = paymentTypeFilter === 'cash' ? 'Cash' : paymentTypeFilter === 'account' ? 'Account' : 'All';

    if (type === 'excel') {
      const XLSX = await import('xlsx');
      // Header info rows
      const wsData: (string | number)[][] = [
        ['The Paani™ — Dues Report'],
        [maxMonth ? `Up to: ${format(fullMonthDate, 'MMMM yyyy')}` : 'All Months', '', '', `Type: ${typeLabel}`],
        [],
        ['#', 'Customer', 'Contact', 'Month', 'Paid (Rs)', 'Remaining (Rs)', 'Total Due (Rs)'],
      ];
      const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [
        // Title spans all columns
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
      ];
      let rowIdx = 4; // data starts after 4 header rows

      for (const g of groups) {
        const startRow = rowIdx;
        const endRow = startRow + g.months.length - 1;
        g.months.forEach((m, i) => {
          wsData.push([
            i === 0 ? g.serial : '',
            i === 0 ? `#${g.intId} ${g.name}` : '',
            i === 0 ? g.phone : '',
            m.month,
            m.paid,
            m.remaining,
            i === 0 ? g.totalRemaining : '',
          ]);
          rowIdx++;
        });

        // Merge #, Customer, Contact, Total columns across all month rows
        if (endRow > startRow) {
          [0, 1, 2, 6].forEach(c => merges.push({ s: { r: startRow, c }, e: { r: endRow, c } }));
        }
      }

      wsData.push(['', '', '', 'TOTAL', grandPaid, '', grandRemaining]);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 5 }, { wch: 32 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 16 }];
      ws['!merges'] = merges;
      XLSX.utils.book_append_sheet(wb, ws, 'Dues Report');
      const label = maxMonth ? format(fullMonthDate, 'MMM_yyyy') : 'All';
      XLSX.writeFile(wb, `PaaniPlant_Dues_${label}.xlsx`);
    } else {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

      // Header
      doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(63, 81, 181);
      doc.text('The Paani™ — Dues Report', 40, 40);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
      const subLines: string[] = [];
      if (maxMonth) subLines.push(`Up to: ${format(fullMonthDate, 'MMMM yyyy')}`);
      subLines.push(`Type: ${typeLabel}`);
      doc.text(subLines.join('   ·   '), 40, 56);

      const GREEN: [number, number, number] = [22, 130, 80];
      const RED: [number, number, number] = [190, 40, 40];
      const SEP_COLOR: [number, number, number] = [210, 215, 235];

      const body: any[] = [];
      for (const g of groups) {
        const span = g.months.length;
        g.months.forEach((m, i) => {
          if (i === 0) {
            body.push([
              { content: g.serial, rowSpan: span, styles: { valign: 'middle', halign: 'center' } },
              { content: `#${g.intId} ${g.name}`, rowSpan: span, styles: { valign: 'middle' } },
              { content: g.phone, rowSpan: span, styles: { valign: 'middle' } },
              { content: m.month },
              { content: m.paid.toLocaleString(), styles: { halign: 'right', textColor: m.paid > 0 ? GREEN : [150, 150, 150] } },
              { content: m.remaining.toLocaleString(), styles: { halign: 'right', textColor: RED } },
              { content: g.totalRemaining.toLocaleString(), rowSpan: span, styles: { valign: 'middle', halign: 'right', fontStyle: 'bold', textColor: RED } },
            ]);
          } else {
            body.push([
              { content: m.month },
              { content: m.paid.toLocaleString(), styles: { halign: 'right', textColor: m.paid > 0 ? GREEN : [150, 150, 150] } },
              { content: m.remaining.toLocaleString(), styles: { halign: 'right', textColor: RED } },
            ]);
          }
        });
        // Thin separator row between customer groups
        body.push([{
          content: '',
          colSpan: 7,
          styles: { fillColor: SEP_COLOR, cellPadding: 1, minCellHeight: 3 },
        }]);
      }
      // Grand total
      body.push([
        { content: 'TOTAL', colSpan: 4, styles: { fontStyle: 'bold', halign: 'right', fillColor: [235, 238, 255] } },
        { content: grandPaid.toLocaleString(), styles: { fontStyle: 'bold', halign: 'right', fillColor: [235, 238, 255], textColor: GREEN } },
        { content: '', styles: { fillColor: [235, 238, 255] } },
        { content: grandRemaining.toLocaleString(), styles: { fontStyle: 'bold', halign: 'right', fillColor: [235, 238, 255], textColor: RED } },
      ]);

      autoTable(doc, {
        startY: 66,
        head: [['#', 'Customer', 'Contact', 'Month', 'Paid (Rs)', 'Remaining (Rs)', 'Total Due (Rs)']],
        body,
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [63, 81, 181], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 22 }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right', cellWidth: 58 } },
      });
      const label = maxMonth ? format(fullMonthDate, 'MMM_yyyy') : 'All';
      doc.save(`PaaniPlant_Dues_${label}.pdf`);
    }
  };

  return (
    <div className="p-3 sm:p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-base font-semibold">Payments &amp; Balances</h2>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => { setCollectionsOpen(true); setColGenerated(false); setColRows([]); }} title="Collections Report"
            className="border-violet-500 text-violet-700 hover:bg-violet-600 hover:text-white px-2">
            <BarChart2 className="h-4 w-4 md:mr-1.5" />
            <span className="hidden md:inline text-xs">Collections</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} title="Export PDF"
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground px-2">
            <FileText className="h-4 w-4 md:mr-1.5" />
            <span className="hidden md:inline text-xs">PDF</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('excel')} title="Export Excel"
            className="border-green-600 text-green-700 hover:bg-green-600 hover:text-white px-2">
            <FileSpreadsheet className="h-4 w-4 md:mr-1.5" />
            <span className="hidden md:inline text-xs">Excel</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => fullMonthFilter ? fetchBalances(format(fullMonthDate, 'yyyy-MM')) : fetchBalances()}
            disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-muted/30 px-3 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground shrink-0">Type</span>
        {(['all', 'cash', 'account'] as const).map(t => (
          <label key={t} className="flex items-center gap-1.5 cursor-pointer select-none">
            <Checkbox
              checked={paymentTypeFilter === t}
              onCheckedChange={() => setPaymentTypeFilter(prev => prev === t ? null : t)}
              className="h-3.5 w-3.5"
            />
            <span className="text-sm">{t === 'all' ? 'All' : t === 'cash' ? 'Cash' : 'Account'}</span>
          </label>
        ))}
        <div className="w-px h-4 bg-border hidden sm:block" />
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <Checkbox
            checked={showSettled}
            onCheckedChange={v => setShowSettled(v as boolean)}
            className="h-3.5 w-3.5"
          />
          <span className="text-sm text-muted-foreground">Settled</span>
        </label>
        <div className="w-px h-4 bg-border hidden sm:block" />
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <Checkbox
            checked={fullMonthFilter}
            onCheckedChange={v => setFullMonthFilter(v as boolean)}
            className="h-3.5 w-3.5"
          />
          <span className="text-sm font-medium">Full Month</span>
        </label>
        {fullMonthFilter && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFullMonthDate(d => startOfMonth(subMonths(d, 1)))}
              disabled={fullMonthDate <= FULL_MONTH_MIN}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs font-semibold min-w-[72px] text-center tabular-nums">
              {format(fullMonthDate, 'MMM yyyy')}
            </span>
            <button
              onClick={() => setFullMonthDate(d => startOfMonth(addMonths(d, 1)))}
              disabled={startOfMonth(addMonths(fullMonthDate, 1)) > startOfMonth(new Date())}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
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
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className={cn(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                        b.paymentType === 'account'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      )}>
                        {b.paymentType === 'account' ? 'Account' : 'Cash'}
                      </span>
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
      <Sheet open={drawerOpen} onOpenChange={(open) => {
        setDrawerOpen(open);
        if (!open) requestAnimationFrame(() => window.scrollTo(0, savedScrollY.current));
      }}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 overflow-hidden">
          <SheetHeader className="px-4 pt-5 pb-3 border-b shrink-0">
            <SheetTitle className="text-base">
              {selected ? `${selected.customerName} (#${selected.customerIntId})` : ''}
            </SheetTitle>
            {selected && (
              <span className={cn(
                'self-start text-xs font-semibold px-2 py-0.5 rounded-full',
                selected.paymentType === 'account'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              )}>
                {selected.paymentType === 'account' ? 'Account' : 'Cash'}
              </span>
            )}
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

      {/* Collections Report Dialog */}
      <Dialog open={collectionsOpen} onOpenChange={v => { setCollectionsOpen(v); if (!v) { setColGenerated(false); setColRows([]); setColType(null); setColFrom(undefined); setColTo(undefined); setColAccountBalances([]); } }}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-violet-600" /> Collections Report
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Date pickers */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">From</label>
                <Popover open={colFromOpen} onOpenChange={setColFromOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal text-sm', !colFrom && 'text-muted-foreground')}>
                      {colFrom ? format(colFrom, 'MMM d, yyyy') : 'Pick date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={colFrom}
                      onSelect={d => {
                        setColFrom(d);
                        setColFromOpen(false);
                        if (d) setColTo(new Date());
                        setColGenerated(false); setColRows([]);
                      }}
                      disabled={d => d < COLLECTIONS_MIN || d > new Date()}
                      initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">To</label>
                <Popover open={colToOpen} onOpenChange={setColToOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal text-sm', !colTo && 'text-muted-foreground')}>
                      {colTo ? format(colTo, 'MMM d, yyyy') : 'Pick date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={colTo}
                      onSelect={d => { setColTo(d); setColToOpen(false); setColGenerated(false); setColRows([]); }}
                      disabled={d => d < COLLECTIONS_MIN || d > new Date() || (colFrom ? d < colFrom : false)}
                      initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Payment type — mandatory, one at a time */}
            <div className="flex items-center gap-4 rounded-lg border bg-muted/30 px-3 py-2.5">
              <span className="text-sm font-medium">Type <span className="text-destructive">*</span></span>
              {(['cash', 'account'] as const).map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="radio" name="colType" value={t} checked={colType === t}
                    onChange={() => { setColType(t); setColGenerated(false); setColRows([]); }}
                    className="accent-primary" />
                  <span className="text-sm capitalize">{t}</span>
                </label>
              ))}
            </div>

            <Button
              onClick={fetchCollections}
              disabled={!colFrom || !colTo || !colType || colLoading}
              className="w-full bg-gradient-to-r from-violet-600 to-primary"
            >
              {colLoading ? 'Generating...' : 'Generate Report'}
            </Button>

            {colGenerated && (
              <>
                {colRows.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-4">No payment records found for this period.</p>
                ) : (
                  <>
                    {/* Summary */}
                    <div className="rounded-lg bg-violet-50 border border-violet-200 px-4 py-3 flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{colRows.length} payment{colRows.length !== 1 ? 's' : ''}</span>
                      <span className="text-sm font-bold text-violet-700">
                        Total: Rs {colRows.reduce((s, r) => s + r.amount, 0).toLocaleString()}
                      </span>
                    </div>

                    {/* Download buttons */}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleCollectionsExport('pdf')}
                        className="flex-1 border-primary text-primary hover:bg-primary hover:text-primary-foreground gap-1.5">
                        <FileText className="h-4 w-4" /> PDF
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleCollectionsExport('excel')}
                        className="flex-1 border-green-600 text-green-700 hover:bg-green-600 hover:text-white gap-1.5">
                        <FileSpreadsheet className="h-4 w-4" /> Excel
                      </Button>
                    </div>

                    {/* Inline preview table */}
                    <div className="rounded-md border overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-violet-600 text-white">
                            <th className="px-2 py-2 text-center">#</th>
                            <th className="px-2 py-2 text-center">ID</th>
                            <th className="px-2 py-2 text-left">Customer</th>
                            <th className="px-2 py-2 text-left">Amount</th>
                            <th className="px-2 py-2 text-left">
                              {colType === 'account'
                                ? <span>Remaining<br /><span className="text-[10px] font-normal opacity-80">(Prev Month)</span></span>
                                : 'Remaining'}
                            </th>
                            <th className="px-2 py-2 text-left">Date & Time</th>
                            <th className="px-2 py-2 text-left">Remarks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {colRows.map((r, i) => {
                            const bal = getColRemaining(r.customerIntId);
                            return (
                              <tr key={r.serial} className={i % 2 === 0 ? 'bg-white' : 'bg-violet-50/40'}>
                                <td className="px-2 py-1.5 text-center text-muted-foreground">{r.serial}</td>
                                <td className="px-2 py-1.5 text-center font-medium">{r.customerIntId}</td>
                                <td className="px-2 py-1.5">{r.customerName}</td>
                                <td className="px-2 py-1.5">
                                  <span className="text-foreground font-medium">Rs</span>{' '}
                                  <span className="text-green-700 font-semibold tabular-nums">{r.amount.toLocaleString()}</span>
                                </td>
                                <td className="px-2 py-1.5 whitespace-nowrap font-semibold">
                                  {bal === 0
                                    ? <span className="text-green-600">Settled</span>
                                    : <>
                                        <span className="text-foreground font-medium">Rs</span>{' '}
                                        <span className={`tabular-nums ${bal > 0 ? 'text-red-600' : 'text-green-700'}`}>
                                          {bal > 0 ? bal.toLocaleString() : `${Math.abs(bal).toLocaleString()} Adv`}
                                        </span>
                                      </>
                                  }
                                </td>
                                <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{fmtPKTShort(r.date)}</td>
                                <td className="px-2 py-1.5 text-muted-foreground">{r.note || '-'}</td>
                              </tr>
                            );
                          })}
                          <tr className="bg-violet-100 border-t-2 border-violet-300">
                            <td colSpan={3} className="px-2 py-2 text-right text-xs font-bold">TOTAL</td>
                            <td className="px-2 py-2 font-bold whitespace-nowrap">
                              <span className="text-foreground">Rs</span>{' '}
                              <span className="text-green-700 tabular-nums">{colRows.reduce((s, r) => s + r.amount, 0).toLocaleString()}</span>
                            </td>
                            <td colSpan={3} />
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
