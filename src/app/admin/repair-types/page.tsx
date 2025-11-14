'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Wrench, Plus, Edit, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import ShekelIcon from '@/components/ui/shekel-icon';

interface RepairType {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface Lab {
  id: string;
  full_name: string | null;
  email: string;
}

interface LabPrice {
  id: string;
  lab_id: string;
  repair_type_id: string;
  price: number;
  is_active: boolean;
  lab: Lab;
}

export default function AdminRepairTypesPage() {
  const [repairTypes, setRepairTypes] = useState<RepairType[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [selectedRepairType, setSelectedRepairType] = useState<RepairType | null>(null);
  const [labPrices, setLabPrices] = useState<LabPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewTypeDialogOpen, setIsNewTypeDialogOpen] = useState(false);
  const [isPricingDialogOpen, setIsPricingDialogOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeDescription, setNewTypeDescription] = useState('');

  const supabase = createClient();
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch repair types
      const { data: typesData, error: typesError } = await supabase
        .from('repair_types')
        .select('*')
        .order('name');

      if (typesError) throw typesError;
      setRepairTypes(typesData || []);

      // Fetch labs
      const { data: labsData, error: labsError } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'lab')
        .eq('is_active', true)
        .order('full_name');

      if (labsError) throw labsError;
      setLabs(labsData || []);
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן לטעון את הנתונים',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [supabase, toast]);

  const fetchLabPrices = async (repairTypeId: string) => {
    try {
      const { data, error } = await supabase
        .from('lab_repair_prices')
        .select(`
          *,
          lab:users!lab_repair_prices_lab_id_fkey(id, full_name, email)
        `)
        .eq('repair_type_id', repairTypeId);

      if (error) throw error;
      setLabPrices(data || []);
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון מחירים',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateRepairType = async () => {
    if (!newTypeName.trim()) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין שם לסוג התיקון',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await (supabase
        .from('repair_types') as any)
        .insert({
          name: newTypeName.trim(),
          description: newTypeDescription.trim() || null,
          is_active: true,
        });

      if (error) throw error;

      toast({
        title: 'הצלחה',
        description: 'סוג התיקון נוסף בהצלחה',
      });

      setIsNewTypeDialogOpen(false);
      setNewTypeName('');
      setNewTypeDescription('');
      fetchData();
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן ליצור סוג תיקון',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (repairType: RepairType) => {
    try {
      const { error } = await (supabase
        .from('repair_types') as any)
        .update({ is_active: !repairType.is_active })
        .eq('id', repairType.id);

      if (error) throw error;

      toast({
        title: 'הצלחה',
        description: `סוג התיקון ${repairType.is_active ? 'הושבת' : 'הופעל'} בהצלחה`,
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לעדכן את הסטטוס',
        variant: 'destructive',
      });
    }
  };

  const handleOpenPricingDialog = async (repairType: RepairType) => {
    setSelectedRepairType(repairType);
    await fetchLabPrices(repairType.id);
    setIsPricingDialogOpen(true);
  };

  const handleUpdatePrice = async (labId: string, price: string) => {
    if (!selectedRepairType) return;

    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue < 0) {
      toast({
        title: 'שגיאה',
        description: 'מחיר לא תקין',
        variant: 'destructive',
      });
      return;
    }

    try {
      const existingPrice = labPrices.find(lp => lp.lab_id === labId);

      if (existingPrice) {
        // Update existing price
        console.log('Updating existing price:', existingPrice.id, priceValue);
        const { error } = await (supabase.from('lab_repair_prices') as any).update({ 
          price: priceValue, 
          is_active: true 
        }).eq('id', existingPrice.id);

        if (error) {
          console.error('Error updating price:', error);
          throw error;
        }
      } else {
        // Insert new price
        console.log('Inserting new price for lab:', labId, 'repair type:', selectedRepairType.id, 'price:', priceValue);
        const { error } = await (supabase.from('lab_repair_prices') as any).insert({
          lab_id: labId,
          repair_type_id: selectedRepairType.id,
          price: priceValue,
          is_active: true,
        });

        if (error) {
          console.error('Error inserting price:', error);
          throw error;
        }
      }

      toast({
        title: 'הצלחה',
        description: 'המחיר עודכן בהצלחה',
      });

      await fetchLabPrices(selectedRepairType.id);
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן לעדכן את המחיר',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Wrench className="h-7 w-7 text-primary" />
            ניהול סוגי תיקונים
          </h1>
          <p className="text-muted-foreground mt-1">הגדרת סוגי תיקונים ומחירים למעבדות</p>
        </div>
        <Button onClick={() => setIsNewTypeDialogOpen(true)}>
          <Plus className="h-4 w-4 ms-2" />
          סוג תיקון חדש
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>סוגי תיקונים</CardTitle>
          <CardDescription>רשימת כל סוגי התיקונים במערכת</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם</TableHead>
                <TableHead>תיאור</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead className="text-center">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repairTypes.map((repairType) => (
                <TableRow key={repairType.id}>
                  <TableCell className="font-medium">{repairType.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {repairType.description || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={repairType.is_active ? 'default' : 'secondary'}>
                      {repairType.is_active ? 'פעיל' : 'מושבת'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2 justify-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenPricingDialog(repairType)}
                      >
                        <ShekelIcon className="h-4 w-4 ms-1" />
                        מחירים
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleActive(repairType)}
                      >
                        {repairType.is_active ? 'השבת' : 'הפעל'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* New Repair Type Dialog */}
      <Dialog open={isNewTypeDialogOpen} onOpenChange={setIsNewTypeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>סוג תיקון חדש</DialogTitle>
            <DialogDescription>הוסף סוג תיקון חדש למערכת</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">שם *</Label>
              <Input
                id="name"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="לדוגמה: החלפת מסך"
              />
            </div>
            <div>
              <Label htmlFor="description">תיאור</Label>
              <Textarea
                id="description"
                value={newTypeDescription}
                onChange={(e) => setNewTypeDescription(e.target.value)}
                placeholder="תיאור אופציונלי"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewTypeDialogOpen(false)}>
              ביטול
            </Button>
            <Button onClick={handleCreateRepairType}>שמור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pricing Dialog */}
      <Dialog open={isPricingDialogOpen} onOpenChange={setIsPricingDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>מחירים למעבדות - {selectedRepairType?.name}</DialogTitle>
            <DialogDescription>הגדר מחירים לכל מעבדה</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {labs.map((lab) => {
              const existingPrice = labPrices.find(lp => lp.lab_id === lab.id);
              return (
                <div key={lab.id} className="flex items-center gap-4 p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{lab.full_name}</div>
                    <div className="text-sm text-muted-foreground">{lab.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="מחיר"
                      defaultValue={existingPrice?.price || ''}
                      className="w-32"
                      onBlur={(e) => {
                        if (e.target.value) {
                          handleUpdatePrice(lab.id, e.target.value);
                        }
                      }}
                    />
                    <ShekelIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
