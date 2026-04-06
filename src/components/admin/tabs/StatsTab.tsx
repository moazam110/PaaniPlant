"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, ListChecks, PackageCheck, PackageSearch, IndianRupee, TrendingUp, BarChart2 } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { buildApiUrl } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LabelList,
} from 'recharts';

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

const P = {
  cash: '#7c3aed', cashMid: '#a78bfa', cashLight: '#ede9fe',
  account: '#f59e0b', accountMid: '#fcd34d', accountLight: '#fffbeb',
  deliveries: '#0ea5e9', deliveriesLight: '#7dd3fc',
};

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
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="700">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function StatsTab({
  totalCustomers,
  pendingDeliveries,
  deliveriesTodayCount,
  totalCansToday,
  totalAmountGenerated,
  totalCashAmountGenerated,
}: StatsTabProps) {
  const currentDate = new Date();
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [isMonthlyView, setIsMonthlyView] = useState(false);
  const [isYearView, setIsYearView] = useState(false);

  const [filteredMetrics, setFilteredMetrics] = useState({
    deliveries: deliveriesTodayCount,
    totalCans: totalCansToday,
    totalAmountGenerated: 0,
    totalCashAmountGenerated: 0,
    timeLabel: 'Today',
    isLoading: false,
  });

  const [chartData, setChartData] = useState<ChartEntry[]>([]);
  const [donutData, setDonutData] = useState<{ name: string; value: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartView, setChartView] = useState<ChartView>('yearly');
  const [chartMeta, setChartMeta] = useState({ title: '', subtitle: '' });
  const [donutTotal, setDonutTotal] = useState(0);
  const [dailyData, setDailyData] = useState<any[]>([]);

  const months = [
    { value: '1', label: 'Jan' }, { value: '2', label: 'Feb' }, { value: '3', label: 'Mar' },
    { value: '4', label: 'Apr' }, { value: '5', label: 'May' }, { value: '6', label: 'Jun' },
    { value: '7', label: 'Jul' }, { value: '8', label: 'Aug' }, { value: '9', label: 'Sep' },
    { value: '10', label: 'Oct' }, { value: '11', label: 'Nov' }, { value: '12', label: 'Dec' },
  ];

  const years = Array.from({ length: 6 }, (_, i) => {
    const y = currentDate.getFullYear() - i;
    return { value: String(y), label: String(y) };
  });

  const abortRef = useRef<AbortController | null>(null);
  const reqVer = useRef(0);

  const buildAndFetchMetrics = async () => {
    const now = new Date();
    const todayDay = String(now.getDate());
    const todayMonth = String(now.getMonth() + 1);
    const todayYear = String(now.getFullYear());
    const isBlank = !selectedDay && !selectedMonth && !selectedYear;
    const eDay = isBlank ? todayDay : selectedDay || '';
    const eMonth = isBlank ? todayMonth : (selectedMonth || (selectedDay ? todayMonth : ''));
    const eYear = isBlank ? todayYear : (selectedYear || (selectedMonth ? todayYear : ''));

    let url = buildApiUrl('api/dashboard/metrics');
    const params: string[] = [];
    if (eDay && eMonth && eYear) params.push(`day=${eDay}`, `month=${eMonth}`, `year=${eYear}`);
    else if (eMonth && eYear) params.push(`month=${eMonth}`, `year=${eYear}`);
    else if (eYear && !eMonth && !eDay) params.push(`year=${eYear}`);
    if (params.length) url += `?${params.join('&')}`;

    const nextMonthly = !!(eMonth && eYear && !eDay);
    const nextYear = !!(!eMonth && eYear && !eDay);

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
        timeLabel: data.timeLabel || (isBlank ? 'Today' : ''),
        isLoading: false,
      });
      setIsMonthlyView(nextMonthly);
      setIsYearView(nextYear);
    } catch (e) {
      if ((e as any)?.name === 'AbortError') return;
      setFilteredMetrics(p => ({ ...p, isLoading: false }));
    }
  };

  const fetchChartData = useCallback(async () => {
    const nowYear = String(new Date().getFullYear());
    const effectiveYear = selectedYear || nowYear;
    const view: ChartView = selectedMonth ? 'dayofweek' : 'yearly';
    setChartView(view);
    setChartLoading(true);

    try {
      let url = '';
      const monthLabel = months.find(m => m.value === selectedMonth)?.label || '';

      if (view === 'yearly') {
        url = buildApiUrl(`api/stats/chart/yearly?year=${effectiveYear}`);
        setChartMeta({ title: `Monthly Sales — ${effectiveYear}`, subtitle: 'Revenue breakdown by month' });
      } else {
        url = buildApiUrl(`api/stats/chart/dayofweek?year=${effectiveYear}&month=${selectedMonth}`);
        setChartMeta({ title: `Day-of-Week Analysis — ${monthLabel} ${effectiveYear}`, subtitle: '×N = occurrences of that weekday in this month' });
      }

      const res = await fetch(url);
      const json = await res.json();
      const data: ChartEntry[] = (json.data || []).map((d: any) => ({
        ...d,
        accountAmount: Math.max(0, (d.amount || 0) - (d.cashAmount || 0)),
      }));
      setChartData(data);

      const totalAmt = data.reduce((s, d) => s + (d.amount || 0), 0);
      const cashAmt = data.reduce((s, d) => s + (d.cashAmount || 0), 0);
      setDonutTotal(totalAmt);
      setDonutData([
        { name: 'Cash', value: cashAmt },
        { name: 'Account', value: Math.max(0, totalAmt - cashAmt) },
      ]);

      // Always fetch daily breakdown — use selected month or current month
      const dailyMonth = selectedMonth || String(new Date().getMonth() + 1);
      const dailyRes = await fetch(buildApiUrl(`api/stats/chart/daily?year=${effectiveYear}&month=${dailyMonth}`));
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
  }, [selectedDay, selectedMonth, selectedYear]);

  useEffect(() => {
    buildAndFetchMetrics();
    fetchChartData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay, selectedMonth, selectedYear]);

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

  return (
    <div className="p-4 space-y-6">

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-28">
          <Select value={selectedDay} onValueChange={setSelectedDay}>
            <SelectTrigger><SelectValue placeholder="Date">{selectedDay || 'Date'}</SelectValue></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 31 }, (_, i) => {
                const d = String(i + 1);
                return <SelectItem key={d} value={d}>{d.padStart(2, '0')}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="w-32">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger><SelectValue placeholder="Month">{selectedMonth || 'Month'}</SelectValue></SelectTrigger>
            <SelectContent>
              {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-24">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger><SelectValue placeholder="Year">{selectedYear || 'Year'}</SelectValue></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {(selectedDay || selectedMonth || selectedYear) && (
          <button
            onClick={() => { setSelectedDay(''); setSelectedMonth(''); setSelectedYear(''); }}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* KPI Cards */}
      {(() => {
        const now = new Date();
        const isBlank = !selectedDay && !selectedMonth && !selectedYear;
        const isToday = isBlank || (
          selectedDay === String(now.getDate()) &&
          selectedMonth === String(now.getMonth() + 1) &&
          selectedYear === String(now.getFullYear())
        );

        if (isMonthlyView || (!isBlank && !isToday && !isYearView)) {
          return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard title="Total Deliveries" value={filteredMetrics.deliveries} icon={PackageCheck} />
              <KpiCard title="Total Cans" value={filteredMetrics.totalCans} icon={PackageSearch} />
              <KpiCard title="Total Amount" value={`Rs. ${filteredMetrics.totalAmountGenerated.toLocaleString()}`} icon={IndianRupee} green />
              <KpiCard title="Cash Amount" value={`Rs. ${filteredMetrics.totalCashAmountGenerated.toLocaleString()}`} icon={IndianRupee} green />
            </div>
          );
        }

        if (isToday && !isYearView) {
          return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                  <Users className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {totalCustomers >= 0 ? <div className="text-2xl font-bold">{totalCustomers}</div> : <Skeleton className="h-7 w-12 bg-muted/50" />}
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Deliveries</CardTitle>
                  <ListChecks className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {pendingDeliveries >= 0 ? <div className="text-2xl font-bold">{pendingDeliveries}</div> : <Skeleton className="h-7 w-12 bg-muted/50" />}
                </CardContent>
              </Card>
              <KpiCard title="Today's Deliveries" value={filteredMetrics.deliveries} icon={PackageCheck} />
              <KpiCard title="Today's Cans" value={filteredMetrics.totalCans} icon={PackageSearch} />
              <KpiCard title="Total Amount Generated" value={`Rs. ${totalAmountGenerated.toLocaleString()}`} icon={IndianRupee} green span="col-span-2" />
              <KpiCard title="Cash Amount Generated" value={`Rs. ${totalCashAmountGenerated.toLocaleString()}`} icon={IndianRupee} green span="col-span-2" />
            </div>
          );
        }

        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Total Deliveries" value={filteredMetrics.deliveries} icon={PackageCheck} />
            <KpiCard title="Total Cans" value={filteredMetrics.totalCans} icon={PackageSearch} />
            <KpiCard title="Total Amount" value={`Rs. ${filteredMetrics.totalAmountGenerated.toLocaleString()}`} icon={IndianRupee} green />
            <KpiCard title="Cash Amount" value={`Rs. ${filteredMetrics.totalCashAmountGenerated.toLocaleString()}`} icon={IndianRupee} green />
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
        ) : chartData.length === 0 || chartData.every(d => d.amount === 0 && d.deliveries === 0) ? (
          <Card className="glass-card">
            <CardContent className="pt-6 flex flex-col items-center justify-center h-48 gap-2">
              <TrendingUp className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No data for this period.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Revenue Stacked Bar */}
            <Card className="glass-card lg:col-span-2">
              <CardHeader className="pb-1 pt-4 px-5">
                <div className="flex items-center gap-4">
                  <CardTitle className="text-sm font-semibold text-foreground">Revenue — Cash vs Account</CardTitle>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground ml-auto">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: P.cash }} />Cash</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: P.account }} />Account</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top: 16, right: 8, left: -10, bottom: 0 }} barCategoryGap="30%">
                    <defs>
                      <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={P.cashMid} /><stop offset="100%" stopColor={P.cash} />
                      </linearGradient>
                      <linearGradient id="acctGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={P.accountMid} /><stop offset="100%" stopColor={P.account} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                    <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 6 }} />
                    <Bar dataKey="cashAmount" name="Cash" fill="url(#cashGrad)" stackId="rev" radius={[0, 0, 0, 0]} maxBarSize={48}>
                      <LabelList dataKey="cashAmount" position="inside" content={({ x, y, width, height, value }: any) => {
                        if (!value || (height as number) < 20) return null;
                        return <text x={(x as number) + (width as number) / 2} y={(y as number) + (height as number) / 2} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={10} fontWeight="600">{`${(value / 1000).toFixed(0)}k`}</text>;
                      }} />
                    </Bar>
                    <Bar dataKey="accountAmount" name="Account" fill="url(#acctGrad)" stackId="rev" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      <LabelList dataKey="accountAmount" position="inside" content={({ x, y, width, height, value }: any) => {
                        if (!value || (height as number) < 20) return null;
                        return <text x={(x as number) + (width as number) / 2} y={(y as number) + (height as number) / 2} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={10} fontWeight="600">{`${(value / 1000).toFixed(0)}k`}</text>;
                      }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Donut */}
            <Card className="glass-card">
              <CardHeader className="pb-1 pt-4 px-5">
                <CardTitle className="text-sm font-semibold text-foreground">Revenue Split</CardTitle>
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
                          Rs.{donutTotal >= 1000 ? `${(donutTotal / 1000).toFixed(1)}k` : donutTotal}
                        </tspan>
                      </text>
                      <Legend iconType="circle" iconSize={8}
                        formatter={(v) => <span style={{ fontSize: 12, color: '#6b7280' }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Deliveries & Cans */}
            <Card className="glass-card lg:col-span-3">
              <CardHeader className="pb-1 pt-4 px-5">
                <CardTitle className="text-sm font-semibold text-foreground">Deliveries &amp; Cans</CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} margin={{ top: 12, right: 8, left: -10, bottom: 0 }} barCategoryGap="30%" barGap={4}>
                    <defs>
                      <linearGradient id="delGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={P.deliveriesLight} /><stop offset="100%" stopColor={P.deliveries} />
                      </linearGradient>
                      <linearGradient id="canGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6ee7b7" /><stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 6 }} />
                    <Bar dataKey="deliveries" name="Deliveries" fill="url(#delGrad)" radius={[6, 6, 0, 0]} maxBarSize={36}>
                      <LabelList dataKey="deliveries" position="top" style={{ fontSize: 10, fill: '#6b7280', fontWeight: 600 }} />
                    </Bar>
                    <Bar dataKey="cans" name="Cans" fill="url(#canGrad)" radius={[6, 6, 0, 0]} maxBarSize={36}>
                      <LabelList dataKey="cans" position="top" style={{ fontSize: 10, fill: '#6b7280', fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

          </div>
        )}
      </div>

      {/* Daily breakdown chart — shown only when month is selected */}
      {dailyData.length > 0 && (() => {
        const DOW_COLORS = ['#f43f5e','#8b5cf6','#06b6d4','#10b981','#f59e0b','#3b82f6','#ec4899'];
        const DOW_NAMES  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

        const CustomTick = ({ x, y, payload }: any) => {
          const entry = dailyData[payload.index];
          if (!entry) return null;
          const color = DOW_COLORS[entry.dow];
          return (
            <g transform={`translate(${x},${y})`}>
              <text x={0} y={0} dy={10} textAnchor="middle" fontSize={8} fill={color} fontWeight="700">
                {entry.dayName[0]}
              </text>
              <text x={0} y={0} dy={20} textAnchor="middle" fontSize={8} fill="#9ca3af">
                {entry.day}
              </text>
            </g>
          );
        };

        return (
          <Card className="glass-card">
            <CardHeader className="pb-1 pt-4 px-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm font-semibold text-foreground">
                  {(() => {
                    const now = new Date();
                    const m = selectedMonth || String(now.getMonth() + 1);
                    const y = selectedYear || String(now.getFullYear());
                    const mLabel = months.find(mo => mo.value === m)?.label || '';
                    return `Daily Deliveries — ${mLabel} ${y}`;
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
                  <Tooltip
                    content={({ active, payload }: any) => {
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
                    }}
                    cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                  />
                  <Bar dataKey="deliveries" name="Deliveries" radius={[3, 3, 0, 0]} maxBarSize={14}>
                    {dailyData.map((entry, i) => (
                      <Cell key={i} fill={DOW_COLORS[entry.dow]} fillOpacity={0.85} />
                    ))}
                    <LabelList dataKey="deliveries" position="top"
                      content={({ x, y, value }: any) => value > 0
                        ? <text x={x} y={(y as number) - 2} textAnchor="middle" fontSize={8} fill="#9ca3af">{value}</text>
                        : null} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
