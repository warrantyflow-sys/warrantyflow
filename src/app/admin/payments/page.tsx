'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAllLabsBalances } from '@/hooks/queries/useLabPayments';
import { BackgroundRefreshIndicator } from '@/components/ui/background-refresh-indicator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Users,
  Search,
  X
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type BalanceStatus = 'all' | 'owed' | 'settled' | 'overpaid';
type SortOption = 'balance_desc' | 'balance_asc' | 'name' | 'earned' | 'paid';

export default function AdminPaymentsPage() {
  const { labBalances, isLoading, isFetching, refetch } = useAllLabsBalances();
  const router = useRouter();

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [balanceStatus, setBalanceStatus] = useState<BalanceStatus>('all');
  const [sortOption, setSortOption] = useState<SortOption>('balance_desc');

  // Filtered and sorted data
  const filteredLabBalances = useMemo(() => {
    let result = [...labBalances];

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(lab =>
        (lab.lab_name || '').toLowerCase().includes(query) ||
        (lab.lab_email || '').toLowerCase().includes(query)
      );
    }

    switch (balanceStatus) {
      case 'owed':
        result = result.filter(lab => lab.balance > 0);
        break;
      case 'settled':
        result = result.filter(lab => lab.balance === 0);
        break;
      case 'overpaid':
        result = result.filter(lab => lab.balance < 0);
        break;
    }

    switch (sortOption) {
      case 'balance_desc':
        result.sort((a, b) => b.balance - a.balance);
        break;
      case 'balance_asc':
        result.sort((a, b) => a.balance - b.balance);
        break;
      case 'name':
        result.sort((a, b) => (a.lab_name || '').localeCompare(b.lab_name || '', 'he'));
        break;
      case 'earned':
        result.sort((a, b) => b.total_earned - a.total_earned);
        break;
      case 'paid':
        result.sort((a, b) => b.total_paid - a.total_paid);
        break;
    }

    return result;
  }, [labBalances, searchQuery, balanceStatus, sortOption]);

  const clearFilters = () => {
    setSearchQuery('');
    setBalanceStatus('all');
    setSortOption('balance_desc');
  };

  const hasActiveFilters = searchQuery || balanceStatus !== 'all' || sortOption !== 'balance_desc';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalOwed = labBalances.reduce((sum, lab) => sum + Math.max(0, lab.balance), 0);
  const totalEarned = labBalances.reduce((sum, lab) => sum + lab.total_earned, 0);
  const totalPaid = labBalances.reduce((sum, lab) => sum + lab.total_paid, 0);

  return (
    <div className="space-y-6 p-6">
      <BackgroundRefreshIndicator isFetching={isFetching} isLoading={isLoading} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">ניהול תשלומים</h1>
          <p className="text-muted-foreground">סקירה כללית של יתרות למעבדות</p>
        </div>
        <Button onClick={() => refetch()} variant="outline">
          רענן
          <RefreshCw className="ms-2 h-4 w-4" />
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2" dir="rtl">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <CardTitle className="text-sm font-medium">סה"כ עלות תיקונים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right text-green-600">{formatCurrency(totalEarned)}</div>
            <p className="text-xs text-muted-foreground">מכל המעבדות</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2" dir="rtl">
            <ShekelIcon className="h-4 w-4 text-blue-600" />
            <CardTitle className="text-sm font-medium">סה"כ שילמת</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right text-blue-600">{formatCurrency(totalPaid)}</div>
            <p className="text-xs text-muted-foreground">לכל המעבדות</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2" dir="rtl">
            <Wallet className="h-4 w-4 text-orange-600" />
            <CardTitle className="text-sm font-medium">יתרת חוב</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right text-orange-600">{formatCurrency(totalOwed)}</div>
            <p className="text-xs text-muted-foreground">חוב כולל למעבדות</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2" dir="rtl">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">מעבדות פעילות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right">{labBalances.length}</div>
            <p className="text-xs text-muted-foreground">
              {labBalances.filter(l => l.balance > 0).length} עם יתרת חוב
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>סינון</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* חיפוש */}
            <div>
              <Label>חיפוש</Label>
              <div className="relative mt-1">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="שם מעבדה או אימייל..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ps-10"
                />
              </div>
            </div>

            {/* סטטוס יתרה */}
            <div>
              <Label>סטטוס יתרה</Label>
              <select
                title="סטטוס יתרה"
                className="w-full px-3 py-2 border rounded-md text-sm mt-1"
                value={balanceStatus}
                onChange={(e) => setBalanceStatus(e.target.value as BalanceStatus)}
              >
                <option value="all">הכל</option>
                <option value="owed">עם חוב</option>
                <option value="settled">מעודכן (0)</option>
                <option value="overpaid">בפלוס</option>
              </select>
            </div>

            {/* מיון */}
            <div>
              <Label>מיון לפי</Label>
              <select
                title="מיון"
                className="w-full px-3 py-2 border rounded-md text-sm mt-1"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
              >
                <option value="balance_desc">יתרה (גבוה לנמוך)</option>
                <option value="balance_asc">יתרה (נמוך לגבוה)</option>
                <option value="name">שם מעבדה</option>
                <option value="earned">עלות תיקונים</option>
                <option value="paid">סכום ששולם</option>
              </select>
            </div>

            {/* כפתור איפוס */}
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="w-full"
              >
                <X className="h-4 w-4 me-2" />
                נקה סינון
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Labs Table */}
      <Card>
        <CardHeader>
          <CardTitle>יתרות מעבדות</CardTitle>
          <CardDescription>
            {filteredLabBalances.length} מתוך {labBalances.length} מעבדות • לחץ על שורה לניהול תשלומים
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>מעבדה</TableHead>
                <TableHead>אימייל</TableHead>
                <TableHead>תיקונים</TableHead>
                <TableHead>תשלומים</TableHead>
                <TableHead>סה"כ עלות תיקונים</TableHead>
                <TableHead>סה"כ שולם</TableHead>
                <TableHead>יתרה</TableHead>
                <TableHead>פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLabBalances.map((lab) => (
                <TableRow
                  key={lab.lab_id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/admin/labs/${lab.lab_id}/payments`)}
                >
                  <TableCell className="font-medium">{lab.lab_name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{lab.lab_email}</TableCell>
                  <TableCell className="text-right">
                    <span className="text-muted-foreground">{lab.repairs_count}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-muted-foreground">{lab.payments_count}</span>
                  </TableCell>
                  <TableCell className="text-right text-green-600 font-medium">
                    {formatCurrency(lab.total_earned)}
                  </TableCell>
                  <TableCell className="text-right text-blue-600 font-medium">
                    {formatCurrency(lab.total_paid)}
                  </TableCell>
                  <TableCell className="text-right">
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
                      <Eye className="h-4 w-4 me-1" />
                      צפה
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredLabBalances.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    {hasActiveFilters ? 'לא נמצאו מעבדות התואמות לסינון' : 'אין מעבדות רשומות במערכת'}
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