"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { CalendarIcon, FileText, SkipForward, CheckCircle2, ChevronRight, ChevronLeft, Users } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/api';

const APRIL_2026 = new Date(2026, 3, 1); // April 1 2026 — earliest allowed billing date
import { cn } from '@/lib/utils';

interface CustomerBillData {
  intId: number;
  objectId: string;
  name: string;
  phone?: string;
  address: string;
  paymentType: string;
  requests: any[];
  totalCans: number;
  totalAmount: number;
  previousDues: { month: string; amount: number }[];
  advanceCredit: number;
  netPayable: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AdminBulkBillsDialog({ open, onOpenChange }: Props) {
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash' | 'account'>('all');
  const [bills, setBills] = useState<CustomerBillData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [seqIndex, setSeqIndex] = useState<number | null>(null);
  const [seqSending, setSeqSending] = useState(false);
  const [useFullMonth, setUseFullMonth] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => {
    const prev = startOfMonth(subMonths(new Date(), 1));
    return prev < APRIL_2026 ? APRIL_2026 : prev;
  });
  const [specificCustomer, setSpecificCustomer] = useState(false);
  const [customerIdInput, setCustomerIdInput] = useState('');

  useEffect(() => {
    if (useFullMonth) {
      setFromDate(startOfMonth(selectedMonth));
      setToDate(endOfMonth(selectedMonth));
      setGenerated(false);
      setBills([]);
    }
  }, [useFullMonth, selectedMonth]);

  const totalCansAll = bills.reduce((s, b) => s + b.totalCans, 0);
  const totalAmountAll = bills.reduce((s, b) => s + b.totalAmount, 0);

