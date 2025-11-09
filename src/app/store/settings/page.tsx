
'use client';

import { SettingsLayout } from '@/components/shared/settings-layout';
import { ProfileSettingsCard } from '@/components/shared/profile-settings-card';
import { PasswordSettingsCard } from '@/components/shared/password-settings-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function StoreSettingsPage() {
  return (
    <SettingsLayout
      title="הגדרות"
      description="נהל את הגדרות החנות, הפרופיל האישי והאבטחה שלך."
    >
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2" style={{ direction: 'rtl' }}>
          <TabsTrigger value="profile">פרופיל</TabsTrigger>
          <TabsTrigger value="security">אבטחה</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <ProfileSettingsCard />
        </TabsContent>
        <TabsContent value="security">
          <PasswordSettingsCard />
        </TabsContent>
      </Tabs>
    </SettingsLayout>
  );
}
