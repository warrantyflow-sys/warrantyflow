'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useWarrantiesTable, useWarrantiesStats } from '@/hooks/queries/useWarranties';
import { useAllUsers } from '@/hooks/queries/useUsers';
import { BackgroundRefreshIndicator } from '@/components/ui/background-refresh-indicator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Search,
  Plus,
  Phone,
  User,
  Store,
  XCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { formatDate, validateIMEI, validateIsraeliPhone } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const warrantySchema = z.object({
  imei: z.string().refine(validateIMEI, 'מספר IMEI לא תקין'),
  customer_name: z.string().min(2, 'שם הלקוח חייב להכיל לפחות 2 תווים'),
  customer_phone: z.string().refine(validateIsraeliPhone, 'מספר טלפון לא תקין'),
  store_id: z.string().optional(),
});

type WarrantyFormData = z.infer<typeof warrantySchema>;

export default function WarrantiesPage() {
  // --- State ---
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired'>('all');

  // Dialogs
  const [isActivationDialogOpen, setIsActivationDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  
  // Users Data for Store selection
  const { users: allUsers } = useAllUsers();
  const stores = useMemo(() => allUsers.filter(u => u.role === 'store'), [allUsers]);

  // --- New Optimized Data Fetching ---
  const { data: statsData } = useWarrantiesStats();
  const { 
    data: warrantiesData, 
    isLoading, 
    isFetching 
  } = useWarrantiesTable(page, pageSize, { 
    status: filterStatus, 
    search: debouncedSearch 
  });

  const warranties = warrantiesData?.data || [];
  const totalCount = warrantiesData?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const supabase = createClient();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<WarrantyFormData>({
    resolver: zodResolver(warrantySchema),
  });

  // Debounce Search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      if (searchQuery !== debouncedSearch) setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [filterStatus]);

  const getUserDisplayName = useCallback((user?: { full_name?: string | null; email?: string | null } | null) => {
    if (!user) return '';
    return user.full_name?.trim() || user.email || '';
  }, []);

  const getStatusBadge = (warranty: any) => {
    const expiryDate = new Date(warranty.expiry_date);
    const now = new Date();

    if (!warranty.is_active) {
      return <Badge className="bg-gray-500">בוטל</Badge>;
    }
    if (expiryDate < now) {
      return <Badge className="bg-red-500">פג תוקף</Badge>;
    }
    return <Badge className="bg-green-500">פעיל</Badge>;
  };

  const handleSearchDeviceForActivation = async () => {
    const trimmedIMEI = searchQuery.trim().replace(/[\s-]/g, '');

    if (!trimmedIMEI || !validateIMEI(trimmedIMEI)) {
      toast({
        title: 'שגיאה',
        description: 'אנא הזן מספר IMEI תקין',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Use existing search logic
      const { data: searchResult, error: searchError } = await (supabase as any)
        .rpc('search_device_by_imei', {
          p_imei: trimmedIMEI,
          p_user_ip: null
        });

      if (searchError || !searchResult || searchResult.length === 0) {
        toast({
          title: 'לא נמצא',
          description: 'המכשיר לא נמצא במערכת',
          variant: 'destructive',
        });
        return;
      }

      const result = searchResult[0];
      if (!result.device_id) {
        toast({ title: 'לא נמצא', description: 'המכשיר לא נמצא', variant: 'destructive' });
        return;
      }

      // Prepare device record for the dialog
      const deviceRecord = {
        id: result.device_id,
        imei: result.imei,
        model: result.model_name || 'לא ידוע',
        warranty_months: result.warranty_months || 12,
        is_replaced: result.is_replaced || false,
        replaced_at: result.replaced_at || null,
        activation_date: result.activation_date || null,
        expiry_date: result.warranty_expiry_date || null,
        has_active_warranty: result.has_active_warranty
      };

      if (deviceRecord.is_replaced) {
        toast({ title: 'מכשיר הוחלף', description: 'לא ניתן להפעיל אחריות', variant: 'destructive' });
      } else if (deviceRecord.has_active_warranty) {
        toast({ title: 'אחריות קיימת', description: 'למכשיר זה כבר יש אחריות פעילה', variant: 'destructive' });
      }

      setSelectedDevice(deviceRecord);
      setValue('imei', deviceRecord.imei);
      setIsActivationDialogOpen(true);

    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בחיפוש המכשיר',
        variant: 'destructive',
      });
    }
  };

  const onActivateWarranty = async (data: WarrantyFormData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('משתמש לא מחובר');

      const activationDate = new Date();
      const expiryDate = new Date(activationDate);
      expiryDate.setMonth(expiryDate.getMonth() + (selectedDevice?.warranty_months || 12));

      const { error } = await (supabase.from('warranties') as any).insert([{
        device_id: selectedDevice.id,
        store_id: data.store_id || null,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        activation_date: activationDate.toISOString().split('T')[0],
        expiry_date: expiryDate.toISOString().split('T')[0],
        activated_by: user.id,
        is_active: true,
      }]);

      if (error) throw error;

      await (supabase.from('devices') as any)
        .update({ warranty_status: 'active' })
        .eq('id', selectedDevice.id);

      toast({ title: 'הצלחה', description: 'האחריות הופעלה בהצלחה' });
      setIsActivationDialogOpen(false);
      reset();
      setSelectedDevice(null);
      // Realtime update will handle refresh
    } catch (error: any) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    }
  };

  const handleCancelWarranty = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך לבטל אחריות זו?')) return;
    try {
      const { error } = await (supabase as any)
        .from('warranties')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'הצלחה', description: 'האחריות בוטלה' });
    } catch (error: any) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    }
  };

  if (isLoading && page === 1) {
    return <div className="flex items-center justify-center h-96">טוען...</div>;
  }

  return (
    <div className="space-y-6">
      <BackgroundRefreshIndicator isFetching={isFetching} isLoading={isLoading} />

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">ניהול אחריות</h1>
        <Button onClick={() => { setSearchQuery(''); setIsActivationDialogOpen(true); }}>
          הפעל אחריות חדשה
          <Plus className="ms-2 h-4 w-4" />
        </Button>

        {/* Activation Dialog (Keep existing logic, simplified here for brevity) */}
        <Dialog open={isActivationDialogOpen} onOpenChange={setIsActivationDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>הפעלת אחריות</DialogTitle>
              <DialogDescription>הזן מספר IMEI להפעלת האחריות</DialogDescription>
            </DialogHeader>
            {!selectedDevice ? (
              <div className="space-y-4">
                 <div className="flex gap-2">
                    <Input 
                      value={searchQuery} 
                      onChange={(e) => setSearchQuery(e.target.value)} 
                      placeholder="הזן IMEI לחיפוש" 
                    />
                    <Button onClick={handleSearchDeviceForActivation}><Search className="h-4 w-4" /></Button>
                 </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onActivateWarranty)} className="space-y-4">
                 <div className="p-3 bg-muted rounded text-sm">
                    <p><strong>דגם:</strong> {selectedDevice.model}</p>
                    <p><strong>IMEI:</strong> {selectedDevice.imei}</p>
                 </div>
                 <Input {...register('customer_name')} placeholder="שם לקוח" />
                 {errors.customer_name && <p className="text-red-500 text-xs">{errors.customer_name.message}</p>}
                 <Input {...register('customer_phone')} placeholder="טלפון" />
                 {errors.customer_phone && <p className="text-red-500 text-xs">{errors.customer_phone.message}</p>}
                 <Select onValueChange={(v) => setValue('store_id', v)}>
                    <SelectTrigger><SelectValue placeholder="בחר חנות (אופציונלי)" /></SelectTrigger>
                    <SelectContent>
                       {stores.map(s => <SelectItem key={s.id} value={s.id}>{getUserDisplayName(s)}</SelectItem>)}
                    </SelectContent>
                 </Select>
                 <DialogFooter>
                    <Button type="submit" disabled={isSubmitting}>הפעל אחריות</Button>
                 </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>רשימת אחריות ({statsData?.total || totalCount})</CardTitle>
            <div className="flex gap-2">
              <div className="flex gap-1">
                <Button size="sm" variant={filterStatus === 'all' ? 'default' : 'outline'} onClick={() => setFilterStatus('all')}>
                   הכל
                </Button>
                <Button size="sm" variant={filterStatus === 'active' ? 'default' : 'outline'} onClick={() => setFilterStatus('active')}>
                   פעיל ({statsData?.active || 0})
                </Button>
                <Button size="sm" variant={filterStatus === 'expired' ? 'default' : 'outline'} onClick={() => setFilterStatus('expired')}>
                   פג תוקף ({statsData?.expired || 0})
                </Button>
              </div>
              <div className="relative w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="חיפוש IMEI, לקוח..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Pagination Controls */}
           <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">
                 עמוד {page} מתוך {totalPages || 1} (סה"כ {totalCount})
              </span>
              <div className="flex gap-2">
                 <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronRight className="h-4 w-4" />
                 </Button>
                 <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                    <ChevronLeft className="h-4 w-4" />
                 </Button>
              </div>
           </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>IMEI</TableHead>
                <TableHead>דגם</TableHead>
                <TableHead>לקוח</TableHead>
                <TableHead>טלפון</TableHead>
                <TableHead>חנות</TableHead>
                <TableHead>הופעל</TableHead>
                <TableHead>תוקף עד</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warranties.map((warranty) => (
                <TableRow key={warranty.id}>
                  <TableCell className="font-mono text-sm">{warranty.device?.imei}</TableCell>
                  <TableCell>{warranty.device?.device_model?.model_name || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1"><User className="h-3 w-3" />{warranty.customer_name}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{warranty.customer_phone}</div>
                  </TableCell>
                  <TableCell>
                    {getUserDisplayName(warranty.store) ? (
                      <div className="flex items-center gap-1"><Store className="h-3 w-3" />{getUserDisplayName(warranty.store)}</div>
                    ) : '-'}
                  </TableCell>
                  <TableCell>{formatDate(warranty.activation_date)}</TableCell>
                  <TableCell>{formatDate(warranty.expiry_date)}</TableCell>
                  <TableCell>{getStatusBadge(warranty)}</TableCell>
                  <TableCell>
                    {warranty.is_active && (
                      <Button size="sm" variant="ghost" onClick={() => handleCancelWarranty(warranty.id)} title="בטל אחריות">
                        <XCircle className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {warranties.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">לא נמצאו תוצאות</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}