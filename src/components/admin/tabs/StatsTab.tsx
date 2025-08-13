"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, ListChecks, PackageCheck, PackageSearch, IndianRupee } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { buildApiUrl } from '@/lib/api';

interface StatsTabProps {
  totalCustomers: number;
  pendingDeliveries: number;
  deliveriesTodayCount: number;
  totalCansToday: number;
}

export default function StatsTab({
  totalCustomers,
  pendingDeliveries,
  deliveriesTodayCount,
  totalCansToday
}: StatsTabProps) {
  const currentDate = new Date();
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [isMonthlyView, setIsMonthlyView] = useState(false);
  const [isYearView, setIsYearView] = useState(false);

  const [filteredMetrics, setFilteredMetrics] = useState({
    deliveries: deliveriesTodayCount,
    totalCans: totalCansToday,
    totalAmountGenerated: 0,
    totalCashAmountGenerated: 0,
    timeLabel: 'Today',
    isLoading: false
  });

  const months = [
    { value: '1', label: 'Jan' },
    { value: '2', label: 'Feb' },
    { value: '3', label: 'Mar' },
    { value: '4', label: 'Apr' },
    { value: '5', label: 'May' },
    { value: '6', label: 'Jun' },
    { value: '7', label: 'Jul' },
    { value: '8', label: 'Aug' },
    { value: '9', label: 'Sep' },
    { value: '10', label: 'Oct' },
    { value: '11', label: 'Nov' },
    { value: '12', label: 'Dec' }
  ];

  const years = Array.from({ length: 6 }, (_, i) => {
    const year = currentDate.getFullYear() - i;
    return { value: String(year), label: String(year) };
  });

  // Abortable, versioned requests to avoid race conditions
  const abortRef = useRef<AbortController | null>(null);
  const requestVersionRef = useRef(0);

  const buildAndFetchMetrics = async () => {
    // compute effective selection
    const now = new Date();
    const todayDay = String(now.getDate());
    const todayMonth = String(now.getMonth() + 1);
    const todayYear = String(now.getFullYear());

    const isBlank = !selectedDay && !selectedMonth && !selectedYear;
    const effectiveDay = isBlank ? todayDay : selectedDay || '';
    const effectiveMonth = isBlank ? todayMonth : (selectedMonth || (selectedDay ? todayMonth : ''));
    const effectiveYear = isBlank ? todayYear : (selectedYear || (selectedMonth ? todayYear : ''));

    let url = buildApiUrl('api/dashboard/metrics');
    const params: string[] = [];
    if (effectiveMonth && effectiveYear) {
      params.push(`month=${effectiveMonth}`, `year=${effectiveYear}`);
    }
    if (effectiveDay) {
      params.push(`day=${effectiveDay}`);
    }
    if (!effectiveMonth && effectiveYear && !effectiveDay) {
      params.push(`year=${effectiveYear}`);
    }
    if (params.length) {
      url += `?${params.join('&')}`;
    }

    // set view flags locally based on selection
    const nextIsMonthlyView = !!(effectiveMonth && effectiveYear && !effectiveDay);
    const nextIsYearView = !!(!effectiveMonth && effectiveYear && !effectiveDay);

    // abort previous
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    const myVersion = ++requestVersionRef.current;
    setFilteredMetrics(prev => ({ ...prev, isLoading: true }));

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Ignore if a newer request finished
      if (myVersion !== requestVersionRef.current) return;

      setFilteredMetrics({
        deliveries: data.deliveries || 0,
        totalCans: data.totalCans || 0,
        totalAmountGenerated: data.totalAmountGenerated || 0,
        totalCashAmountGenerated: data.totalCashAmountGenerated || 0,
        timeLabel: data.timeLabel || (isBlank ? 'Today' : ''),
        isLoading: false
      });
      setIsMonthlyView(nextIsMonthlyView);
      setIsYearView(nextIsYearView);
    } catch (e) {
      if ((e as any)?.name === 'AbortError') return;
      // Ignore errors but stop loading state
      setFilteredMetrics(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleDayChange = (day: string) => {
    setSelectedDay(day);
  };

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
  };

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
  };

  // Trigger fetch whenever selection changes
  useEffect(() => {
    buildAndFetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay, selectedMonth, selectedYear]);

  // Initialize with today's data (while showing blank selectors)
  useEffect(() => {
    buildAndFetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4 space-y-6">
      {/* Day/Month/Year Selectors */}
      <div className="flex items-center gap-4">
        <div className="flex gap-3">
          <div className="w-28">
            <Select value={selectedDay} onValueChange={handleDayChange}>
              <SelectTrigger>
                <SelectValue placeholder="Date">{selectedDay || 'Date'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 31 }, (_, i) => {
                  const day = (i + 1).toString();
                  const dayDisplay = day.padStart(2, '0');
                  return (
                    <SelectItem key={day} value={day}>{dayDisplay}</SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="w-32">
            <Select value={selectedMonth} onValueChange={handleMonthChange}>
              <SelectTrigger>
                <SelectValue placeholder="Month">{selectedMonth || 'Month'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-24">
            <Select value={selectedYear} onValueChange={handleYearChange}>
              <SelectTrigger>
                <SelectValue placeholder="Year">{selectedYear || 'Year'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year.value} value={year.value}>
                    {year.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* KPI Rendering Rules */}
      {(() => {
        const now = new Date();
        const todayDay = String(now.getDate());
        const todayMonth = String(now.getMonth() + 1);
        const todayYear = String(now.getFullYear());
        const isBlankSelection = !selectedDay && !selectedMonth && !selectedYear;
        const isTodaySelected = isBlankSelection || (selectedDay === todayDay && selectedMonth === todayMonth && selectedYear === todayYear);

        if (isMonthlyView) {
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
                  <PackageCheck className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {filteredMetrics.isLoading ? (
                    <Skeleton className="h-7 w-12 bg-muted/50" />
                  ) : (
                    <div className="text-2xl font-bold">{filteredMetrics.deliveries}</div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Delivered Cans</CardTitle>
                  <PackageSearch className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {filteredMetrics.isLoading ? (
                    <Skeleton className="h-7 w-12 bg-muted/50" />
                  ) : (
                    <div className="text-2xl font-bold">{filteredMetrics.totalCans}</div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Amount Generated</CardTitle>
                  <IndianRupee className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {filteredMetrics.isLoading ? (
                    <Skeleton className="h-7 w-20 bg-muted/50" />
                  ) : (
                    <div className="text-2xl font-bold text-green-600">
                      Rs. {filteredMetrics.totalAmountGenerated.toLocaleString()}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cash Amount Generated</CardTitle>
                  <IndianRupee className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {filteredMetrics.isLoading ? (
                    <Skeleton className="h-7 w-20 bg-muted/50" />
                  ) : (
                    <div className="text-2xl font-bold text-green-600">Rs. {filteredMetrics.totalCashAmountGenerated.toLocaleString()}</div>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        }

        if ((isTodaySelected && !isYearView) || (!selectedDay && !selectedMonth && !selectedYear)) {
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                  <Users className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {totalCustomers >= 0 ? (
                    <div className="text-2xl font-bold">{totalCustomers}</div>
                  ) : (
                    <Skeleton className="h-7 w-12 bg-muted/50" />
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Deliveries</CardTitle>
                  <ListChecks className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {pendingDeliveries >= 0 ? (
                    <div className="text-2xl font-bold">{pendingDeliveries}</div>
                  ) : (
                    <Skeleton className="h-7 w-12 bg-muted/50" />
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
                  <PackageCheck className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {filteredMetrics.isLoading ? (
                    <Skeleton className="h-7 w-12 bg-muted/50" />
                  ) : (
                    <div className="text-2xl font-bold">{filteredMetrics.deliveries}</div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Delivered Cans</CardTitle>
                  <PackageSearch className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {filteredMetrics.isLoading ? (
                    <Skeleton className="h-7 w-12 bg-muted/50" />
                  ) : (
                    <div className="text-2xl font-bold">{filteredMetrics.totalCans}</div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Amount Generated</CardTitle>
                  <IndianRupee className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {filteredMetrics.isLoading ? (
                    <Skeleton className="h-7 w-20 bg-muted/50" />
                  ) : (
                    <div className="text-2xl font-bold text-green-600">
                      Rs. {filteredMetrics.totalAmountGenerated.toLocaleString()}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cash Amount Generated</CardTitle>
                  <IndianRupee className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {filteredMetrics.isLoading ? (
                    <Skeleton className="h-7 w-20 bg-muted/50" />
                  ) : (
                    <div className="text-2xl font-bold text-green-600">
                      Rs. {filteredMetrics.totalCashAmountGenerated.toLocaleString()}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        }

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
                <PackageCheck className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {filteredMetrics.isLoading ? (
                  <Skeleton className="h-7 w-12 bg-muted/50" />
                ) : (
                  <div className="text-2xl font-bold">{filteredMetrics.deliveries}</div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Delivered Cans</CardTitle>
                <PackageSearch className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {filteredMetrics.isLoading ? (
                  <Skeleton className="h-7 w-12 bg-muted/50" />
                ) : (
                  <div className="text-2xl font-bold">{filteredMetrics.totalCans}</div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Amount Generated</CardTitle>
                <IndianRupee className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {filteredMetrics.isLoading ? (
                  <Skeleton className="h-7 w-20 bg-muted/50" />
                ) : (
                  <div className="text-2xl font-bold text-green-600">
                    Rs. {filteredMetrics.totalAmountGenerated.toLocaleString()}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cash Amount Generated</CardTitle>
                <IndianRupee className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {filteredMetrics.isLoading ? (
                  <Skeleton className="h-7 w-20 bg-muted/50" />
                ) : (
                  <div className="text-2xl font-bold text-green-600">
                    Rs. {filteredMetrics.totalCashAmountGenerated.toLocaleString()}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })()}
    </div>
  );
}