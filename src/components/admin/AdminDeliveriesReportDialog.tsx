"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon, FileText, FileSpreadsheet } from 'lucide-react';
import type { DeliveryRequest } from '@/types';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface AdminDeliveriesReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AdminDeliveriesReportDialog({ open, onOpenChange }: AdminDeliveriesReportDialogProps) {
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [requests, setRequests] = useState<DeliveryRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [filterByCustomerId, setFilterByCustomerId] = useState(false);
  const [customerIdInput, setCustomerIdInput] = useState('');

  const totalCans = requests.reduce((s, r) => s + (r.cans || 0), 0);
  const totalAmount = requests.reduce((s, r) => s + ((r.cans || 0) * ((r as any).pricePerCan || 0)), 0);
  const cashCans = requests.filter(r => r.paymentType === 'cash').reduce((s, r) => s + (r.cans || 0), 0);
  const cashAmount = requests.filter(r => r.paymentType === 'cash').reduce((s, r) => s + ((r.cans || 0) * ((r as any).pricePerCan || 0)), 0);
  const accountCans = requests.filter(r => r.paymentType !== 'cash').reduce((s, r) => s + (r.cans || 0), 0);
  const accountAmount = requests.filter(r => r.paymentType !== 'cash').reduce((s, r) => s + ((r.cans || 0) * ((r as any).pricePerCan || 0)), 0);

  const fetchData = async () => {
    if (!fromDate || !toDate) return;
    setIsLoading(true);
    try {
      const start = new Date(fromDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      const endForApi = new Date(end);
      endForApi.setDate(endForApi.getDate() + 1);

      const url = buildApiUrl(
        `${API_ENDPOINTS.DELIVERY_REQUESTS}?status=delivered&startDate=${start.toISOString()}&endDate=${endForApi.toISOString()}&page=1&limit=10000`
      );
      const res = await fetch(url);
      if (res.ok) {
        const result = await res.json();
        let data: DeliveryRequest[] = Array.isArray(result) ? result : (result?.data || []);
        if (filterByCustomerId && customerIdInput.trim()) {
          const targetId = parseInt(customerIdInput.trim(), 10);
          data = data.filter(r => (r as any).customerIntId === targetId);
        }
        data.sort((a, b) => new Date(a.requestedAt!).getTime() - new Date(b.requestedAt!).getTime());
        setRequests(data);
        setGenerated(true);
      }
    } catch (err) {
      console.error('Error fetching deliveries report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getRows = () =>
    requests.map((r, i) => {
      if (filterByCustomerId) return [
        String(i + 1),
        r.requestedAt ? format(new Date(r.requestedAt), 'MMM d, yyyy') : '-',
        String(r.cans || 0),
        `Rs. ${(r as any).pricePerCan || 0}`,
        `Rs. ${((r.cans || 0) * ((r as any).pricePerCan || 0)).toFixed(0)}`,
        '',
      ];
      return [
        String(i + 1),
        String((r as any).customerIntId || '-'),
        r.customerName || '-',
        r.requestedAt ? format(new Date(r.requestedAt), 'MMM d, yyyy') : '-',
        String(r.cans || 0),
        `Rs. ${(r as any).pricePerCan || 0}`,
        `Rs. ${((r.cans || 0) * ((r as any).pricePerCan || 0)).toFixed(0)}`,
        r.paymentType ? (r.paymentType === 'cash' ? 'Cash' : 'Account') : '-',
        '',
      ];
    });

  const buildPdfDoc = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'landscape' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const lx = 14;

    doc.setFontSize(20); doc.setFont('helvetica', 'bold'); doc.setTextColor(63, 81, 181);
    doc.text('The Paani™', lx, 18);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(90);
    doc.text('RAHMATPUR LATIF COLONY, NEAR ARFAT MASJID, LARKANO', lx, 24);
    doc.text('TEL: 0333 786 0 444', lx, 29);
    doc.setTextColor(63, 81, 181);
    doc.textWithLink('www.paani.online', lx, 34, { url: 'https://www.paani.online' });

    doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(63, 81, 181);
    doc.text('DELIVERIES REPORT', pageW - lx, 18, { align: 'right' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(60);
    const period = `${format(fromDate!, 'MMM d, yyyy')} – ${format(toDate!, 'MMM d, yyyy')}`;
    doc.text(`Period: ${period}`, pageW - lx, 24, { align: 'right' });
    doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')}`, pageW - lx, 29, { align: 'right' });

    doc.setDrawColor(63, 81, 181); doc.setLineWidth(0.5); doc.line(lx, 38, pageW - lx, 38);

    let tableStartY = 43;
    if (filterByCustomerId && requests.length > 0) {
      const first = requests[0];
      const custPt = (first as any).paymentType === 'cash' ? 'Cash' : 'Account';
      const infoFields: [string, string][] = [
        ['CUSTOMER NAME', (first.customerName || '-').toUpperCase()],
        ['CUSTOMER ID', customerIdInput.trim()],
        ['PAYMENT TYPE', custPt],
        ['PERIOD', `${format(fromDate!, 'MMM d, yyyy')} – ${format(toDate!, 'MMM d, yyyy')}`.toUpperCase()],
      ];
      const vx = 52;
      let iy = 45;
      doc.setFontSize(10);
      infoFields.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold'); doc.setTextColor(60);
        doc.text(`${label}:`, lx, iy);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(0);
        doc.text(value, vx, iy);
        iy += 7;
      });
      doc.setDrawColor(63, 81, 181); doc.setLineWidth(0.5); doc.line(lx, iy + 1, pageW - lx, iy + 1);
      tableStartY = iy + 7;
    }

    const remarksColIndex = filterByCustomerId ? 5 : 8;

    autoTable(doc, {
      startY: tableStartY,
      showFoot: 'lastPage',
      head: [filterByCustomerId ? [
        { content: 'S.No', styles: { halign: 'center' } },
        { content: 'Date', styles: { halign: 'left' } },
        { content: 'Cans', styles: { halign: 'center' } },
        { content: 'Price / Can', styles: { halign: 'right' } },
        { content: 'Subtotal', styles: { halign: 'right' } },
        { content: 'Remarks', styles: { halign: 'left' } },
      ] : [
        { content: 'S.No', styles: { halign: 'center' } },
        { content: 'ID', styles: { halign: 'center' } },
        { content: 'Customer Name', styles: { halign: 'left' } },
        { content: 'Date', styles: { halign: 'left' } },
        { content: 'Cans', styles: { halign: 'center' } },
        { content: 'Price / Can', styles: { halign: 'right' } },
        { content: 'Subtotal', styles: { halign: 'right' } },
        { content: 'Payment Type', styles: { halign: 'center' } },
        { content: 'Remarks', styles: { halign: 'left' } },
      ]],
      body: getRows(),
      foot: filterByCustomerId ? [
        [
          { content: '', styles: { halign: 'center' } },
          { content: 'TOTAL', styles: { halign: 'left' } },
          { content: String(totalCans), styles: { halign: 'center' } },
          { content: '', styles: { halign: 'right' } },
          { content: `Rs. ${totalAmount.toFixed(0)}`, styles: { halign: 'right' } },
          { content: '', styles: { halign: 'left' } },
        ],
      ] : [
        [
          { content: '', styles: { halign: 'center' } },
          { content: '', styles: { halign: 'center' } },
          { content: 'Total Cash', styles: { halign: 'left' } },
          { content: '', styles: { halign: 'left' } },
          { content: String(cashCans), styles: { halign: 'center' } },
          { content: '', styles: { halign: 'right' } },
          { content: `Rs. ${cashAmount.toFixed(0)}`, styles: { halign: 'right' } },
          { content: '', styles: { halign: 'center' } },
          { content: '', styles: { halign: 'left' } },
        ],
        [
          { content: '', styles: { halign: 'center' } },
          { content: '', styles: { halign: 'center' } },
          { content: 'Total Account', styles: { halign: 'left' } },
          { content: '', styles: { halign: 'left' } },
          { content: String(accountCans), styles: { halign: 'center' } },
          { content: '', styles: { halign: 'right' } },
          { content: `Rs. ${accountAmount.toFixed(0)}`, styles: { halign: 'right' } },
          { content: '', styles: { halign: 'center' } },
          { content: '', styles: { halign: 'left' } },
        ],
        [
          { content: '', styles: { halign: 'center' } },
          { content: '', styles: { halign: 'center' } },
          { content: 'Grand Total', styles: { halign: 'left', fontStyle: 'bold' } },
          { content: '', styles: { halign: 'left' } },
          { content: String(totalCans), styles: { halign: 'center', fontStyle: 'bold' } },
          { content: '', styles: { halign: 'right' } },
          { content: `Rs. ${totalAmount.toFixed(0)}`, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: '', styles: { halign: 'center' } },
          { content: '', styles: { halign: 'left' } },
        ],
      ],
      headStyles: { fillColor: [63, 81, 181], fontSize: 9, fontStyle: 'bold' },
      footStyles: { fillColor: [230, 230, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 8.5, cellPadding: 3 },
      columnStyles: filterByCustomerId ? {
        0: { cellWidth: 14, halign: 'center' },
        1: { cellWidth: 32, halign: 'left' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 35, halign: 'right' },
        5: { cellWidth: 138, halign: 'left' },
      } : {
        0: { cellWidth: 14, halign: 'center' },
        1: { cellWidth: 14, halign: 'center' },
        2: { cellWidth: 62, halign: 'left' },
        3: { cellWidth: 26, halign: 'left' },
        4: { cellWidth: 14, halign: 'center' },
        5: { cellWidth: 24, halign: 'right' },
        6: { cellWidth: 26, halign: 'right' },
        7: { cellWidth: 26, halign: 'center' },
        8: { cellWidth: 63, halign: 'left' },
      },
      alternateRowStyles: { fillColor: [248, 249, 255] },
      didParseCell: (data: any) => {
        if (data.column.index === remarksColIndex) {
          data.cell.styles.cellPadding = { top: 3, right: 3, bottom: 3, left: 20 };
        }
      },
    });

    const disclaimer = 'This is a system-generated report and does not require a signature.';
    doc.setFontSize(9.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(150, 150, 150);
    const dw = doc.getTextWidth(disclaimer);
    doc.text(disclaimer, (pageW - dw) / 2, pageH - 6);

    return doc;
  };

  const pdfFileName = () => {
    const base = `ThePaani_Deliveries`;
    const datePart = `${format(fromDate!, 'yyyy-MM-dd')}_to_${format(toDate!, 'yyyy-MM-dd')}`;
    if (filterByCustomerId && customerIdInput.trim() && requests.length > 0) {
      const custName = (requests[0].customerName || '').replace(/\s+/g, '_');
      return `${base}_${customerIdInput.trim()}_${custName}_${datePart}.pdf`;
    }
    return `${base}_${datePart}.pdf`;
  };

  const handleDownloadPDF = async () => {
    const doc = await buildPdfDoc();
    doc.save(pdfFileName());
  };

  const handleWhatsAppShare = async () => {
    const customerLine = filterByCustomerId && customerIdInput.trim() ? `*Customer ID:* ${customerIdInput.trim()}\n` : '';
    const breakdownLines = !filterByCustomerId
      ? `*Total Cash:* ${cashCans} cans — Rs. ${cashAmount.toFixed(0)}\n` +
        `*Total Account:* ${accountCans} cans — Rs. ${accountAmount.toFixed(0)}\n`
      : '';
    const text =
      `*The Paani™ — Deliveries Report*\n\n` +
      `*Period:* ${format(fromDate!, 'MMM d, yyyy')} – ${format(toDate!, 'MMM d, yyyy')}\n` +
      customerLine +
      `*Total Deliveries:* ${requests.length}\n` +
      `*Total Cans:* ${totalCans}\n` +
      breakdownLines +
      `*Grand Total:* Rs. ${totalAmount.toFixed(0)}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        const doc = await buildPdfDoc();
        const pdfBlob = doc.output('blob');
        const pdfFile = new File([pdfBlob], pdfFileName(), { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
          await navigator.share({ files: [pdfFile], title: 'The Paani™ Deliveries Report' });
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

  const handleDownloadExcel = async () => {
    const XLSX = await import('xlsx');

    const custName0 = filterByCustomerId && requests.length > 0 ? requests[0].customerName || '' : '';
    const header = [
      ['The Paani™ — Deliveries Report'],
      ['RAHMATPUR LATIF COLONY, NEAR ARFAT MASJID, LARKANO'],
      ['TEL: 0333 786 0 444  |  www.paani.online'],
      [],
      [`Period: ${format(fromDate!, 'MMM d, yyyy')} – ${format(toDate!, 'MMM d, yyyy')}`],
      ...(filterByCustomerId && customerIdInput.trim() ? [
        [`Customer Name: ${custName0}`],
        [`Customer ID: ${customerIdInput.trim()}`],
      ] : []),
      [`Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')}`],
      [],
      filterByCustomerId
        ? ['S.No', 'Date', 'Cans', 'Price / Can (Rs)', 'Subtotal (Rs)', 'Remarks']
        : ['S.No', 'ID', 'Customer Name', 'Date', 'Cans', 'Price / Can (Rs)', 'Subtotal (Rs)', 'Payment Type', 'Remarks'],
    ];
    const rows = requests.map((r, i) => filterByCustomerId ? [
      i + 1,
      r.requestedAt ? format(new Date(r.requestedAt), 'MMM d, yyyy') : '-',
      r.cans || 0,
      (r as any).pricePerCan || 0,
      (r.cans || 0) * ((r as any).pricePerCan || 0),
      '',
    ] : [
      i + 1,
      (r as any).customerIntId || '-',
      r.customerName || '-',
      r.requestedAt ? format(new Date(r.requestedAt), 'MMM d, yyyy') : '-',
      r.cans || 0,
      (r as any).pricePerCan || 0,
      (r.cans || 0) * ((r as any).pricePerCan || 0),
      r.paymentType ? (r.paymentType === 'cash' ? 'Cash' : 'Account') : '-',
      '',
    ]);
    const footer = filterByCustomerId
      ? [[], ['TOTAL', '', totalCans, '', totalAmount, '']]
      : [
          [],
          ['', '', 'Total Cash', cashCans, '', cashAmount, '', ''],
          ['', '', 'Total Account', accountCans, '', accountAmount, '', ''],
          ['', '', 'Grand Total', totalCans, '', totalAmount, '', ''],
        ];

    const ws = XLSX.utils.aoa_to_sheet([...header, ...rows, ...footer]);
    ws['!cols'] = [
      { wch: 14 }, { wch: 6 }, { wch: 28 }, { wch: 6 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 30 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Deliveries');
    const xlsxName = pdfFileName().replace('.pdf', '.xlsx');
    XLSX.writeFile(wb, xlsxName);
  };

  const handleClose = (v: boolean) => {
    onOpenChange(v);
    if (!v) { setGenerated(false); setRequests([]); setFilterByCustomerId(false); setCustomerIdInput(''); }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[620px] glass-card max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">Deliveries Report</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">From</label>
              <Popover open={fromOpen} onOpenChange={setFromOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal text-sm', !fromDate && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    {fromDate ? format(fromDate, 'MMM d, yyyy') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={fromDate} onSelect={(d) => {
                    setFromDate(d);
                    setFromOpen(false);
                    setGenerated(false);
                    setRequests([]);
                    if (d && !toDate) setToDate(new Date());
                  }} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">To</label>
              <Popover open={toOpen} onOpenChange={setToOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal text-sm', !toDate && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    {toDate ? format(toDate, 'MMM d, yyyy') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={toDate} onSelect={(d) => {
                    setToDate(d);
                    setToOpen(false);
                    setGenerated(false);
                    setRequests([]);
                  }} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Optional Customer ID filter */}
          <div className="flex items-center gap-3">
            <Checkbox
              id="filterByCustomerId"
              checked={filterByCustomerId}
              onCheckedChange={(checked) => {
                setFilterByCustomerId(checked as boolean);
                if (!checked) setCustomerIdInput('');
                setGenerated(false);
                setRequests([]);
              }}
            />
            <Label htmlFor="filterByCustomerId" className="text-sm cursor-pointer select-none">Filter by Customer ID</Label>
            {filterByCustomerId && (
              <Input
                type="number"
                placeholder="Enter ID"
                min={1}
                value={customerIdInput}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || parseInt(val, 10) > 0) {
                    setCustomerIdInput(val);
                    setGenerated(false);
                    setRequests([]);
                  }
                }}
                className="w-32 h-9 text-sm"
                autoFocus
              />
            )}
          </div>

          <Button
            onClick={fetchData}
            disabled={!fromDate || !toDate || isLoading || (filterByCustomerId && !(parseInt(customerIdInput, 10) > 0))}
            className="w-full bg-gradient-to-r from-primary via-accent to-primary"
          >
            {isLoading ? 'Loading...' : 'Generate Report'}
          </Button>

          {generated && (
            requests.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">No delivered requests in this date range.</p>
            ) : (
              <>
                {/* Summary strip */}
                <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-sm flex justify-between items-center">
                  <span className="text-muted-foreground">{format(fromDate!, 'MMM d, yyyy')} – {format(toDate!, 'MMM d, yyyy')}</span>
                  <span className="font-semibold text-primary">{requests.length} deliveries &nbsp;·&nbsp; {totalCans} cans &nbsp;·&nbsp; Rs. {totalAmount.toFixed(0)}</span>
                </div>

                {/* Customer info strip (only when filtered by ID) */}
                {filterByCustomerId && requests.length > 0 && (
                  <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-sm space-y-0.5">
                    <p className="font-semibold text-primary">{requests[0].customerName || '-'}</p>
                    <p className="text-xs text-muted-foreground">ID: {customerIdInput} &nbsp;·&nbsp; Payment: {(requests[0] as any).paymentType === 'cash' ? 'Cash' : 'Account'}</p>
                    <p className="text-xs text-muted-foreground">{format(fromDate!, 'MMM d, yyyy')} – {format(toDate!, 'MMM d, yyyy')}</p>
                  </div>
                )}

                {/* Preview table */}
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-primary text-primary-foreground">
                        <th className="px-2 py-2 text-center">S.No</th>
                        {!filterByCustomerId && <th className="px-2 py-2 text-center">ID</th>}
                        {!filterByCustomerId && <th className="px-2 py-2 text-left">Customer</th>}
                        <th className="px-2 py-2 text-left whitespace-nowrap">Date</th>
                        <th className="px-2 py-2 text-center">Cans</th>
                        <th className="px-2 py-2 text-right whitespace-nowrap">Price/Can</th>
                        <th className="px-2 py-2 text-right">Subtotal</th>
                        {!filterByCustomerId && <th className="px-2 py-2 text-center whitespace-nowrap">Payment</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map((r, i) => (
                        <tr key={r._id || r.requestId} className={i % 2 === 0 ? '' : 'bg-muted/30'}>
                          <td className="px-2 py-1.5 text-center text-muted-foreground">{i + 1}</td>
                          {!filterByCustomerId && <td className="px-2 py-1.5 text-center text-muted-foreground">{(r as any).customerIntId || '-'}</td>}
                          {!filterByCustomerId && <td className="px-2 py-1.5">{r.customerName || '-'}</td>}
                          <td className="px-2 py-1.5 whitespace-nowrap">{r.requestedAt ? format(new Date(r.requestedAt), 'MMM d, yyyy') : '-'}</td>
                          <td className="px-2 py-1.5 text-center">{r.cans}</td>
                          <td className="px-2 py-1.5 text-right">Rs. {(r as any).pricePerCan || 0}</td>
                          <td className="px-2 py-1.5 text-right font-medium">Rs. {((r.cans || 0) * ((r as any).pricePerCan || 0)).toFixed(0)}</td>
                          {!filterByCustomerId && <td className="px-2 py-1.5 text-center capitalize">{r.paymentType || '-'}</td>}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      {filterByCustomerId ? (
                        <tr className="bg-muted border-t-2 font-bold">
                          <td className="px-2 py-2 text-center text-xs">Total</td>
                          <td className="px-2 py-2 text-xs" />
                          <td className="px-2 py-2 text-center text-xs">{totalCans}</td>
                          <td />
                          <td className="px-2 py-2 text-right text-xs">Rs. {totalAmount.toFixed(0)}</td>
                          <td />
                        </tr>
                      ) : (
                        <>
                          <tr className="bg-muted/60 border-t-2">
                            <td colSpan={4} className="px-2 py-1.5 text-xs">Total Cash</td>
                            <td className="px-2 py-1.5 text-center text-xs">{cashCans}</td>
                            <td />
                            <td className="px-2 py-1.5 text-right text-xs">Rs. {cashAmount.toFixed(0)}</td>
                            <td colSpan={2} />
                          </tr>
                          <tr className="bg-muted/60">
                            <td colSpan={4} className="px-2 py-1.5 text-xs">Total Account</td>
                            <td className="px-2 py-1.5 text-center text-xs">{accountCans}</td>
                            <td />
                            <td className="px-2 py-1.5 text-right text-xs">Rs. {accountAmount.toFixed(0)}</td>
                            <td colSpan={2} />
                          </tr>
                          <tr className="bg-muted border-t font-bold">
                            <td colSpan={4} className="px-2 py-2 text-xs">Grand Total</td>
                            <td className="px-2 py-2 text-center text-xs">{totalCans}</td>
                            <td />
                            <td className="px-2 py-2 text-right text-xs">Rs. {totalAmount.toFixed(0)}</td>
                            <td colSpan={2} />
                          </tr>
                        </>
                      )}
                    </tfoot>
                  </table>
                </div>

                {/* Download buttons */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <Button variant="outline" onClick={handleDownloadPDF} className="flex flex-col h-auto py-3 gap-1.5">
                    <FileText className="h-5 w-5 text-red-500" />
                    <span className="text-xs font-medium">PDF</span>
                  </Button>
                  <Button variant="outline" onClick={handleDownloadExcel} className="flex flex-col h-auto py-3 gap-1.5">
                    <FileSpreadsheet className="h-5 w-5 text-green-600" />
                    <span className="text-xs font-medium">Excel</span>
                  </Button>
                  <Button variant="outline" onClick={handleWhatsAppShare} className="flex flex-col h-auto py-3 gap-1.5" style={{ borderColor: '#25D36650' }}>
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
