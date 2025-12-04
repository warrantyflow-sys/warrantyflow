'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useReplacementsTable, useReplacementsStats } from '@/hooks/queries/useReplacements';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import {
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  MessageSquare,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/utils';
import { ReplacementsPageSkeleton } from '@/components/ui/loading-skeletons';

type RequestStatus = 'pending' | 'approved' | 'rejected';

export default function ReplacementsPage() {
  // --- State ---
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | RequestStatus>('all');

  // Dialog States
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isDecisionDialogOpen, setIsDecisionDialogOpen] = useState(false);
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve');
  const [adminNotes, setAdminNotes] = useState('');

  // User ID for audit log
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const supabase = createClient();
  const { toast } = useToast();

  // --- Optimized Data Fetching ---
  const { data: statsData, isLoading: isStatsLoading } = useReplacementsStats();
  
  const { 
    data: requestsData, 
    isLoading: isRequestsLoading, 
    isFetching 
  } = useReplacementsTable(page, pageSize, {
    status: filterStatus,
    search: debouncedSearch
  });

  const requests = requestsData?.data || [];
  const totalCount = requestsData?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);
  
  const isLoading = isRequestsLoading; // Main loading state

  // --- Effects ---

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

  // Load User ID once
  useEffect(() => {
    const loadUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    loadUserId();
  }, [supabase]);


  // --- Handlers ---

  const handleRefresh = () => {
    toast({ title: 'הנתונים מתעדכנים...' });
    // Invalidation happens automatically via hooks if needed, or we can expose refetch
  };

  const handleDecision = async () => {
    if (!selectedRequest) return;
    if (decision === 'reject' && !adminNotes.trim()) {
      toast({
        title: 'שגיאה',
        description: 'יש לציין סיבת דחייה',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (!currentUserId) throw new Error('משתמש לא מחובר');

      if (decision === 'approve') {
        const { error } = await supabase.rpc('approve_replacement', {
          p_request_id: selectedRequest.id,
          p_admin_notes: adminNotes || null,
        } as any);

        if (error) throw error;

        // Audit Log
        supabase.from('audit_log').insert({
          actor_user_id: currentUserId,
          action: 'replacement.approve',
          entity_type: 'replacement_request',
          entity_id: selectedRequest.id,
          meta: {
            device_id: selectedRequest.device?.id,
            requester_id: selectedRequest.requester_id,
            admin_notes: adminNotes || null
          }
        });

        toast({
          title: 'הבקשה אושרה',
          description: `ההחלפה עבור ${selectedRequest.device?.device_model?.model_name} (IMEI: ${selectedRequest.device?.imei}) אושרה.`,
        });
      } else {
        const { error } = await supabase.rpc('reject_replacement', {
          p_request_id: selectedRequest.id,
          p_admin_notes: adminNotes,
        } as any);

        if (error) throw error;

        // Audit Log
        supabase.from('audit_log').insert({
          actor_user_id: currentUserId,
          action: 'replacement.reject',
          entity_type: 'replacement_request',
          entity_id: selectedRequest.id,
          meta: {
            device_id: selectedRequest.device?.id,
            requester_id: selectedRequest.requester_id,
            admin_notes: adminNotes
          }
        });

        toast({
          title: 'הבקשה נדחתה',
          description: `ההחלפה עבור ${selectedRequest.device?.device_model?.model_name} (IMEI: ${selectedRequest.device?.imei}) נדחתה.`,
          variant: 'destructive',
        });
      }

      setIsDecisionDialogOpen(false);
      setAdminNotes('');
      // Data updates automatically via Realtime subscription in the hook
    } catch (error) {
      console.error('Error processing decision:', error);
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בעיבוד הבקשה',
        variant: 'destructive',
      });
    }
  };

  // --- Helpers ---

  const getUserDisplayName = useCallback((user?: { full_name?: string | null; email?: string | null }) => {
    if (!user) return '';
    return user.full_name?.trim() || user.email || '';
  }, []);

  const getStatusBadge = (status: RequestStatus) => {
    const variants = {
      pending: { variant: 'outline' as const, text: 'ממתין' },
      approved: { variant: 'default' as const, text: 'אושר' },
      rejected: { variant: 'destructive' as const, text: 'נדחה' },
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.text}</Badge>;
  };

  const getPriorityBadge = (createdAt: string, status: RequestStatus) => {
    if (status !== 'pending') return null;

    const created = new Date(createdAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60);

    if (hoursDiff > 48) {
      return <Badge variant="destructive">דחוף</Badge>;
    } else if (hoursDiff > 24) {
      return <Badge variant="outline">בינוני</Badge>;
    }
    return <Badge variant="secondary">רגיל</Badge>;
  };

  const getRequesterTypeBadge = (role?: string) => {
    if (!role) return null;
    const config = {
      store: { text: 'חנות', variant: 'outline' as const },
      lab: { text: 'מעבדה', variant: 'secondary' as const },
      admin: { text: 'מנהל', variant: 'default' as const },
    };
    const roleConfig = config[role as keyof typeof config];
    if (!roleConfig) return null;
    return <Badge variant={roleConfig.variant}>{roleConfig.text}</Badge>;
  };

  if (isLoading && page === 1) {
    return <ReplacementsPageSkeleton />;
  }

  return (
    <div className="space-y-6" dir="rtl">
      <BackgroundRefreshIndicator
        isFetching={isFetching || isStatsLoading}
        isLoading={isLoading}
      />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">בקשות החלפה</h1>
          <p className="text-muted-foreground">
            ניהול ואישור בקשות החלפת מכשירים
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title='סה"כ בקשות' value={statsData?.total || 0} icon={RefreshCw} color="blue" />
        <StatCard title='ממתינות' value={statsData?.pending || 0} icon={Clock} color="orange" />
        <StatCard title='אושרו' value={statsData?.approved || 0} icon={CheckCircle} color="green" />
        <StatCard title='נדחו' value={statsData?.rejected || 0} icon={XCircle} color="red" />
      </div>

      {/* Pending Alert */}
      {(statsData?.pending || 0) > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>יש {statsData?.pending} בקשות ממתינות</AlertTitle>
          <AlertDescription>
            הבקשות נמצאות בטיפול וייענו בהקדם האפשרי
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>סינון בקשות</CardTitle>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              רענן
              <RefreshCw className="h-4 w-4 ms-2" />
            </Button>
          </div>
          <div className="flex gap-4 mt-4">
            <select
              title="בחר סטטוס"
              className="px-3 py-2 border rounded-md"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
            >
              <option value="all">כל הסטטוסים</option>
              <option value="pending">ממתין</option>
              <option value="approved">אושר</option>
              <option value="rejected">נדחה</option>
            </select>

            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="חיפוש לפי IMEI או שם לקוח..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          
          {/* Pagination Top */}
          <PaginationControls 
             page={page} totalPages={totalPages} totalCount={totalCount} 
             pageSize={pageSize} onPageChange={setPage} isFetching={isFetching} 
          />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>מכשיר</TableHead>
                <TableHead>מבקש</TableHead>
                <TableHead>סיבה</TableHead>
                <TableHead>תאריך</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>דחיפות</TableHead>
                <TableHead>מטופל ע"י</TableHead>
                <TableHead>פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{request.device?.device_model?.model_name}</div>
                      <div className="text-xs text-muted-foreground">{request.device?.imei}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{getUserDisplayName(request.requester) || 'ללא שם'}</span>
                        {getRequesterTypeBadge(request.requester?.role)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {request.requester?.email || ''}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[200px]">
                      <p className="text-sm truncate">{request.reason}</p>
                      {request.repair && (
                        <Badge variant="outline" className="mt-1">
                          תיקון: {request.repair.fault_type}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {formatDate(request.created_at)}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell>
                    {getPriorityBadge(request.created_at, request.status)}
                  </TableCell>
                  <TableCell>
                    {request.resolver ? (
                      <div className="text-sm">
                        <div>{request.resolver.full_name}</div>
                        {request.resolved_at && (
                          <div className="text-xs text-muted-foreground">
                            {formatDate(request.resolved_at)}
                          </div>
                        )}
                      </div>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedRequest(request);
                          setIsDetailsDialogOpen(true);
                        }}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>

                      {request.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedRequest(request);
                              setDecision('approve');
                              setIsDecisionDialogOpen(true);
                            }}
                            title="אשר"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedRequest(request);
                              setDecision('reject');
                              setIsDecisionDialogOpen(true);
                            }}
                            title="דחה"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {requests.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              לא נמצאו בקשות מתאימות
            </div>
          )}

           {/* Pagination Bottom */}
           <div className="mt-4">
             <PaginationControls 
               page={page} totalPages={totalPages} totalCount={totalCount} 
               pageSize={pageSize} onPageChange={setPage} isFetching={isFetching} 
             />
           </div>
        </CardContent>
      </Card>

      {/* Decision Dialog */}
      <Dialog open={isDecisionDialogOpen} onOpenChange={setIsDecisionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision === 'approve' ? 'אישור בקשת החלפה' : 'דחיית בקשת החלפה'}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest && (
                <div className="mt-2">
                  <p>מכשיר: {selectedRequest.device?.device_model?.model_name}</p>
                  <p>IMEI: {selectedRequest.device?.imei}</p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>הערות מנהל</Label>
              <textarea
                className="w-full px-3 py-2 border rounded-md mt-1 min-h-[100px]"
                placeholder={decision === 'approve' ? 'הערות לאישור...' : 'סיבת הדחייה (חובה)...'}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </div>

            {decision === 'approve' && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>שים לב</AlertTitle>
                <AlertDescription>
                  אישור הבקשה ישנה את סטטוס המכשיר ל"הוחלף"
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDecisionDialogOpen(false)}>
              ביטול
            </Button>
            <Button
              onClick={handleDecision}
              variant={decision === 'approve' ? 'default' : 'destructive'}
              disabled={decision === 'reject' && !adminNotes}
            >
              {decision === 'approve' ? 'אשר החלפה' : 'דחה בקשה'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>פרטי בקשת החלפה</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">מכשיר</Label>
                  <p className="font-medium">{selectedRequest.device?.device_model?.model_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedRequest.device?.imei}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">סטטוס</Label>
                  <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">מבקש</Label>
                  <p className="font-medium">{getUserDisplayName(selectedRequest.requester) || '-'}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedRequest.requester?.email || ''}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">תאריך הגשה</Label>
                  <p className="font-medium">{formatDateTime(selectedRequest.created_at)}</p>
                </div>

                {selectedRequest.repair && (
                  <>
                    <div>
                      <Label>תקלה קשורה</Label>
                      <p className="font-medium">{selectedRequest.repair.fault_type}</p>
                    </div>
                    <div>
                      <Label>מעבדה מטפלת</Label>
                      <p className="font-medium">{getUserDisplayName(selectedRequest.repair.lab) || 'לא צוין'}</p>
                    </div>
                  </>
                )}

                {selectedRequest.resolver && (
                  <>
                    <div>
                      <Label>טופל על ידי</Label>
                      <p className="font-medium">{selectedRequest.resolver.full_name}</p>
                    </div>
                    <div>
                      <Label>תאריך טיפול</Label>
                      <p className="font-medium">
                        {selectedRequest.resolved_at && formatDateTime(selectedRequest.resolved_at)}
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div>
                <Label>סיבת הבקשה</Label>
                <p className="mt-1 p-3 bg-muted rounded">{selectedRequest.reason}</p>
              </div>

              {selectedRequest.admin_notes && (
                <div>
                  <Label>הערות מנהל</Label>
                  <p className="mt-1 p-3 bg-muted rounded">{selectedRequest.admin_notes}</p>
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

// Helper Components

function StatCard({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    blue: 'text-blue-600',
    orange: 'text-orange-600',
    green: 'text-green-600',
    red: 'text-red-600',
    purple: 'text-purple-600',
  };
  return (
    <Card className={`shadow-sm border-r-4 border-r-${color}-500`}>
      <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
        <div className={`h-10 w-10 rounded-full bg-${color}-100 flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${colors[color]}`} />
        </div>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${colors[color]}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function PaginationControls({ page, totalPages, totalCount, pageSize, onPageChange, isFetching }: any) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">
        מציג {totalCount > 0 ? ((page - 1) * pageSize) + 1 : 0}-
        {Math.min(page * pageSize, totalCount)} מתוך {totalCount}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={page === 1 || isFetching}
        >
          «
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange((p: number) => Math.max(1, p - 1))}
          disabled={page === 1 || isFetching}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="text-sm px-2">
          {page} / {totalPages}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange((p: number) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages || isFetching}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages || isFetching}
        >
          »
        </Button>
      </div>
    </div>
  );
}