  const fetchData = async () => {
    if (!fromDate || !toDate) return;
    setIsLoading(true);
    try {
      const start = new Date(fromDate); start.setHours(0, 0, 0, 0);
      const endForApi = new Date(toDate); endForApi.setHours(0, 0, 0, 0); endForApi.setDate(endForApi.getDate() + 1);

      const [deliveriesRes, customersRes] = await Promise.all([
        fetch(buildApiUrl(`${API_ENDPOINTS.DELIVERY_REQUESTS}?status=delivered&startDate=${start.toISOString()}&endDate=${endForApi.toISOString()}&page=1&limit=10000`)),
        fetch(buildApiUrl(`${API_ENDPOINTS.CUSTOMERS}?page=1&limit=10000`)),
      ]);

      const deliveriesResult = await deliveriesRes.json();
      const customersResult = await customersRes.json();
      const deliveries: any[] = Array.isArray(deliveriesResult) ? deliveriesResult : (deliveriesResult?.data || []);
      const customers: any[] = Array.isArray(customersResult) ? customersResult : (customersResult?.data || []);

      const grouped: Record<number, any[]> = {};
      for (const d of deliveries) {
        const id = d.customerIntId;
        if (id == null) continue;
        if (!grouped[id]) grouped[id] = [];
        grouped[id].push(d);
      }

      // Specific customer filter — parse the entered ID
      const specificId = specificCustomer && customerIdInput.trim() ? Number(customerIdInput.trim()) : null;

      const billData: Omit<CustomerBillData, 'previousDues' | 'advanceCredit' | 'netPayable'>[] = [];
      for (const c of customers) {
        const custId = c.intId ?? c.id;
        const reqs: any[] = grouped[custId] || [];
        if (reqs.length === 0) continue;
        if (paymentFilter !== 'all' && c.paymentType !== paymentFilter) continue;
        if (specificId !== null && custId !== specificId) continue;
        reqs.sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime());
        billData.push({
          intId: custId,
          objectId: String(c._id || ''),
          name: c.name,
          phone: c.phone,
          address: c.address,
          paymentType: c.paymentType,
          requests: reqs,
          totalCans: reqs.reduce((s, r) => s + (r.cans || 0), 0),
          totalAmount: reqs.reduce((s, r) => s + ((r.cans || 0) * (r.pricePerCan || 0)), 0),
        });
      }
      billData.sort((a, b) => a.intId - b.intId);

      // Billing month key — always derived from start date to prevent double-counting current period as a previous due
      const billingMonthKey = format(start, 'yyyy-MM');

      // Fetch FIFO ledger for each customer to get previous dues & advance
      const withLedger: CustomerBillData[] = await Promise.all(
        billData.map(async bill => {
          const empty = { ...bill, previousDues: [], advanceCredit: 0, netPayable: bill.totalAmount };
          if (!bill.objectId) return empty;
          try {
            const res = await fetch(buildApiUrl(`api/payments/ledger/${bill.objectId}?maxMonth=${billingMonthKey}`));
            if (!res.ok) return empty;
            const d = await res.json();
            const ledger: any[] = (d.data?.ledger || []).slice().reverse(); // oldest → newest
            const finalBalance: number = d.data?.finalBalance ?? 0;

            // Previous months that still have dues (exclude the current billing month)
            const previousDues = ledger
              .filter((e: any) =>
                e.status === 'due' &&
                e.dueForMonth > 0 &&
                (!billingMonthKey || e.month < billingMonthKey)
              )
              .map((e: any) => ({ month: e.month, amount: e.dueForMonth as number }));

            const prevTotal = previousDues.reduce((s: number, d: { amount: number }) => s + d.amount, 0);
            const advanceCredit = finalBalance > 0 ? finalBalance : 0;
            // finalBalance is the authoritative net position (negative = owes, positive = advance)
            const netPayable = finalBalance < 0 ? -finalBalance : 0;

            return { ...bill, previousDues, advanceCredit, netPayable };
          } catch { return empty; }
        })
      );

      setBills(withLedger);
      setGenerated(true);
    } catch (err) {
      console.error('Error fetching bulk bills:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const drawBillOnDoc = (doc: any, autoTableFn: any, bill: CustomerBillData) => {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const lx = 14; const vx = 52;

    doc.setFontSize(22); doc.setFont('helvetica', 'bold'); doc.setTextColor(63, 81, 181);
    doc.text('The Paani™', lx, 20);
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(90);
    doc.text('RAHMATPUR LATIF COLONY, NEAR ARFAT MASJID, LARKANO', lx, 27);
    doc.text('TEL: 0333 786 0 444', lx, 33);
    doc.setTextColor(63, 81, 181);
    doc.textWithLink('www.paani.online', lx, 39, { url: 'https://www.paani.online' });

    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(63, 81, 181);
    doc.text('BILL', pageW - lx, 20, { align: 'right' });
    doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(120);
    doc.text('Generated by Admin', pageW - lx, 27, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${format(new Date(), 'MMM d, yyyy')}`, pageW - lx, 33, { align: 'right' });

    doc.setDrawColor(63, 81, 181); doc.setLineWidth(0.5); doc.line(lx, 43, pageW - lx, 43);

    const period = `${format(fromDate!, 'MMM d, yyyy')} – ${format(toDate!, 'MMM d, yyyy')}`.toUpperCase();
    const fields: [string, string][] = [
      ['CUSTOMER NAME', bill.name.toUpperCase()],
      ['CUSTOMER ID', String(bill.intId)],
      ['PAYMENT TYPE', bill.paymentType === 'cash' ? 'Cash' : 'Account'],
      ['ADDRESS', bill.address.toUpperCase()],
      ...(bill.phone ? [['PHONE NUMBER', bill.phone] as [string, string]] : []),
      ['BILLING PERIOD', period],
    ];

    let y = 52; doc.setFontSize(10);
    fields.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold'); doc.setTextColor(60); doc.text(`${label}:`, lx, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(0); doc.text(value, vx, y);
      y += 7;
    });

    doc.setFontSize(7.5); doc.setTextColor(150); doc.setFont('helvetica', 'italic');
    doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')}`, lx, y);

    autoTableFn(doc, {
      startY: y + 6,
      showFoot: 'lastPage',
      head: [[
        { content: '#', styles: { halign: 'center' } },
        { content: 'Date', styles: { halign: 'left' } },
        { content: 'Cans', styles: { halign: 'center' } },
        { content: 'Price / Can', styles: { halign: 'right' } },
        { content: 'Subtotal', styles: { halign: 'right' } },
      ]],
      body: bill.requests.map((r, i) => [
        String(i + 1),
        r.requestedAt ? format(new Date(r.requestedAt), 'MMM d, yyyy') : '-',
        String(r.cans || 0),
        `Rs. ${r.pricePerCan || 0}`,
        `Rs. ${((r.cans || 0) * (r.pricePerCan || 0)).toFixed(0)}`,
      ]),
      foot: [[
        { content: '', styles: { halign: 'center' } },
        { content: 'TOTAL', styles: { halign: 'left' } },
        { content: String(bill.totalCans), styles: { halign: 'center' } },
        { content: '', styles: { halign: 'right' } },
        { content: `Rs. ${bill.totalAmount.toFixed(0)}`, styles: { halign: 'right' } },
      ]],
      headStyles: { fillColor: [63, 81, 181], fontSize: 9.5, fontStyle: 'bold' },
      footStyles: { fillColor: [230, 230, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9.5 },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 45, halign: 'left' },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 52, halign: 'right' },
        4: { cellWidth: 53, halign: 'right' },
      },
      alternateRowStyles: { fillColor: [248, 249, 255] },
    });

