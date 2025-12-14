'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { Save, Bell } from 'lucide-react';
import type { Json } from '@/types';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface NotificationPreferences {
  notifyOnWarrantyActivated: boolean;
  notifyOnRepairNew: boolean;
  notifyOnRepairCompleted: boolean;
  notifyOnReplacementRequest: boolean;
  notifyOnReplacementUpdate: boolean;
  notifyOnPaymentReceived: boolean;
}

interface NotificationOption {
  id: keyof NotificationPreferences;
  label: string;
  description: string;
  roles: ('admin' | 'store' | 'lab')[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

const defaultPreferences: NotificationPreferences = {
  notifyOnWarrantyActivated: true,
  notifyOnRepairNew: true,
  notifyOnRepairCompleted: true,
  notifyOnReplacementRequest: true,
  notifyOnReplacementUpdate: true,
  notifyOnPaymentReceived: true,
};

/**
 * Notification options configuration
 * Each option specifies which roles should see it
 */
const notificationOptions: NotificationOption[] = [
  {
    id: 'notifyOnWarrantyActivated',
    label: 'התראה על הפעלת אחריות',
    description: 'קבל התראה כאשר חנות מפעילה אחריות חדשה.',
    roles: ['admin'],
  },
  {
    id: 'notifyOnRepairNew',
    label: 'התראה על תיקון חדש',
    description: 'קבל התראה כאשר תיקון חדש נוצר במערכת.',
    roles: ['admin'],
  },
  {
    id: 'notifyOnRepairCompleted',
    label: 'התראה על השלמת תיקון',
    description: 'קבל התראה כאשר תיקון הושלם בהצלחה.',
    roles: ['admin'],
  },
  {
    id: 'notifyOnReplacementRequest',
    label: 'התראה על בקשת החלפה',
    description: 'קבל התראה כאשר מתקבלת בקשת החלפה חדשה.',
    roles: ['admin'],
  },
  {
    id: 'notifyOnReplacementUpdate',
    label: 'התראה על עדכון בקשת החלפה',
    description: 'קבל התראה כאשר בקשת החלפה שהגשת מתעדכנת.',
    roles: ['store', 'lab'],
  },
  {
    id: 'notifyOnPaymentReceived',
    label: 'התראה על תשלום שהתקבל',
    description: 'קבל התראה כאשר המנהל מעדכן על תשלום שביצע עבורך.',
    roles: ['lab'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export function NotificationPreferencesCard() {
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'store' | 'lab' | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<NotificationPreferences>(defaultPreferences);

  const supabase = createClient();
  const { toast } = useToast();

  // ─────────────────────────────────────────────────────────────────────────────
  // Load notification settings
  // ─────────────────────────────────────────────────────────────────────────────

  const loadNotificationSettings = useCallback(async (id: string) => {
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('notification_preferences, role')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (userData) {
        setUserRole(userData.role as 'admin' | 'store' | 'lab');

        if (userData.notification_preferences) {
          const prefs = userData.notification_preferences as Record<string, boolean>;
          setNotificationSettings({
            notifyOnWarrantyActivated: prefs.notifyOnWarrantyActivated ?? true,
            notifyOnRepairNew: prefs.notifyOnRepairNew ?? true,
            notifyOnRepairCompleted: prefs.notifyOnRepairCompleted ?? true,
            notifyOnReplacementRequest: prefs.notifyOnReplacementRequest ?? true,
            notifyOnReplacementUpdate: prefs.notifyOnReplacementUpdate ?? true,
            notifyOnPaymentReceived: prefs.notifyOnPaymentReceived ?? true,
          });
        }
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  }, [supabase]);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        loadNotificationSettings(user.id);
      }
    };
    loadUser();
  }, [supabase, loadNotificationSettings]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Save notification settings
  // ─────────────────────────────────────────────────────────────────────────────

  const handleSaveNotifications = async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          notification_preferences: notificationSettings as unknown as Json,
        })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'הצלחה',
        description: 'העדפות ההתראות נשמרו בהצלחה',
      });

      loadNotificationSettings(userId);
    } catch (error: unknown) {
      toast({
        title: 'שגיאה',
        description: error instanceof Error ? error.message : 'לא ניתן לשמור את העדפות ההתראות',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Filter options based on user role
  // ─────────────────────────────────────────────────────────────────────────────

  const filteredOptions = notificationOptions.filter(
    (option) => userRole && option.roles.includes(userRole)
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  // Don't render if no options available for this role
  if (filteredOptions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <CardTitle>העדפות התראות</CardTitle>
        </div>
        <CardDescription>
          בחר אילו התראות תרצה לקבל במערכת.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {filteredOptions.map((option, index) => (
          <div key={option.id}>
            {index > 0 && <Separator className="mb-4" />}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor={option.id}>{option.label}</Label>
                <p className="text-sm text-muted-foreground">
                  {option.description}
                </p>
              </div>
              <Switch
                id={option.id}
                checked={notificationSettings[option.id]}
                onCheckedChange={(checked) =>
                  setNotificationSettings({ ...notificationSettings, [option.id]: checked })
                }
              />
            </div>
          </div>
        ))}

        <div className="pt-4">
          <Button onClick={handleSaveNotifications} disabled={isLoading}>
            <Save className="ms-2 h-4 w-4" />
            שמור העדפות
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}