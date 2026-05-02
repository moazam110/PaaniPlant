"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Users, ListChecks, PackageCheck, PackageSearch, IndianRupee, TrendingUp, BarChart2, ChevronLeft, ChevronRight } from 'lucide-react';
import { CalendarIcon } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { buildApiUrl } from '@/lib/api';
import { format, startOfMonth, subMonths, addMonths } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LabelList,
} from 'recharts';
import { cn } from '@/lib/utils';

interface StatsTabProps {
  totalCustomers: number;
  pendingDeliveries: number;
  deliveriesTodayCount: number;
  totalCansToday: number;
  totalAmountGenerated: number;
  totalCashAmountGenerated: number;
  currentTimeLabel: string;
}

interface ChartEntry {
  deliveries: number;
  cans: number;
  amount: number;
  cashAmount: number;
  accountAmount: number;
  [key: string]: string | number;
}

type ChartView = 'yearly' | 'dayofweek';
type ViewMode = 'all' | 'cash' | 'account';

const APRIL_2026 = new Date(2026, 3, 1);

const pktToday = () => {
  const pkt = new Date(Date.now() + 5 * 3600_000);
  return new Date(pkt.getUTCFullYear(), pkt.getUTCMonth(), pkt.getUTCDate());
};

const P = {
  cash: '#7c3aed', cashMid: '#a78bfa', cashLight: '#ede9fe',
  account: '#f59e0b', accountMid: '#fcd34d', accountLight: '#fffbeb',
  deliveries: '#0ea5e9', deliveriesLight: '#7dd3fc',
};

const CA = { paid: '#10b981', paidLight: '#6ee7b7', remaining: '#f59e0b', remainingLight: '#fcd34d' };

const BarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0);
  return (
    <div className="bg-white/95 backdrop-blur border border-border rounded-2xl shadow-xl p-3 text-xs min-w-[160px]">
      <p className="font-bold text-foreground mb-2 text-sm">{label}</p>
      {payload.map((p: any) => {
        const pct = total > 0 ? Math.round((p.value / total) * 100) : 0;
        return (
          <div key={p.dataKey} className="flex items-center justify-between gap-4 mb-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: p.fill }} />
              <span className="text-muted-foreground">{p.name}</span>
            </span>
            <span className="font-semibold text-foreground">
              {p.dataKey === 'deliveries' || p.dataKey === 'cans'
                ? `${p.value}${total > 0 ? ` (${pct}%)` : ''}`
                : `Rs.${(p.value / 1000).toFixed(1)}k`}
            </span>
          </div>
        );
      })}
      {payload.length > 1 && total > 0 && payload[0]?.dataKey !== 'deliveries' && (
        <div className="border-t border-border pt-1 mt-1 flex justify-between">
          <span className="text-muted-foreground">Total</span>
          <span className="font-bold text-foreground">Rs.{(total / 1000).toFixed(1)}k</span>
        </div>
      )}
    </div>
  );
};

const PieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.07) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  return (
    <text x={cx + r * Math.cos(-midAngle * RADIAN)} y={cy + r * Math.sin(-midAngle * RADIAN)}
      fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="700">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// ── Shared date-picker sub-components ────────────────────────────────────────
const MonthNav = ({ date, onChange, min = APRIL_2026 }: {
  date: Date; onChange: (d: Date) => void; min?: Date;
}) => {
  const canBack = startOfMonth(subMonths(date, 1)) >= startOfMonth(min);
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!canBack}
        onClick={() => onChange(startOfMonth(subMonths(date, 1)))}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-semibold w-28 text-center">{format(date, 'MMMM yyyy')}</span>
      <Button variant="ghost" size="icon" className="h-7 w-7"
        onClick={() => onChange(startOfMonth(addMonths(date, 1)))}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};

const YearNav = ({ year, onChange }: { year: number; onChange: (y: number) => void }) => (
  <div className="flex items-center gap-1">
    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={year <= 2026}
      onClick={() => onChange(year - 1)}>
      <ChevronLeft className="h-4 w-4" />
    </Button>
    <span className="text-sm font-semibold w-16 text-center">{year}</span>
    <Button variant="ghost" size="icon" className="h-7 w-7"
      onClick={() => onChange(year + 1)}>
      <ChevronRight className="h-4 w-4" />
    </Button>
  </div>
);

