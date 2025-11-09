
'use client';

import { SettingsLayout } from '@/components/shared/settings-layout';
import { ProfileSettingsCard } from '@/components/shared/profile-settings-card';
import { PasswordSettingsCard } from '@/components/shared/password-settings-card';
import { SystemSettingsCard } from '@/components/admin/system-settings-card';

export default function AdminSettingsPage() {
  return (
    <SettingsLayout
      title="הגדרות"
      description="נהל את הגדרות המערכת, הפרופיל האישי והאבטחה שלך."
    >
      <SystemSettingsCard />
      <ProfileSettingsCard />
      <PasswordSettingsCard />
    </SettingsLayout>
  );
}
