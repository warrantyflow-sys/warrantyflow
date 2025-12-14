'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Bell, Check, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDateTime } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  is_opened: boolean;
  created_at: string;
}

interface NotificationsDropdownProps {
  /** User role - determines behavior and available actions */
  userRole: 'admin' | 'store' | 'lab';
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns an appropriate icon for each notification type
 */
function getNotificationIcon(type: string): string {
  switch (type) {
    case 'warranty_activated':
      return '🛡️';
    case 'replacement_request_new':
      return '🔄';
    case 'replacement_request_updated':
      return '📋';
    case 'repair_new':
      return '🔧';
    case 'repair_completed':
      return '✅';
    case 'payment_received':
      return '💰';
    default:
      return '🔔';
  }
}

/**
 * Formats notification data for display based on notification type
 */
function formatNotificationData(notification: Notification | null): React.ReactNode {
  if (!notification?.data || Object.keys(notification.data).length === 0) {
    return null;
  }

  const { type, data } = notification;

  // Specific formatting for replacement request responses
  if (type === 'replacement_request_updated') {
    return (
      <div className="bg-muted p-4 rounded-lg space-y-2">
        <p className="text-sm font-medium">פרטי הבקשה:</p>
        {data.device_model_name != null && (
          <p className="text-sm">
            <span className="font-medium">דגם:</span> {String(data.device_model_name)}
          </p>
        )}
        {data.device_imei != null && (
          <p className="text-sm">
            <span className="font-medium">IMEI:</span> {String(data.device_imei)}
          </p>
        )}
        {data.admin_notes != null && (
          <p className="text-sm">
            <span className="font-medium">הערות מנהל:</span> {String(data.admin_notes)}
          </p>
        )}
      </div>
    );
  }

  // Specific formatting for payment received
  if (type === 'payment_received') {
    return (
      <div className="bg-muted p-4 rounded-lg space-y-2">
        <p className="text-sm font-medium">פרטי התשלום:</p>
        {data.amount != null && (
          <p className="text-sm">
            <span className="font-medium">סכום:</span> {String(data.amount)} ₪
          </p>
        )}
        {data.payment_date != null && (
          <p className="text-sm">
            <span className="font-medium">תאריך:</span> {formatDateTime(String(data.payment_date))}
          </p>
        )}
        {data.notes != null && (
          <p className="text-sm">
            <span className="font-medium">הערות:</span> {String(data.notes)}
          </p>
        )}
      </div>
    );
  }

  // Specific formatting for warranty activated
  if (type === 'warranty_activated') {
    return (
      <div className="bg-muted p-4 rounded-lg space-y-2">
        <p className="text-sm font-medium">פרטי האחריות:</p>
        {data.model_name != null && (
          <p className="text-sm">
            <span className="font-medium">דגם:</span> {String(data.model_name)}
          </p>
        )}
        {data.device_imei != null && (
          <p className="text-sm">
            <span className="font-medium">IMEI:</span> {String(data.device_imei)}
          </p>
        )}
        {data.store_name != null && (
          <p className="text-sm">
            <span className="font-medium">חנות:</span> {String(data.store_name)}
          </p>
        )}
        {data.customer_name != null && (
          <p className="text-sm">
            <span className="font-medium">לקוח:</span> {String(data.customer_name)}
          </p>
        )}
      </div>
    );
  }

  // Generic fallback for other notification types
  const displayableEntries = Object.entries(data).filter(
    ([key]) => !['request_id', 'device_id', 'warranty_id', 'payment_id', 'repair_id'].includes(key)
  );

  if (displayableEntries.length === 0) return null;

  return (
    <div className="bg-muted p-4 rounded-lg space-y-2">
      <p className="text-sm font-medium">פרטים נוספים:</p>
      <div className="space-y-1 mt-2">
        {displayableEntries.map(([key, value]) => (
          <div key={key} className="flex justify-between text-sm gap-2">
            <span className="font-medium text-muted-foreground">{key}:</span>
            <span className="text-right">{String(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

export function NotificationsDropdown({ userRole }: NotificationsDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  
  // Dialog states
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isDecisionDialogOpen, setIsDecisionDialogOpen] = useState(false);
  
  // Admin-only state for replacement decisions
  const [adminNotes, setAdminNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const { toast } = useToast();
  const supabase = createClient();

  // ─────────────────────────────────────────────────────────────────────────────
  // Load user and notifications
  // ─────────────────────────────────────────────────────────────────────────────

  const loadNotifications = useCallback(async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        const typedData = data as Notification[];
        setNotifications(typedData);
        setUnreadCount(typedData.filter((n) => !n.is_read).length);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }, [supabase]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Setup realtime subscription
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);
      await loadNotifications(user.id);

      // Realtime subscription with user filter for security
      channel = supabase
        .channel(`notifications-${userRole}-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const newNotification = payload.new as Notification;
            setNotifications((prev) => [newNotification, ...prev]);
            setUnreadCount((prev) => prev + 1);

            toast({
              title: newNotification.title,
              description: newNotification.message,
            });
          }
        )
        .subscribe();
    };

    setup();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, userRole, loadNotifications, toast]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Notification actions
  // ─────────────────────────────────────────────────────────────────────────────

  const markAsOpened = async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_opened: true, is_read: true })
        .eq('id', notificationId);
      
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_opened: true, is_read: true } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as opened:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const wasUnread = notifications.find((n) => n.id === notificationId)?.is_read === false;
      
      await supabase.from('notifications').delete().eq('id', notificationId);
      
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      if (wasUnread) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Open notification handler - determines which dialog to show
  // ─────────────────────────────────────────────────────────────────────────────

  const openNotification = (notification: Notification) => {
    setSelectedNotification(notification);

    // Admin sees decision dialog for new replacement requests
    if (userRole === 'admin' && notification.type === 'replacement_request_new') {
      setIsDecisionDialogOpen(true);
    } else {
      setIsDetailDialogOpen(true);
    }

    if (!notification.is_opened) {
      markAsOpened(notification.id);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Admin-only: Handle replacement request decision
  // ─────────────────────────────────────────────────────────────────────────────

  const handleDecision = async (decision: 'approve' | 'reject') => {
    if (!selectedNotification?.data?.request_id) return;

    if (decision === 'reject' && !adminNotes.trim()) {
      toast({
        title: 'שגיאה',
        description: 'יש לציין סיבת דחייה',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const rpcName = decision === 'approve' ? 'approve_replacement' : 'reject_replacement';
      const { error } = await supabase.rpc(rpcName, {
        p_request_id: String(selectedNotification.data.request_id),
        p_admin_notes: adminNotes || '',
      });

      if (error) throw error;

      toast({
        title: 'הצלחה',
        description: `הבקשה ${decision === 'approve' ? 'אושרה' : 'נדחתה'} בהצלחה`,
      });

      setIsDecisionDialogOpen(false);
      setAdminNotes('');
      
      // Remove the notification locally after handling it
      setNotifications((prev) => prev.filter((n) => n.id !== selectedNotification.id));
    } catch (error: unknown) {
      console.error('Error processing decision:', error);
      toast({
        title: 'שגיאה',
        description: error instanceof Error ? error.message : 'אירעה שגיאה בעיבוד הבקשה',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-96">
          <div dir="rtl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">התראות</h3>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs"
                >
                  <Check className="h-3 w-3 me-1" />
                  סמן הכל כנקרא
                </Button>
              )}
            </div>
            <ScrollArea className="h-[400px]">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Bell className="h-12 w-12 mb-2 opacity-50" />
                  <p className="text-sm">אין התראות</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                        !notification.is_read ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                      }`}
                      onClick={() => openNotification(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-sm">{notification.title}</p>
                            {!notification.is_read && (
                              <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {formatDateTime(notification.created_at)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Detail Dialog - for all notification types (non-actionable) */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>{selectedNotification?.title}</DialogTitle>
            <DialogDescription>
              {selectedNotification && formatDateTime(selectedNotification.created_at)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">{selectedNotification?.message}</p>
            {formatNotificationData(selectedNotification)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
              סגור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decision Dialog - Admin only, for replacement requests */}
      {userRole === 'admin' && (
        <Dialog open={isDecisionDialogOpen} onOpenChange={setIsDecisionDialogOpen}>
          <DialogContent className="sm:max-w-[500px]" dir="rtl">
            <DialogHeader>
              <DialogTitle>טיפול בבקשת החלפה</DialogTitle>
              <DialogDescription>{selectedNotification?.message}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedNotification?.data && (
                <div className="text-sm space-y-1">
                  {selectedNotification.data.requester_name != null && (
                    <p>
                      <span className="font-medium">מבקש:</span>{' '}
                      {String(selectedNotification.data.requester_name)}
                    </p>
                  )}
                  {selectedNotification.data.device_imei != null && (
                    <p>
                      <span className="font-medium">IMEI:</span>{' '}
                      {String(selectedNotification.data.device_imei)}
                    </p>
                  )}
                  {selectedNotification.data.reason != null && (
                    <p>
                      <span className="font-medium">סיבה:</span>{' '}
                      {String(selectedNotification.data.reason)}
                    </p>
                  )}
                </div>
              )}
              <div>
                <Label htmlFor="admin_notes">הערות (חובה בדחייה)</Label>
                <Textarea
                  id="admin_notes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="הזן הערות או סיבת דחייה..."
                />
              </div>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>שים לב</AlertTitle>
                <AlertDescription>
                  אישור הבקשה ישנה את סטטוס המכשיר ל&quot;הוחלף&quot;.
                </AlertDescription>
              </Alert>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDecisionDialogOpen(false)}
                disabled={isProcessing}
              >
                ביטול
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDecision('reject')}
                disabled={!adminNotes || isProcessing}
              >
                דחה בקשה
              </Button>
              <Button onClick={() => handleDecision('approve')} disabled={isProcessing}>
                אשר החלפה
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}