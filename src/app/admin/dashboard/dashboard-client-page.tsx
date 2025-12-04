'use client';

import { useState } from 'react';
import { useAdminDashboardStats } from '@/hooks/queries/useAdminDashboard';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { BackgroundRefreshIndicator } from '@/components/ui/background-refresh-indicator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SettingCard } from '@/components/admin/setting-card';
import { DeviceModelsDialog } from '@/components/admin/device-models-dialog';
import { RepairTypesDialog } from '@/components/admin/repair-types-dialog';
import { LabRepairPricesDialog } from '@/components/admin/lab-repair-prices-dialog';
import { QuickLinkCard } from '@/components/admin/quick-link-card';
import ShekelIcon from '@/components/ui/shekel-icon';
import {
  Package,
  Shield,
  Wrench,
  RefreshCw,
  XCircle,
  Users,
  Smartphone,
  Store,
  FileBarChart
} from 'lucide-react';

export default function AdminDashboard() {
  // 1. שליפת נתונים
  const { stats, isFetching } = useAdminDashboardStats();
  const { user } = useCurrentUser(); // כדי להציג "שלום ישראל"

  // 2. ניהול מצבי Dialog
  const [isModelsDialogOpen, setIsModelsDialogOpen] = useState(false);
  const [isRepairTypesDialogOpen, setIsRepairTypesDialogOpen] = useState(false);
  const [isLabPricesDialogOpen, setIsLabPricesDialogOpen] = useState(false);

  return (
    <div className="space-y-6" dir="rtl">
      {/* אינדיקטור שקט לרענון נתונים ברקע */}
      <BackgroundRefreshIndicator isFetching={isFetching} />

      {/* כותרת עם שם המשתמש */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {user?.full_name ? `שלום, ${user.full_name}` : 'לוח בקרה'}
          </h1>
          <p className="text-muted-foreground">
            סקירה כללית וניהול המערכת
          </p>
        </div>
      </div>

      {/* כרטיסי סטטיסטיקה */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="border-r-4 border-r-blue-500 shadow-sm">
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Smartphone className="h-4 w-4 text-blue-600" />
            </div>
            <CardTitle className="text-sm font-medium">סה"כ מכשירים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="border-r-4 border-r-green-500 shadow-sm">
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
              <Package className="h-4 w-4 text-green-600" />
            </div>
            <CardTitle className="text-sm font-medium">חדשים במלאי</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.new}</div>
          </CardContent>
        </Card>

        <Card className="border-r-4 border-r-emerald-500 shadow-sm">
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <Shield className="h-4 w-4 text-emerald-600" />
            </div>
            <CardTitle className="text-sm font-medium">אחריות פעילה</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
          </CardContent>
        </Card>

        <Card className="border-r-4 border-r-red-500 shadow-sm">
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="h-4 w-4 text-red-600" />
            </div>
            <CardTitle className="text-sm font-medium">פגי תוקף</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.expired}</div>
          </CardContent>
        </Card>

        <Card className="border-r-4 border-r-purple-500 shadow-sm">
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
              <RefreshCw className="h-4 w-4 text-purple-600" />
            </div>
            <CardTitle className="text-sm font-medium">הוחלפו</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.replaced}</div>
          </CardContent>
        </Card>

        <Card className="border-r-4 border-r-orange-500 shadow-sm">
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
              <Wrench className="h-4 w-4 text-orange-600" />
            </div>
            <CardTitle className="text-sm font-medium">בתיקון</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inRepair}</div>
          </CardContent>
        </Card>
      </div>

      {/* אזור קיצורי דרך */}
      <section>
        <h2 className="text-lg font-semibold mb-4">קיצורי דרך</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" role="list">
          <QuickLinkCard
            title="ניהול משתמשים"
            description="צפייה ועריכת משתמשי מערכת"
            icon={Users}
            href="/admin/users"
            color="blue"
          />
          <QuickLinkCard
            title="ניהול מכשירים"
            description="מאגר המכשירים והאחריויות"
            icon={Smartphone}
            href="/admin/devices"
            color="indigo"
          />
          <QuickLinkCard
            title="תיקונים"
            description="מעקב וניהול סטטוס תיקונים"
            icon={Wrench}
            href="/admin/repairs"
            color="orange"
          />
          <QuickLinkCard
            title="דוחות"
            description="דוחות פעילות ומלאי"
            icon={FileBarChart} 
            href="/admin/reports"
            color="green"
          />
        </div>
      </section>

      {/* אזור הגדרות מערכת */}
      <section>
        <h2 className="text-lg font-semibold mb-4">הגדרות מערכת</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" role="list">
          <SettingCard
            title="ניהול דגמים"
            description="הוסף וערוך דגמי מכשירים ומשך אחריות"
            icon={Smartphone}
            onClick={() => setIsModelsDialogOpen(true)}
          />
          <SettingCard
            title="סוגי תיקונים"
            description="נהל את רשימת סוגי התיקונים האפשריים"
            icon={Wrench}
            onClick={() => setIsRepairTypesDialogOpen(true)}
          />
          <SettingCard
            title="מחירי תיקונים למעבדות"
            description="הגדר מחירים לכל מעבדה לפי סוג תיקון"
            icon={ShekelIcon}
            onClick={() => setIsLabPricesDialogOpen(true)}
          />
        </div>
      </section>

      {/* דיאלוגים (Modals) */}
      <DeviceModelsDialog
        open={isModelsDialogOpen}
        onOpenChange={setIsModelsDialogOpen}
      />
      <RepairTypesDialog
        open={isRepairTypesDialogOpen}
        onOpenChange={setIsRepairTypesDialogOpen}
      />
      <LabRepairPricesDialog
        open={isLabPricesDialogOpen}
        onOpenChange={setIsLabPricesDialogOpen}
      />
    </div>
  );
}