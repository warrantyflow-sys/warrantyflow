'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { User } from '@/types';

// ✅ שימוש ב-Hooks החדשים לקריאות יעילות
import { useUsersTable, useUserStats } from '@/hooks/queries/useUsers';

import { BackgroundRefreshIndicator } from '@/components/ui/background-refresh-indicator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useToast } from '@/components/ui/use-toast';
import {
  Plus, Search, Shield, Store, Wrench, Edit, Key,
  UserX, UserCheck, Trash2, BarChart3, Users,
  ChevronRight, ChevronLeft, Loader2
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { UsersPageSkeleton } from '@/components/ui/loading-skeletons';

type ManagedUser = User;

// --- Zod Schemas ---

const editUserSchema = z.object({
  email: z.string().email('כתובת אימייל לא תקינה'),
  full_name: z.string().min(1, 'שם מלא הוא שדה חובה'),
  phone: z.string().optional(),
  role: z.enum(['admin', 'store', 'lab']),
  is_active: z.boolean(),
});

const passwordSchema = z.object({
  password: z.string().min(8, 'הסיסמה חייבת להכיל לפחות 8 תווים'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'הסיסמאות אינן תואמות',
  path: ['confirmPassword'],
});

const createUserSchema = z.object({
  email: z.string().email('כתובת אימייל לא תקינה'),
  full_name: z.string().min(1, 'שם מלא הוא שדה חובה'),
  phone: z.string().optional(),
  role: z.enum(['admin', 'store', 'lab']),
  password: z.string().min(8, 'הסיסמה חייבת להכיל לפחות 8 תווים'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'הסיסמאות אינן תואמות',
  path: ['confirmPassword'],
});

type CreateUserFormData = z.infer<typeof createUserSchema>;
type EditUserFormData = z.infer<typeof editUserSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function UsersPage() {
  const supabase = createClient();
  const { toast } = useToast();

  // --- State Management ---
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Filters
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'store' | 'lab'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Dialog & Selection States
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isStatsDialogOpen, setIsStatsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Global Stats State (Top Cards)
  const [globalStats, setGlobalStats] = useState({
    total: 0, admins: 0, stores: 0, labs: 0, active: 0, inactive: 0
  });

  // --- Data Fetching: Main Table ---
  // שימוש ב-Hook שמנהל את השאילתה, הסינון והפגינציה מול השרת
  const { 
    data: usersData, 
    isLoading, 
    isFetching, 
    refetch 
  } = useUsersTable(page, pageSize, {
    role: roleFilter,
    status: statusFilter === 'inactive' ? 'inactive' : statusFilter === 'active' ? 'active' : 'all',
    search: debouncedSearch
  });

  const users = usersData?.users || [];
  const totalCount = usersData?.total || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // --- Data Fetching: User Stats ---
  // נטען רק כאשר הדיאלוג פתוח ויש משתמש נבחר
  const { data: userStats, isLoading: loadingStats } = useUserStats(
    isStatsDialogOpen && selectedUser ? selectedUser.id : null,
    isStatsDialogOpen && selectedUser ? selectedUser.role : null
  );

  // --- Data Fetching: Global Stats ---
  // שאילתות Count יעילות לכרטיסים למעלה
  const fetchGlobalStats = useCallback(async () => {
    try {
      const [total, admins, stores, labs, active, inactive] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'store'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'lab'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_active', false),
      ]);

      setGlobalStats({
        total: total.count || 0,
        admins: admins.count || 0,
        stores: stores.count || 0,
        labs: labs.count || 0,
        active: active.count || 0,
        inactive: inactive.count || 0,
      });
    } catch (error) {
      console.error('Error fetching global stats:', error);
    }
  }, [supabase]);

  // Initial Load & Debounce Logic
  useEffect(() => {
    fetchGlobalStats();
  }, [fetchGlobalStats]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      if (searchQuery !== debouncedSearch) setPage(1); // חזרה לעמוד ראשון בחיפוש חדש
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, debouncedSearch]);

  useEffect(() => {
    setPage(1);
  }, [roleFilter, statusFilter]);

  // --- Forms ---
  const createForm = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { email: '', password: '', confirmPassword: '', full_name: '', phone: '', role: 'store' }
  });

  const editForm = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const selectedRoleCreate = createForm.watch('role');

  // --- Action Handlers ---

  const handleRefresh = () => {
    refetch();
    fetchGlobalStats();
  };

  const handleCreateUser = async (data: CreateUserFormData) => {
    setIsSubmitting(true);
    try {
      const { confirmPassword, ...payload } = data;
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'שגיאה ביצירת משתמש');
      }

      toast({ title: 'הצלחה', description: 'המשתמש נוצר בהצלחה' });
      setIsCreateDialogOpen(false);
      createForm.reset();
      handleRefresh();
    } catch (error: any) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUser = async (data: EditUserFormData) => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('users').update({
        full_name: data.full_name,
        phone: data.phone,
        role: data.role,
        is_active: data.is_active,
      }).eq('id', selectedUser.id);

      if (error) throw error;

      toast({ title: 'הצלחה', description: 'פרטי המשתמש עודכנו' });
      setIsEditDialogOpen(false);
      refetch(); // עדכון הטבלה
    } catch (error: any) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (data: PasswordFormData) => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, newPassword: data.password }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'שגיאה באיפוס סיסמה');
      }

      toast({ title: 'הצלחה', description: 'הסיסמה שונתה בהצלחה' });
      setIsPasswordDialogOpen(false);
      passwordForm.reset();
    } catch (error: any) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from('users').update({ is_active: !currentStatus }).eq('id', userId);
      if (error) throw error;
      toast({ title: 'הצלחה', description: `המשתמש ${!currentStatus ? 'הופעל' : 'הושעה'} בהצלחה` });
      refetch(); // עדכון ה-Badge בטבלה
      fetchGlobalStats(); // עדכון הסטטיסטיקות למעלה
    } catch (error: any) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק משתמש זה?')) return;
    try {
      const response = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) throw new Error('Failed to delete');
      
      toast({ title: 'הצלחה', description: 'המשתמש נמחק' });
      handleRefresh();
    } catch (error: any) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    }
  };

  // --- Helper Functions ---
  const openEditDialog = (user: ManagedUser) => {
    setSelectedUser(user);
    editForm.reset({
      email: user.email,
      full_name: user.full_name || '',
      phone: user.phone || '',
      role: user.role,
      is_active: user.is_active,
    });
    setIsEditDialogOpen(true);
  };

  const getRoleBadge = (role: string) => {
    const config = {
      admin: { variant: 'default' as const, icon: Shield, text: 'מנהל' },
      store: { variant: 'outline' as const, icon: Store, text: 'חנות' },
      lab: { variant: 'secondary' as const, icon: Wrench, text: 'מעבדה' },
    };
    const roleConfig = config[role as keyof typeof config];
    const Icon = roleConfig.icon;
    return (
      <Badge variant={roleConfig.variant}>
        <Icon className="h-3 w-3 ms-1" />
        {roleConfig.text}
      </Badge>
    );
  };

  // --- Render ---

  if (isLoading && page === 1) {
    return <UsersPageSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Background Fetch Indicator */}
      <BackgroundRefreshIndicator isFetching={isFetching} isLoading={isLoading} />

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">ניהול משתמשים</h2>
          <p className="text-muted-foreground">ניהול משתמשי המערכת והרשאות</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          הוסף משתמש <Plus className="ms-2 h-4 w-4" />
        </Button>
      </div>

      {/* Global Stats Cards */}
      <div className="grid gap-4 md:grid-cols-6">
        <StatCard title='סה"כ משתמשים' value={globalStats.total} icon={Users} />
        <StatCard title='מנהלים' value={globalStats.admins} icon={Shield} />
        <StatCard title='חנויות' value={globalStats.stores} icon={Store} />
        <StatCard title='מעבדות' value={globalStats.labs} icon={Wrench} />
        <StatCard title='פעילים' value={globalStats.active} icon={UserCheck} />
        <StatCard title='מושעים' value={globalStats.inactive} icon={UserX} />
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חפש לפי שם, אימייל או טלפון..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                dir="rtl"
                className="pr-8"
              />
            </div>
            <Select value={roleFilter} onValueChange={(val) => setRoleFilter(val as any)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל התפקידים</SelectItem>
                <SelectItem value="admin">מנהלים</SelectItem>
                <SelectItem value="store">חנויות</SelectItem>
                <SelectItem value="lab">מעבדות</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as any)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                <SelectItem value="active">פעילים</SelectItem>
                <SelectItem value="inactive">מושעים</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Main Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>רשימת משתמשים</CardTitle>
          <CardDescription>
            {totalCount} משתמשים במערכת 
            {debouncedSearch && ` (תוצאות חיפוש עבור "${debouncedSearch}")`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Pagination Top Controls */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b">
            <span className="text-sm text-muted-foreground">
              מציג {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, totalCount)} מתוך {totalCount}
            </span>
            <div className="flex gap-2 items-center">
               <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(1)} 
                disabled={page === 1}
              >
                ראשון
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.max(1, p - 1))} 
                disabled={page === 1}
              >
                <ChevronRight className="h-4 w-4" /> הקודם
              </Button>
              <span className="text-sm px-2">עמוד {page} מתוך {totalPages}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                disabled={page >= totalPages}
              >
                הבא <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>משתמש</TableHead>
                <TableHead>תפקיד</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>תאריך הצטרפות</TableHead>
                <TableHead>פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                    לא נמצאו משתמשים
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.full_name || user.email}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                        {user.phone && <div className="text-sm text-muted-foreground">{user.phone}</div>}
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? 'default' : 'secondary'}>
                        {user.is_active ? 'פעיל' : 'מושעה'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(user.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {(user.role === 'store' || user.role === 'lab') && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => { setSelectedUser(user); setIsStatsDialogOpen(true); }}
                            title="סטטיסטיקות"
                          >
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openEditDialog(user)} title="עריכה">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => { setSelectedUser(user); passwordForm.reset(); setIsPasswordDialogOpen(true); }}
                          title="שינוי סיסמה"
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => toggleUserStatus(user.id, user.is_active)}
                          title={user.is_active ? 'השעה' : 'הפעל'}
                        >
                          {user.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteUser(user.id)} title="מחיקה">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* --- Dialogs --- */}

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>הוספת משתמש חדש</DialogTitle>
            <DialogDescription>צור משתמש חדש במערכת</DialogDescription>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(handleCreateUser)} className="space-y-4">
            <div>
              <Label>אימייל</Label>
              <Input {...createForm.register('email')} type="email" />
              {createForm.formState.errors.email && <p className="text-red-500 text-xs mt-1">{createForm.formState.errors.email.message}</p>}
            </div>
            <div>
              <Label>סיסמה</Label>
              <Input {...createForm.register('password')} type="password" />
              {createForm.formState.errors.password && <p className="text-red-500 text-xs mt-1">{createForm.formState.errors.password.message}</p>}
            </div>
            <div>
              <Label>אישור סיסמה</Label>
              <Input {...createForm.register('confirmPassword')} type="password" />
              {createForm.formState.errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{createForm.formState.errors.confirmPassword.message}</p>}
            </div>
            <div>
              <Label>שם מלא</Label>
              <Input {...createForm.register('full_name')} />
              {createForm.formState.errors.full_name && <p className="text-red-500 text-xs mt-1">{createForm.formState.errors.full_name.message}</p>}
            </div>
            <div>
              <Label>טלפון</Label>
              <Input {...createForm.register('phone')} />
            </div>
            <div>
              <Label>תפקיד</Label>
              <Select value={selectedRoleCreate} onValueChange={(v: any) => createForm.setValue('role', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">מנהל</SelectItem>
                  <SelectItem value="store">חנות</SelectItem>
                  <SelectItem value="lab">מעבדה</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? 'יוצר...' : 'צור משתמש'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>ביטול</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>עריכת משתמש</DialogTitle>
            <DialogDescription>ערוך את פרטי המשתמש</DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleUpdateUser)} className="space-y-4">
            <div>
              <Label>אימייל</Label>
              <Input {...editForm.register('email')} disabled className="bg-muted" />
            </div>
            <div>
              <Label>שם מלא</Label>
              <Input {...editForm.register('full_name')} />
              {editForm.formState.errors.full_name && <p className="text-red-500 text-xs mt-1">{editForm.formState.errors.full_name.message}</p>}
            </div>
            <div>
              <Label>טלפון</Label>
              <Input {...editForm.register('phone')} />
            </div>
            <div>
              <Label>תפקיד</Label>
              <Select value={editForm.watch('role')} onValueChange={(v: any) => editForm.setValue('role', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">מנהל</SelectItem>
                  <SelectItem value="store">חנות</SelectItem>
                  <SelectItem value="lab">מעבדה</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-2">
               <input type="checkbox" id="edit-active" {...editForm.register('is_active')} className="h-4 w-4" />
               <Label htmlFor="edit-active">משתמש פעיל</Label>
            </div>
            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? 'מעדכן...' : 'עדכן'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>ביטול</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>איפוס סיסמה</DialogTitle>
            <DialogDescription>הגדר סיסמה חדשה עבור {selectedUser?.full_name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={passwordForm.handleSubmit(handleResetPassword)} className="space-y-4">
            <div>
              <Label>סיסמה חדשה</Label>
              <Input {...passwordForm.register('password')} type="password" />
              {passwordForm.formState.errors.password && <p className="text-red-500 text-xs mt-1">{passwordForm.formState.errors.password.message}</p>}
            </div>
            <div>
              <Label>אישור סיסמה</Label>
              <Input {...passwordForm.register('confirmPassword')} type="password" />
              {passwordForm.formState.errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{passwordForm.formState.errors.confirmPassword.message}</p>}
            </div>
            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? 'מעדכן...' : 'שנה סיסמה'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>ביטול</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* User Stats Dialog */}
      <Dialog open={isStatsDialogOpen} onOpenChange={setIsStatsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>סטטיסטיקות - {selectedUser?.full_name}</DialogTitle>
            <DialogDescription>
              {selectedUser?.role === 'store' ? 'סטטיסטיקות החנות' : 'סטטיסטיקות המעבדה'}
            </DialogDescription>
          </DialogHeader>
          
          {loadingStats ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-2" />
              <p>טוען נתונים...</p>
            </div>
          ) : userStats ? (
            <div className="grid gap-4 md:grid-cols-3">
              {selectedUser?.role === 'store' ? (
                <>
                  <StatDetailCard title='סה"כ אחריות' value={userStats.totalWarranties} subtitle="מאז ההצטרפות" />
                  <StatDetailCard title='אחריות פעילות' value={userStats.activeWarranties} subtitle="כרגע" />
                  <StatDetailCard title='הפעלות החודש' value={userStats.monthlyActivations} subtitle="החודש הנוכחי" />
                </>
              ) : (
                <>
                  <StatDetailCard title='סה"כ תיקונים' value={userStats.totalRepairs} subtitle="מאז ההצטרפות" />
                  <StatDetailCard title='תיקונים פעילים' value={userStats.pendingRepairs} subtitle="כרגע" />
                  <StatDetailCard title='הושלמו החודש' value={userStats.completedRepairs} subtitle="החודש הנוכחי" />
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              לא ניתן לטעון סטטיסטיקות או אין נתונים
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Sub Components ---

function StatCard({ title, value, icon: Icon }: any) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2" dir="rtl">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-right">{value}</div>
      </CardContent>
    </Card>
  );
}

function StatDetailCard({ title, value, subtitle }: any) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}