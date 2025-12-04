'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import * as Papa from 'papaparse';
import { createClient } from '@/lib/supabase/client';
import { useDevices } from '@/hooks/queries/useDevices';
import { useAdminDashboardStats } from '@/hooks/queries/useAdminDashboard';
import type { Device, DeviceModel, Warranty, Repair } from '@/types';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import {
  Package,
  Search,
  Plus,
  Upload,
  Edit,
  Trash,
  Shield,
  CheckCircle,
  XCircle,
  AlertCircle,
  Smartphone,
  FileSpreadsheet,
  Download,
  Wrench,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { formatDate, validateIMEI } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DevicesPageSkeleton } from '@/components/ui/loading-skeletons';
import { BackgroundRefreshIndicator } from '@/components/ui/background-refresh-indicator';

type WarrantyStatus = 'new' | 'active' | 'expired' | 'replaced';

// פונקציה לחישוב סטטוס אחריות
const calculateWarrantyStatus = (device: DeviceRow): WarrantyStatus => {
  if (device.is_replaced) return 'replaced';

  // אם המידע כבר קיים מה-view, נשתמש בו
  if (device.warranty_status) return device.warranty_status;

  const activeWarranty = device.warranties?.find(w => w.is_active);
  if (activeWarranty) {
    const expiryDate = new Date(activeWarranty.expiry_date);
    const now = new Date();
    return expiryDate > now ? 'active' : 'expired';
  }

  return 'new';
};

const deviceSchema = z.object({
  imei: z.string().refine(validateIMEI, 'מספר IMEI לא תקין'),
  imei2: z.string().optional(),
  model: z.string().min(2, 'דגם חייב להכיל לפחות 2 תווים'),
  import_batch: z.string().optional(),
  warranty_months: z.number().min(1).max(36),
});

type DeviceFormData = z.infer<typeof deviceSchema>;

type DeviceRow = Device & {
  // תיקון: עדכון הטיפוס כדי לתמוך במבנה שמגיע מה-Hook
  device_model?: { model_name: string } | null; 
  device_models?: DeviceModel | null;
  warranties?: (Warranty & {
    store?: Pick<{ id: string; email: string; full_name: string | null }, 'full_name' | 'email'> | null;
  })[] | null;
  repairs?: Repair[] | null;
  model_name?: string;
  warranty_months?: number;
  warranty_status?: WarrantyStatus;
  _computed?: any;
};

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: string[];
}

