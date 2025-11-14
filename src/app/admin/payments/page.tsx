'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import ShekelIcon from '@/components/ui/shekel-icon';
import {
  TrendingUp,
  Wallet,
  Eye,
  RefreshCw,
  CheckCircle,
  Users
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

interface LabBalance {
  lab_id: string;
  lab_name: string;
  lab_email: string;
  total_earned: number;
  total_paid: number;
  balance: number;
  repairs_count: number;
  payments_count: number;
}

export default function AdminPaymentsPage() {
  const [labBalances, setLabBalances] = useState<LabBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch all labs
      const { data: labs } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'lab')
        .eq('is_active', true)
        .order('full_name');

      if (!labs) return;

      // For each lab, calculate balance
      const balancesPromises = labs.map(async (lab: any) => {
        // Get all completed repairs
        const { data: repairs } = await supabase
          .from('repairs')
          .select('id, cost')
          .eq('lab_id', lab.id)
          .eq('status', 'completed');

        // Get all payments
        const { data: payments } = await supabase
          .from('payments')
          .select('amount')
          .eq('lab_id', lab.id);

        const totalEarned = (repairs as any)?.reduce((sum: number, r: any) => sum + (r.cost || 0), 0) || 0;
        const totalPaid = (payments as any)?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;

        return {
          lab_id: lab.id,
          lab_name: lab.full_name || lab.email || '',
          lab_email: lab.email || '',
          total_earned: totalEarned,
          total_paid: totalPaid,
          balance: totalEarned - totalPaid,
          repairs_count: repairs?.length || 0,
          payments_count: payments?.length || 0,
        };
      });

      const balances = await Promise.all(balancesPromises);

      // Sort by balance (highest first)
      balances.sort((a, b) => b.balance - a.balance);
      setLabBalances(balances);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון את נתוני התשלומים',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [supabase, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalOwed = labBalances.reduce((sum, lab) => sum + Math.max(0, lab.balance), 0);
  const totalOverpaid = labBalances.reduce((sum, lab) => sum + Math.abs(Math.min(0, lab.balance)), 0);
  const totalEarned = labBalances.reduce((sum, lab) => sum + lab.total_earned, 0);
  const totalPaid = labBalances.reduce((sum, lab) => sum + lab.total_paid, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">ניהול תשלומים</h1>
          <p className="text-muted-foreground">סקירה כללית של יתרות למעבדות</p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="ms-2 h-4 w-4" />
          רענן
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סה"כ עלות תיקונים</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalEarned)}</div>
            <p className="text-xs text-muted-foreground">מכל המעבדות</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סה"כ שילמת</CardTitle>
            <ShekelIcon className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalPaid)}</div>
            <p className="text-xs text-muted-foreground">לכל המעבדות</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">יתרת חוב</CardTitle>
            <Wallet className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(totalOwed)}</div>
            <p className="text-xs text-muted-foreground">חוב כולל למעבדות</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">מעבדות פעילות</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{labBalances.length}</div>
            <p className="text-xs text-muted-foreground">
              {labBalances.filter(l => l.balance > 0).length} עם יתרת חוב
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Labs Table */}
      <Card>
        <CardHeader>
          <CardTitle>יתרות מעבדות</CardTitle>
          <CardDescription>
            לחץ על שורה לניהול תשלומים למעבדה
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>מעבדה</TableHead>
                <TableHead>אימייל</TableHead>
                <TableHead className="text-center">תיקונים</TableHead>
                <TableHead className="text-center">תשלומים</TableHead>
                <TableHead className="text-left">סה"כ עלות תיקונים</TableHead>
                <TableHead className="text-left">סה"כ שולם</TableHead>
                <TableHead className="text-left">יתרה</TableHead>
                <TableHead>פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {labBalances.map((lab) => (
                <TableRow
                  key={lab.lab_id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/admin/labs/${lab.lab_id}/payments`)}
                >
                  <TableCell className="font-medium">{lab.lab_name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{lab.lab_email}</TableCell>
                  <TableCell className="text-center">
                    <span className="text-muted-foreground">{lab.repairs_count}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-muted-foreground">{lab.payments_count}</span>
                  </TableCell>
                  <TableCell className="text-left text-green-600 font-medium">
                    {formatCurrency(lab.total_earned)}
                  </TableCell>
                  <TableCell className="text-left text-blue-600 font-medium">
                    {formatCurrency(lab.total_paid)}
                  </TableCell>
                  <TableCell className="text-left">
                    {lab.balance > 0 ? (
                      <span className="font-bold text-orange-600">
                        {formatCurrency(lab.balance)}
                      </span>
                    ) : lab.balance < 0 ? (
                      <span className="font-bold text-green-600">
                        +{formatCurrency(Math.abs(lab.balance))}
                      </span>
                    ) : (
                      <span className="text-muted-foreground font-medium flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        מעודכן
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/admin/labs/${lab.lab_id}/payments`);
                      }}
                    >
                      <Eye className="h-4 w-4 ms-1" />
                      צפה
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {labBalances.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    אין מעבדות רשומות במערכת
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
