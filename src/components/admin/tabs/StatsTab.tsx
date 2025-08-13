"use client";

import React, { useState, useEffect } from 'react';
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
  // State for month/year filtering
  const currentDate = new Date();
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [isMonthlyView, setIsMonthlyView] = useState(false);
  const [isYearView, setIsYearView] = useState(false);
  
  // State for filtered metrics
  const [filteredMetrics, setFilteredMetrics] = useState({
    deliveries: deliveriesTodayCount,
    totalCans: totalCansToday,
    totalAmountGenerated: 0,
    totalCashAmountGenerated: 0,
    timeLabel: 'Today',
    isLoading: false
  });
  
  // Months array for dropdown
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
  
  // Years array for dropdown (current year + 5 previous years)
  const years = Array.from({ length: 6 }, (_, i) => {
    const year = currentDate.getFullYear() - i;
    return { value: String(year), label: String(year) };
  });

  // Fetch filtered metrics when month/year changes
  const fetchFilteredMetrics = async (month?: string, year?: string, day?: string) => {
    setFilteredMetrics(prev => ({ ...prev, isLoading: true }));

    try {
      let metricsUrl = buildApiUrl('api/dashboard/metrics');
      const params: string[] = [];

      // Normalize inputs: if day present but month/year missing, use current; if month present but no year, use current
      const now = new Date();
      const effectiveMonth = day && !month ? String(now.getMonth() + 1) : month;
      const effectiveYear = (day && !year) || (month && !year) ? String(now.getFullYear()) : year;

      if (effectiveMonth && effectiveYear) {
        params.push(`month=${effectiveMonth}`, `year=${effectiveYear}`);
      }
      if (day) {
        params.push(`day=${day}`);
      }
      if (!effectiveMonth && effectiveYear && !day) {
        params.push(`year=${effectiveYear}`);
      }
      if (params.length) {
        metricsUrl += `?${params.join('&')}`;
      }

      const response = await fetch(metricsUrl);
      if (response.ok) {
        const data = await response.json();
        setFilteredMetrics({
          deliveries: data.deliveries || 0,
          totalCans: data.totalCans || 0,
          totalAmountGenerated: data.totalAmountGenerated || 0,
          totalCashAmountGenerated: data.totalCashAmountGenerated || 0,
          timeLabel: data.timeLabel || 'Today',
          isLoading: false
        });
        setIsMonthlyView(!!data.isMonthlyView);
        setIsYearView(!!data.isYearView);
      } else {
        console.error('Failed to fetch filtered metrics');
        setFilteredMetrics(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Error fetching filtered metrics:', error);
      setFilteredMetrics(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Helper: fetch for current selection; if none selected, fetch today
  const fetchForCurrentSelection = () => {
    const now = new Date();
    const todayDay = String(now.getDate()).padStart(2, '0');
    const todayMonth = String(now.getMonth() + 1);
    const todayYear = String(now.getFullYear());

    if (!selectedDay && !selectedMonth && !selectedYear) {
      fetchFilteredMetrics(todayMonth, todayYear, todayDay);
    } else if (selectedDay) {
      // If day selected without month/year, assume current month/year
      const month = selectedMonth || todayMonth;
      const year = selectedYear || todayYear;
      fetchFilteredMetrics(month, year, selectedDay);
    } else if (selectedMonth) {
      // If month selected without year, assume current year
      const year = selectedYear || todayYear;
      fetchFilteredMetrics(selectedMonth, year, undefined);
    } else if (selectedYear) {
      fetchFilteredMetrics(undefined, selectedYear, undefined);
    } else {
      fetchFilteredMetrics(todayMonth, todayYear, todayDay);
    }
  };

  const handleDayChange = (day: string) => {
    setSelectedDay(day);
    // After any change, fetch according to current selection
    setTimeout(fetchForCurrentSelection, 0);
  };

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    setTimeout(fetchForCurrentSelection, 0);
  };

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    setTimeout(fetchForCurrentSelection, 0);
  };



  // Initialize with today's data (while showing blank selectors)
  useEffect(() => {
    fetchForCurrentSelection();
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
                  const day = (i + 1).toString().padStart(2, '0');
                  return (
                    <SelectItem key={day} value={day}>{day}</SelectItem>
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
        const todayDay = String(now.getDate()).padStart(2, '0');
        const todayMonth = String(now.getMonth() + 1);
        const todayYear = String(now.getFullYear());
        const isBlankSelection = !selectedDay && !selectedMonth && !selectedYear;
        const isTodaySelected = isBlankSelection || (selectedDay === todayDay && selectedMonth === todayMonth && selectedYear === todayYear);

        // Monthly View: only four KPIs
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

        // Day/Year View
        if (isTodaySelected && !isYearView) {
          // Today: keep all KPIs
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

        // Non-today date or year view: only four KPIs
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