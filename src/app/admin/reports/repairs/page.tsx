'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { User, Device, DeviceModel, Warranty, Repair, RepairType } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { formatDate, formatCurrency } from '@/lib/utils';
import {
  Download,
  Wrench,
  Building2,
  TrendingUp,
  ArrowRight,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  Activity,
  CheckCircle2,
  Clock,
  Wallet
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';

type AdminRepair = Repair & {
  device?: (Pick<Device, 'imei'> & {
    device_models?: Pick<DeviceModel, 'model_name'> | null;
  }) | null;
  lab?: Pick<User, 'full_name' | 'email'> | null;
  warranty?: (Warranty & {
    store?: Pick<User, 'full_name' | 'email'> | null;
  }) | null;
  repair_type?: Pick<RepairType, 'id' | 'name'> | null;
  custom_repair_description?: string | null;
  custom_repair_price?: number | null;
};

type LabRow = Pick<User, 'id' | 'full_name' | 'email' | 'phone'>;
type RepairTypeRow = Pick<RepairType, 'id' | 'name' | 'is_active'>;
type DateRangeOption = 'week' | 'month' | 'quarter' | 'year' | 'custom';

// Constants
const COLORS = ['#3b82f6', '#22c55e', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

const statusLabels: Record<string, string> = {
  received: 'התקבל',
  completed: 'הושלם',
  replacement_requested: 'בקשת החלפה',
  cancelled: 'בוטל',
};

export default function AdminRepairsReportPage() {
  const supabase = createClient();
  const { toast } = useToast();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [allRepairs, setAllRepairs] = useState<AdminRepair[]>([]);
  const [labs, setLabs] = useState<LabRow[]>([]);
  const [repairTypes, setRepairTypes] = useState<RepairTypeRow[]>([]);
  
  // Filters
  const [filterLab, setFilterLab] = useState<string>('all');
  const [filterRepairType, setFilterRepairType] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRangeOption>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Initialize Dates
  useEffect(() => {
    const now = new Date();
    const start = new Date();
    
    switch (dateRange) {
      case 'week': start.setDate(now.getDate() - 7); break;
      case 'month': start.setMonth(now.getMonth() - 1); break;
      case 'quarter': start.setMonth(now.getMonth() - 3); break;
      case 'year': start.setFullYear(now.getFullYear() - 1); break;
      case 'custom': return; // Don't change dates automatically
    }
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(now.toISOString().split('T')[0]);
  }, [dateRange]);

  // Initial Data Fetch (Labs & Types)
  useEffect(() => {
    const fetchMetaData = async () => {
      try {
        const [labsRes, typesRes] = await Promise.all([
          supabase.from('users').select('id, full_name, email').eq('role', 'lab').order('full_name'),
          supabase.from('repair_types').select('id, name, is_active').order('name')
        ]);

        if (labsRes.data) setLabs(labsRes.data as LabRow[]);
        if (typesRes.data) setRepairTypes(typesRes.data as RepairTypeRow[]);
      } catch (error) {
        console.error('Error fetching metadata:', error);
      }
    };
    fetchMetaData();
  }, [supabase]);

  // Fetch Repairs based on filters
  const fetchRepairs = useCallback(async () => {
    if (!startDate || !endDate) return;

    try {
      setIsLoading(true);
      let query = supabase
        .from('repairs')
        .select(`
          *,
          device:devices(imei, device_models(model_name)),
          lab:users!repairs_lab_id_fkey(full_name, email),
          warranty:warranties(
            customer_name,
            customer_phone,
            store:users!warranties_store_id_fkey(full_name, email)
          ),
          repair_type:repair_types(id, name)
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59');

      if (filterLab !== 'all') query = query.eq('lab_id', filterLab);
      if (filterRepairType !== 'all')
        if (filterRepairType === 'custom') {
          query = query.not('custom_repair_description', 'is', null);
        } else {
          query = query.eq('repair_type_id', filterRepairType);
        }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setAllRepairs((data || []) as AdminRepair[]);

    } catch (error) {
      console.error('Error fetching repairs:', error);
      toast({ title: 'שגיאה', description: 'לא ניתן לטעון נתונים', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [supabase, startDate, endDate, filterLab, filterRepairType, toast]);

  useEffect(() => {
    fetchRepairs();
  }, [fetchRepairs]);

  // Derived Stats & Charts Data
  const stats = useMemo(() => {
    const total = allRepairs.length;
    const completed = allRepairs.filter(r => r.status === 'completed').length;
    // Changed semantic from revenue to cost
    const totalCost = allRepairs.reduce((sum, r) => sum + (r.cost || 0), 0);
    const pending = allRepairs.filter(r => r.status === 'received').length;

    return { total, completed, totalCost, pending };
  }, [allRepairs]);

  const chartData = useMemo(() => {
    // 1. Daily Trend (Cost & Count)
    const dailyMap = new Map<string, { date: string; cost: number; count: number }>();
    
    allRepairs.forEach(r => {
      const date = new Date(r.created_at).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
      const current = dailyMap.get(date) || { date, cost: 0, count: 0 };
      dailyMap.set(date, {
        date,
        cost: current.cost + (r.cost || 0),
        count: current.count + 1
      });
    });

    const trendData = Array.from(dailyMap.values()).reverse(); 

    // 2. Status Distribution
    const statusMap = new Map<string, number>();
    allRepairs.forEach(r => {
      const label = statusLabels[r.status] || r.status;
      statusMap.set(label, (statusMap.get(label) || 0) + 1);
    });
    const statusData = Array.from(statusMap.entries()).map(([name, value]) => ({ name, value }));

    // 3. Repair Type Distribution
    const typeMap = new Map<string, number>();
    allRepairs.forEach(r => {
      const label = r.repair_type?.name || 'אחר';
      
      typeMap.set(label, (typeMap.get(label) || 0) + 1);
    });
    const typeData = Array.from(typeMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6); // Top 6 types

    // 4. Lab Performance
    const labMap = new Map<string, { name: string; count: number; cost: number }>();
    allRepairs.forEach(r => {
      const name = r.lab?.full_name || r.lab?.email || 'לא משויך';
      const current = labMap.get(name) || { name, count: 0, cost: 0 };
      labMap.set(name, {
        name,
        count: current.count + 1,
        cost: current.cost + (r.cost || 0)
      });
    });
    const labData = Array.from(labMap.values()).sort((a, b) => b.cost - a.cost);

    return { trendData, statusData, typeData, labData };
  }, [allRepairs]);

  const handleExport = () => {
    const csvContent = [
      ['תאריך', 'מכשיר', 'תיקון', 'מעבדה', 'חנות', 'סטטוס', 'עלות'],
      ...allRepairs.map(r => [
        formatDate(r.created_at),
        `${r.device?.device_models?.model_name || ''} - ${r.device?.imei || ''}`,
        r.repair_type?.name || r.custom_repair_description || 'אחר',
        r.lab?.full_name || '',
        r.warranty?.store?.full_name || '',
        statusLabels[r.status] || r.status,
        (r.cost || 0).toString()
      ])
    ].map(e => e.join(',')).join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `repairs_report_${startDate}_${endDate}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin/reports">
              <Button variant="ghost" size="sm" className="p-0 h-auto hover:bg-transparent text-muted-foreground hover:text-primary">
                <ArrowRight className="h-4 w-4 ml-1" />
                חזרה לדוחות
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-8 w-8 text-primary" />
            דוח תיקונים ועלויות
          </h1>
          <p className="text-muted-foreground">מעקב אחר ביצועי מעבדות והוצאות תיקונים</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          ייצוא לאקסל
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            
            {/* Date Filters */}
            <div className="space-y-2">
              <label className="text-sm font-medium">טווח תאריכים</label>
              <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="week">שבוע אחרון</SelectItem>
                  <SelectItem value="month">חודש אחרון</SelectItem>
                  <SelectItem value="quarter">רבעון אחרון</SelectItem>
                  <SelectItem value="year">שנה אחרונה</SelectItem>
                  <SelectItem value="custom">מותאם אישית</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateRange === 'custom' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">מתאריך</label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">עד תאריך</label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </>
            )}

            {/* Other Filters */}
            <div className="space-y-2">
              <label className="text-sm font-medium">מעבדה</label>
              <Select value={filterLab} onValueChange={setFilterLab}>
                <SelectTrigger><SelectValue placeholder="כל המעבדות" /></SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all">כל המעבדות</SelectItem>
                  {labs.map(l => <SelectItem key={l.id} value={l.id}>{l.full_name || l.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">סוג תיקון</label>
              <Select value={filterRepairType} onValueChange={setFilterRepairType}>
                <SelectTrigger><SelectValue placeholder="כל הסוגים" /></SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all">כל הסוגים</SelectItem>
                  {repairTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  <SelectItem value="custom">אחר (מותאם)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">סה"כ תיקונים</p>
                    <h3 className="text-2xl font-bold mt-1">{stats.total}</h3>
                  </div>
                  <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <Wrench className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CHANGED: Color to Red/Orange to indicate Expense */}
            <Card className="border-l-4 border-l-red-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    {/* CHANGED: Label to Expenses */}
                    <p className="text-sm font-medium text-muted-foreground">סה״כ עלות למעבדות</p>
                    <h3 className="text-2xl font-bold mt-1 text-red-600 dark:text-red-400">{formatCurrency(stats.totalCost)}</h3>
                  </div>
                  <div className="h-10 w-10 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">הושלמו</p>
                    <h3 className="text-2xl font-bold mt-1">{stats.completed}</h3>
                  </div>
                  <div className="h-10 w-10 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">בטיפול / ממתין</p>
                    <h3 className="text-2xl font-bold mt-1">{stats.pending}</h3>
                  </div>
                  <div className="h-10 w-10 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                    <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost Trend */}
            <Card className="col-span-1 lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  מגמת עלויות תיקונים
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData.trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      {/* CHANGED: Gradient to Red */}
                      <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    {/* FIXED: XAxis overlapping by adding minTickGap */}
                    <XAxis dataKey="date" minTickGap={30} tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" orientation="right" tickFormatter={(v) => `₪${v}`} tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="left" tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: any, name: any) => {
                        if (name === 'עלות') return formatCurrency(value);
                        return value;
                      }}
                      labelStyle={{ textAlign: 'right', direction: 'rtl' }}
                    />
                    <Legend />
                    {/* CHANGED: Semantic names and colors */}
                    <Area yAxisId="left" type="monotone" dataKey="cost" name="עלות" stroke="#ef4444" fillOpacity={1} fill="url(#colorCost)" />
                    <Bar yAxisId="right" dataKey="count" name="כמות תיקונים" barSize={20} fill="#3b82f6" opacity={0.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Repair Types Distribution - LTR FIX */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChartIcon className="h-5 w-5 text-primary" />
                  סוגי תיקונים נפוצים
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[350px]" dir="ltr"> {/* Force LTR for the chart container */}
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    layout="vertical" 
                    data={chartData.typeData} 
                    margin={{ left: 0, right: 30, bottom: 20, top: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    
                    {/* ציר X רגיל (מספרים משמאל לימין) */}
                    <XAxis type="number" />
                    
                    {/* ציר Y בצד שמאל (ברירת מחדל)
                        width={100} - שומר מקום לטקסט בעברית בצד שמאל
                    */}
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={100} 
                      tick={{ fontSize: 12, fill: '#6b7280' }} 
                      interval={0}
                    />
                    
                    {/* הטולטיפ עדיין מיושר לימין כדי שיהיה קריא בעברית */}
                    <Tooltip 
                      cursor={{fill: '#f3f4f6'}}
                      formatter={(value: any) => [value, 'כמות']}
                      contentStyle={{ direction: 'rtl', textAlign: 'right', borderRadius: '8px' }}
                    />
                    
                    {/* הברים צומחים ימינה, אז נעגל את הפינות הימניות: [0, 4, 4, 0] */}
                    <Bar dataKey="value" name="כמות" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={32}>
                      {chartData.typeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5 text-primary" />
                  התפלגות סטטוסים
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData.statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      nameKey="name"
                    >
                      {chartData.statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Lab Performance Table */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  ביצועי מעבדות ועלויות
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">שם המעבדה</TableHead>
                      <TableHead className="text-center">כמות תיקונים</TableHead>
                      <TableHead className="text-left">סה"כ לתשלום</TableHead>
                      <TableHead className="text-left">ממוצע לתיקון</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chartData.labData.map((lab, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{lab.name}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{lab.count}</Badge>
                        </TableCell>
                        <TableCell className="text-left font-medium text-red-600">
                          {formatCurrency(lab.cost)}
                        </TableCell>
                        <TableCell className="text-left text-muted-foreground">
                          {formatCurrency(lab.count > 0 ? lab.cost / lab.count : 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Detailed List */}
          <Card>
            <CardHeader>
              <CardTitle>פירוט תיקונים</CardTitle>
              <CardDescription>
                רשימת התיקונים בטווח הנבחר ({allRepairs.length} רשומות)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">תאריך</TableHead>
                    <TableHead className="text-right">מכשיר</TableHead>
                    <TableHead className="text-right">סוג תיקון</TableHead>
                    <TableHead className="text-right">מעבדה</TableHead>
                    <TableHead className="text-right">חנות</TableHead>
                    <TableHead className="text-center">סטטוס</TableHead>
                    <TableHead className="text-left">עלות (חוב)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allRepairs.slice(0, 50).map((repair) => (
                    <TableRow key={repair.id} className="hover:bg-muted/50">
                      <TableCell className="text-xs">
                        {formatDate(repair.created_at)}
                        <div className="text-muted-foreground text-[10px]">
                          {new Date(repair.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{repair.device?.device_models?.model_name || 'לא ידוע'}</div>
                        <div className="text-xs text-muted-foreground font-mono">{repair.device?.imei}</div>
                      </TableCell>
                      <TableCell>
                        {repair.repair_type?.name || repair.custom_repair_description || 'אחר'}
                      </TableCell>
                      <TableCell>{repair.lab?.full_name || 'לא משויך'}</TableCell>
                      <TableCell>{repair.warranty?.store?.full_name || '-'}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={repair.status === 'completed' ? 'default' : 'outline'}>
                          {statusLabels[repair.status] || repair.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-left font-medium text-red-600">
                        {repair.cost ? formatCurrency(repair.cost) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {allRepairs.length > 50 && (
                <div className="text-center p-4 text-sm text-muted-foreground">
                  מציג 50 מתוך {allRepairs.length} רשומות. השתמש בייצוא לאקסל לצפייה מלאה.
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}