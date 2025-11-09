'use client';

import { SettingsLayout } from '@/components/shared/settings-layout';
import { ProfileSettingsCard } from '@/components/shared/profile-settings-card';
import { PasswordSettingsCard } from '@/components/shared/password-settings-card';
import { LabNotificationsCard } from '@/components/lab/lab-notifications-card';

export default function LabSettingsPage() {
  return (
    <SettingsLayout
      title="הגדרות"
      description="נהל את הגדרות הפרופיל, האבטחה וההתראות שלך."
    >
      <ProfileSettingsCard />
      <PasswordSettingsCard />
      <LabNotificationsCard />
    </SettingsLayout>
  );
}