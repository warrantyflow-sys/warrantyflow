'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Tables } from '@/lib/supabase/database.types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  DollarSign, 
  Calendar,
  Wrench,
  TrendingUp,
  Download,
  FileText,
  CheckCircle,
  Clock
} from 'lucide-react';

type CompletedRepair = Tables<'repairs'> & {
  device?: (Pick<Tables<'devices'>, 'imei'> & {
    device_models?: Pick<Tables<'device_models'>, 'model_name'> | null;
  }) | null;
  warranty?: (Tables<'warranties'> & {
    store?: Pick<Tables<'users'>, 'full_name' | 'email'> | null;
  }) | null;
};

type LabPayment = Tables<'payments'>;

interface MonthlyReport {
  month: string;
  year: number;
  repairs: CompletedRepair[];
  totalRepairs: number;
  totalRevenue: number;
  byFaultType: Record<string, { count: number; revenue: number }>;
  payments: LabPayment[];
}

export default function LabFinancialReportPage() {
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReport[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().substring(0, 7)
  );
  const [labData, setLabData] = useState<Tables<'users'> | null>(null);
  const [totalStats, setTotalStats] = useState({
    totalRepairs: 0,
    totalRevenue: 0,
    totalPaid: 0,
    balance: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  
  const supabase = createClient();
  const { toast } = useToast();

  const faultTypeLabels: Record<string, string> = {
    screen: 'מסך',
    charging_port: 'שקע טעינה',
    flash: 'פנס',
    speaker: 'רמקול',
    board: 'לוח אם',
    other: 'אחר',
  };

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get lab info
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single<Tables<'users'>>();

      if (!userData) return;
      setLabData(userData);
      const labId = userData.id;

      // Fetch all repairs
      const { data: repairs } = await supabase
        .from('repairs')
        .select(`
          *,
          device:devices(imei, device_models(model_name)),
          warranty:warranties(
            customer_name,
            store:users!warranties_store_id_fkey(full_name, email)
          )
        `)
        .eq('lab_id', labId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .returns<CompletedRepair[]>();

      // Fetch all payments
      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('lab_id', labId)
        .order('payment_date', { ascending: false })
        .returns<LabPayment[]>();

      // Process data by month
      const reportsByMonth: Record<string, MonthlyReport> = {};
      
      (repairs || []).forEach(repair => {
        const completionDate = repair.completed_at || repair.created_at;
        const month = completionDate.substring(0, 7);
        if (!reportsByMonth[month]) {
          reportsByMonth[month] = {
            month: month.split('-')[1],
            year: parseInt(month.split('-')[0]),
            repairs: [],
            totalRepairs: 0,
            totalRevenue: 0,
            byFaultType: {},
            payments: []
          };
        }
        
        reportsByMonth[month].repairs.push(repair);
        reportsByMonth[month].totalRepairs++;
        reportsByMonth[month].totalRevenue += repair.cost || 0;
        
        // Group by fault type
        const faultType = repair.fault_type || 'other';
        if (!reportsByMonth[month].byFaultType[faultType]) {
          reportsByMonth[month].byFaultType[faultType] = { count: 0, revenue: 0 };
        }
        reportsByMonth[month].byFaultType[faultType].count++;
        reportsByMonth[month].byFaultType[faultType].revenue += repair.cost || 0;
      });

      // Add payments to months
      (payments || []).forEach(payment => {
        const month = payment.payment_date.substring(0, 7);
        if (reportsByMonth[month]) {
          reportsByMonth[month].payments.push(payment);
        }
      });

      const sortedReports = Object.values(reportsByMonth).sort((a, b) => {
        const dateA = `${a.year}-${String(a.month).padStart(2, '0')}`;
        const dateB = `${b.year}-${String(b.month).padStart(2, '0')}`;
        return dateB.localeCompare(dateA);
      });

      setMonthlyReports(sortedReports);

      // Calculate totals
      const totalRevenue = (repairs || []).reduce((sum, r) => sum + (r.cost || 0), 0);
      const totalPaid = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

      setTotalStats({
        totalRepairs: repairs?.length || 0,
        totalRevenue,
        totalPaid,
        balance: totalRevenue - totalPaid
      });

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון את הנתונים',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [supabase, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportToCSV = () => {
    const selectedReport = monthlyReports.find(r => 
      `${r.year}-${String(r.month).padStart(2, '0')}` === selectedMonth
    );
    
    if (!selectedReport) return;

    const csvContent = [
      ['דוח כספי - ' + (labData?.full_name || labData?.email || '')],
      ['חודש: ' + selectedMonth],
      [''],
      ['סיכום כללי'],
      ['תיקונים', 'הכנסות'],
      [selectedReport.totalRepairs, formatCurrency(selectedReport.totalRevenue)],
      [''],
      ['פירוט לפי סוג תקלה'],
      ['סוג תקלה', 'כמות', 'הכנסה'],
      ...Object.entries(selectedReport.byFaultType).map(([type, data]) => [
        faultTypeLabels[type] || type,
        data.count,
        formatCurrency(data.revenue)
      ]),
      [''],
      ['פירוט תיקונים'],
      ['תאריך', 'דגם', 'תקלה', 'מחיר', 'חנות'],
      ...selectedReport.repairs.map(repair => [
        repair.completed_at ? formatDate(repair.completed_at) : formatDate(repair.created_at),
        repair.device?.device_models?.model_name || 'לא ידוע',
        faultTypeLabels[repair.fault_type || 'other'] || repair.fault_type || 'אחר',
        formatCurrency(repair.cost || 0),
        repair.warranty?.store?.full_name || repair.warranty?.store?.email || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `financial_report_${selectedMonth}.csv`;
    link.click();
  };

  const currentMonthReport = monthlyReports.find(r => 
    `${r.year}-${String(r.month).padStart(2, '0')}` === selectedMonth
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">דוח כספי</h1>
          <p className="text-muted-foreground">
            סיכום תיקונים והכנסות - {labData?.full_name || labData?.email || ''}
          </p>
        </div>
        <div className="flex gap-4">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthlyReports.map((report) => {
                const monthValue = `${report.year}-${String(report.month).padStart(2, '0')}`;
                return (
                  <SelectItem key={monthValue} value={monthValue}>
                    {report.month}/{report.year}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Button onClick={exportToCSV} variant="outline">
            <Download className="ms-2 h-4 w-4" />
            ייצוא לאקסל
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סה"כ תיקונים</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.totalRepairs}</div>
            <p className="text-xs text-muted-foreground">תיקונים שהושלמו</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סה"כ הכנסות</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalStats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">הכנסות מתיקונים</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">התקבל</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalStats.totalPaid)}</div>
            <p className="text-xs text-muted-foreground">תשלומים שהתקבלו</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">יתרה</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalStats.balance)}</div>
            <p className="text-xs text-muted-foreground">מאזן תשלומים</p>
          </CardContent>
        </Card>
      </div>

      {currentMonthReport && (
        <>
          {/* Monthly Summary */}
          <Card>
            <CardHeader>
              <CardTitle>סיכום חודש {currentMonthReport.month}/{currentMonthReport.year}</CardTitle>
              <CardDescription>
                {currentMonthReport.totalRepairs} תיקונים בסך {formatCurrency(currentMonthReport.totalRevenue)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* By Fault Type */}
                <div>
                  <h4 className="font-medium mb-2">פילוח לפי סוג תקלה</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">סוג תקלה</TableHead>
                        <TableHead className="text-right">כמות</TableHead>
                        <TableHead className="text-right">מחיר יחידה</TableHead>
                        <TableHead className="text-right">סה"כ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(currentMonthReport.byFaultType).map(([type, data]) => (
                        <TableRow key={type}>
                          <TableCell>{faultTypeLabels[type] || type}</TableCell>
                          <TableCell>{data.count}</TableCell>
                      <TableCell>
                        {formatCurrency(data.count > 0 ? data.revenue / data.count : 0)}
                      </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(data.revenue)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold">
                        <TableCell>סה"כ</TableCell>
                        <TableCell>{currentMonthReport.totalRepairs}</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>{formatCurrency(currentMonthReport.totalRevenue)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Payments Received */}
                {currentMonthReport.payments.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">תשלומים שהתקבלו</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">תאריך</TableHead>
                          <TableHead className="text-right">סכום</TableHead>
                          <TableHead className="text-right">אסמכתא</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentMonthReport.payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>{formatDate(payment.payment_date)}</TableCell>
                            <TableCell className="font-bold text-blue-600">
                              {formatCurrency(payment.amount)}
                            </TableCell>
                            <TableCell>{payment.reference || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Detailed Repairs List */}
          <Card>
            <CardHeader>
              <CardTitle>פירוט תיקונים</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">תאריך</TableHead>
                    <TableHead className="text-right">מכשיר</TableHead>
                    <TableHead className="text-right">תקלה</TableHead>
                    <TableHead className="text-right">לקוח</TableHead>
                    <TableHead className="text-right">חנות</TableHead>
                    <TableHead className="text-right">מחיר</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentMonthReport.repairs.map((repair) => (
                    <TableRow key={repair.id}>
                      <TableCell>{repair.completed_at ? formatDate(repair.completed_at) : '-'}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{repair.device?.device_models?.model_name || 'לא ידוע'}</div>
                          <div className="text-xs text-muted-foreground">{repair.device?.imei}</div>
                        </div>
                      </TableCell>
                      <TableCell>{faultTypeLabels[repair.fault_type || 'other']}</TableCell>
                      <TableCell>{repair.warranty?.customer_name || repair.customer_name}</TableCell>
                      <TableCell>{repair.warranty?.store?.full_name || repair.warranty?.store?.email || '-'}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(repair.cost || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}