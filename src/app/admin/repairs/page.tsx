'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRepairsTable, useRepairsStats } from '@/hooks/queries/useRepairs';
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Wrench,
  Search,
  Building2,
  Clock,
  CheckCircle,
  Phone,
  User,
  FileText,
  Package,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import ShekelIcon from '@/components/ui/shekel-icon';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils';
import { fetchAllRepairTypes, RepairType } from '@/lib/api/repair_types'; // Import new API function and type
import { fetchAllDeviceModels, DeviceModel } from '@/lib/api/device_models'; // Import new API function and type

type RepairStatus = 'received' | 'completed' | 'replacement_requested';

export default function RepairsPage() {
  
  // Pagination & Search
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterLab, setFilterLab] = useState<string>('all');
  const [filterRepairType, setFilterRepairType] = useState<string>('all');
  const [filterDeviceModel, setFilterDeviceModel] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');

  // Auxiliary Data
  const [labs, setLabs] = useState<any[]>([]);
  const [allRepairTypes, setAllRepairTypes] = useState<RepairType[]>([]); // New state for repair types
  const [allDeviceModels, setAllDeviceModels] = useState<DeviceModel[]>([]); // New state for device models

  // Dialogs
  const [selectedRepair, setSelectedRepair] = useState<any>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedLabId, setSelectedLabId] = useState('');

  const supabase = createClient();
  const { toast } = useToast();

  // --- Data Fetching (Optimized) ---

  // 1. שליפת הסטטיסטיקות (RPC מהיר)
  const { data: statsData, isLoading: isStatsLoading } = useRepairsStats();

  // 2. שליפת הטבלה (Server-Side Pagination)
  const { 
    data: repairsData, 
    isLoading: isRepairsLoading, 
    isFetching 
  } = useRepairsTable(page, pageSize, {
    status: filterStatus,
    labId: filterLab,
    search: debouncedSearch,
    repairTypeId: filterRepairType, // Pass new filter
    modelId: filterDeviceModel,     // Pass new filter
  });

  const repairs = repairsData?.data || [];
  const totalCount = repairsData?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const isLoading = isRepairsLoading;

  // --- Effects ---

  // Debounce לחיפוש כדי למנוע עומס קריאות
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      if (searchQuery !== debouncedSearch) setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, debouncedSearch]);

  // איפוס עמוד בעת שינוי פילטרים
  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterLab, filterRepairType, filterDeviceModel, filterDateFrom, filterDateTo]);

  // טעינת רשימת מעבדות, סוגי תיקונים ודגמי מכשירים (לפילטרים והקצאה)
  useEffect(() => {
    const fetchAuxiliaryData = async () => {
      // Fetch Labs
      const { data: labsData } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'lab');
      setLabs(labsData || []);

      // Fetch Repair Types
      try {
        const repairTypesData = await fetchAllRepairTypes();
        setAllRepairTypes(repairTypesData);
      } catch (error) {
        console.error("Failed to fetch repair types:", error);
        toast({
          title: 'שגיאה',
          description: 'כשל בטעינת סוגי תיקונים',
          variant: 'destructive',
        });
      }

      // Fetch Device Models
      try {
        const deviceModelsData = await fetchAllDeviceModels();
        setAllDeviceModels(deviceModelsData);
      } catch (error) {
        console.error("Failed to fetch device models:", error);
        toast({
          title: 'שגיאה',
          description: 'כשל בטעינת דגמי מכשירים',
          variant: 'destructive',
        });
      }
    };
    fetchAuxiliaryData();
  }, [supabase, toast]);

  // --- Handlers ---

  const handleRefresh = () => {
    // Invalidation מטופל בתוך ה-Hook ע"י React Query
    // אפשר להוסיף כאן refetch ידני אם רוצים
    toast({ title: 'הנתונים מתעדכנים...' });
  };

  const handleAssignLab = async () => {
    if (!selectedRepair || !selectedLabId) return;
  
    try {
      const { error } = await (supabase as any)
        .from('repairs')
        .update({
          lab_id: selectedLabId,
          status: 'received'
        } as any)
        .eq('id', selectedRepair.id);
  
      if (error) throw error;
  
      toast({
        title: 'הצלחה',
        description: 'התיקון הוקצה למעבדה בהצלחה',
      });
  
      setIsAssignDialogOpen(false);
      setSelectedRepair(null);
      setSelectedLabId('');
      // הנתונים יתעדכנו אוטומטית בזכות ה-Realtime ב-Hook
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן להקצות את התיקון',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateStatus = async (repairId: string, newStatus: RepairStatus) => {
    try {
      const updateData: any = { status: newStatus };
  
      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }
  
      const { error } = await (supabase as any)
        .from('repairs')
        .update(updateData as any)
        .eq('id', repairId);
  
      if (error) throw error;
  
      toast({
        title: 'הצלחה',
        description: 'הסטטוס עודכן בהצלחה',
      });
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן לעדכן את הסטטוס',
        variant: 'destructive',
      });
    }
  };

  // --- Helper Functions (Badges & Labels) ---

  const getStatusBadge = (status: RepairStatus) => {
    const variants = {
      received: { icon: Clock, label: 'התקבל', className: 'bg-blue-100 text-blue-700' },
      completed: { icon: CheckCircle, label: 'הושלם', className: 'bg-green-100 text-green-700' },
      replacement_requested: { icon: Package, label: 'בקשת החלפה', className: 'bg-red-100 text-red-700' },
    };

    const variant = variants[status] || variants.received;
    const Icon = variant.icon;

    return (
      <Badge className={variant.className}>
        <Icon className="ms-1 h-3 w-3" />
        {variant.label}
      </Badge>
    );
  };

  const getRepairTypeDisplay = (repair: any) => {
    const labels: Record<string, string> = {
      screen: 'מסך',
      charging_port: 'שקע טעינה',
      flash: 'פנס',
      speaker: 'רמקול',
      board: 'לוח אם',
      other: 'אחר',
    };

    if (repair.repair_type?.name) return repair.repair_type.name;
    if (repair.custom_repair_description) return repair.custom_repair_description;
    if (repair.fault_type) return labels[repair.fault_type] || repair.fault_type;
    return 'לא ידוע';
  };

  const getUrgencyBadge = (createdAt: string, status: RepairStatus) => {
    if (status === 'completed' || status === 'replacement_requested') return null;
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));

    if (days > 3) return <Badge variant="destructive">דחוף - {days} ימים</Badge>;
    if (days > 1) return <Badge variant="outline" className="border-yellow-500">{days} ימים</Badge>;
    return null;
  };

  if (isLoading && page === 1) { // מציג שלד רק בטעינה ראשונית של עמוד ראשון
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <BackgroundRefreshIndicator
        isFetching={isFetching || isStatsLoading} // אינדיקציה גם לטבלת תיקונים וגם לסטטיסטיקות
        isLoading={isLoading}
      />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ניהול תיקונים</h1>
          <p className="text-muted-foreground">
            ניהול ומעקב אחר כל התיקונים במערכת ({totalCount} רשומות)
          </p>
        </div>
      </div>

      {/* Stats Cards - שימוש במידע מה-Hook החדש */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title='סה"כ תיקונים' value={statsData?.total || 0} icon={Wrench} color="blue" /> 
        <StatCard title='ממתינים' value={statsData?.received || 0} icon={Clock} color="orange" /> 
        <StatCard title='הושלמו' value={statsData?.completed || 0} icon={CheckCircle} color="green" />  
        <StatCard 
          title='עלות כוללת' 
          value={formatCurrency(statsData?.total_cost || 0)} 
          icon={ShekelIcon} 
          color="purple" 
        />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>סינון תיקונים</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            <div>
              <Label>חיפוש</Label>
              <div className="relative mt-1">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="IMEI, לקוח..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ps-10"
                />
              </div>
            </div>

            <div>
              <Label>מעבדה</Label>
              <select
                title="מעבדה"
                className="w-full px-3 py-2 border rounded-md text-sm mt-1"
                value={filterLab}
                onChange={(e) => setFilterLab(e.target.value)}
              >
                <option value="all">כל המעבדות</option>
                {labs.map((lab) => (
                  <option key={lab.id} value={lab.id}>
                    {lab.full_name || lab.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>סטטוס</Label>
              <select
                title="סטטוס"
                className="w-full px-3 py-2 border rounded-md text-sm mt-1"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">כל הסטטוסים</option>
                <option value="received">התקבל</option>
                <option value="completed">הושלם</option>
                <option value="replacement_requested">בקשת החלפה</option>
              </select>
            </div>

            {/* סוג תיקון */}
            <div>
              <Label>סוג תיקון</Label>
              <select
                title="סוג תיקון"
                className="w-full px-3 py-2 border rounded-md text-sm mt-1"
                value={filterRepairType}
                onChange={(e) => setFilterRepairType(e.target.value)}
              >
                <option value="all">כל הסוגים</option>
                {allRepairTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
                <option value="custom">אחר (מותאם)</option>
              </select>
            </div>

            {/* דגם מכשיר */}
            <div>
              <Label>דגם</Label>
              <select
                title="דגם"
                className="w-full px-3 py-2 border rounded-md text-sm mt-1"
                value={filterDeviceModel}
                onChange={(e) => setFilterDeviceModel(e.target.value)}
              >
                <option value="all">כל הדגמים</option>
                {allDeviceModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.model_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-end h-full pb-1">
                 <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterStatus('all');
                    setFilterLab('all');
                    setFilterRepairType('all'); // Reset new filter
                    setFilterDeviceModel('all'); // Reset new filter
                    setFilterDateFrom('');
                    setFilterDateTo('');
                  }}
                  className="w-full"
                >
                  נקה סינונים
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pagination - Top */}
      <PaginationControls 
        page={page} 
        totalPages={totalPages} 
        totalCount={totalCount} 
        pageSize={pageSize} 
        onPageChange={setPage} 
        isFetching={isFetching} 
      />

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>רשימת תיקונים ({totalCount})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>מכשיר</TableHead>
                <TableHead>לקוח</TableHead>
                <TableHead>תיקון</TableHead>
                <TableHead>מעבדה</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>נפתח</TableHead>
                <TableHead>עלות</TableHead>
                <TableHead>דחיפות</TableHead>
                <TableHead>פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repairs.map((repair) => (
                <TableRow key={repair.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{repair.device?.device_models?.model_name || 'לא ידוע'}</div>
                      <div className="text-xs text-muted-foreground">{repair.device?.imei}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {repair.customer_name || repair.warranty?.[0]?.customer_name}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {repair.customer_phone || repair.warranty?.[0]?.customer_phone}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getRepairTypeDisplay(repair)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {repair.lab ? (
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {repair.lab.full_name || repair.lab.email}
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedRepair(repair);
                          setIsAssignDialogOpen(true);
                        }}
                      >
                        הקצה
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(repair.status as RepairStatus)}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {formatDate(repair.created_at || '')}
                    </div>
                  </TableCell>
                  <TableCell>
                    {repair.cost ? formatCurrency(repair.cost) : '-'}
                  </TableCell>
                  <TableCell>
                    {getUrgencyBadge(repair.created_at || '', repair.status as RepairStatus)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedRepair(repair);
                          setIsDetailsDialogOpen(true);
                        }}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>

                      {repair.status === 'received' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUpdateStatus(repair.id, 'completed')}
                          title="סמן כהושלם"
                        >
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {repairs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              לא נמצאו תיקונים מתאימים
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination - Bottom */}
      <PaginationControls 
        page={page} 
        totalPages={totalPages} 
        totalCount={totalCount} 
        pageSize={pageSize} 
        onPageChange={setPage} 
        isFetching={isFetching} 
      />

      {/* Assign Lab Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>הקצאת תיקון למעבדה</DialogTitle>
            <DialogDescription>
              בחר מעבדה לביצוע התיקון
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>מעבדה</Label>
              <select
                title="מעבדה"
                className="w-full px-3 py-2 border rounded-md mt-1"
                value={selectedLabId}
                onChange={(e) => setSelectedLabId(e.target.value)}
              >
                <option value="">בחר מעבדה</option>
                {labs.map((lab) => (
                  <option key={lab.id} value={lab.id}>
                    {lab.full_name || lab.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              ביטול
            </Button>
            <Button onClick={handleAssignLab} disabled={!selectedLabId}>
              הקצה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Repair Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>פרטי תיקון</DialogTitle>
            <DialogDescription>פרטי התיקון שנבחר.</DialogDescription>
          </DialogHeader>
          {selectedRepair && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>מכשיר</Label>
                  <p className="font-medium">{selectedRepair.device?.device_model?.model_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedRepair.device?.imei}</p>
                </div>
                <div>
                  <Label>לקוח</Label>
                  <p className="font-medium">{selectedRepair.customer_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedRepair.customer_phone}</p>
                </div>
                <div>
                  <Label>סוג תיקון</Label>
                  <p className="font-medium">{getRepairTypeDisplay(selectedRepair)}</p>
                </div>
                <div>
                  <Label>סטטוס</Label>
                  <div className="mt-1">{getStatusBadge(selectedRepair.status)}</div>
                </div>
                <div>
                  <Label>מעבדה</Label>
                  <p className="font-medium">{selectedRepair.lab?.full_name || selectedRepair.lab?.email || 'לא הוקצה'}</p>
                </div>
                <div>
                  <Label>עלות</Label>
                  <p className="font-medium">
                    {selectedRepair.cost ? formatCurrency(selectedRepair.cost) : 'טרם נקבעה'}
                  </p>
                </div>
                <div>
                  <Label>נפתח</Label>
                  <p className="font-medium">{formatDateTime(selectedRepair.created_at)}</p>
                </div>
                <div>
                  <Label>הושלם</Label>
                  <p className="font-medium">
                    {selectedRepair.completed_at ? formatDateTime(selectedRepair.completed_at) : 'טרם הושלם'}
                  </p>
                </div>
              </div>

              {selectedRepair.fault_description && (
                <div>
                  <Label>תיאור התקלה</Label>
                  <p className="mt-1 p-3 bg-muted rounded">{selectedRepair.fault_description}</p>
                </div>
              )}

              {selectedRepair.notes && (
                <div>
                  <Label>הערות</Label>
                  <p className="mt-1 p-3 bg-muted rounded">{selectedRepair.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsDetailsDialogOpen(false)}>
              סגור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Helper Components ---

function StatCard({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    blue: { border: 'border-r-blue-500', bg: 'bg-blue-100', text: 'text-blue-600' },
    orange: { border: 'border-r-orange-500', bg: 'bg-orange-100', text: 'text-orange-600' },
    green: { border: 'border-r-green-500', bg: 'bg-green-100', text: 'text-green-600' },
    purple: { border: 'border-r-purple-500', bg: 'bg-purple-100', text: 'text-purple-600' },
  };
  const c = colors[color] || colors.blue;

  return (
    <Card className={`shadow-sm hover:shadow-md transition-shadow border-r-4 ${c.border}`}>
      <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
        <div className={`h-10 w-10 rounded-full ${c.bg} dark:bg-opacity-20 flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${c.text} dark:text-opacity-80`} />
        </div>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${c.text}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function PaginationControls({ page, totalPages, totalCount, pageSize, onPageChange, isFetching }: any) {
  if (totalPages <= 1) return null;
  
  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardContent className="p-0 py-2">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            מציג {totalCount > 0 ? ((page - 1) * pageSize) + 1 : 0}-
            {Math.min(page * pageSize, totalCount)} מתוך {totalCount}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(1)}
              disabled={page === 1 || isFetching}
            >
              <span className="sr-only">ראשון</span>«
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange((p: number) => Math.max(1, p - 1))}
              disabled={page === 1 || isFetching}
            >
              <ChevronRight className="h-4 w-4" />
              הקודם
            </Button>
            <div className="text-sm px-2">
              עמוד {page} מתוך {Math.max(1, totalPages)}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange((p: number) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isFetching}
            >
              הבא
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(totalPages)}
              disabled={page >= totalPages || isFetching}
            >
              <span className="sr-only">אחרון</span>»
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}