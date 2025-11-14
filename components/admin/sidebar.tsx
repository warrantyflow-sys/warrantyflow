'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  Shield,
  Wrench,
  RefreshCw,
  Building2,
  Users,
  FileText,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Store,
  Tag,
  Smartphone,
} from 'lucide-react';
import ShekelIcon from '@/components/ui/shekel-icon';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

const navigationSections = [
  {
    items: [
      { name: 'לוח בקרה', href: '/admin/dashboard', icon: LayoutDashboard },
      { name: 'מכשירים', href: '/admin/devices', icon: Package },
      { name: 'אחריות', href: '/admin/warranties', icon: Shield },
      { name: 'תיקונים', href: '/admin/repairs', icon: Wrench },
      { name: 'בקשות החלפה', href: '/admin/replacements', icon: RefreshCw },
      { name: 'חנויות', href: '/admin/stores', icon: Store },
      { name: 'מעבדות', href: '/admin/labs', icon: Building2 },
      { name: 'משתמשים', href: '/admin/users', icon: Users },
      { name: 'תשלומים', href: '/admin/payments', icon: ShekelIcon },
      { name: 'דוחות', href: '/admin/reports', icon: FileText },
    ],
  },
  {
    title: 'הגדרות',
    items: [
      { name: 'הגדרות כלליות', href: '/admin/settings', icon: Settings },
      { name: 'דגמי מכשירים', href: '/admin/dashboard?dialog=models', icon: Smartphone },
      { name: 'סוגי תיקונים', href: '/admin/dashboard?dialog=repair-types', icon: Wrench },
      { name: 'מחירי תיקון', href: '/admin/dashboard?dialog=lab-prices', icon: ShekelIcon },
    ],
  },
];

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
}


export function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        className="lg:hidden fixed top-4 right-4 z-50 p-2 rounded-md bg-white dark:bg-gray-800 shadow-md border border-border"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Sidebar */}
      <div
        className={cn(
          'fixed lg:static inset-y-0 right-0 z-40 bg-card border-l border-border shadow-sm transition-all duration-300 ease-in-out', // 3. הוספת transition-all
          isMobileMenuOpen ? 'translate-x-0 w-[17.5rem]' : 'translate-x-full', // התנהגות מובייל
          'lg:translate-x-0', // תמיד מוצג בדסקטופ
          isCollapsed ? 'lg:w-20' : 'lg:w-[17.5rem]' // 4. רוחב דינמי לדסקטופ
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-border bg-gradient-to-l from-primary/10 to-transparent">
            {/* 5. הסתרת הלוגו כשהסיידבר מכווץ */}
            <div className={cn('transition-opacity', isCollapsed ? 'lg:opacity-0 lg:w-0' : 'lg:opacity-100')}>
              <Image
                src="/logo.png"
                alt="לוגו"
                width={80}
                height={80}
                priority
              />
            </div>
            
            {/* 6. כפתור לכיווץ/הרחבה (מוצג רק בדסקטופ) */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex"
            >
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
            {navigationSections.map((section, sectionIndex) => (
              <div key={sectionIndex}>
                {section.title && (
                  <h3 className={cn(
                    "px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider",
                    isCollapsed && 'lg:hidden' // 7. הסתרת כותרות סעיפים
                  )}>
                    {section.title}
                  </h3>
                )}
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          'group flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200',
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-md'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-sm',
                          isCollapsed && 'lg:justify-center' // 8. מרכוז האייקון
                        )}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Icon
                          className={cn(
                            'h-5 w-5 flex-shrink-0 transition-transform group-hover:scale-110',
                            isActive && 'animate-pulse'
                          )}
                        />
                        {/* 9. הסתרת הטקסט והחץ כשהסיידבר מכווץ */}
                        <span className={cn('flex-1', isCollapsed && 'lg:hidden')}>
                          {item.name}
                        </span>
                        {isActive && (
                          <ChevronRight className={cn('h-4 w-4 flex-shrink-0', isCollapsed && 'lg:hidden')} />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-border">
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 text-muted-foreground hover:text-foreground",
                isCollapsed && 'lg:justify-center' // 10. מרכוז כפתור התנתקות
              )}
              onClick={handleSignOut}
            >
              <LogOut className="h-5 w-5" />
              {/* 11. הסתרת טקסט התנתקות */}
              <span className={cn(isCollapsed && 'lg:hidden')}>התנתק</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile overlay (נשאר ללא שינוי) */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}

