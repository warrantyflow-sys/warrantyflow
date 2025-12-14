'use client';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLabPricingData } from '@/hooks/queries/useRepairTypes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import ShekelIcon from '@/components/ui/shekel-icon';

export default function RepairPricingPage() {
  const { user } = useCurrentUser();
  const labId = user?.id || null;

  const { 
    pricingData: labPrices, 
    isLoading: loading, 
    refetch 
  } = useLabPricingData(labId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            מחירי תיקונים
          </h1>
          <p className="text-muted-foreground mt-1">רשימת סוגי התיקונים והמחירים המאושרים</p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={loading}
          className="flex-1 sm:flex-none"
        >
          רענן
          <RefreshCw className={cn("h-4 w-4 ms-2", loading && "animate-spin")} />
        </Button>
      </div>

      {(!labPrices || labPrices.length === 0) ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">אין מחירי תיקונים זמינים</p>
            <p className="text-sm mt-1">המנהל טרם הגדיר מחירים עבור המעבדה שלך</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* מחירים פעילים */}
          {(labPrices as any[])
            .filter(price => price.is_active)
            .map(price => (
              <Card key={price.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{price.repair_types?.name || 'שם חסר'}</CardTitle>
                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                      פעיל
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {price.repair_types?.description && (
                    <p className="text-sm text-muted-foreground">
                      {price.repair_types.description}
                    </p>
                  )}
                  <div className="pt-2 border-t">
                    <div className="flex items-baseline gap-1">
                      <ShekelIcon className="h-6 w-6 text-primary inline-block mb-1" />
                      <span className="text-3xl font-bold text-primary">
                        {Number(price.price).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  {price.notes && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">הערות:</span> {price.notes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* מחירים לא פעילים */}
      {(labPrices as any[]).some(price => !price.is_active) && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4 text-muted-foreground">מחירים לא פעילים</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(labPrices as any[])
              .filter(price => !price.is_active)
              .map(price => (
                <Card key={price.id} className="opacity-60">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg">{price.repair_types?.name}</CardTitle>
                      <Badge variant="secondary" className="bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                        לא פעיל
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {price.repair_types?.description && (
                      <p className="text-sm text-muted-foreground">
                        {price.repair_types.description}
                      </p>
                    )}
                    <div className="pt-2 border-t">
                      <div className="flex items-baseline gap-1">
                        <ShekelIcon className="h-6 w-6 text-muted-foreground inline-block mb-1" />
                        <span className="text-3xl font-bold text-muted-foreground">
                          {Number(price.price).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    {price.notes && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">הערות:</span> {price.notes}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}