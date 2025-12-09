'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Device, DeviceModel, Warranty, ReplacementRequest } from '@/types';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useStoreDashboardStats } from '@/hooks/queries/useStoreDashboard';
import { BackgroundRefreshIndicator } from '@/components/ui/background-refresh-indicator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Shield,
  Package,
  Search,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Calendar,
  User,
  Store,
  Hash,
  Clock,
  RefreshCw,
  FileText,
  Phone,
  ShieldOff,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useForm } from 'react-hook-form';
import { formatDate } from '@/lib/utils';

interface WarrantyFormData {
  customer_name: string;
  customer_phone: string;
}

type DeviceWithWarranty = Device & {
  device_models?: DeviceModel | null;
  warranties?: {
    id: string;
    store_id: string;
    customer_name: string;
    customer_phone: string;
    activation_date: string;
    expiry_date: string;
    is_active: boolean;
  }[] | null;
  is_own_warranty?: boolean;
  pending_replacements?: number;
  approved_replacements?: number;
};

type ReplacementRequestWithDevice = ReplacementRequest & {
  device?: DeviceWithWarranty | null;
};

export default function StoreDashboard() {
  const { user: currentUser, isLoading: isUserLoading } = useCurrentUser();
  const storeId = currentUser?.id || null;
  const storeName = currentUser?.full_name || currentUser?.email || '';
  const { stats, isLoading: isStatsLoading, isFetching: isStatsFetching } = useStoreDashboardStats(storeId);

  const [searchImei, setSearchImei] = useState('');
  const [searchResult, setSearchResult] = useState<DeviceWithWarranty | null>(null);
  const [isActivationDialogOpen, setIsActivationDialogOpen] = useState(false);
  const [isReplacementDialogOpen, setIsReplacementDialogOpen] = useState(false);
  const [activeDevices, setActiveDevices] = useState<DeviceWithWarranty[]>([]);
  const [replacementRequests, setReplacementRequests] = useState<ReplacementRequestWithDevice[]>([]);
  const [activeTab, setActiveTab] = useState('search');
  const activationDateDisplay = formatDate(new Date());
  const [activeDevicesPage, setActiveDevicesPage] = useState(1);
  const [totalActiveDevices, setTotalActiveDevices] = useState(0);
  const [searchResultReplacements, setSearchResultReplacements] = useState<{
    id: string;
    status: string;
    reason: string;
    created_at: string;
    admin_notes?: string | null;
  }[]>([]);
  const listRefreshDebounce = useRef<NodeJS.Timeout | null>(null);
  const DEVICES_PER_PAGE = 5;
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<WarrantyFormData>();

  // בדיקה האם יש אחריות שהחנות הנוכחית הפעילה
  const hasOwnWarranty = Boolean(
    searchResult?.warranties && 
    searchResult.warranties.length > 0 && 
    searchResult.is_own_warranty
  );
  
  // בדיקה האם יש אחריות פעילה (בכלל - גם של חנות אחרת)
  const hasAnyWarranty = Boolean(searchResult?.warranties && searchResult.warranties.length > 0);
  
  // בדיקה האם האחריות שייכת לחנות אחרת
  const isOtherStoreWarranty = hasAnyWarranty && !searchResult?.is_own_warranty;
  
  const currentWarranty = hasOwnWarranty ? searchResult!.warranties![0]! : null;

  const fetchActiveDevices = useCallback(async () => {
    if (!storeId) return;
  
    try {
      const from = (activeDevicesPage - 1) * DEVICES_PER_PAGE;
      const to = from + DEVICES_PER_PAGE - 1;
  
      const { data, error, count } = await supabase
        .from('warranties')
        .select(`
          id,
          store_id,
          customer_name,
          customer_phone,
          activation_date,
          expiry_date,
          is_active,
          devices!inner (
            *,
            device_models (*)
          )
        `, { count: 'exact' })
        .eq('store_id', storeId)
        .eq('is_active', true)
        .gte('expiry_date', new Date().toISOString().split('T')[0])
        .order('created_at', { ascending: false })
        .range(from, to);
  
      if (error) {
        console.error('Error fetching active devices:', error);
        return;
      }
  
      if (!data || data.length === 0) {
        setActiveDevices([]);
        setTotalActiveDevices(count || 0);
        return;
      }
  
      // חילוץ device_ids
      const deviceIds = data.map((warranty: any) => warranty.devices.id);
  
      // שליפת בקשות החלפה לכל המכשירים
      const { data: replacementData } = await supabase
        .from('replacement_requests')
        .select('device_id, status')
        .in('device_id', deviceIds);
  
      // יצירת מפה של ספירות בקשות לכל מכשיר
      const replacementCounts = new Map<string, { pending: number; approved: number }>();
      deviceIds.forEach(id => replacementCounts.set(id, { pending: 0, approved: 0 }));
      
      (replacementData || []).forEach((req: any) => {
        const counts = replacementCounts.get(req.device_id);
        if (counts) {
          if (req.status === 'pending') counts.pending++;
          else if (req.status === 'approved') counts.approved++;
        }
      });
  
      // מיזוג הנתונים
      const flattenedDevices = data.map((warranty: any) => {
        const deviceId = warranty.devices.id;
        const counts = replacementCounts.get(deviceId) || { pending: 0, approved: 0 };
        
        return {
          ...warranty.devices,
          device_models: warranty.devices.device_models,
          warranties: [warranty],
          is_own_warranty: true,
          pending_replacements: counts.pending,
          approved_replacements: counts.approved,
        };
      });
  
      setActiveDevices(flattenedDevices);
      setTotalActiveDevices(count || 0);
  
    } catch (error) {
      console.error('Error fetching active devices:', error);
    }
  }, [storeId, supabase, activeDevicesPage]);

  const fetchReplacementRequests = useCallback(async () => {
    if (!storeId) return;

    try {
      const { data } = await supabase
        .from('replacement_requests')
        .select(`
          *,
          device:devices(*, device_models(*), warranties(*))
        `)
        .eq('requester_id', storeId)
        .order('created_at', { ascending: false });

      setReplacementRequests(data || []);
    } catch (error) {
      console.error('Error fetching replacement requests:', error);
    }
  }, [storeId, supabase]);

  useEffect(() => {
    if (!storeId) return;

    fetchActiveDevices();
    fetchReplacementRequests();

    const triggerListRefresh = () => {
      if (listRefreshDebounce.current) clearTimeout(listRefreshDebounce.current);
      listRefreshDebounce.current = setTimeout(() => {
        fetchActiveDevices();
        fetchReplacementRequests();
      }, 1000);
    };

    const channel = supabase
      .channel(`store-dashboard-lists-${storeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'warranties', filter: `store_id=eq.${storeId}` },
        triggerListRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'replacement_requests', filter: `requester_id=eq.${storeId}` },
        triggerListRefresh
      )
      .subscribe();

    return () => {
      if (listRefreshDebounce.current) clearTimeout(listRefreshDebounce.current);
      supabase.removeChannel(channel);
    };
  }, [storeId, fetchActiveDevices, fetchReplacementRequests, supabase]);

  const handleSearch = async () => {
    const trimmedIMEI = searchImei.trim().replace(/[\s-]/g, '');
    if (!trimmedIMEI) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין מספר IMEI',
        variant: 'destructive',
      });
      return;
    }

    try {
      console.log('Searching for IMEI:', trimmedIMEI);

      const { data: searchResultData, error: searchError } = await supabase
        .rpc('search_device_by_imei', {
          p_imei: trimmedIMEI,
          p_user_ip: null
        });

      console.log('Search result:', { searchResultData, error: searchError });

      if (searchError) {
        console.error('Search error:', searchError);
        toast({
          title: 'שגיאה',
          description: `אירעה שגיאה בחיפוש המכשיר: ${searchError.message}`,
          variant: 'destructive',
        });
        return;
      }

      if (!searchResultData || searchResultData.length === 0) {
        toast({
          title: 'שגיאה',
          description: 'לא התקבלה תשובה מהשרת',
          variant: 'destructive',
        });
        return;
      }

      const result = searchResultData[0];

      // בדיקה אם הגענו למגבלת חיפושים
      if (!result.device_found && result.message?.includes('מכסת')) {
        toast({
          title: 'הגעת למגבלת החיפושים',
          description: result.message || 'הגעת למגבלה של 50 חיפושים ליום',
          variant: 'destructive',
        });
        return;
      }

      // בדיקה אם המכשיר נמצא
      if (!result.device_found || !result.device_id) {
        toast({
          title: 'לא נמצא',
          description: result.message || `המכשיר עם IMEI ${trimmedIMEI} לא נמצא במערכת`,
          variant: 'destructive',
        });
        setSearchResult(null);
        setSearchResultReplacements([]);
        return;
      }

      // ========================================
      // טיפול חדש: אחריות בחנות אחרת
      // ========================================
      if (result.has_active_warranty && !result.is_own_warranty) {
        // מכשיר נמצא אבל האחריות שייכת לחנות אחרת
        toast({
          title: 'אחריות בחנות אחרת',
          description: result.message || 'למכשיר זה קיימת אחריות פעילה בחנות אחרת',
          variant: 'destructive',
        });
        
        // הצג את המכשיר עם מידע מוגבל (ללא פרטי לקוח)
        const device: DeviceWithWarranty = {
          id: result.device_id,
          imei: result.imei!,
          imei2: result.imei2 || null,
          model_id: result.model_id!,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          notes: null,
          is_replaced: result.is_replaced || false,
          replaced_at: result.replaced_at || null,
          imported_by: null,
          import_batch: null,
          device_models: {
            id: result.model_id!,
            model_name: result.model_name || 'לא ידוע',
            manufacturer: result.manufacturer || null,
            warranty_months: result.warranty_months || 12,
            description: null,
            is_active: true,
            created_by: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          // אחריות קיימת אבל לא שלנו - לא מציגים פרטים
          warranties: [{
            id: '', // לא מקבלים את ה-ID
            store_id: '', // לא מקבלים
            customer_name: '', // מוסתר!
            customer_phone: '', // מוסתר!
            activation_date: '',
            expiry_date: '',
            is_active: true
          }],
          is_own_warranty: false // סימון שזה לא שלנו
        };
        
        setSearchResult(device);
        return;
      }

      // שליפת בקשות החלפה למכשיר (רק אם האחריות שלנו)
      if (result.is_own_warranty && result.device_id) {
        const { data: replacements } = await supabase
          .from('replacement_requests')
          .select('id, status, reason, created_at, admin_notes')
          .eq('device_id', result.device_id)
          .order('created_at', { ascending: false });
        
        setSearchResultReplacements(replacements || []);
      } else {
        setSearchResultReplacements([]);
      }

      // המשך רגיל - מכשיר שלנו או ללא אחריות
      const device: DeviceWithWarranty = {
        id: result.device_id,
        imei: result.imei!,
        imei2: result.imei2 || null,
        model_id: result.model_id!,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: null,
        is_replaced: result.is_replaced || false,
        replaced_at: result.replaced_at || null,
        imported_by: null,
        import_batch: null,
        device_models: {
          id: result.model_id!,
          model_name: result.model_name || 'לא ידוע',
          manufacturer: result.manufacturer || null,
          warranty_months: result.warranty_months || 12,
          description: null,
          is_active: true,
          created_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        warranties: result.warranty_id ? [{
          id: result.warranty_id,
          store_id: storeId || '',
          customer_name: result.customer_name || '',
          customer_phone: result.customer_phone || '',
          activation_date: new Date().toISOString().split('T')[0],
          expiry_date: result.warranty_expiry_date || new Date().toISOString().split('T')[0],
          is_active: result.has_active_warranty || false
        }] : [],
        is_own_warranty: result.is_own_warranty ?? true
      };

      console.log('Found device:', device);
      setSearchResult(device);

      // הודעות לפי מצב
      if (result.is_replaced) {
        toast({
          title: 'מכשיר הוחלף',
          description: `מכשיר זה הוחלף${result.replaced_at ? ' בתאריך ' + formatDate(result.replaced_at) : ''} ולא ניתן להפעיל עליו אחריות`,
          variant: 'destructive',
        });
      } else if (result.has_active_warranty && result.is_own_warranty) {
        const activationInfo = result.warranty_expiry_date
          ? ` (תוקף עד ${formatDate(result.warranty_expiry_date)})`
          : '';
        toast({
          title: 'אחריות קיימת',
          description: `למכשיר זה כבר קיימת אחריות פעילה${activationInfo}`,
        });
      } else if (!result.has_active_warranty) {
        toast({
          title: 'מכשיר נמצא',
          description: 'המכשיר נמצא במערכת וניתן להפעיל עליו אחריות',
        });
      }
    } catch (error) {
      console.error('Error searching device:', error);
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בחיפוש המכשיר',
        variant: 'destructive',
      });
    }
  };

  const onSubmitWarranty = async (data: WarrantyFormData) => {
    if (!searchResult) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('משתמש לא מחובר');

      const device = searchResult;

      const { data: activationResult, error: activationError } = (await supabase
        .rpc('activate_warranty', {
          p_device_id: device.id,
          p_customer_name: data.customer_name,
          p_customer_phone: data.customer_phone,
          p_notes: null,
        } as any)) as {
          data: { success: boolean; message: string; warranty_id: string | null; expiry_date: string | null }[] | null;
          error: any
        };

      if (activationError) throw activationError;

      if (!activationResult?.[0]?.success) {
        throw new Error(activationResult?.[0]?.message || 'שגיאה בהפעלת אחריות');
      }

      toast({
        title: 'הצלחה',
        description: `האחריות הופעלה בהצלחה עבור ${data.customer_name}`,
      });

      setIsActivationDialogOpen(false);
      reset();
      setSearchImei('');
      setSearchResult(null);
      setSearchResultReplacements([]);

      fetchActiveDevices();
      fetchReplacementRequests();

    } catch (error: any) {
      console.error('Error activating warranty:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה בהפעלת האחריות',
        variant: 'destructive',
      });
    }
  };

  const handleRequestReplacement = async (deviceId: string, warrantyId: string | null, reason: string) => {
    try {
      const { data, error } = await supabase.rpc('create_replacement_request', {
        p_device_id: deviceId,
        p_reason: reason
      });

      if (error) throw new Error(error.message);

      const result = data?.[0];
      if (!result?.success) {
        throw new Error(result?.message || 'An unknown error occurred.');
      }

      toast({
        title: 'הצלחה',
        description: 'בקשת ההחלפה נשלחה בהצלחה',
      });

      setIsReplacementDialogOpen(false);
      setSearchResult(null);
      setSearchResultReplacements([]);
      setSearchImei('');

      fetchActiveDevices();
      fetchReplacementRequests();

    } catch (error: any) {
      console.error('Error requesting replacement:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה בהגשת בקשת ההחלפה',
        variant: 'destructive',
      });
    }
  };

  const getWarrantyStatus = (warranty: Warranty) => {
    const now = new Date();
    const expiryDate = new Date(warranty.expiry_date);

    if (!warranty.is_active) {
      return { text: 'לא פעילה', variant: 'secondary' as const };
    }

    if (expiryDate < now) {
      return { text: 'פגה תוקף', variant: 'destructive' as const };
    }

    const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft <= 30) {
      return { text: `${daysLeft} ימים נותרו`, variant: 'outline' as const };
    }

    return { text: 'פעילה', variant: 'default' as const };
  };

  const getReplacementStatus = (status: string) => {
    switch (status) {
      case 'pending':
        return { text: 'ממתין', variant: 'outline' as const, icon: Clock };
      case 'approved':
        return { text: 'אושר', variant: 'default' as const, icon: CheckCircle };
      case 'rejected':
        return { text: 'נדחה', variant: 'destructive' as const, icon: AlertCircle };
      case 'completed':
        return { text: 'הושלם', variant: 'secondary' as const, icon: CheckCircle };
      default:
        return { text: status, variant: 'outline' as const, icon: Clock };
    }
  };

  return (
    <div className="space-y-6">
      <BackgroundRefreshIndicator
        isFetching={isStatsFetching}
        isLoading={isUserLoading || !storeId || isStatsLoading}
      />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">ניהול מכשירים ואחריות</h2>
          <p className="text-muted-foreground">
            תצוגה מרכזית של כל המכשירים, אחריות ובקשות החלפה
          </p>
        </div>
        <Button onClick={() => {
          setSearchResult(null);
          setSearchResultReplacements([]);
          setSearchImei('');
          reset();
          setIsActivationDialogOpen(true);
        }}>
          <Shield className="me-2 h-4 w-4" />
          הפעל אחריות חדשה
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-green-500 cursor-pointer" onClick={() => setActiveTab('active-warranties')}>
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-sm font-medium">אחריות פעילות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 text-right">{stats.activeWarranties}</div>
            <p className="text-xs text-muted-foreground mt-1 text-right">מכשירים מוגנים</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-orange-500 cursor-pointer" onClick={() => setActiveTab('replacements')}>
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
              <RefreshCw className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <CardTitle className="text-sm font-medium">בקשות החלפה</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600 text-right">{stats.pendingReplacements}</div>
            <p className="text-xs text-muted-foreground mt-1 text-right">ממתינות לטיפול</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-blue-500 cursor-pointer" onClick={() => router.push('/store/reports')}>
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-sm font-medium">הפעלות החודש</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600 text-right">{stats.monthlyActivations}</div>
            <p className="text-xs text-muted-foreground mt-1 text-right">אחריות חדשות</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-purple-500 cursor-pointer" onClick={() => router.push('/store/devices')}>
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
              <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <CardTitle className="text-sm font-medium">סה"כ מכשירים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600 text-right">{stats.totalDevices}</div>
            <p className="text-xs text-muted-foreground mt-1 text-right">במערכת</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3" dir="rtl">
          <TabsTrigger value="search" className="flex items-center justify-center gap-2">
            <Search className="h-4 w-4" />
            חיפוש מכשיר
          </TabsTrigger>
          <TabsTrigger value="replacements" className="flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4" />
            בקשות החלפה
          </TabsTrigger>
          <TabsTrigger value="active-warranties" className="flex items-center justify-center gap-2">
            <Shield className="h-4 w-4" />
            מכשירים עם אחריות
          </TabsTrigger>
        </TabsList>

        {/* Active Warranties Tab */}
        <TabsContent value="active-warranties" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>מכשירים עם אחריות פעילה</CardTitle>
              <CardDescription>
                כל המכשירים שהופעלה עליהם אחריות בחנות שלך
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeDevices.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>אין מכשירים עם אחריות פעילה</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>דגם</TableHead>
                        <TableHead>IMEI</TableHead>
                        <TableHead>לקוח</TableHead>
                        <TableHead>טלפון</TableHead>
                        <TableHead>תאריך הפעלה</TableHead>
                        <TableHead>תוקף</TableHead>
                        <TableHead>בקשות החלפה</TableHead>
                        <TableHead>סטטוס</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeDevices.map((device) => {
                        const warranties = device.warranties as any;
                        const warranty = warranties?.[0];
                        if (!warranty) return null;
                        const status = getWarrantyStatus(warranty);

                        return (
                          <TableRow key={device.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-muted-foreground" />
                                {device.device_models?.model_name || 'לא ידוע'}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{device.imei}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                {warranty.customer_name}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                {warranty.customer_phone}
                              </div>
                            </TableCell>
                            <TableCell>{formatDate(warranty.activation_date)}</TableCell>
                            <TableCell>{formatDate(warranty.expiry_date)}</TableCell>
                            <TableCell>
                              {(device.pending_replacements ?? 0) > 0 && <Badge variant="outline">ממתין: {device.pending_replacements}</Badge>}
                              {(device.approved_replacements ?? 0) > 0 && <Badge>אושר: {device.approved_replacements}</Badge>}
                            </TableCell>
                            <TableCell>
                              <Badge variant={status.variant}>
                                {status.text}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      מציג {((activeDevicesPage - 1) * DEVICES_PER_PAGE) + 1}-
                      {Math.min(activeDevicesPage * DEVICES_PER_PAGE, totalActiveDevices)} מתוך {totalActiveDevices}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveDevicesPage(p => Math.max(1, p - 1))}
                        disabled={activeDevicesPage === 1}
                      >
                        הקודם
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveDevicesPage(p => p + 1)}
                        disabled={activeDevicesPage * DEVICES_PER_PAGE >= totalActiveDevices}
                      >
                        הבא
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Replacement Requests Tab */}
        <TabsContent value="replacements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>בקשות החלפה</CardTitle>
              <CardDescription>
                כל בקשות ההחלפה שהוגשו למכשירים שלך
              </CardDescription>
            </CardHeader>
            <CardContent>
              {replacementRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>אין בקשות החלפה</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>דגם</TableHead>
                      <TableHead>IMEI</TableHead>
                      <TableHead>סיבה</TableHead>
                      <TableHead>תאריך בקשה</TableHead>
                      <TableHead>סטטוס</TableHead>
                      <TableHead>הערות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {replacementRequests.map((request) => {
                      const status = getReplacementStatus(request.status);
                      const StatusIcon = status.icon;

                      return (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              {request.device?.device_models?.model_name || 'לא ידוע'}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{request.device?.imei}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              {request.reason}
                            </div>
                          </TableCell>
                          <TableCell>{formatDate(request.created_at)}</TableCell>
                          <TableCell>
                            <Badge variant={status.variant} className="flex items-center gap-1 w-fit">
                              <StatusIcon className="h-3 w-3" />
                              {status.text}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {request.admin_notes || '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Search Tab */}
        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>חיפוש מכשיר לפי IMEI</CardTitle>
              <CardDescription>
                חפש מכשיר כדי להפעיל אחריות או להגיש בקשת החלפה
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2" dir="rtl">
                <Input
                  placeholder="הזן מספר IMEI..."
                  value={searchImei}
                  onChange={(e) => setSearchImei(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1"
                  dir="rtl"
                />
                <Button onClick={handleSearch} size="lg">
                  <Search className="me-2 h-4 w-4" />
                  חפש
                </Button>
              </div>

              {/* Search Result */}
              {searchResult && (
                <Card className={`border-2 ${
                  searchResult.is_replaced ? 'border-destructive' : 
                  isOtherStoreWarranty ? 'border-orange-500' :
                  'border-primary'
                }`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">תוצאות חיפוש</CardTitle>
                      {searchResult.is_replaced ? (
                        <Badge variant="destructive" className="text-sm">
                          מכשיר הוחלף
                        </Badge>
                      ) : isOtherStoreWarranty ? (
                        <Badge variant="outline" className="text-sm border-orange-500 text-orange-600">
                          <ShieldOff className="h-3 w-3 me-1" />
                          אחריות בחנות אחרת
                        </Badge>
                      ) : hasOwnWarranty ? (
                        <Badge variant="default" className="text-sm">
                          אחריות פעילה
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-sm">
                          ללא אחריות
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* התראה - מכשיר הוחלף */}
                    {searchResult.is_replaced && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          מכשיר זה הוחלף ולא ניתן להפעיל עליו אחריות או להגיש בקשת החלפה.
                          {searchResult.replaced_at && (
                            <> תאריך החלפה: {formatDate(searchResult.replaced_at)}</>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {/* התראה חדשה - אחריות בחנות אחרת */}
                    {isOtherStoreWarranty && !searchResult.is_replaced && (
                      <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950">
                        <ShieldOff className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-orange-800 dark:text-orange-200">
                          <strong>למכשיר זה קיימת אחריות פעילה בחנות אחרת.</strong>
                          <br />
                          לא ניתן לצפות בפרטי הלקוח או להגיש בקשת החלפה.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* פרטי מכשיר בסיסיים - תמיד מוצגים */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">דגם</Label>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{searchResult.device_models?.model_name || 'לא ידוע'}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">IMEI</Label>
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-sm">{searchResult.imei}</span>
                        </div>
                      </div>
                      {searchResult.imei2 && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">IMEI 2</Label>
                          <div className="flex items-center gap-2">
                            <Hash className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono text-sm">{searchResult.imei2}</span>
                          </div>
                        </div>
                      )}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">תקופת אחריות</Label>
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          <span>{searchResult.device_models?.warranty_months || 12} חודשים</span>
                        </div>
                      </div>
                    </div>

                    {/* פרטי אחריות - רק אם זו אחריות שלנו */}
                    {currentWarranty && hasOwnWarranty && (
                      <div className="border-t pt-4 space-y-3">
                        <h4 className="font-semibold flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          פרטי אחריות
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <Label className="text-xs text-muted-foreground">לקוח</Label>
                            <p className="font-medium">{currentWarranty.customer_name}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">טלפון</Label>
                            <p className="font-medium">{currentWarranty.customer_phone}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">תאריך הפעלה</Label>
                            <p>{formatDate(currentWarranty.activation_date)}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">תוקף עד</Label>
                            <p>{formatDate(currentWarranty.expiry_date)}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {searchResultReplacements.length > 0 && (
                      <div className="border-t pt-4 space-y-3">
                        <h4 className="font-semibold flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 text-orange-500" />
                          בקשות החלפה ({searchResultReplacements.length})
                        </h4>
                        <div className="space-y-2">
                          {searchResultReplacements.map((req) => {
                            const status = getReplacementStatus(req.status);
                            const StatusIcon = status.icon;
                            return (
                              <div key={req.id} className="flex items-center justify-between p-3 bg-muted rounded-lg text-sm">
                                <div className="flex items-center gap-3">
                                  <Badge variant={status.variant} className="flex items-center gap-1">
                                    <StatusIcon className="h-3 w-3" />
                                    {status.text}
                                  </Badge>
                                  <span className="text-muted-foreground">{formatDate(req.created_at)}</span>
                                </div>
                                <span className="text-muted-foreground truncate max-w-[200px]" title={req.reason}>
                                  {req.reason}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        {searchResultReplacements.some(r => r.admin_notes) && (
                          <div className="text-sm">
                            {searchResultReplacements.filter(r => r.admin_notes).map((req) => (
                              <div key={req.id} className="text-muted-foreground">
                                <span className="font-medium">הערת מנהל:</span> {req.admin_notes}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* כפתורי פעולה - רק אם מותר */}
                    {!searchResult.is_replaced && !isOtherStoreWarranty && (
                      <div className="flex gap-2 pt-2">
                        {!hasOwnWarranty && !hasAnyWarranty && (
                          <Button onClick={() => setIsActivationDialogOpen(true)} className="flex-1">
                            <Shield className="me-2 h-4 w-4" />
                            הפעל אחריות
                          </Button>
                        )}

                        {/* כפתור הגש בקשת החלפה - רק אם אין בקשה ממתינה - ודווקא ממתינה */}
                        {hasOwnWarranty && searchResultReplacements.length === 0 && (
                          <Button onClick={() => setIsReplacementDialogOpen(true)} variant="outline" className="flex-1">
                            <RefreshCw className="me-2 h-4 w-4" />
                            הגש בקשת החלפה
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Activation Dialog */}
      <Dialog open={isActivationDialogOpen} onOpenChange={(isOpen) => {
        setIsActivationDialogOpen(isOpen);
        if (!isOpen) {
          setSearchResult(null);
          setSearchResultReplacements([]);
          setSearchImei('');
          reset();
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>הפעלת אחריות</DialogTitle>
            <DialogDescription>
              {searchResult ? 'הזן את פרטי הלקוח להפעלת האחריות' : 'הזן מספר IMEI לחיפוש והפעלת אחריות'}
            </DialogDescription>
          </DialogHeader>

          {!searchResult ? (
            <div className="space-y-4 pt-2">
              <div className="flex gap-2" dir="rtl">
                <Input
                  placeholder="הזן מספר IMEI..."
                  value={searchImei}
                  onChange={(e) => setSearchImei(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1"
                  dir="rtl"
                  id="imei-dialog-search"
                />
                <Button onClick={handleSearch}>
                  <Search className="me-2 h-4 w-4" />
                  חפש
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmitWarranty)} className="space-y-4">
              <div className="space-y-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">תאריך הפעלה:</Label>
                  <span className="text-sm">{activationDateDisplay}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">מפעיל האחריות:</Label>
                  <span className="text-sm font-medium">{storeName || 'החנות שלך'}</span>
                </div>

                {searchResult && (
                  <>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">דגם:</Label>
                      <span className="text-sm">{searchResult.device_models?.model_name || 'לא ידוע'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">IMEI:</Label>
                      <span className="text-sm font-mono">{searchResult.imei}</span>
                    </div>
                    {searchResult.imei2 && (
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-sm font-medium">IMEI 2:</Label>
                        <span className="text-sm font-mono">{searchResult.imei2}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">תקופת אחריות:</Label>
                      <span className="text-sm">{searchResult.device_models?.warranty_months || 12} חודשים</span>
                    </div>
                  </>
                )}
              </div>
              
              {searchResult.is_replaced && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    מכשיר זה הוחלף ולא ניתן להפעיל עליו אחריות.
                  </AlertDescription>
                </Alert>
              )}
              
              {isOtherStoreWarranty && (
                <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950">
                  <ShieldOff className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800 dark:text-orange-200">
                    למכשיר זה קיימת אחריות פעילה בחנות אחרת.
                  </AlertDescription>
                </Alert>
              )}
              
              {hasOwnWarranty && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    למכשיר זה כבר קיימת אחריות פעילה.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div>
                  <Label htmlFor="customer_name">שם הלקוח *</Label>
                  <Input
                    id="customer_name"
                    {...register('customer_name', { required: 'שם הלקוח הוא שדה חובה' })}
                    placeholder="ישראל ישראלי"
                    disabled={hasOwnWarranty || hasAnyWarranty || searchResult.is_replaced}
                  />
                  {errors.customer_name && (
                    <p className="text-sm text-red-500 mt-1">{errors.customer_name.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="customer_phone">טלפון הלקוח *</Label>
                  <Input
                    id="customer_phone"
                    {...register('customer_phone', {
                      required: 'טלפון הלקוח הוא שדה חובה',
                      pattern: {
                        value: /^[0-9]{9,10}$/,
                        message: 'מספר טלפון לא תקין'
                      }
                    })}
                    placeholder="050-1234567"
                    disabled={hasOwnWarranty || hasAnyWarranty || searchResult.is_replaced}
                  />
                  {errors.customer_phone && (
                    <p className="text-sm text-red-500 mt-1">{errors.customer_phone.message}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 justify-start pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsActivationDialogOpen(false)}
                >
                  ביטול
                </Button>
                <Button 
                  type="submit" 
                  disabled={hasOwnWarranty || hasAnyWarranty || searchResult.is_replaced}
                >
                  {hasOwnWarranty ? 'אחריות כבר קיימת' :
                   isOtherStoreWarranty ? 'אחריות בחנות אחרת' :
                   searchResult.is_replaced ? 'מכשיר הוחלף' :
                   'הפעל אחריות'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Replacement Request Dialog */}
      <Dialog open={isReplacementDialogOpen} onOpenChange={setIsReplacementDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>הגשת בקשת החלפה</DialogTitle>
            <DialogDescription>
              הזן את הסיבה להחלפת המכשיר
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const reason = (formData.get('reason') as string || '').trim();
            
            if (!reason) {
              toast({
                title: 'שגיאה',
                description: 'יש להזין סיבה להחלפה',
                variant: 'destructive',
              });
              return;
            }
            
            if (reason.length < 5) {
              toast({
                title: 'שגיאה',
                description: 'הסיבה חייבת להכיל לפחות 5 תווים',
                variant: 'destructive',
              });
              return;
            }
            
            if (searchResult && hasOwnWarranty) {
              const warrantyId = searchResult.warranties?.[0]?.id || null;
              handleRequestReplacement(searchResult.id, warrantyId, reason);
            }
          }} className="space-y-4">
            {searchResult && (
              <div className="space-y-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">דגם:</Label>
                  <span className="text-sm">{searchResult.device_models?.model_name || 'לא ידוע'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">IMEI:</Label>
                  <span className="text-sm font-mono">{searchResult.imei}</span>
                </div>
                {currentWarranty && (
                  <>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">לקוח:</Label>
                      <span className="text-sm">{currentWarranty.customer_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">טלפון:</Label>
                      <span className="text-sm">{currentWarranty.customer_phone}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="reason">סיבת ההחלפה * (לפחות 5 תווים)</Label>
              <Input
                id="reason"
                name="reason"
                required
                minLength={5}
                placeholder="לדוגמה: מסך שבור, בעיית סוללה..."
              />
            </div>

            <div className="flex gap-3 justify-start pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsReplacementDialogOpen(false)}
              >
                ביטול
              </Button>
              <Button type="submit" disabled={!hasOwnWarranty}>
                <RefreshCw className="me-2 h-4 w-4" />
                הגש בקשה
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}