    // Balance summary (previous dues + payments + net payable)
    const tableEndY = (doc as any).lastAutoTable?.finalY ?? 150;
    const hasPrevDues = bill.previousDues.length > 0;
    const prevTotal = bill.previousDues.reduce((s, d) => s + d.amount, 0);
    const totalCharged = bill.totalAmount + prevTotal;
    // paidAmount = what was actually paid toward this bill's charges
    // When netPayable === 0 (exact or overpayment): fully paid = totalCharged
    // When netPayable > 0 (partial): paid = totalCharged - netPayable
    const paidAmount = totalCharged > 0 ? Math.max(0, totalCharged - bill.netPayable) : 0;
    const hasPaidAmount = paidAmount > 0;
    const showSummary = hasPrevDues || hasPaidAmount || bill.netPayable > 0 || bill.advanceCredit > 0;

    if (showSummary) {
      let sy = tableEndY + 5;
      const rx = pageW - lx;

      doc.setDrawColor(200, 200, 220); doc.setLineWidth(0.3);
      doc.line(lx, sy, rx, sy);
      sy += 5;

      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
      doc.text('Current period bill:', lx, sy);
      doc.text(`Rs. ${bill.totalAmount.toFixed(0)}`, rx, sy, { align: 'right' });
      sy += 5.5;

      if (hasPrevDues) {
        doc.setFont('helvetica', 'bold'); doc.setTextColor(180, 30, 30);
        doc.text('Previous outstanding dues:', lx, sy);
        sy += 5;
        doc.setFont('helvetica', 'normal');
        for (const due of bill.previousDues) {
          const [yr, mo] = due.month.split('-');
          const ml = new Date(Number(yr), Number(mo) - 1, 15).toLocaleString('en-US', { month: 'long', year: 'numeric' });
          doc.setTextColor(180, 30, 30);
          doc.text(`  ${ml}`, lx + 3, sy);
          doc.text(`+ Rs. ${due.amount.toFixed(0)}`, rx, sy, { align: 'right' });
          sy += 5;
        }
      }

      if (hasPaidAmount) {
        doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 130, 60);
        doc.text('Paid:', lx, sy);
        doc.text(`- Rs. ${paidAmount.toFixed(0)}`, rx, sy, { align: 'right' });
        sy += 5.5;
      }

      sy += 1;
      doc.setDrawColor(63, 81, 181); doc.setLineWidth(0.6);
      doc.line(lx, sy, rx, sy);
      sy += 5;

      doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      if (bill.netPayable <= 0) {
        doc.setTextColor(0, 130, 60);
        doc.text('TOTAL PAYABLE:', lx, sy);
        doc.text('PAID', rx, sy, { align: 'right' });
      } else {
        doc.setTextColor(63, 81, 181);
        doc.text('TOTAL PAYABLE:', lx, sy);
        doc.text(`Rs. ${bill.netPayable.toFixed(0)}`, rx, sy, { align: 'right' });
      }

      if (bill.advanceCredit > 0) {
        sy += 6;
        doc.setFontSize(8.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(0, 130, 60);
        doc.text(`Advance on account: Rs. ${bill.advanceCredit.toFixed(0)} (will apply to next billing)`, lx, sy);
      }
    }

