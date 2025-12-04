'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  ArrowRight, 
  Building2, 
  Tag, 
  Wallet,
  AlertCircle
} from 'lucide-react';
import ShekelIcon from '@/components/ui/shekel-icon';

interface RepairType {
  id: string;
  name: string;
  description: string | null;
}

interface LabRepairPrice {
  id: string;
  lab_id: string;
  repair_type_id: string;
  price: number;
  is_active: boolean;
  notes: string | null;
  repair_types: RepairType;
}

interface Lab {
  id: string;
  full_name: string;
  email: string;
}

export default function AdminLabRepairPricingPage() {
  const params = useParams();
  const router = useRouter();
  const labId = params.id as string;

  const [lab, setLab] = useState<Lab | null>(null);
  const [repairTypes, setRepairTypes] = useState<RepairType[]>([]);
  const [labPrices, setLabPrices] = useState<LabRepairPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState<LabRepairPrice | null>(null);
  
  const [formData, setFormData] = useState({
    repair_type_id: '',
    price: '',
    notes: '',
    is_active: true
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [labRes, typesRes, pricesRes] = await Promise.all([
        fetch(`/api/admin/labs/${labId}`),
        fetch('/api/admin/repair-types'),
        fetch(`/api/admin/labs/${labId}/repair-prices`)
      ]);

      if (labRes.ok) {
        const labData = await labRes.json();
        setLab(labData);
      }

      if (typesRes.ok) {
        const types = await typesRes.json();
        setRepairTypes(types.filter((t: RepairType) => t));
      }

      if (pricesRes.ok) {
        const prices = await pricesRes.json();
        setLabPrices(prices);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [labId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    try {
      if (editingPrice) {
        // עדכון מחיר קיים
        const res = await fetch(`/api/admin/labs/${labId}/repair-prices`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingPrice.id,
            price: parseFloat(formData.price),
            is_active: formData.is_active,
            notes: formData.notes || null
          })
        });

        if (res.ok) {
          await loadData();
          closeDialog();
        }
      } else {
        // הוספת מחיר חדש
        const res = await fetch(`/api/admin/labs/${labId}/repair-prices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repair_type_id: formData.repair_type_id,
            price: parseFloat(formData.price),
            notes: formData.notes || null
          })
        });

        if (res.ok) {
          await loadData();
          closeDialog();
        }
      }
    } catch (error) {
      console.error('Error saving price:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק מחיר זה?')) return;

    try {
      const res = await fetch(`/api/admin/labs/${labId}/repair-prices?id=${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Error deleting price:', error);
    }
  };

  const openAddDialog = () => {
    setEditingPrice(null);
    setFormData({ repair_type_id: '', price: '', notes: '', is_active: true });
    setDialogOpen(true);
  };

  const openEditDialog = (price: LabRepairPrice) => {
    setEditingPrice(price);
    setFormData({
      repair_type_id: price.repair_type_id,
      price: price.price.toString(),
      notes: price.notes || '',
      is_active: price.is_active
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingPrice(null);
    setFormData({ repair_type_id: '', price: '', notes: '', is_active: true });
  };

  const availableTypes = repairTypes.filter(
    type => !labPrices.some(price => price.repair_type_id === type.id)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!lab) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-semibold">מעבדה לא נמצאה</h2>
        <Button onClick={() => router.push('/admin/labs')}>חזרה לרשימה</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <TooltipProvider>
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className="p-0 h-auto hover:bg-transparent text-muted-foreground hover:text-primary"
                onClick={() => router.push('/admin/labs')}
              >
                <ArrowRight className="h-4 w-4 ml-1" />
                חזרה למעבדות
              </Button>
            </div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="h-8 w-8 text-primary" />
              ניהול מחירון - {lab.full_name}
            </h1>
            <p className="text-muted-foreground">{lab.email} • ניהול מחירי תיקונים ספציפיים למעבדה</p>
          </div>
          
          {availableTypes.length > 0 && (
            <Button onClick={openAddDialog} className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              הוסף מחיר חדש
            </Button>
          )}
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {labPrices.map(price => (
            <Card key={price.id} className="group hover:shadow-md transition-shadow duration-200">
              <CardHeader className="flex flex-row justify-between items-start space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    {price.repair_types.name}
                  </CardTitle>
                  {price.repair_types.description && (
                    <CardDescription className="line-clamp-1">
                      {price.repair_types.description}
                    </CardDescription>
                  )}
                </div>
                <Badge variant={price.is_active ? "default" : "secondary"}>
                  {price.is_active ? 'פעיל' : 'לא פעיל'}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="mt-4 flex items-end justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">מחיר מעבדה</p>
                    <div className="flex items-baseline gap-1">
                      <ShekelIcon className="h-5 w-5 text-primary" />
                      <span className="text-2xl font-bold text-primary">{price.price.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(price)}>
                          <Pencil className="h-4 w-4 text-blue-600" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>ערוך מחיר</p></TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(price.id)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>מחק מחיר</p></TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                
                {price.notes && (
                  <div className="mt-4 pt-4 border-t text-sm text-muted-foreground bg-muted/30 p-2 rounded-md">
                    <span className="font-medium ml-1">הערות:</span>
                    {price.notes}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Empty State */}
          {labPrices.length === 0 && (
            <Card className="col-span-full border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg">אין מחירי תיקונים</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    עדיין לא הוגדרו מחירי תיקונים עבור מעבדה זו. הוסף מחירים כדי לאפשר יצירת תיקונים.
                  </p>
                </div>
                <Button onClick={openAddDialog} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  הוסף מחיר ראשון
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Dialog Form */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[425px]" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {editingPrice ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                {editingPrice ? 'עריכת מחיר תיקון' : 'הוספת מחיר חדש'}
              </DialogTitle>
              <DialogDescription>
                {editingPrice 
                  ? 'עדכן את המחיר והסטטוס עבור סוג התיקון'
                  : 'בחר סוג תיקון וקבע את המחיר למעבדה זו'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Repair Type Selection */}
              <div className="space-y-2">
                <Label>סוג תיקון</Label>
                {!editingPrice ? (
                  <Select 
                    value={formData.repair_type_id} 
                    onValueChange={(val) => setFormData({ ...formData, repair_type_id: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחר סוג תיקון..." />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      {availableTypes.map(type => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={editingPrice.repair_types.name} disabled className="bg-muted" />
                )}
              </div>

              {/* Price Input */}
              <div className="space-y-2">
                <Label>מחיר (בש״ח)</Label>
                <div className="relative">
                  <ShekelIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-10"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Notes Input */}
              <div className="space-y-2">
                <Label>הערות (אופציונלי)</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="הערות פנימיות לגבי המחיר..."
                  className="resize-none"
                  rows={3}
                />
              </div>

              {/* Active Switch */}
              {editingPrice && (
                <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <Label className="text-base">סטטוס פעיל</Label>
                    <p className="text-xs text-muted-foreground">
                      האם מחיר זה זמין לבחירה בתיקונים חדשים
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={closeDialog}>
                ביטול
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={!formData.price || (!editingPrice && !formData.repair_type_id)}
              >
                שמור שינויים
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    </div>
  );
}