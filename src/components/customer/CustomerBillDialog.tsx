"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { CalendarIcon, FileText, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { Customer, DeliveryRequest } from '@/types';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/api';
import { cn } from '@/lib/utils';

interface CustomerBillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
  customerId: string;
}

export default function CustomerBillDialog({ open, onOpenChange, customer, customerId }: CustomerBillDialogProps) {
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [billRequests, setBillRequests] = useState<DeliveryRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [useFullMonth, setUseFullMonth] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => startOfMonth(subMonths(new Date(), 1)));

  useEffect(() => {
    if (useFullMonth) {
      setFromDate(startOfMonth(selectedMonth));
      setToDate(endOfMonth(selectedMonth));
      setGenerated(false);
      setBillRequests([]);
    }
  }, [useFullMonth, selectedMonth]);

  const totalCans = billRequests.reduce((sum, r) => sum + (r.cans || 0), 0);
  const totalAmount = billRequests.reduce((sum, r) => sum + ((r.cans || 0) * ((r as any).pricePerCan || 0)), 0);

  const fetchBillData = async () => {
    if (!fromDate || !toDate) return;
    setIsLoading(true);
    try {
      const start = new Date(fromDate);
      start.setHours(0, 0, 0, 0);
      const endForApi = new Date(toDate);
      endForApi.setHours(0, 0, 0, 0);
      endForApi.setDate(endForApi.getDate() + 1);

      const url = buildApiUrl(
        `${API_ENDPOINTS.DELIVERY_REQUESTS}?customerId=${customerId}&status=delivered&startDate=${start.toISOString()}&endDate=${endForApi.toISOString()}&page=1&limit=10000`
      );
      const res = await fetch(url);
      if (res.ok) {
        const result = await res.json();
        const data: DeliveryRequest[] = Array.isArray(result) ? result : (result?.data || []);
        data.sort((a, b) =>
          new Date(a.requestedAt!).getTime() - new Date(b.requestedAt!).getTime()
        );
        setBillRequests(data);
        setGenerated(true);
      }
    } catch (err) {
      console.error('Error fetching bill data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getBillRows = () =>
    billRequests.map((r, i) => [
      String(i + 1),
      r.requestedAt ? format(new Date(r.requestedAt), 'MMM d, yyyy') : '-',
      String(r.cans || 0),
      `Rs. ${(r as any).pricePerCan || 0}`,
      `Rs. ${((r.cans || 0) * ((r as any).pricePerCan || 0)).toFixed(0)}`,
    ]);

  const handleDownloadPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const labelX = 14;
    const valueX = 52;

    // Company header
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(63, 81, 181);
    doc.text('The Paani™', labelX, 20);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90);
    doc.text('RAHMATPUR LATIF COLONY, NEAR ARFAT MASJID, LARKANO', labelX, 27);
    doc.text('TEL: 0333 786 0 444', labelX, 33);
    doc.setTextColor(63, 81, 181);
    doc.textWithLink('www.paani.online', labelX, 39, { url: 'https://www.paani.online' });

    // Divider
    doc.setDrawColor(63, 81, 181);
    doc.setLineWidth(0.5);
    doc.line(labelX, 43, pageW - 14, 43);

    // Customer details — all values in uppercase
    const custIntId = (customer as any).intId ?? (customer as any).id ?? '';
    const paymentType = billRequests.length > 0
      ? ((billRequests[0] as any).paymentType === 'cash' ? 'Cash' : 'Account')
      : (customer as any).paymentType === 'cash' ? 'Cash' : 'Account';
    const period = `${format(fromDate!, 'MMM d, yyyy')} – ${format(toDate!, 'MMM d, yyyy')}`.toUpperCase();
    const fields: [string, string][] = [
      ['CUSTOMER NAME', customer.name.toUpperCase()],
      ...(custIntId ? [['CUSTOMER ID', String(custIntId)] as [string, string]] : []),
      ['PAYMENT TYPE', paymentType],
      ['ADDRESS', customer.address.toUpperCase()],
      ...(customer.phone ? [['PHONE NUMBER', customer.phone] as [string, string]] : []),
      ['BILLING PERIOD', period],
    ];

    let y = 52;
    doc.setFontSize(10);
    fields.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60);
      doc.text(`${label}:`, labelX, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);
      doc.text(value, valueX, y);
      y += 7;
    });

    doc.setFontSize(7.5);
    doc.setTextColor(150);
    doc.setFont('helvetica', 'italic');
    doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')}`, labelX, y);

    // Column widths must sum to 182mm (210 - 14 margin × 2)
    autoTable(doc, {
      startY: y + 6,
      head: [[
        { content: '#', styles: { halign: 'center' } },
        { content: 'Date', styles: { halign: 'left' } },
        { content: 'Cans', styles: { halign: 'center' } },
        { content: 'Price / Can', styles: { halign: 'right' } },
        { content: 'Subtotal', styles: { halign: 'right' } },
      ]],
      body: getBillRows(),
      foot: [[
        { content: '', styles: { halign: 'center' } },
        { content: 'TOTAL', styles: { halign: 'left' } },
        { content: String(totalCans), styles: { halign: 'center' } },
        { content: '', styles: { halign: 'right' } },
        { content: `Rs. ${totalAmount.toFixed(0)}`, styles: { halign: 'right' } },
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

    // Page footer — disclaimer only
    const pageH = doc.internal.pageSize.getHeight();
    const disclaimer = 'This is a system-generated invoice and does not require a signature.';
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150, 150, 150);
    const disclaimerW = doc.getTextWidth(disclaimer);
    doc.text(disclaimer, (pageW - disclaimerW) / 2, pageH - 6);

    doc.save(`ThePaani_Bill_${custIntId ? `${custIntId}_` : ''}${customer.name}_${format(fromDate!, 'yyyy-MM-dd')}_to_${format(toDate!, 'yyyy-MM-dd')}.pdf`);
  };

  const handleDownloadExcel = async () => {
    const XLSX = await import('xlsx');

    const excelIntId = (customer as any).intId ?? (customer as any).id ?? '';
    const excelPt = billRequests.length > 0
      ? ((billRequests[0] as any).paymentType === 'cash' ? 'Cash' : 'Account')
      : (customer as any).paymentType === 'cash' ? 'Cash' : 'Account';
    const header = [
      ['The Paani™ — Bill'],
      ['RAHMATPUR LATIF COLONY, NEAR ARFAT MASJID, LARKANO'],
      ['TEL: 0333 786 0 444'],
      [],
      [`Customer Name: ${customer.name}`],
      ...(excelIntId ? [[`Customer ID: ${excelIntId}`]] : []),
      [`Payment Type: ${excelPt}`],
      [`Address: ${customer.address}`],
      ...(customer.phone ? [[`Phone Number: ${customer.phone}`]] : []),
      [`Billing Period: ${format(fromDate!, 'MMM d, yyyy')} – ${format(toDate!, 'MMM d, yyyy')}`],
      [`Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')}`],
      [],
      ['#', 'Date', 'Cans', 'Price / Can (Rs)', 'Subtotal (Rs)'],
    ];
    const rows = billRequests.map((r, i) => [
      i + 1,
      r.requestedAt ? format(new Date(r.requestedAt), 'MMM d, yyyy') : '-',
      r.cans || 0,
      (r as any).pricePerCan || 0,
      (r.cans || 0) * ((r as any).pricePerCan || 0),
    ]);
    const footer = [[], ['', 'TOTAL', totalCans, '', totalAmount]];

    const ws = XLSX.utils.aoa_to_sheet([...header, ...rows, ...footer]);
    ws['!cols'] = [{ wch: 4 }, { wch: 16 }, { wch: 6 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bill');
    XLSX.writeFile(wb, `ThePaani_Bill_${excelIntId ? `${excelIntId}_` : ''}${customer.name}_${format(fromDate!, 'yyyy-MM-dd')}_to_${format(toDate!, 'yyyy-MM-dd')}.xlsx`);
  };

  const buildWhatsAppText = () => {
    const waIntId = (customer as any).intId ?? (customer as any).id ?? '';
    const waPt = billRequests.length > 0
      ? ((billRequests[0] as any).paymentType === 'cash' ? 'Cash' : 'Account')
      : (customer as any).paymentType === 'cash' ? 'Cash' : 'Account';
    return `*The Paani™ — Bill*\n\n` +
    `*Customer Name:* ${customer.name}\n` +
    (waIntId ? `*Customer ID:* ${waIntId}\n` : '') +
    `*Payment Type:* ${waPt}\n` +
    `*Address:* ${customer.address}\n` +
    (customer.phone ? `*Phone Number:* ${customer.phone}\n` : '') +
    `*Billing Period:* ${format(fromDate!, 'MMM d, yyyy')} – ${format(toDate!, 'MMM d, yyyy')}\n\n` +
    billRequests.map((r, i) => {
      const sub = ((r.cans || 0) * ((r as any).pricePerCan || 0)).toFixed(0);
      return `${i + 1}. ${r.requestedAt ? format(new Date(r.requestedAt), 'MMM d') : '-'} — ${r.cans} cans × Rs.${(r as any).pricePerCan || 0} = Rs.${sub}`;
    }).join('\n') +
    `\n\n*Total Cans: ${totalCans}*\n*Total Amount: Rs. ${totalAmount.toFixed(0)}*`;
  };

  const handleWhatsAppShare = async () => {
    const text = buildWhatsAppText();

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        const doc = new jsPDF();
        const pageW2 = doc.internal.pageSize.getWidth();
        const lx = 14; const vx = 52;
        doc.setFontSize(22); doc.setFont('helvetica', 'bold'); doc.setTextColor(63, 81, 181);
        doc.text('The Paani™', lx, 20);
        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(90);
        doc.text('RAHMATPUR LATIF COLONY, NEAR ARFAT MASJID, LARKANO', lx, 27);
        doc.text('TEL: 0333 786 0 444', lx, 33);
        doc.setTextColor(63, 81, 181);
        doc.textWithLink('www.paani.online', lx, 39, { url: 'https://www.paani.online' });
        doc.setDrawColor(63, 81, 181); doc.setLineWidth(0.5); doc.line(lx, 43, pageW2 - 14, 43);
        const waIntId2 = (customer as any).intId ?? (customer as any).id ?? '';
        const waPt2 = billRequests.length > 0
          ? ((billRequests[0] as any).paymentType === 'cash' ? 'Cash' : 'Account')
          : (customer as any).paymentType === 'cash' ? 'Cash' : 'Account';
        const period2 = `${format(fromDate!, 'MMM d, yyyy')} – ${format(toDate!, 'MMM d, yyyy')}`.toUpperCase();
        const fs2: [string, string][] = [
          ['CUSTOMER NAME', customer.name.toUpperCase()],
          ...(waIntId2 ? [['CUSTOMER ID', String(waIntId2)] as [string, string]] : []),
          ['PAYMENT TYPE', waPt2],
          ['ADDRESS', customer.address.toUpperCase()],
          ...(customer.phone ? [['PHONE NUMBER', customer.phone] as [string, string]] : []),
          ['BILLING PERIOD', period2],
        ];
        let y2 = 52; doc.setFontSize(10);
        fs2.forEach(([label, value]) => {
          doc.setFont('helvetica', 'bold'); doc.setTextColor(60); doc.text(`${label}:`, lx, y2);
          doc.setFont('helvetica', 'normal'); doc.setTextColor(0); doc.text(value, vx, y2); y2 += 7;
        });
        doc.setFontSize(7.5); doc.setTextColor(150); doc.setFont('helvetica', 'italic');
        doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')}`, lx, y2);
        autoTable(doc, {
          startY: y2 + 6,
          head: [[
        { content: '#', styles: { halign: 'center' } },
        { content: 'Date', styles: { halign: 'left' } },
        { content: 'Cans', styles: { halign: 'center' } },
        { content: 'Price / Can', styles: { halign: 'right' } },
        { content: 'Subtotal', styles: { halign: 'right' } },
      ]],
          body: getBillRows(),
          foot: [[
            { content: '', styles: { halign: 'center' } },
            { content: 'TOTAL', styles: { halign: 'left' } },
            { content: String(totalCans), styles: { halign: 'center' } },
            { content: '', styles: { halign: 'right' } },
            { content: `Rs. ${totalAmount.toFixed(0)}`, styles: { halign: 'right' } },
          ]],
          headStyles: { fillColor: [63, 81, 181], fontSize: 9.5, fontStyle: 'bold' },
          footStyles: { fillColor: [230, 230, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9.5 },
          styles: { fontSize: 9, cellPadding: 3 },
          columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 45, halign: 'left' }, 2: { cellWidth: 22, halign: 'center' }, 3: { cellWidth: 52, halign: 'right' }, 4: { cellWidth: 53, halign: 'right' } },
          alternateRowStyles: { fillColor: [248, 249, 255] },
        });

        // Page footer — disclaimer only
        const pageH2 = doc.internal.pageSize.getHeight();
        const disclaimer2 = 'This is a system-generated invoice and does not require a signature.';
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(150, 150, 150);
        const disclaimerW2 = doc.getTextWidth(disclaimer2);
        doc.text(disclaimer2, (pageW2 - disclaimerW2) / 2, pageH2 - 6);

        const pdfBlob = doc.output('blob');
        const waIntId3 = (customer as any).intId ?? (customer as any).id ?? '';
        const pdfFile = new File([pdfBlob], `ThePaani_Bill_${waIntId3 ? `${waIntId3}_` : ''}${customer.name}.pdf`, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
          await navigator.share({ files: [pdfFile], title: 'The Paani™ Bill' });
          return;
        }
      } catch { /* fall through */ }
      try {
        await navigator.share({ text });
        return;
      } catch { /* fall through */ }
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setGenerated(false); setBillRequests([]); setUseFullMonth(false); } }}>
      <DialogContent className="sm:max-w-[580px] glass-card max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">Generate Bill</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Full Month toggle */}
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
            <Checkbox
              id="billFullMonth"
              checked={useFullMonth}
              onCheckedChange={(v) => setUseFullMonth(v as boolean)}
            />
            <Label htmlFor="billFullMonth" className="text-sm cursor-pointer select-none font-medium">Full Month</Label>
            {useFullMonth && (
              <div className="flex items-center gap-1 ml-auto">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedMonth(m => startOfMonth(subMonths(m, 1)))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold w-28 text-center">{format(selectedMonth, 'MMMM yyyy')}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedMonth(m => startOfMonth(addMonths(m, 1)))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Date Range */}
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
                  <Calendar mode="single" selected={fromDate} onSelect={(d) => { setFromDate(d); setFromOpen(false); setGenerated(false); setBillRequests([]); if (d && !toDate) setToDate(new Date()); }} initialFocus />
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
                  <Calendar mode="single" selected={toDate} onSelect={(d) => { setToDate(d); setToOpen(false); setGenerated(false); setBillRequests([]); }} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <Button
            onClick={fetchBillData}
            disabled={!fromDate || !toDate || isLoading}
            className="w-full bg-gradient-to-r from-primary via-accent to-primary"
          >
            {isLoading ? 'Loading...' : 'Generate Bill'}
          </Button>

          {/* Bill Table */}
          {generated && (
            billRequests.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">No delivered requests in this date range.</p>
            ) : (
              <>
                {/* Customer info strip */}
                <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-sm space-y-0.5">
                  <p className="font-semibold text-primary">{customer.name}</p>
                  <p className="text-muted-foreground text-xs">{customer.address}</p>
                  <p className="text-muted-foreground text-xs">
                    {format(fromDate!, 'MMM d, yyyy')} &ndash; {format(toDate!, 'MMM d, yyyy')}
                  </p>
                </div>

                {/* Table */}
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-primary text-primary-foreground">
                        <th className="px-2 py-2 text-left w-8">#</th>
                        <th className="px-2 py-2 text-left">Date</th>
                        <th className="px-2 py-2 text-center">Cans</th>
                        <th className="px-2 py-2 text-right">Price/Can</th>
                        <th className="px-2 py-2 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billRequests.map((r, i) => (
                        <tr key={r._id || r.requestId} className={i % 2 === 0 ? '' : 'bg-muted/30'}>
                          <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            {r.requestedAt ? format(new Date(r.requestedAt), 'MMM d, yyyy') : '-'}
                          </td>
                          <td className="px-2 py-1.5 text-center">{r.cans}</td>
                          <td className="px-2 py-1.5 text-right">Rs. {(r as any).pricePerCan || 0}</td>
                          <td className="px-2 py-1.5 text-right font-medium">
                            Rs. {((r.cans || 0) * ((r as any).pricePerCan || 0)).toFixed(0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted border-t-2 font-bold">
                        <td colSpan={2} className="px-2 py-2 text-sm">Total</td>
                        <td className="px-2 py-2 text-center text-sm">{totalCans}</td>
                        <td />
                        <td className="px-2 py-2 text-right text-sm">Rs. {totalAmount.toFixed(0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <Button variant="outline" onClick={handleDownloadPDF} className="flex flex-col h-auto py-3 gap-1.5">
                    <FileText className="h-5 w-5 text-red-500" />
                    <span className="text-xs font-medium">PDF</span>
                  </Button>
                  <Button variant="outline" onClick={handleDownloadExcel} className="flex flex-col h-auto py-3 gap-1.5">
                    <FileSpreadsheet className="h-5 w-5 text-green-600" />
                    <span className="text-xs font-medium">Excel</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleWhatsAppShare}
                    className="flex flex-col h-auto py-3 gap-1.5"
                    style={{ borderColor: '#25D36650' }}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#25D366]" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    <span className="text-xs font-medium">WhatsApp</span>
                  </Button>
                </div>
              </>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