    const disclaimer = 'This is a system-generated invoice and does not require a signature.';
    doc.setFontSize(9.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(150, 150, 150);
    const dw = doc.getTextWidth(disclaimer);
    doc.text(disclaimer, (pageW - dw) / 2, pageH - 6);
  };

  const buildSinglePdf = async (bill: CustomerBillData) => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    drawBillOnDoc(doc, autoTable, bill);
    return doc;
  };

  const handleDownloadAll = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    bills.forEach((bill, i) => {
      if (i > 0) doc.addPage();
      drawBillOnDoc(doc, autoTable, bill);
    });
    doc.save(`ThePaani_BulkBills_${format(fromDate!, 'yyyy-MM-dd')}_to_${format(toDate!, 'yyyy-MM-dd')}.pdf`);
  };

  const sendBillWhatsApp = async (bill: CustomerBillData) => {
    setSeqSending(true);
    try {
      const doc = await buildSinglePdf(bill);
      const pdfBlob = doc.output('blob');
      const fileName = `ThePaani_Bill_${bill.intId}_${bill.name}_${format(fromDate!, 'yyyy-MM-dd')}_to_${format(toDate!, 'yyyy-MM-dd')}.pdf`;
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.({ files: [pdfFile] })) {
        await navigator.share({ files: [pdfFile], title: `The Paani™ Bill – ${bill.name}` });
        return;
      }

      // Desktop fallback: download PDF + open WhatsApp
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
      if (bill.phone) {
        const phone = bill.phone.replace(/\D/g, '').replace(/^0/, '92');
        window.open(`https://wa.me/${phone}`, '_blank');
      }
    } catch { /* user dismissed share */ } finally {
      setSeqSending(false);
    }
  };

  const seqBill = seqIndex !== null ? bills[seqIndex] : null;

  const handleClose = (v: boolean) => {
    onOpenChange(v);
    if (!v) { setGenerated(false); setBills([]); setSeqIndex(null); setUseFullMonth(false); setSpecificCustomer(false); setCustomerIdInput(''); }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[680px] glass-card max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Bulk Bills
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Full Month toggle */}
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 cursor-pointer select-none" onClick={() => setUseFullMonth(v => !v)}>
            <div onClick={e => e.stopPropagation()}>
              <Checkbox
                id="useFullMonth"
                checked={useFullMonth}
                onCheckedChange={(v) => setUseFullMonth(v as boolean)}
              />
            </div>
            <span className="text-sm font-medium">Full Month</span>
            {useFullMonth && (
              <div className="flex items-center gap-1 ml-auto" onClick={e => e.stopPropagation()}>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  disabled={selectedMonth <= APRIL_2026}
                  onClick={() => setSelectedMonth(m => { const prev = startOfMonth(subMonths(m, 1)); return prev < APRIL_2026 ? APRIL_2026 : prev; })}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold w-28 text-center">{format(selectedMonth, 'MMMM yyyy')}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedMonth(m => startOfMonth(addMonths(m, 1)))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={cn('text-sm font-medium mb-1.5 block', useFullMonth && 'text-muted-foreground')}>From</label>
              <Popover open={fromOpen} onOpenChange={v => { if (!useFullMonth) setFromOpen(v); }}>
                <PopoverTrigger asChild>
                  <Button variant="outline" disabled={useFullMonth} className={cn('w-full justify-start text-left font-normal text-sm', !fromDate && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    {fromDate ? format(fromDate, 'MMM d, yyyy') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={fromDate} onSelect={(d) => { setFromDate(d); setFromOpen(false); setGenerated(false); setBills([]); if (d && !toDate) setToDate(new Date()); }} initialFocus disabled={(d) => d < APRIL_2026} />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className={cn('text-sm font-medium mb-1.5 block', useFullMonth && 'text-muted-foreground')}>To</label>
              <Popover open={toOpen} onOpenChange={v => { if (!useFullMonth) setToOpen(v); }}>
                <PopoverTrigger asChild>
                  <Button variant="outline" disabled={useFullMonth} className={cn('w-full justify-start text-left font-normal text-sm', !toDate && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    {toDate ? format(toDate, 'MMM d, yyyy') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={toDate} onSelect={(d) => { setToDate(d); setToOpen(false); setGenerated(false); setBills([]); }} initialFocus disabled={(d) => d < APRIL_2026} />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Specific customer filter */}
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 cursor-pointer select-none" onClick={() => { setSpecificCustomer(v => !v); setCustomerIdInput(''); setGenerated(false); setBills([]); }}>
            <div onClick={e => e.stopPropagation()}>
              <Checkbox
                id="specificCustomer"
                checked={specificCustomer}
                onCheckedChange={(v) => { setSpecificCustomer(v as boolean); setCustomerIdInput(''); setGenerated(false); setBills([]); }}
              />
            </div>
            <span className="text-sm font-medium whitespace-nowrap">Specific Customer ID</span>
            {specificCustomer && (
              <Input
                type="number"
                min="1"
                placeholder="Enter ID…"
                value={customerIdInput}
                onChange={e => { setCustomerIdInput(e.target.value); setGenerated(false); setBills([]); }}
                onClick={e => e.stopPropagation()}
                className="h-7 w-28 text-sm ml-auto"
              />
            )}
          </div>

          <div className={cn("flex items-center gap-3", specificCustomer && "opacity-50 pointer-events-none")}>
            <label className="text-sm font-medium whitespace-nowrap">Payment Type</label>
            <Select value={specificCustomer ? 'all' : paymentFilter} onValueChange={(v: 'all' | 'cash' | 'account') => { setPaymentFilter(v); setGenerated(false); setBills([]); }} disabled={specificCustomer}>
              <SelectTrigger className="h-9 text-sm w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="account">Account</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={fetchData} disabled={!fromDate || !toDate || isLoading} className="w-full bg-gradient-to-r from-primary via-accent to-primary">
            {isLoading ? 'Loading...' : 'Generate Bills'}
          </Button>

          {generated && (
            bills.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">No customers with deliveries in this period.</p>
            ) : (
              <>
                {/* Summary */}
                <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-sm flex justify-between items-center">
                  <span className="text-muted-foreground">{bills.length} customers</span>
                  <span className="font-semibold text-primary">{totalCansAll} cans &nbsp;·&nbsp; Rs. {totalAmountAll.toFixed(0)}</span>
                </div>

                {/* Sequential send overlay */}
                {seqIndex !== null && seqBill ? (
                  <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {seqIndex > 0 && (
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground" onClick={() => setSeqIndex(seqIndex - 1)}>
                            <ChevronLeft className="h-3.5 w-3.5" /> Prev
                          </Button>
                        )}
                        <span className="text-xs text-muted-foreground font-medium">SENDING BILL</span>
                      </div>
                      <span className="text-xs font-semibold text-primary">{seqIndex + 1} / {bills.length}</span>
                    </div>

                    <Progress value={((seqIndex + 1) / bills.length) * 100} className="h-1.5" />

                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-base truncate">{seqBill.name}</p>
                          <p className="text-xs text-muted-foreground">
                            ID: {seqBill.intId} · {seqBill.totalCans} cans · Billed <span className="tabular-nums font-medium">Rs. {seqBill.totalAmount.toFixed(0)}</span>
                          </p>
                          {seqBill.phone
                            ? <p className="text-xs text-muted-foreground">📞 {seqBill.phone}</p>
                            : <p className="text-xs text-orange-500">No phone — will download PDF only</p>
                          }
                        </div>
                        {seqBill.netPayable <= 0 ? (
                          <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/40 border border-green-200 dark:border-green-800 rounded-md px-2 py-0.5 shrink-0">PAID</span>
                        ) : (
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold tabular-nums text-primary leading-tight">Rs. {seqBill.netPayable.toFixed(0)}</p>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary/70 leading-tight">DUE</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => sendBillWhatsApp(seqBill)}
                        disabled={seqSending}
                        className="flex-1 bg-[#25D366] hover:bg-[#1ebe5d] text-white"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4 mr-2 fill-white" xmlns="http://www.w3.org/2000/svg">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        {seqSending ? 'Opening...' : 'Send PDF'}
                      </Button>
                      <Button variant="outline" onClick={() => setSeqIndex(seqIndex + 1 < bills.length ? seqIndex + 1 : null)} className="gap-1.5">
                        <SkipForward className="h-4 w-4" /> Skip
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setSeqIndex(seqIndex + 1 < bills.length ? seqIndex + 1 : null)}
                        className="gap-1.5 border-green-500 text-green-600 hover:bg-green-50"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Done
                      </Button>
                    </div>

                    {seqIndex + 1 >= bills.length && (
                      <p className="text-center text-xs text-muted-foreground">This is the last customer.</p>
                    )}

                    <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setSeqIndex(null)}>
                      Exit Sequential Mode
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Action buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" onClick={handleDownloadAll} className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium">Download All PDF</span>
                      </Button>
                      <Button
                        onClick={() => setSeqIndex(0)}
                        className="flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white shrink-0" xmlns="http://www.w3.org/2000/svg">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        <span className="text-sm font-medium">Send All Sequentially</span>
                      </Button>
                    </div>

                    {/* Customer bills — card list */}
                    <div className="space-y-2">
                      {bills.map((bill) => {
                        const prevTotalRow = bill.previousDues.reduce((s, d) => s + d.amount, 0);
                        const totalCharged = bill.totalAmount + prevTotalRow;
                        const paidRow = totalCharged > 0 ? Math.max(0, totalCharged - bill.netPayable) : 0;
                        const isPaid = bill.netPayable <= 0;
                        return (
                          <div key={bill.intId} className="rounded-xl border bg-card overflow-hidden">
                            <div className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-1">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-semibold text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">#{bill.intId}</span>
                                  <p className="text-sm font-semibold truncate">{bill.name}</p>
                                </div>
                                {bill.phone && <p className="text-[10px] text-muted-foreground mt-0.5">{bill.phone}</p>}
                              </div>
                              <Button
                                variant="ghost" size="sm"
                                className="h-8 w-8 p-0 hover:bg-[#25D366]/10 shrink-0"
                                onClick={() => sendBillWhatsApp(bill)}
                                title={bill.phone ? `Send to ${bill.phone}` : 'No phone — will download PDF'}
                              >
                                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-[#25D366]" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                              </Button>
                            </div>
                            <div className={cn(
                              'flex items-end justify-between gap-2 px-3 pb-2.5',
                              isPaid ? 'bg-green-50/50 dark:bg-green-950/10' : ''
                            )}>
                              <div className="text-xs space-y-0.5">
                                <p className="text-muted-foreground">
                                  <span className="font-semibold text-foreground tabular-nums">{bill.totalCans}</span> cans
                                  {' · '}Billed <span className="font-semibold text-foreground tabular-nums">Rs. {bill.totalAmount.toFixed(0)}</span>
                                </p>
                                {prevTotalRow > 0 && (
                                  <p className="text-destructive font-medium">+ Prev dues Rs. <span className="tabular-nums">{prevTotalRow.toFixed(0)}</span></p>
                                )}
                                {paidRow > 0 && (
                                  <p className="text-green-600 dark:text-green-400 font-semibold">Paid Rs. <span className="tabular-nums">{paidRow.toFixed(0)}</span></p>
                                )}
                              </div>
                              <div className="shrink-0 text-right">
                                {isPaid ? (
                                  <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/40 border border-green-200 dark:border-green-800 rounded-md px-2 py-0.5">PAID</span>
                                ) : (
                                  <>
                                    <p className="text-sm font-bold tabular-nums text-primary leading-tight">Rs. {bill.netPayable.toFixed(0)}</p>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-primary/70 leading-tight">DUE</p>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Totals footer */}
                      <div className="rounded-xl border-2 border-primary/20 bg-primary/5 px-3 py-2.5 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold">{bills.length} customers · <span className="tabular-nums">{totalCansAll}</span> cans</p>
                          <p className="text-[10px] text-muted-foreground tabular-nums">Billed Rs. {totalAmountAll.toFixed(0)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground font-medium">Total Due</p>
                          <p className="text-base font-bold tabular-nums text-primary">Rs. {bills.reduce((s, b) => s + Math.max(0, b.netPayable), 0).toFixed(0)}</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