const DatePickerBtn = ({ date, open, onOpenChange, onSelect, label = 'Pick date' }: {
  date?: Date; open: boolean; onOpenChange: (v: boolean) => void;
  onSelect: (d: Date | undefined) => void; label?: string;
}) => (
  <Popover open={open} onOpenChange={onOpenChange}>
    <PopoverTrigger asChild>
      <Button variant="outline" className={cn('justify-start text-left font-normal text-sm h-9 px-3', !date && 'text-muted-foreground')}>
        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
        {date ? format(date, 'MMM d, yyyy') : label}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar mode="single" selected={date} onSelect={d => { onSelect(d); onOpenChange(false); }}
        initialFocus disabled={(d) => d < APRIL_2026 || d > new Date()} />
    </PopoverContent>
  </Popover>
);
// ─────────────────────────────────────────────────────────────────────────────

export default function StatsTab({
  totalCustomers,
  pendingDeliveries,
  deliveriesTodayCount,
  totalCansToday,
  totalAmountGenerated,
  totalCashAmountGenerated,
}: StatsTabProps) {
  const currentDate = new Date();

  const [viewMode, setViewMode] = useState<ViewMode>('all');

  // ── All view date picker state ────────────────────────────────────────────
  type AllPickerMode = 'day' | 'month' | 'year';
  const [allPickerMode, setAllPickerMode] = useState<AllPickerMode>('day');
  const [allPickerDate, setAllPickerDate] = useState<Date | undefined>(pktToday());
  const [allPickerOpen, setAllPickerOpen] = useState(false);
  const [allMonthDate, setAllMonthDate]   = useState<Date>(() => startOfMonth(new Date()));
  const [allYearNum,   setAllYearNum]     = useState<number>(() => new Date().getFullYear());

  // Derive effective day/month/year for existing All view API calls
  const { effectiveDay, effectiveMonth, effectiveYear } = useMemo(() => {
    if (allPickerMode === 'year') return { effectiveDay: '', effectiveMonth: '', effectiveYear: String(allYearNum) };
    if (allPickerMode === 'month') return { effectiveDay: '', effectiveMonth: String(allMonthDate.getMonth() + 1), effectiveYear: String(allMonthDate.getFullYear()) };
    // day mode
    const d = allPickerDate || pktToday();
    return { effectiveDay: String(d.getDate()), effectiveMonth: String(d.getMonth() + 1), effectiveYear: String(d.getFullYear()) };
  }, [allPickerMode, allPickerDate, allMonthDate, allYearNum]);
  // ─────────────────────────────────────────────────────────────────────────

  // ── Cash view state ───────────────────────────────────────────────────────
  const [caFullMonth, setCaFullMonth]   = useState(false);
  const [caMonthDate, setCaMonthDate]   = useState<Date>(() => startOfMonth(pktToday()));
  const [caPickerDate, setCaPickerDate] = useState<Date | undefined>(pktToday());
  const [caPickerOpen, setCaPickerOpen] = useState(false);
  // ─────────────────────────────────────────────────────────────────────────

  // ── Account view state ────────────────────────────────────────────────────
  const [accMonthDate, setAccMonthDate] = useState<Date>(() => {
    const prev = startOfMonth(subMonths(new Date(), 1));
    return prev < APRIL_2026 ? APRIL_2026 : prev;
  });
  // ─────────────────────────────────────────────────────────────────────────

  // ── Cash / Account data ───────────────────────────────────────────────────
  const [caSummary, setCaSummary] = useState({ cans: 0, totalBilled: 0, actualPaid: 0, remaining: 0 });
  const [caDailyData, setCaDailyData]   = useState<{ day: number; billed: number; paid: number; remaining: number; cans: number }[]>([]);
  const [caMonthlyData, setCaMonthlyData] = useState<{ month: number; monthName: string; billed: number; paid: number; remaining: number; cans: number }[]>([]);
  const [caLoading, setCaLoading] = useState(false);

  const fetchCaData = useCallback(async (mode: ViewMode) => {
    if (mode === 'all') return;
    setCaLoading(true);
    try {
      if (mode === 'cash') {
        const m = caFullMonth ? caMonthDate : (caPickerDate || pktToday());
        const monthNum = m.getMonth() + 1;
        const yearNum  = m.getFullYear();
        const dayNum   = caFullMonth ? 0 : m.getDate();
        const params = new URLSearchParams({ type: 'cash', year: String(yearNum), month: String(monthNum) });
        if (caFullMonth) params.set('fullMonth', 'true'); else params.set('day', String(dayNum));

        const [sumRes, dailyRes] = await Promise.all([
          fetch(buildApiUrl(`api/stats/cash-account/summary?${params}`)),
          fetch(buildApiUrl(`api/stats/cash-account/daily?type=cash&year=${yearNum}&month=${monthNum}`)),
        ]);
        if (sumRes.ok)   setCaSummary(await sumRes.json());
        if (dailyRes.ok) { const d = await dailyRes.json(); setCaDailyData(d.data || []); }
      } else {
        // account
        const monthNum = accMonthDate.getMonth() + 1;
        const yearNum  = accMonthDate.getFullYear();
        const params = new URLSearchParams({ type: 'account', year: String(yearNum), month: String(monthNum), fullMonth: 'true' });

        const [sumRes, monthlyRes] = await Promise.all([
          fetch(buildApiUrl(`api/stats/cash-account/summary?${params}`)),
          fetch(buildApiUrl(`api/stats/cash-account/monthly?type=account&year=${yearNum}`)),
        ]);
        if (sumRes.ok)     setCaSummary(await sumRes.json());
        if (monthlyRes.ok) { const d = await monthlyRes.json(); setCaMonthlyData(d.data || []); }
      }
    } catch { /* ignore */ } finally {
      setCaLoading(false);
    }
  }, [caFullMonth, caMonthDate, caPickerDate, accMonthDate]);

  useEffect(() => {
    if (viewMode !== 'all') fetchCaData(viewMode);
  }, [viewMode, fetchCaData]);
  // ─────────────────────────────────────────────────────────────────────────

  // ── All view data ─────────────────────────────────────────────────────────
  const [filteredMetrics, setFilteredMetrics] = useState({
    deliveries: deliveriesTodayCount,
    totalCans: totalCansToday,
    totalAmountGenerated: 0,
    totalCashAmountGenerated: 0,
    timeLabel: 'Today',
    isLoading: false,
  });

  const [chartData, setChartData]     = useState<ChartEntry[]>([]);
  const [donutData, setDonutData]     = useState<{ name: string; value: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartView, setChartView]     = useState<ChartView>('yearly');
  const [chartMeta, setChartMeta]     = useState({ title: '', subtitle: '' });
  const [donutTotal, setDonutTotal]   = useState(0);
  const [dailyData, setDailyData]     = useState<any[]>([]);
  const [isMonthlyView, setIsMonthlyView] = useState(false);
  const [isYearView, setIsYearView]   = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const reqVer   = useRef(0);

  const buildAndFetchMetrics = async (eDay: string, eMonth: string, eYear: string) => {
    let url = buildApiUrl('api/dashboard/metrics');
    const params: string[] = [];
    if (eDay && eMonth && eYear) params.push(`day=${eDay}`, `month=${eMonth}`, `year=${eYear}`);
    else if (eMonth && eYear)    params.push(`month=${eMonth}`, `year=${eYear}`);
    else if (eYear)              params.push(`year=${eYear}`);
    if (params.length) url += `?${params.join('&')}`;

    const nextMonthly = !!(eMonth && eYear && !eDay);
    const nextYear    = !!(!eMonth && eYear && !eDay);

    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const v = ++reqVer.current;
    setFilteredMetrics(p => ({ ...p, isLoading: true }));

    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (v !== reqVer.current) return;
      setFilteredMetrics({
        deliveries: data.deliveries || 0,
        totalCans: data.totalCans || 0,
        totalAmountGenerated: data.totalAmountGenerated || 0,
        totalCashAmountGenerated: data.totalCashAmountGenerated || 0,
        timeLabel: data.timeLabel || '',
        isLoading: false,
      });
      setIsMonthlyView(nextMonthly);
      setIsYearView(nextYear);
    } catch (e) {
      if ((e as any)?.name === 'AbortError') return;
      setFilteredMetrics(p => ({ ...p, isLoading: false }));
    }
  };

  const months = [
    { value: '1', label: 'Jan' }, { value: '2', label: 'Feb' }, { value: '3', label: 'Mar' },
    { value: '4', label: 'Apr' }, { value: '5', label: 'May' }, { value: '6', label: 'Jun' },
    { value: '7', label: 'Jul' }, { value: '8', label: 'Aug' }, { value: '9', label: 'Sep' },
    { value: '10', label: 'Oct' }, { value: '11', label: 'Nov' }, { value: '12', label: 'Dec' },
  ];

  const fetchChartData = useCallback(async (eDay: string, eMonth: string, eYear: string) => {
    const nowYear = String(new Date().getFullYear());
    const effectiveYearForChart = eYear || nowYear;
    const view: ChartView = eMonth ? 'dayofweek' : 'yearly';
    setChartView(view);
    setChartLoading(true);

    try {
      let url = '';
      const monthLabel = months.find(m => m.value === eMonth)?.label || '';

      if (view === 'yearly') {
        url = buildApiUrl(`api/stats/chart/yearly?year=${effectiveYearForChart}`);
        setChartMeta({ title: `Monthly Sales — ${effectiveYearForChart}`, subtitle: 'Revenue breakdown by month' });
      } else {
        url = buildApiUrl(`api/stats/chart/dayofweek?year=${effectiveYearForChart}&month=${eMonth}`);
        setChartMeta({ title: `Day-of-Week Analysis — ${monthLabel} ${effectiveYearForChart}`, subtitle: '×N = occurrences of that weekday in this month' });
      }

      const res = await fetch(url);
      const json = await res.json();
      const data: ChartEntry[] = (json.data || []).map((d: any) => ({
        ...d,
        accountAmount: Math.max(0, (d.amount || 0) - (d.cashAmount || 0)),
      }));
      setChartData(data);

      const totalAmt = data.reduce((s, d) => s + (d.amount || 0), 0);
      const cashAmt  = data.reduce((s, d) => s + (d.cashAmount || 0), 0);
      setDonutTotal(totalAmt);
      setDonutData([
        { name: 'Cash',    value: cashAmt },
        { name: 'Account', value: Math.max(0, totalAmt - cashAmt) },
      ]);

      const dailyMonth = eMonth || String(new Date().getMonth() + 1);
      const dailyRes = await fetch(buildApiUrl(`api/stats/chart/daily?year=${effectiveYearForChart}&month=${dailyMonth}`));
      if (dailyRes.ok) {
        const dailyJson = await dailyRes.json();
        setDailyData(dailyJson.data || []);
      }
    } catch (e) {
      console.error('Chart fetch error:', e);
    } finally {
      setChartLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (viewMode !== 'all') return;
    buildAndFetchMetrics(effectiveDay, effectiveMonth, effectiveYear);
    fetchChartData(effectiveDay, effectiveMonth, effectiveYear);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, effectiveDay, effectiveMonth, effectiveYear]);
  // ─────────────────────────────────────────────────────────────────────────

  const showLoading = filteredMetrics.isLoading;
  const xKey = chartView === 'yearly' ? 'month' : 'label';

  const KpiCard = ({ title, value, icon: Icon, green = false, span = '' }: any) => (
    <Card className={`glass-card ${span}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {showLoading
          ? <Skeleton className="h-7 w-20 bg-muted/50" />
          : <div className={`text-2xl font-bold ${green ? 'text-green-600' : ''}`}>{value}</div>}
      </CardContent>
    </Card>
  );

  // ── Cash/Account chart helpers ────────────────────────────────────────────
  const CaDonutLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.07) return null;
    const RADIAN = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.55;
    return (
      <text x={cx + r * Math.cos(-midAngle * RADIAN)} y={cy + r * Math.sin(-midAngle * RADIAN)}
        fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="700">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const CaTick = ({ x, y, payload }: any) => (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={14} textAnchor="middle" fontSize={9} fill="#9ca3af">{payload.value}</text>
    </g>
  );

  const CaBarTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-border rounded-xl shadow-lg p-2 text-xs min-w-[120px]">
        <p className="font-bold mb-1 text-foreground">{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm" style={{ background: p.fill }} />
              <span className="text-muted-foreground">{p.name}</span>
            </span>
            <span className="font-semibold" style={{ color: p.fill }}>Rs {p.value?.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  };

  const CaKpiCards = () => (
    caLoading ? (
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="glass-card"><CardContent className="pt-4"><Skeleton className="h-7 w-20 bg-muted/50" /></CardContent></Card>
        ))}
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Cans', value: String(caSummary.cans), icon: PackageCheck, color: '' },
          { label: 'Total Amount', value: `Rs ${caSummary.totalBilled.toLocaleString()}`, icon: IndianRupee, color: '' },
          { label: 'Actual Payments', value: `Rs ${caSummary.actualPaid.toLocaleString()}`, icon: IndianRupee, color: 'text-green-600 dark:text-green-400' },
          { label: 'Remaining', value: `Rs ${caSummary.remaining.toLocaleString()}`, icon: IndianRupee, color: 'text-amber-600 dark:text-amber-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className={cn('h-4 w-4', color || 'text-muted-foreground')} />
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className={cn('text-xl font-bold', color)}>{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  );

  const CaDonut = ({ label }: { label: string }) => {
    const segments = [
      { name: 'Paid',      value: caSummary.actualPaid },
      { name: 'Remaining', value: caSummary.remaining },
    ];
    const total = caSummary.actualPaid + caSummary.remaining;
    return (
      <Card className="glass-card">
        <CardHeader className="pb-1 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">{label} Payment Split</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center pb-4">
          {total === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <defs>
                  <linearGradient id="caPaidDonut" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={CA.paidLight} /><stop offset="100%" stopColor={CA.paid} />
                  </linearGradient>
                  <linearGradient id="caRemDonut" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={CA.remainingLight} /><stop offset="100%" stopColor={CA.remaining} />
                  </linearGradient>
                </defs>
                <Pie data={segments} cx="50%" cy="45%" innerRadius={58} outerRadius={85}
                  paddingAngle={3} dataKey="value" labelLine={false} label={<CaDonutLabel />}>
                  <Cell fill="url(#caPaidDonut)" />
                  <Cell fill="url(#caRemDonut)" />
                </Pie>
                <text x="50%" y="45%" textAnchor="middle" dominantBaseline="central">
                  <tspan x="50%" dy="-0.5em" fontSize="10" fill="#9ca3af">Total</tspan>
                  <tspan x="50%" dy="1.5em" fontSize="13" fontWeight="800" fill="#1f2937">
                    Rs.{total >= 1000 ? `${(total/1000).toFixed(1)}k` : total}
                  </tspan>
                </text>
                <Legend iconType="circle" iconSize={8}
                  formatter={(v, entry: any) => (
                    <span style={{ fontSize: 12, color: '#6b7280' }}>
                      {v} — Rs {entry.payload.value.toLocaleString()}
                    </span>
                  )} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    );
  };
  // ─────────────────────────────────────────────────────────────────────────

  const cashMonthLabel   = format(caFullMonth ? caMonthDate : (caPickerDate || pktToday()), 'MMMM yyyy');
  const accMonthLabel    = format(accMonthDate, 'MMMM yyyy');

  return (
    <div className="p-4 space-y-6">

      {/* View mode selector */}
      <div className="flex items-center gap-x-4 gap-y-2 flex-wrap rounded-lg border bg-muted/30 px-3 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground shrink-0">View</span>
        {(['all', 'cash', 'account'] as const).map(m => (
          <label key={m} className="flex items-center gap-1.5 cursor-pointer select-none">
            <Checkbox checked={viewMode === m} onCheckedChange={() => setViewMode(m)} className="h-3.5 w-3.5" />
            <span className="text-sm">{m === 'all' ? 'All' : m === 'cash' ? 'Cash' : 'Account'}</span>
          </label>
        ))}
      </div>

      {/* ── CASH VIEW ─────────────────────────────────────────────────────── */}
      {viewMode === 'cash' && (
        <div className="space-y-4">
          {/* Date controls */}
          <div className="flex items-center gap-x-4 gap-y-2 flex-wrap rounded-lg border bg-muted/30 px-3 py-2.5">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <Checkbox checked={caFullMonth} onCheckedChange={v => setCaFullMonth(v as boolean)} className="h-3.5 w-3.5" />
              <span className="text-sm font-medium">Full Month</span>
            </label>
            {caFullMonth ? (
              <MonthNav date={caMonthDate} onChange={setCaMonthDate} />
            ) : (
              <DatePickerBtn date={caPickerDate} open={caPickerOpen} onOpenChange={setCaPickerOpen}
                onSelect={d => d && setCaPickerDate(d)} label="Pick date" />
            )}
          </div>
          <CaKpiCards />
          {!caLoading && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="glass-card lg:col-span-2">
                <CardHeader className="pb-1 pt-4 px-5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-sm font-semibold">Cash — Daily ({cashMonthLabel})</CardTitle>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: CA.paid }} />Paid</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: CA.remaining }} />Remaining</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-2 pb-4">
                  {caDailyData.every(d => d.billed === 0) ? (
                    <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No cash data for this period.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={caDailyData} margin={{ top: 16, right: 8, left: -10, bottom: 8 }} barCategoryGap="15%">
                        <defs>
                          <linearGradient id="caPaidGrad2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={CA.paidLight} /><stop offset="100%" stopColor={CA.paid} />
                          </linearGradient>
                          <linearGradient id="caRemGrad2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={CA.remainingLight} /><stop offset="100%" stopColor={CA.remaining} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="day" tick={<CaTick />} axisLine={false} tickLine={false} interval={0} />
                        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                          tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                        <Tooltip content={<CaBarTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                        <Bar dataKey="paid" name="Paid" fill="url(#caPaidGrad2)" stackId="s" radius={[0,0,0,0]} maxBarSize={20}>
                          <LabelList dataKey="paid" position="inside" content={({ x, y, width, height, value }: any) => {
                            if (!value || (height as number) < 16) return null;
                            return <text x={(x as number)+(width as number)/2} y={(y as number)+(height as number)/2}
                              textAnchor="middle" dominantBaseline="central" fill="white" fontSize={8} fontWeight="700">
                              {(value/1000).toFixed(0)}k</text>;
                          }} />
                        </Bar>
                        <Bar dataKey="remaining" name="Remaining" fill="url(#caRemGrad2)" stackId="s" radius={[4,4,0,0]} maxBarSize={20}>
                          <LabelList dataKey="remaining" position="top" content={({ x, y, value }: any) => {
                            if (!value) return null;
                            return <text x={(x as number)} y={(y as number)-3} textAnchor="middle" fontSize={8} fill="#9ca3af">
                              {value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}</text>;
                          }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
              <CaDonut label="Cash" />
            </div>
          )}
        </div>
      )}

      {/* ── ACCOUNT VIEW ──────────────────────────────────────────────────── */}
      {viewMode === 'account' && (
        <div className="space-y-4">
          {/* Month-only picker */}
          <div className="flex items-center gap-x-4 gap-y-2 flex-wrap rounded-lg border bg-muted/30 px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground shrink-0">Month</span>
            <MonthNav date={accMonthDate} onChange={setAccMonthDate} />
          </div>
          <CaKpiCards />
          {!caLoading && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="glass-card lg:col-span-2">
                <CardHeader className="pb-1 pt-4 px-5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-sm font-semibold">Account — Monthly ({accMonthDate.getFullYear()})</CardTitle>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: CA.paid }} />Paid</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: CA.remaining }} />Remaining</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-2 pb-4">
                  {caMonthlyData.every(d => d.billed === 0) ? (
                    <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No account data for this year.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={caMonthlyData} margin={{ top: 16, right: 8, left: -10, bottom: 8 }} barCategoryGap="15%">
                        <defs>
                          <linearGradient id="accPaidGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={CA.paidLight} /><stop offset="100%" stopColor={CA.paid} />
                          </linearGradient>
                          <linearGradient id="accRemGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={CA.remainingLight} /><stop offset="100%" stopColor={CA.remaining} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="monthName" tick={<CaTick />} axisLine={false} tickLine={false} interval={0} />
                        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                          tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                        <Tooltip content={<CaBarTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                        <Bar dataKey="paid" name="Paid" fill="url(#accPaidGrad)" stackId="s" radius={[0,0,0,0]} maxBarSize={20}>
                          <LabelList dataKey="paid" position="inside" content={({ x, y, width, height, value }: any) => {
                            if (!value || (height as number) < 16) return null;
                            return <text x={(x as number)+(width as number)/2} y={(y as number)+(height as number)/2}
                              textAnchor="middle" dominantBaseline="central" fill="white" fontSize={8} fontWeight="700">
                              {(value/1000).toFixed(0)}k</text>;
                          }} />
                        </Bar>
                        <Bar dataKey="remaining" name="Remaining" fill="url(#accRemGrad)" stackId="s" radius={[4,4,0,0]} maxBarSize={20}>
                          <LabelList dataKey="remaining" position="top" content={({ x, y, value }: any) => {
                            if (!value) return null;
                            return <text x={(x as number)} y={(y as number)-3} textAnchor="middle" fontSize={8} fill="#9ca3af">
                              {value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}</text>;
                          }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
              <CaDonut label="Account" />
            </div>
          )}
        </div>
      )}

      {/* ── ALL VIEW ──────────────────────────────────────────────────────── */}
      {viewMode === 'all' && (
        <>
          {/* Date picker — same style as bulk bills + Year option */}
          <div className="flex items-center gap-x-4 gap-y-2 flex-wrap rounded-lg border bg-muted/30 px-3 py-2.5">
            {/* Mode toggles */}
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <Checkbox checked={allPickerMode === 'month'} onCheckedChange={v => setAllPickerMode(v ? 'month' : 'day')} className="h-3.5 w-3.5" />
              <span className="text-sm font-medium">Full Month</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <Checkbox checked={allPickerMode === 'year'} onCheckedChange={v => setAllPickerMode(v ? 'year' : 'day')} className="h-3.5 w-3.5" />
              <span className="text-sm font-medium">Full Year</span>
            </label>
            <div className="w-px h-4 bg-border hidden sm:block" />
            {allPickerMode === 'month' && (
              <MonthNav date={allMonthDate} onChange={setAllMonthDate} />
            )}
            {allPickerMode === 'year' && (
              <YearNav year={allYearNum} onChange={setAllYearNum} />
            )}
            {allPickerMode === 'day' && (
              <DatePickerBtn date={allPickerDate} open={allPickerOpen} onOpenChange={setAllPickerOpen}
                onSelect={d => d && setAllPickerDate(d)} label="Today" />
            )}
          </div>

          {/* KPI Cards — unchanged logic */}
          {(() => {
            const now = new Date();
            const isBlank = !effectiveDay && !effectiveMonth && !effectiveYear;
            const isToday = isBlank || (
              effectiveDay   === String(now.getDate()) &&
              effectiveMonth === String(now.getMonth() + 1) &&
              effectiveYear  === String(now.getFullYear())
            );

            if (isYearView) {
              return (
                <div className="grid grid-cols-2 gap-4">
                  <KpiCard title="Total Deliveries"   value={filteredMetrics.deliveries}                                              icon={PackageCheck} />
                  <KpiCard title="Total Cans"         value={filteredMetrics.totalCans}                                               icon={PackageSearch} />
                  <KpiCard title="Total Amount"       value={`Rs. ${filteredMetrics.totalAmountGenerated.toLocaleString()}`}          icon={IndianRupee} green />
                  <KpiCard title="Cash Amount"        value={`Rs. ${filteredMetrics.totalCashAmountGenerated.toLocaleString()}`}      icon={IndianRupee} green />
                </div>
              );
            }

            if (isMonthlyView) {
              const totalDeliveries  = filteredMetrics.deliveries;
              const totalCans        = filteredMetrics.totalCans;
              const totalAmtGen      = filteredMetrics.totalAmountGenerated;
              const totalCashAmtGen  = filteredMetrics.totalCashAmountGenerated;
              return (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard title="Deliveries"   value={totalDeliveries}                                 icon={PackageCheck} />
                  <KpiCard title="Total Cans"   value={totalCans}                                       icon={PackageSearch} />
                  <KpiCard title="Total Amount" value={`Rs. ${totalAmtGen.toLocaleString()}`}           icon={IndianRupee} green />
                  <KpiCard title="Cash Amount"  value={`Rs. ${totalCashAmtGen.toLocaleString()}`}       icon={IndianRupee} green span="col-span-2 lg:col-span-1" />
                </div>
              );
            }

            // Day view (today or specific date)
            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard title="Total Customers"    value={totalCustomers}                                                icon={Users} />
                <KpiCard title="Pending Deliveries" value={pendingDeliveries}                                             icon={ListChecks} />
                <KpiCard title={isToday ? "Today's Deliveries" : "Deliveries"} value={filteredMetrics.deliveries}        icon={PackageCheck} />
                <KpiCard title={isToday ? "Today's Cans" : "Cans"}             value={filteredMetrics.totalCans}          icon={PackageSearch} />
                <KpiCard title="Total Amount Generated"
                  value={`Rs. ${filteredMetrics.totalAmountGenerated.toLocaleString()}`}
                  icon={IndianRupee} green span="col-span-2" />
                <KpiCard title="Cash Amount Generated"
                  value={`Rs. ${filteredMetrics.totalCashAmountGenerated.toLocaleString()}`}
                  icon={IndianRupee} green span="col-span-2" />
              </div>
            );
          })()}

          {/* Charts */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-primary" />
              <div>
                <h3 className="font-semibold text-sm text-foreground">{chartMeta.title}</h3>
                <p className="text-xs text-muted-foreground">{chartMeta.subtitle}</p>
              </div>
            </div>

            {chartLoading ? (
              <Card className="glass-card">
                <CardContent className="pt-6">
                  <Skeleton className="h-72 w-full bg-muted/40 rounded-xl" />
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="glass-card lg:col-span-2">
                  <CardContent className="pt-6 px-2 pb-4">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }} barCategoryGap="20%">
                        <defs>
                          <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={P.cashMid} /><stop offset="100%" stopColor={P.cash} />
                          </linearGradient>
                          <linearGradient id="acctGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={P.accountMid} /><stop offset="100%" stopColor={P.account} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                          tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                        <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                        <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize: 12, color: '#6b7280' }}>{v}</span>} />
                        <Bar dataKey="cashAmount" name="Cash" fill="url(#cashGrad)" radius={[4,4,0,0]} maxBarSize={32}>
                          <LabelList dataKey="cashAmount" position="top" content={({ x, y, value }: any) =>
                            value > 0 ? <text x={x} y={(y as number)-2} textAnchor="middle" fontSize={9} fill={P.cashMid}>
                              {value>=1000?`${(value/1000).toFixed(0)}k`:value}</text> : null} />
                        </Bar>
                        <Bar dataKey="accountAmount" name="Account" fill="url(#acctGrad)" radius={[4,4,0,0]} maxBarSize={32}>
                          <LabelList dataKey="accountAmount" position="top" content={({ x, y, value }: any) =>
                            value > 0 ? <text x={x} y={(y as number)-2} textAnchor="middle" fontSize={9} fill={P.accountMid}>
                              {value>=1000?`${(value/1000).toFixed(0)}k`:value}</text> : null} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardHeader className="pb-1 pt-4 px-5">
                    <CardTitle className="text-sm font-semibold">Revenue Split</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center pb-4">
                    {donutData.every(d => d.value === 0) ? (
                      <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">No revenue data</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <defs>
                            <linearGradient id="cashDonut" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor={P.cashMid} /><stop offset="100%" stopColor={P.cash} />
                            </linearGradient>
                            <linearGradient id="acctDonut" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor={P.accountMid} /><stop offset="100%" stopColor={P.account} />
                            </linearGradient>
                          </defs>
                          <Pie data={donutData} cx="50%" cy="45%" innerRadius={58} outerRadius={85}
                            paddingAngle={3} dataKey="value" labelLine={false} label={<PieLabel />}>
                            <Cell fill="url(#cashDonut)" />
                            <Cell fill="url(#acctDonut)" />
                          </Pie>
                          <text x="50%" y="45%" textAnchor="middle" dominantBaseline="central">
                            <tspan x="50%" dy="-0.5em" fontSize="10" fill="#9ca3af">Total</tspan>
                            <tspan x="50%" dy="1.5em" fontSize="13" fontWeight="800" fill="#1f2937">
                              Rs.{donutTotal>=1000?`${(donutTotal/1000).toFixed(1)}k`:donutTotal}
                            </tspan>
                          </text>
                          <Legend iconType="circle" iconSize={8}
                            formatter={v => <span style={{ fontSize: 12, color: '#6b7280' }}>{v}</span>} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Daily cans breakdown — shown when a month is in view */}
          {dailyData.length > 0 && (() => {
            const DOW_COLORS = ['#f43f5e','#8b5cf6','#06b6d4','#10b981','#f59e0b','#3b82f6','#ec4899'];
            const DOW_NAMES  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

            const CustomTick = ({ x, y, payload }: any) => {
              const entry = dailyData[payload.index];
              if (!entry) return null;
              const color = DOW_COLORS[entry.dow];
              return (
                <g transform={`translate(${x},${y})`}>
                  <text x={0} y={0} dy={10} textAnchor="middle" fontSize={8} fill={color} fontWeight="700">{entry.dayName[0]}</text>
                  <text x={0} y={0} dy={20} textAnchor="middle" fontSize={8} fill="#9ca3af">{entry.day}</text>
                </g>
              );
            };

            return (
              <Card className="glass-card">
                <CardHeader className="pb-1 pt-4 px-5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-sm font-semibold text-foreground">
                      {(() => {
                        const m = effectiveMonth || String(new Date().getMonth() + 1);
                        const y = effectiveYear  || String(new Date().getFullYear());
                        const mLabel = months.find(mo => mo.value === m)?.label || '';
                        return `Daily Cans — ${mLabel} ${y}`;
                      })()}
                    </CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      {DOW_NAMES.map((n, i) => (
                        <span key={n} className="flex items-center gap-1 text-xs" style={{ color: DOW_COLORS[i] }}>
                          <span className="w-2 h-2 rounded-sm inline-block" style={{ background: DOW_COLORS[i] }} />
                          {n}
                        </span>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-2 pb-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={dailyData} margin={{ top: 16, right: 8, left: -10, bottom: 24 }} barCategoryGap="15%">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="day" tick={<CustomTick />} axisLine={false} tickLine={false} interval={0} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload;
                        return (
                          <div className="bg-white border border-border rounded-xl shadow-lg p-2 text-xs">
                            <p className="font-bold mb-1" style={{ color: DOW_COLORS[d.dow] }}>{d.dayName} {d.day}</p>
                            <p>Deliveries: <span className="font-semibold">{d.deliveries}</span></p>
                            <p>Cans: <span className="font-semibold">{d.cans}</span></p>
                            <p>Revenue: <span className="font-semibold">Rs.{d.amount?.toLocaleString()}</span></p>
                          </div>
                        );
                      }} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                      <Bar dataKey="cans" name="Cans" radius={[3,3,0,0]} maxBarSize={14}>
                        {dailyData.map((entry, i) => (
                          <Cell key={i} fill={DOW_COLORS[entry.dow]} fillOpacity={0.85} />
                        ))}
                        <LabelList dataKey="cans" position="top" content={({ x, y, value }: any) =>
                          value > 0 ? <text x={x} y={(y as number)-2} textAnchor="middle" fontSize={8} fill="#9ca3af">{value}</text> : null} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            );
          })()}
        </>
      )}

    </div>
  );
}
