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
  DollarSign,
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
      { name: 'תשלומים', href: '/admin/payments', icon: DollarSign },
      { name: 'דוחות', href: '/admin/reports', icon: FileText },
    ],
  },
  {
    title: 'הגדרות',
    items: [
      { name: 'הגדרות כלליות', href: '/admin/settings', icon: Settings },
      { name: 'דגמי מכשירים', href: '/admin/dashboard?dialog=models', icon: Smartphone },
      { name: 'סוגי תיקונים', href: '/admin/dashboard?dialog=repair-types', icon: Wrench },
      { name: 'מחירי תיקון', href: '/admin/dashboard?dialog=lab-prices', icon: DollarSign },
    ],
  },
];

export function Sidebar() {
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
          'fixed lg:static inset-y-0 right-0 z-40 w-[280px] bg-card border-l border-border shadow-sm transition-transform duration-200 ease-in-out',
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 px-4 border-b border-border bg-gradient-to-l from-primary/10 to-transparent">
            <Image
              src="/logo.png"
              alt="לוגו"
              width={80}
              height={80}
              priority
            />
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
            {navigationSections.map((section, sectionIndex) => (
              <div key={sectionIndex}>
                {section.title && (
                  <h3 className="px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-sm'
                        )}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Icon
                          className={cn(
                            'h-5 w-5 flex-shrink-0 transition-transform group-hover:scale-110',
                            isActive && 'animate-pulse'
                          )}
                        />
                        <span className="flex-1">{item.name}</span>
                        {isActive && <ChevronRight className="h-4 w-4 flex-shrink-0" />}
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
              className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="h-5 w-5" />
              <span>התנתק</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}