export default function DevicesPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | WarrantyStatus>('all');
  const [filterModel, setFilterModel] = useState<string>('all');
  const [selectedDevice, setSelectedDevice] = useState<DeviceRow | null>(null);
  const [uniqueModels, setUniqueModels] = useState<string[]>(['all']);
  const [importProgress, setImportProgress] = useState(0);
  
  // Dialogs
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [preview, setPreview] = useState<Record<string, any>[]>([]);
  
  // Duplicate Handling
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    imei: string;
    existingDevice: DeviceRow | null;
    pendingData: DeviceFormData | null;
    isImport: boolean;
    importData?: Record<string, any>[];
  } | null>(null);

  const supabase = createClient();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setValue,
  } = useForm<DeviceFormData>({
    resolver: zodResolver(deviceSchema),
    defaultValues: {
      warranty_months: 12,
    },
  });

  const { 
    data: devicesData, 
    isLoading: isDevicesLoading, 
    isFetching,
    refetch 
  } = useDevices({
    page,
    pageSize,
    search: debouncedSearch,
    model: filterModel,
    warrantyStatus: filterStatus
  });

  const devices = devicesData?.data || [];
  const totalCount = devicesData?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      if (searchInput !== debouncedSearch) setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterModel]);

  const { stats, isFetching: isStatsFetching } = useAdminDashboardStats();

  const fetchModels = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('device_models')
        .select('model_name')
        .eq('is_active', true)
        .order('model_name');

      const models = ['all', ...(data?.map((m: any) => m.model_name) || [])];
      setUniqueModels(models);
    } catch (error) {
      console.error('Error fetching models:', error);
    }
  }, [supabase]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const getStatusBadge = (status: WarrantyStatus) => {
    const variants = {
      new: { label: 'חדש', variant: 'outline' as const },
      active: { label: 'פעיל', variant: 'default' as const },
      expired: { label: 'פג תוקף', variant: 'secondary' as const },
      replaced: { label: 'הוחלף', variant: 'destructive' as const },
    };
    return variants[status] || variants.new;
  };

  // --- תיקון: מיפוי נכון של שם הדגם ---
  const devicesWithStatus = useMemo(() => {
    return devices.map((device: any) => {
      const warrantyStatus = calculateWarrantyStatus(device);
      const statusBadge = getStatusBadge(warrantyStatus);
      const activeWarranty = device.warranty?.[0] || device.warranties?.find((w: any) => w.is_active);

      return {
        ...device,
        // חילוץ שם הדגם מתוך האובייקט המקונן device_model
        model_name: device.device_model?.model_name || device.model_name || 'לא ידוע',
        _computed: {
          warrantyStatus,
          statusBadge,
          activeWarranty,
        }
      };
    });
  }, [devices]);

  const handleRefresh = () => {
    refetch();
    toast({ title: 'הנתונים עודכנו' });
  };

  const checkDuplicateIMEI = async (imei: string, imei2?: string): Promise<DeviceRow | null> => {
    try {
      const { data, error } = await supabase
        .from('devices_with_status')
        .select('*')
        .or(`imei.eq.${imei}${imei2 ? `,imei2.eq.${imei2},imei.eq.${imei2},imei2.eq.${imei}` : ''}`)
        .limit(1)
        .returns<DeviceRow[]>();

      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Error checking duplicate:', error);
      return null;
    }
  };

  const addDeviceToDatabase = async (data: DeviceFormData, forceAdd: boolean = false) => {
    try {
      if (!forceAdd) {
        const existingDevice = await checkDuplicateIMEI(data.imei, data.imei2);
        if (existingDevice) {
          setDuplicateInfo({
            imei: data.imei,
            existingDevice,
            pendingData: data,
            isImport: false,
          });
          setIsDuplicateDialogOpen(true);
          return;
        }
      }

      let modelId: string;
      const { data: existingModel } = await (supabase as any)
        .from('device_models')
        .select('id')
        .eq('model_name', data.model.trim())
        .single();

      if (existingModel) {
        modelId = existingModel.id;
      } else {
        const { data: newModel, error: createError } = await (supabase as any)
          .from('device_models')
          .insert({
            model_name: data.model.trim(),
            warranty_months: data.warranty_months,
            is_active: true
          })
          .select('id')
          .single();

        if (createError) throw createError;
        modelId = newModel.id;
      }

      const payload = {
        imei: data.imei,
        imei2: data.imei2 || null,
        model_id: modelId,
        import_batch: data.import_batch || null,
        warranty_months: data.warranty_months,
      } as Partial<Device>;

      const { data: newDevice, error } = await (supabase.from('devices') as any)
        .insert([payload])
        .select('id')
        .single();

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (user && newDevice) {
        supabase.from('audit_log').insert({
          actor_user_id: user.id,
          action: 'device.create',
          entity_type: 'device',
          entity_id: newDevice.id,
          meta: { 
            imei: data.imei,
            model: data.model,
            source: 'manual'
          }
        });
      }

      toast({ title: 'הצלחה', description: 'המכשיר נוסף בהצלחה' });
      reset();
      setIsAddDialogOpen(false);
      setIsDuplicateDialogOpen(false);
      setDuplicateInfo(null);
      refetch();
    } catch (error: any) {
      console.error('Error adding device:', error);
      toast({ title: 'שגיאה', description: error.message || 'אירעה שגיאה בהוספת המכשיר', variant: 'destructive' });
    }
  };

  const onSubmit = async (data: DeviceFormData) => {
    await addDeviceToDatabase(data, false);
  };

  const handleEdit = async (data: DeviceFormData) => {
    if (!selectedDevice) return;

    try {
      let modelId: string;
      const { data: existingModel } = await (supabase as any)
        .from('device_models')
        .select('id')
        .eq('model_name', data.model.trim())
        .single();

      if (existingModel) {
        modelId = existingModel.id;
      } else {
        const { data: newModel, error: createError } = await (supabase as any)
          .from('device_models')
          .insert({
            model_name: data.model.trim(),
            warranty_months: data.warranty_months,
            is_active: true
          })
          .select('id')
          .single();

        if (createError) throw createError;
        modelId = newModel.id;
      }

      const updates = {
        imei: data.imei,
        imei2: data.imei2 || null,
        model_id: modelId,
        import_batch: data.import_batch || null,
        warranty_months: data.warranty_months,
      } as Partial<Device>;

      const { error } = await (supabase.from('devices') as any)
        .update(updates)
        .eq('id', selectedDevice.id);

      if (error) throw error;

      if (data.warranty_months !== selectedDevice.warranty_months) {
        const { data: activeWarranty } = await supabase
          .from('warranties')
          .select('id, activation_date')
          .eq('device_id', selectedDevice.id)
          .eq('is_active', true)
          .maybeSingle();

        if (activeWarranty) {
          const activationDate = new Date(activeWarranty.activation_date);
          const newExpiryDate = new Date(activationDate);
          newExpiryDate.setMonth(newExpiryDate.getMonth() + data.warranty_months);

          await supabase
            .from('warranties')
            .update({ expiry_date: newExpiryDate.toISOString().split('T')[0] })
            .eq('id', activeWarranty.id);

          toast({
            title: 'שים לב',
            description: `תאריך תפוגת האחריות עודכן ל-${newExpiryDate.toLocaleDateString('he-IL')}`,
          });
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        supabase.from('audit_log').insert({
          actor_user_id: user.id,
          action: 'device.update',
          entity_type: 'device',
          entity_id: selectedDevice.id,
          meta: { updates: updates }
        });
      }

      toast({ title: 'הצלחה', description: 'המכשיר עודכן בהצלחה' });
      reset();
      setIsEditDialogOpen(false);
      setSelectedDevice(null);
      refetch();
    } catch (error: any) {
      console.error('Error updating:', error);
      toast({ title: 'שגיאה', description: error.message || 'שגיאה בעדכון', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק מכשיר זה?')) return;

    try {
      const deviceToDelete = devices.find((d: any) => d.id === id);
      const { error } = await supabase.from('devices').delete().eq('id', id);
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        supabase.from('audit_log').insert({
          actor_user_id: user.id,
          action: 'device.delete',
          entity_type: 'device',
          entity_id: id,
          meta: { deleted_device: deviceToDelete || { id: id } }
        });
      }

      toast({ title: 'הצלחה', description: 'המכשיר נמחק בהצלחה' });
      refetch();
    } catch (error) {
      console.error('Delete error:', error);
      toast({ title: 'שגיאה', description: 'שגיאה במחיקת המכשיר', variant: 'destructive' });
    }
  };

  const exportToCSV = async () => {
    try {
      toast({ title: 'מכין קובץ לייצוא...', description: 'אנא המתן' });
      
      let query = supabase.from('devices_with_status').select('*');

      if (debouncedSearch) {
        query = query.or(`imei.ilike.%${debouncedSearch}%,imei2.ilike.%${debouncedSearch}%,import_batch.ilike.%${debouncedSearch}%`);
      }

      if (filterStatus !== 'all') {
        query = query.eq('warranty_status', filterStatus);
      }

      if (filterModel !== 'all') {
        const { data: modelData } = await supabase
          .from('device_models')
          .select('id')
          .eq('model_name', filterModel)
          .single();
        
        if (modelData) {
          query = query.eq('model_id', modelData.id);
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const csvContent = [
        ['דגם', 'IMEI1', 'IMEI2', 'סטטוס', 'אצווה'],
        ...(data || []).map((device: any) => [
          device.model_name || '',
          device.imei,
          device.imei2 || '',
          device.warranty_status || 'new',
          device.import_batch || ''
        ]),
      ]
        .map(row => row.join(','))
        .join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `devices_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } catch (error) {
      console.error('Export error:', error);
      toast({ title: 'שגיאה', description: 'אירעה שגיאה בייצוא הקובץ', variant: 'destructive' });
    }
  };

  const downloadTemplate = () => {
    const template = 'דגם,IMEI1,IMEI2\nATLAS,123456789012345,987654321098765\nATLAS 10,123456789012346,';
    const blob = new Blob(['\ufeff' + template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'devices_template.csv';
    link.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportResult(null);
    setPreview([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data as any[];
        setPreview(data.slice(0, 5));
        if (data.length > 0) {
          await importDevices(data);
        }
      },
      error: (error) => {
        toast({ title: 'שגיאה', description: 'אירעה שגיאה בקריאת הקובץ', variant: 'destructive' });
      }
    });
  };

  const importDevices = async (data: Record<string, any>[], forceAdd: boolean = false) => {
    setIsImporting(true);
    setImportProgress(0);

    const result: ImportResult = {
      total: data.length,
      success: 0,
      failed: 0,
      errors: []
    };

    const devicesToInsert: Partial<Device>[] = [];
    const modelCache = new Map<string, string>();
    
    // --- אופטימיזציה: בדיקת כפילויות מרוכזת (Batch Check) ---
    // אוספים את כל ה-IMEIs מהקובץ
    const imeisToCheck = new Set<string>();
    data.forEach(row => {
        const imei1 = row['IMEI1'] || row['imei1'] || row['IMEI'] || row['imei'];
        const imei2 = row['IMEI2'] || row['imei2'];
        if (imei1) imeisToCheck.add(imei1);
        if (imei2) imeisToCheck.add(imei2);
    });

    const existingDevicesMap = new Map<string, DeviceRow>();
    let firstDuplicate: { imei: string; device: DeviceRow; row: number } | null = null;

    if (!forceAdd && imeisToCheck.size > 0) {
        // בודקים מול השרת בצ'אנקים של 50 למניעת שגיאת URL ארוך מדי
        const imeiArray = Array.from(imeisToCheck);
        const chunkSize = 50;
        
        for (let i = 0; i < imeiArray.length; i += chunkSize) {
            const chunk = imeiArray.slice(i, i + chunkSize);
            // שאילתה אחת בודקת 50 מספרים במקביל
            const { data: found } = await supabase
                .from('devices_with_status')
                .select('*')
                .or(`imei.in.(${chunk.join(',')}),imei2.in.(${chunk.join(',')})`)
                .returns<DeviceRow[]>();
            
            if (found) {
                found.forEach((d) => {
                    existingDevicesMap.set(d.imei, d);
                    if (d.imei2) existingDevicesMap.set(d.imei2, d);
                });
            }
        }
    }
    // --- סוף אופטימיזציה ---

    for (let i = 0; i < data.length; i++) {
      setImportProgress(Math.round(((i + 1) / data.length) * 100));

      const row = data[i];
      const modelName = row['דגם'] || row['model'] || row['Model'] || '';
      const imei1 = row['IMEI1'] || row['imei1'] || row['IMEI'] || row['imei'] || '';
      const imei2 = row['IMEI2'] || row['imei2'] || '';

      if (!modelName || !modelName.trim()) {
        result.failed++;
        result.errors.push(`שורה ${i + 2}: דגם חסר`);
        continue;
      }

      if (!imei1 && !imei2) {
        result.failed++;
        result.errors.push(`שורה ${i + 2}: חייב לפחות IMEI אחד`);
        continue;
      }

      if (imei1 && !validateIMEI(imei1)) {
        result.failed++;
        result.errors.push(`שורה ${i + 2}: IMEI1 לא תקין`);
        continue;
      }

      // בדיקת כפילות מול המטמון המקומי במקום קריאת שרת
      if (!forceAdd) {
        const existingDevice = existingDevicesMap.get(imei1) || (imei2 ? existingDevicesMap.get(imei2) : null);
        
        if (existingDevice) {
          if (!firstDuplicate) {
            firstDuplicate = {
              imei: imei1 || imei2,
              device: existingDevice,
              row: i + 2
            };
          }
          result.failed++;
          result.errors.push(`שורה ${i + 2}: IMEI ${imei1 || imei2} כבר קיים`);
          continue;
        }
      }

      let modelId = modelCache.get(modelName.trim());
      if (!modelId) {
        try {
          const { data: existingModel } = await (supabase as any)
            .from('device_models')
            .select('id')
            .eq('model_name', modelName.trim())
            .single();

          if (existingModel) {
            modelId = existingModel.id;
          } else {
            const { data: newModel, error: createError } = await (supabase as any)
              .from('device_models')
              .insert({
                model_name: modelName.trim(),
                warranty_months: 12,
                is_active: true
              })
              .select('id')
              .single();

            if (createError) throw createError;
            modelId = newModel!.id;
          }
          modelCache.set(modelName.trim(), modelId!);
        } catch (error: any) {
          result.failed++;
          result.errors.push(`שורה ${i + 2}: שגיאה ביצירת דגם`);
          continue;
        }
      }

      devicesToInsert.push({
        model_id: modelId,
        imei: imei1 || imei2,
        imei2: imei1 && imei2 ? imei2 : null,
        import_batch: `IMPORT-${new Date().toISOString().split('T')[0]}`,
        warranty_months: 12
      } as Partial<Device>);

      result.success++;
    }

    if (firstDuplicate && !forceAdd) {
      setDuplicateInfo({
        imei: firstDuplicate.imei,
        existingDevice: firstDuplicate.device,
        pendingData: null,
        isImport: true,
        importData: data,
      });
      setIsDuplicateDialogOpen(true);
      setImportResult(result);
      setIsImporting(false);
      setImportProgress(0);
      return;
    }

    if (devicesToInsert.length > 0) {
      try {
        const { data: newDevices, error } = await (supabase.from('devices') as any)
          .insert(devicesToInsert)
          .select('id, imei');

        if (error) throw error;

        // Audit Log
        const { data: { user } } = await supabase.auth.getUser();
        if (user && newDevices) {
          const auditLogs = newDevices.map((device: any) => ({
            actor_user_id: user.id,
            action: 'device.import',
            entity_type: 'device',
            entity_id: device.id,
            meta: { imei: device.imei, source: 'csv' }
          }));
          supabase.from('audit_log').insert(auditLogs);
        }

        toast({
          title: 'הצלחה',
          description: `${result.success} מכשירים יובאו בהצלחה`,
        });

        refetch();
      } catch (error: any) {
        console.error('Import error:', error);
        result.failed = result.total;
        result.success = 0;
        result.errors = [error.message || 'שגיאה בייבוא'];
        toast({ title: 'שגיאה', description: 'שגיאה בייבוא', variant: 'destructive' });
      }
    }

    setImportResult(result);
    setIsImporting(false);
    setImportProgress(0);
    setIsDuplicateDialogOpen(false);
    setDuplicateInfo(null);
  };

  const handleImportDialogOpenChange = (open: boolean) => {
    setIsImportDialogOpen(open);
    if (!open) {
      setPreview([]);
      setImportResult(null);
    }
  };

  if (isDevicesLoading) {
    return <DevicesPageSkeleton />;
  }

  return (
    <div className="space-y-6" dir="rtl">
      <BackgroundRefreshIndicator isFetching={isFetching || isStatsFetching} isLoading={isDevicesLoading} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">ניהול מכשירים</h1>
          <p className="text-muted-foreground">ניהול מלאי המכשירים והאחריות</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} variant="outline">
            רענן <RefreshCw className="ms-2 h-4 w-4" />
          </Button>
          <Button onClick={exportToCSV} variant="outline">
            ייצוא CSV <Download className="ms-2 h-4 w-4" />
          </Button>
          <Button onClick={() => setIsImportDialogOpen(true)} variant="outline">
            ייבוא CSV <Upload className="ms-2 h-4 w-4" />
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            הוסף מכשיר <Plus className="ms-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        {/* ... (כרטיסי סטטיסטיקה ללא שינוי) */}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>חיפוש וסינון</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="חיפוש לפי IMEI, דגם או אצווה..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={() => { setDebouncedSearch(searchInput); setPage(1); }} variant="secondary">חפש</Button>
              {searchInput && (
                <Button onClick={() => { setSearchInput(''); setDebouncedSearch(''); setPage(1); }} variant="outline">נקה</Button>
              )}
            </div>
            <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as any)}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="סטטוס" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                <SelectItem value="new">חדש</SelectItem>
                <SelectItem value="active">פעיל</SelectItem>
                <SelectItem value="expired">פג תוקף</SelectItem>
                <SelectItem value="replaced">הוחלף</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterModel} onValueChange={setFilterModel}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="דגם" /></SelectTrigger>
              <SelectContent>
                {uniqueModels.map((model) => (
                  <SelectItem key={model} value={model}>{model === 'all' ? 'כל הדגמים' : model}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="relative">
            {isFetching && (
              <div className="absolute inset-0 bg-white/50 dark:bg-black/50 z-10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>דגם</TableHead>
                  <TableHead>IMEI 1</TableHead>
                  <TableHead>IMEI 2</TableHead>
                  <TableHead>חודשי אחריות</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>לקוח</TableHead>
                  <TableHead>תוקף אחריות</TableHead>
                  <TableHead>תיקונים</TableHead>
                  <TableHead>אצווה</TableHead>
                  <TableHead>תאריך</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devicesWithStatus.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">לא נמצאו מכשירים</TableCell>
                  </TableRow>
                ) : (
                  devicesWithStatus.map((device: any) => {
                    const { warrantyStatus, statusBadge, activeWarranty } = device._computed;
                    return (
                      <TableRow key={device.id}>
                        <TableCell className="font-medium">{device.model_name || '-'}</TableCell>
                        <TableCell>{device.imei}</TableCell>
                        <TableCell>{device.imei2 || '-'}</TableCell>
                        <TableCell>{device.warranty_months || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2 items-center">
                            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                            {device.is_replaced && warrantyStatus !== 'replaced' && (
                              <Badge variant="destructive" className="text-xs">הוחלף</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {activeWarranty ? (
                            <div className="text-sm">
                              <div className="font-medium">{activeWarranty.customer_name}</div>
                              <div className="text-muted-foreground">{activeWarranty.customer_phone}</div>
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {activeWarranty ? (
                            <div className="text-sm">
                              <div>עד: {formatDate(activeWarranty.expiry_date)}</div>
                              {activeWarranty.store && (
                                <div className="text-muted-foreground">{activeWarranty.store.full_name}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">{device.warranty_months || '-'} חודשים</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {device.repairs && device.repairs.length > 0 ? (
                              <>
                                <Wrench className="h-3 w-3 text-muted-foreground" />
                                <Badge variant="outline" className="font-mono">{device.repairs.length}</Badge>
                              </>
                            ) : (<span className="text-muted-foreground">-</span>)}
                          </div>
                        </TableCell>
                        <TableCell>{device.import_batch || '-'}</TableCell>
                        <TableCell>{formatDate(device.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => { setSelectedDevice(device); setIsDetailsDialogOpen(true); }}>
                              <Smartphone className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => {
                                setSelectedDevice(device);
                                setValue('imei', device.imei);
                                setValue('imei2', device.imei2 || '');
                                setValue('model', device.model_name || '');
                                setValue('import_batch', device.import_batch || '');
                                setValue('warranty_months', device.warranty_months || 12);
                                setIsEditDialogOpen(true);
                              }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(device.id)}>
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Device Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>הוסף מכשיר חדש</DialogTitle>
            <DialogDescription>הזן את פרטי המכשיר החדש</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="model">דגם</Label>
              <Input id="model" {...register('model')} placeholder="ATLAS S9" />
              {errors.model && (
                <p className="text-sm text-red-500 mt-1">{errors.model.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="imei">IMEI 1</Label>
              <Input id="imei" {...register('imei')} placeholder="15 ספרות" />
              {errors.imei && (
                <p className="text-sm text-red-500 mt-1">{errors.imei.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="imei2">IMEI 2 (אופציונלי)</Label>
              <Input id="imei2" {...register('imei2')} placeholder="15 ספרות" />
              {errors.imei2 && (
                <p className="text-sm text-red-500 mt-1">{errors.imei2.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="import_batch">מספר אצווה (אופציונלי)</Label>
              <Input id="import_batch" {...register('import_batch')} placeholder="BATCH-2024-001" />
            </div>
            <div>
              <Label htmlFor="warranty_months">חודשי אחריות</Label>
              <Input
                id="warranty_months"
                type="number"
                {...register('warranty_months', { valueAsNumber: true })}
                placeholder="12"
              />
              {errors.warranty_months && (
                <p className="text-sm text-red-500 mt-1">{errors.warranty_months.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                ביטול
              </Button>
              <Button type="submit">הוסף מכשיר</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Device Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ערוך מכשיר</DialogTitle>
            <DialogDescription>עדכן את פרטי המכשיר</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleEdit)} className="space-y-4">
            <div>
              <Label htmlFor="edit-model">דגם</Label>
              <Input id="edit-model" {...register('model')} />
              {errors.model && (
                <p className="text-sm text-red-500 mt-1">{errors.model.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="edit-imei">IMEI 1</Label>
              <Input id="edit-imei" {...register('imei')} />
              {errors.imei && (
                <p className="text-sm text-red-500 mt-1">{errors.imei.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="edit-imei2">IMEI 2</Label>
              <Input id="edit-imei2" {...register('imei2')} />
              {errors.imei2 && (
                <p className="text-sm text-red-500 mt-1">{errors.imei2.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="edit-import_batch">מספר אצווה</Label>
              <Input id="edit-import_batch" {...register('import_batch')} />
            </div>
            <div>
              <Label htmlFor="edit-warranty_months">חודשי אחריות</Label>
              <Input
                id="edit-warranty_months"
                type="number"
                {...register('warranty_months', { valueAsNumber: true })}
              />
              {errors.warranty_months && (
                <p className="text-sm text-red-500 mt-1">{errors.warranty_months.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                ביטול
              </Button>
              <Button type="submit">שמור שינויים</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      {selectedDevice && (
        <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>פרטי מכשיר</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>דגם</Label>
                  <p className="font-medium">{selectedDevice.model_name || '-'}</p>
                </div>
                <div>
                  <Label>IMEI 1</Label>
                  <p className="font-medium">{selectedDevice.imei}</p>
                </div>
                <div>
                  <Label>IMEI 2</Label>
                  <p className="font-medium">{selectedDevice.imei2 || '-'}</p>
                </div>
                <div>
                  <Label>סטטוס</Label>
                  <p>
                  {(() => {
                    // תיקון: שימוש ב-getStatusBadge במקום חיפוש בתוך ה-device ישירות ב-Dialog
                    // במקרה שה-computed לא קיים ב-selectedDevice שאינו חלק מהטבלה הראשית
                    const status = calculateWarrantyStatus(selectedDevice);
                    const badge = getStatusBadge(status);
                    return <Badge variant={badge.variant}>{badge.label}</Badge>;
                  })()}
                  </p>
                </div>
                <div>
                  <Label>מספר אצווה</Label>
                  <p className="font-medium">{selectedDevice.import_batch || '-'}</p>
                </div>
                <div>
                  <Label>חודשי אחריות</Label>
                  <p className="font-medium">{selectedDevice.warranty_months || '-'} חודשים</p>
                </div>
                <div>
                  <Label>תאריך הוספה</Label>
                  <p className="font-medium">{formatDate(selectedDevice.created_at)}</p>
                </div>
              </div>

              {(() => {
                const firstWarranty = selectedDevice.warranties?.[0];
                if (!firstWarranty) return null;
                return (
                  <div>
                    <h4 className="font-semibold mb-2">פרטי אחריות</h4>
                    <div className="grid grid-cols-2 gap-4 bg-muted p-4 rounded-lg">
                      <div>
                        <Label>שם לקוח</Label>
                        <p>{firstWarranty.customer_name}</p>
                      </div>
                      <div>
                        <Label>טלפון</Label>
                        <p>{firstWarranty.customer_phone}</p>
                      </div>
                      <div>
                        <Label>תאריך הפעלה</Label>
                        <p>{formatDate(firstWarranty.activation_date)}</p>
                      </div>
                      <div>
                        <Label>תאריך סיום</Label>
                        <p>{formatDate(firstWarranty.expiry_date)}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {selectedDevice.repairs && selectedDevice.repairs.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">היסטוריית תיקונים</h4>
                  <div className="space-y-2">
                    {selectedDevice.repairs.map((repair) => (
                      <div key={repair.id} className="bg-muted p-3 rounded-lg">
                        <div className="flex justify-between">
                          <span>{repair.fault_type}</span>
                          <Badge>{repair.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(repair.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setIsDetailsDialogOpen(false)}>סגור</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Duplicate IMEI Confirmation Dialog */}
      <Dialog open={isDuplicateDialogOpen} onOpenChange={setIsDuplicateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertCircle className="h-5 w-5" />
              {duplicateInfo?.isImport ? 'נמצאו מכשירים כפולים בקובץ' : 'מכשיר עם IMEI זהה כבר קיים'}
            </DialogTitle>
            <DialogDescription>
              {duplicateInfo?.isImport 
                ? 'נמצאו מכשירים עם IMEI קיים במערכת. ניתן להמשיך ולייבא רק את המכשירים שאינם כפולים.'
                : 'נמצא מכשיר קיים עם אותו מספר IMEI במערכת'}
            </DialogDescription>
          </DialogHeader>

          {duplicateInfo?.existingDevice && (
            <div className="space-y-4">
              <Alert className="border-orange-500">
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">דוגמה למכשיר קיים:</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">דגם:</span>
                        <p className="font-medium">{duplicateInfo.existingDevice.model_name || '-'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">IMEI:</span>
                        <p className="font-medium">{duplicateInfo.imei}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">סטטוס:</span>
                        {(() => {
                          const duplicateStatus = getStatusBadge(calculateWarrantyStatus(duplicateInfo.existingDevice));
                          return <Badge variant={duplicateStatus.variant}>{duplicateStatus.label}</Badge>;
                        })()}
                      </div>
                      <div>
                        <span className="text-muted-foreground">תאריך הוספה:</span>
                        <p className="font-medium">{formatDate(duplicateInfo.existingDevice.created_at)}</p>
                      </div>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              {duplicateInfo.isImport && importResult && importResult.errors.length > 0 && (
                <Alert>
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-semibold">רשימת כפילויות שנמצאו:</p>
                      <div className="max-h-40 overflow-y-auto text-sm space-y-1">
                        {importResult.errors
                          .filter(err => err.includes('כבר קיים'))
                          .slice(0, 10)
                          .map((error, idx) => (
                            <div key={idx} className="text-orange-600">• {error}</div>
                          ))}
                        {importResult.errors.filter(err => err.includes('כבר קיים')).length > 10 && (
                          <div className="text-muted-foreground">
                            ...ועוד {importResult.errors.filter(err => err.includes('כבר קיים')).length - 10} כפילויות
                          </div>
                        )}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <p className="text-sm text-muted-foreground">
                {duplicateInfo.isImport 
                  ? 'האם ברצונך להמשיך ולייבא את כל המכשירים כולל הכפולים?'
                  : 'האם אתה בטוח שברצונך להוסיף מכשיר נוסף עם אותו IMEI?'}
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsDuplicateDialogOpen(false);
                setDuplicateInfo(null);
              }}
            >
              ביטול
            </Button>
            <Button
              variant="default"
              onClick={() => {
                if (duplicateInfo?.isImport && duplicateInfo.importData) {
                  importDevices(duplicateInfo.importData, true);
                } else if (duplicateInfo?.pendingData) {
                  addDeviceToDatabase(duplicateInfo.pendingData, true);
                }
              }}
            >
              המשך בכל זאת
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

{/* Import CSV Dialog */}
<Dialog open={isImportDialogOpen} onOpenChange={handleImportDialogOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>ייבוא מכשירים מקובץ CSV</DialogTitle>
            <DialogDescription>העלה קובץ CSV עם פורמט: דגם, IMEI1, IMEI2</DialogDescription>
          </DialogHeader>

          {/* אזור תצוגה: או טעינה או העלאה */}
          {isImporting ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-6 border-2 border-dashed border-transparent">
              {/* אנימציית טעינה */}
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              
              <div className="w-full max-w-md space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>מעבד נתונים...</span>
                  <span>{importProgress}%</span>
                </div>
                {/* רכיב ה-Progress */}
                <Progress value={importProgress} className="h-2 w-full" />
              </div>
              
              <p className="text-sm text-muted-foreground text-center">
                אנא המתן, המערכת בודקת כפילויות ומייצרת דגמים במידת הצורך.<br/>
                פעולה זו עשויה לקחת מספר רגעים.
              </p>
            </div>
          ) : (
            /* Upload Zone הרגיל */
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <div className="space-y-2">
                <input
                  title="בחר קובץ CSV"
                  placeholder="בחר קובץ CSV"
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  disabled={isImporting}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  disabled={isImporting}
                  onClick={() => document.getElementById('csv-upload')?.click()}
                >
                  <Upload className="ms-2 h-4 w-4" />
                  בחר קובץ CSV
                </Button>
                <p className="text-sm text-muted-foreground">או גרור קובץ לכאן</p>
              </div>
            </div>
          )}

          {/* Instructions - מוסתר בזמן טעינה כדי לא להעמיס */}
          {!isImporting && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p>הקובץ צריך להכיל את העמודות הבאות:</p>
                  <ul className="list-disc list-inside text-sm">
                    <li><strong>דגם</strong> - דגם המכשיר (חובה)</li>
                    <li><strong>IMEI1</strong> - מספר IMEI ראשון (אופציונלי)</li>
                    <li><strong>IMEI2</strong> - מספר IMEI שני (אופציונלי)</li>
                  </ul>
                  <p className="text-sm text-muted-foreground">לפחות IMEI אחד חייב להיות מלא</p>
                  <Button onClick={downloadTemplate} variant="link" className="p-0 h-auto">
                    הורד קובץ דוגמה
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Preview - מוצג רק כשיש נתונים ואין טעינה פעילה */}
          {!isImporting && preview.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">תצוגה מקדימה (5 שורות ראשונות):</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {Object.keys(preview[0]).map(key => (
                        <th key={key} className="text-right px-2 py-1">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, idx) => (
                      <tr key={idx} className="border-b">
                        {Object.values(row).map((val: any, i) => (
                          <td key={i} className="px-2 py-1">{String(val ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import Result - סיכום בסוף התהליך */}
          {!isImporting && importResult && (
            <Alert className={importResult.failed > 0 ? 'border-red-500' : 'border-green-500'}>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {importResult.failed === 0 ?
                    <CheckCircle className="h-4 w-4 text-green-600" /> :
                    <XCircle className="h-4 w-4 text-red-600" />
                  }
                  <span className="font-medium">סיכום ייבוא</span>
                </div>
                <div className="text-sm space-y-1">
                  <p>סה"כ שורות: {importResult.total}</p>
                  <p>הצליחו: {importResult.success}</p>
                  {importResult.failed > 0 && <p>נכשלו: {importResult.failed}</p>}
                  {importResult.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium">שגיאות:</p>
                      <ul className="list-disc list-inside">
                        {importResult.errors.slice(0, 5).map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                        {importResult.errors.length > 5 && (
                          <li>...ועוד {importResult.errors.length - 5} שגיאות</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => handleImportDialogOpenChange(false)} disabled={isImporting}>
              סגור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}