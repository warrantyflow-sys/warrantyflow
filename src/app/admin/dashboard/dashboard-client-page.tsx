'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
  FileBarChart
} from 'lucide-react';

type ActiveDialog = 'models' | 'repair-types' | 'lab-prices' | null;

export default function AdminDashboard() {
  const { stats, isFetching, isError } = useAdminDashboardStats();
  const { user, isLoading: isUserLoading } = useCurrentUser();
  
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);

  useEffect(() => {
    const dialogParam = searchParams.get('dialog');
    if (dialogParam === 'models' || dialogParam === 'repair-types' || dialogParam === 'lab-prices') {
      setActiveDialog(dialogParam as ActiveDialog);
    } else {
      setActiveDialog(null);
    }
  }, [searchParams]);

  const handleCloseDialog = (isOpen: boolean) => {
    if (!isOpen) {
      setActiveDialog(null);
      router.push('/admin/dashboard', { scroll: false });
    }
  };

  const handleOpenDialog = (dialogName: ActiveDialog) => {
    if (dialogName) {
      router.push(`/admin/dashboard?dialog=${dialogName}`, { scroll: false });
    }
  };

  const quickLinks = [
    { title: "ניהול משתמשים", description: "צפייה ועריכת משתמשי מערכת", icon: Users, href: "/admin/users", color: "blue" },
    { title: "ניהול מכשירים", description: "מאגר המכשירים והאחריויות", icon: Smartphone, href: "/admin/devices", color: "indigo" },
    { title: "תיקונים", description: "מעקב וניהול סטטוס תיקונים", icon: Wrench, href: "/admin/repairs", color: "orange" },
    { title: "דוחות", description: "דוחות פעילות ומלאי", icon: FileBarChart, href: "/admin/reports", color: "green" }
  ];

  const settingsCards = [
    { 
      title: "ניהול דגמים", 
      description: "הוסף וערוך דגמי מכשירים ומשך אחריות", 
      icon: Smartphone, 
      action: () => handleOpenDialog('models') 
    },
    { 
      title: "סוגי תיקונים", 
      description: "נהל את רשימת סוגי התיקונים האפשריים", 
      icon: Wrench, 
      action: () => handleOpenDialog('repair-types') 
    },
    { 
      title: "מחירי תיקונים למעבדות", 
      description: "הגדר מחירים לכל מעבדה לפי סוג תיקון", 
      icon: ShekelIcon, 
      action: () => handleOpenDialog('lab-prices') 
    }
  ];

  const statCards = [
    { title: 'סה"כ מכשירים', value: stats.total, icon: Smartphone, color: 'blue', bg: 'bg-blue-100', text: 'text-blue-600' },
    { title: 'חדשים במלאי', value: stats.new, icon: Package, color: 'green', bg: 'bg-green-100', text: 'text-green-600' },
    { title: 'אחריות פעילה', value: stats.active, icon: Shield, color: 'emerald', bg: 'bg-emerald-100', text: 'text-emerald-600' },
    { title: 'פגי תוקף', value: stats.expired, icon: XCircle, color: 'red', bg: 'bg-red-100', text: 'text-red-600' },
    { title: 'הוחלפו', value: stats.replaced, icon: RefreshCw, color: 'purple', bg: 'bg-purple-100', text: 'text-purple-600' },
    { title: 'בתיקון', value: stats.inRepair, icon: Wrench, color: 'orange', bg: 'bg-orange-100', text: 'text-orange-600' },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <BackgroundRefreshIndicator isFetching={isFetching} />

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isUserLoading ? 'טוען...' : (user?.full_name ? `שלום, ${user.full_name}` : 'לוח בקרה')}
          </h1>
          <p className="text-muted-foreground">
            סקירה כללית וניהול המערכת
          </p>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((stat, index) => (
          <Card key={index} className={`border-r-4 border-r-${stat.color}-500 shadow-sm`}>
            <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
              <div className={`h-8 w-8 rounded-full ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`h-4 w-4 ${stat.text}`} />
              </div>
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isError ? "-" : stats[Object.keys(stats)[index] as keyof typeof stats] ?? stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Links Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4">קיצורי דרך</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link, index) => (
            <QuickLinkCard
              key={index}
              title={link.title}
              description={link.description}
              icon={link.icon}
              href={link.href}
              color={link.color}
            />
          ))}
        </div>
      </section>

      {/* Settings Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4">הגדרות מערכת</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {settingsCards.map((card, index) => (
            <SettingCard
              key={index}
              title={card.title}
              description={card.description}
              icon={card.icon}
              onClick={card.action}
            />
          ))}
        </div>
      </section>

      <DeviceModelsDialog
        open={activeDialog === 'models'}
        onOpenChange={handleCloseDialog}
      />
      <RepairTypesDialog
        open={activeDialog === 'repair-types'}
        onOpenChange={handleCloseDialog}
      />
      <LabRepairPricesDialog
        open={activeDialog === 'lab-prices'}
        onOpenChange={handleCloseDialog}
      />
    </div>
  );
}