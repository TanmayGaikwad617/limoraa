import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { fetchBillingPlan } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../theme';

const REVENUECAT_CONFIGURED = !!process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;

const PLAN_DESCRIPTIONS: Record<string, string> = {
  free: 'Private by default. Save videos, organize collections, and unlock AI insights.',
  pro: 'Unlimited saves, AI analysis, smart collections, advanced search, and priority processing.',
};

const PRO_FEATURES = [
  'Unlimited saves',
  'Unlimited AI analyses',
  'Smart collections',
  'Advanced search',
  'Semantic discovery',
  'Priority processing',
];

const SETTINGS_ROWS = [
  { label: 'Account', icon: 'user' as const },
  { label: 'Notifications', icon: 'bell' as const },
  { label: 'Privacy', icon: 'lock' as const },
  { label: 'Help & Support', icon: 'help-circle' as const },
  { label: 'Terms of Service', icon: 'file-text' as const },
  { label: 'Privacy Policy', icon: 'shield' as const },
];

function getInitials(userEmail: string | undefined): string {
  if (!userEmail) return '?';
  return userEmail.charAt(0).toUpperCase();
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function ProfileScreen() {
  const { user, signOut } = useAuth();

  const [planData, setPlanData] = useState<{
    plan: string;
    saveCount: number;
    saveLimit: number;
    aiCount: number;
    aiLimit: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchBillingPlan()
      .then((res) => {
        if (cancelled) return;
        const p = res.profile;
        setPlanData(
          p
            ? {
                plan: p.plan,
                saveCount: p.monthly_save_count,
                saveLimit: p.monthly_save_limit,
                aiCount: p.monthly_ai_count,
                aiLimit: p.monthly_ai_limit,
              }
            : { plan: 'free', saveCount: 0, saveLimit: 0, aiCount: 0, aiLimit: 0 },
        );
      })
      .catch(() => {
        if (!cancelled) {
          setPlanData({ plan: 'free', saveCount: 0, saveLimit: 0, aiCount: 0, aiLimit: 0 });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch {
            Alert.alert('Error', 'Failed to sign out');
          }
        },
      },
    ]);
  }, [signOut]);

  const handleUpgrade = useCallback(() => {
    if (!REVENUECAT_CONFIGURED) {
      Alert.alert(
        'Billing not configured yet',
        'Subscription purchasing is not yet available. This will be connected to RevenueCat in a future update.',
      );
      return;
    }
    // TODO: Launch RevenueCat paywall/purchase flow
    // When RevenueCat is integrated, this should call:
    //   Purchases.purchaseProduct('pro_monthly')
    //   or Purchases.purchasePackage(offering)
    Alert.alert('Upgrade', 'RevenueCat paywall will launch here.');
  }, []);

  const handleSetting = useCallback((label: string) => {
    Alert.alert(label, 'This setting is not yet available.');
  }, []);

  const plan = planData?.plan ?? 'free';
  const isPro = plan === 'pro';
  const displayName = user?.user_metadata?.full_name as string | undefined;
  const initials = displayName ? displayName.charAt(0).toUpperCase() : getInitials(user?.email);
  const email = user?.email ?? '';
  const planDescription = isPro ? PLAN_DESCRIPTIONS.pro : PLAN_DESCRIPTIONS.free;

  const savePct = planData && planData.saveLimit > 0 ? Math.min(Math.round((planData.saveCount / planData.saveLimit) * 100), 100) : 0;
  const aiPct = planData && planData.aiLimit > 0 ? Math.min(Math.round((planData.aiCount / planData.aiLimit) * 100), 100) : 0;
  const saveRemaining = planData ? Math.max(planData.saveLimit - planData.saveCount, 0) : 0;
  const aiRemaining = planData ? Math.max(planData.aiLimit - planData.aiCount, 0) : 0;

  if (loading) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.skeletonCard}>
          <View style={styles.skeletonRow}>
            <View style={styles.skeletonAvatar} />
            <View style={{ flex: 1, gap: 8 }}>
              <View style={styles.skeletonLineWide} />
              <View style={styles.skeletonLineNarrow} />
            </View>
          </View>
        </View>
        <View style={styles.skeletonCard}>
          <View style={styles.skeletonLineWide} />
          <View style={[styles.skeletonLineFull, { marginTop: 16 }]} />
        </View>
        <View style={styles.skeletonCard}>
          <View style={styles.skeletonLineWide} />
          <View style={[styles.skeletonLineFull, { marginTop: 16 }]} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      {/* Profile Header */}
      <View style={styles.profileCard}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            {displayName ? <Text style={styles.displayName}>{displayName}</Text> : null}
            <Text style={styles.email}>{email}</Text>
            <View style={styles.planBadgeRow}>
              <View style={[styles.planBadge, isPro && styles.planBadgePro]}>
                <Text style={[styles.planBadgeText, isPro && styles.planBadgeTextPro]}>
                  {isPro ? 'Pro' : 'Free'}
                </Text>
              </View>
            </View>
          </View>
        </View>
        <Text style={styles.planDescription}>{planDescription}</Text>
      </View>

      {/* Usage Section */}
      {planData ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Usage</Text>

          <View style={styles.usageCard}>
            <View style={styles.usageHeader}>
              <Feather name="download" size={14} color={theme.colors.secondary} />
              <Text style={styles.usageLabel}>Monthly Saves</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${savePct}%` }]} />
            </View>
            <View style={styles.usageFooter}>
              <Text style={styles.usageStat}>
                {formatNumber(planData.saveCount)} / {formatNumber(planData.saveLimit)} used
              </Text>
              <Text style={styles.usageStat}>{savePct}%</Text>
            </View>
            {saveRemaining > 0 ? (
              <Text style={styles.remainingText}>{formatNumber(saveRemaining)} remaining</Text>
            ) : (
              <Text style={[styles.remainingText, { color: theme.colors.danger }]}>Limit reached</Text>
            )}
          </View>

          <View style={styles.usageCard}>
            <View style={styles.usageHeader}>
              <Feather name="cpu" size={14} color={theme.colors.secondary} />
              <Text style={styles.usageLabel}>Monthly AI Analyses</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${aiPct}%` }]} />
            </View>
            <View style={styles.usageFooter}>
              <Text style={styles.usageStat}>
                {formatNumber(planData.aiCount)} / {formatNumber(planData.aiLimit)} used
              </Text>
              <Text style={styles.usageStat}>{aiPct}%</Text>
            </View>
            {aiRemaining > 0 ? (
              <Text style={styles.remainingText}>{formatNumber(aiRemaining)} remaining</Text>
            ) : (
              <Text style={[styles.remainingText, { color: theme.colors.danger }]}>Limit reached</Text>
            )}
          </View>
        </View>
      ) : null}

      {/* Premium Upsell */}
      {!isPro ? (
        <View style={styles.upsellCard}>
          <View style={styles.upsellHeader}>
            <Feather name="zap" size={16} color={theme.colors.text} />
            <Text style={styles.upsellTitle}>Pro Features</Text>
          </View>

          <View style={styles.featureList}>
            {PRO_FEATURES.map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <Feather name="check" size={14} color={theme.colors.secondary} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          <Pressable style={styles.upgradeButton} onPress={handleUpgrade}>
            <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
          </Pressable>

          {!REVENUECAT_CONFIGURED ? (
            <Text style={styles.billingNote}>Billing not configured yet</Text>
          ) : null}
        </View>
      ) : null}

      {/* Settings */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Settings</Text>
        {SETTINGS_ROWS.map((row) => (
          <Pressable
            key={row.label}
            style={styles.settingRow}
            onPress={() => handleSetting(row.label)}
          >
            <View style={styles.settingLeft}>
              <Feather name={row.icon} size={16} color={theme.colors.text} />
              <Text style={styles.settingLabel}>{row.label}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={theme.colors.tertiary} />
          </Pressable>
        ))}
      </View>

      {/* Sign Out */}
      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <Feather name="log-out" size={16} color={theme.colors.danger} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 120,
    gap: 16,
  },

  // Skeleton
  skeletonCard: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 12,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.skeleton,
  },
  skeletonLineWide: {
    height: 14,
    borderRadius: 4,
    backgroundColor: theme.colors.skeleton,
    width: '60%',
  },
  skeletonLineNarrow: {
    height: 12,
    borderRadius: 4,
    backgroundColor: theme.colors.skeleton,
    width: '35%',
  },
  skeletonLineFull: {
    height: 12,
    borderRadius: 4,
    backgroundColor: theme.colors.skeleton,
    width: '100%',
  },

  // Profile Header
  profileCard: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
  profileRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: theme.colors.card,
    fontSize: 20,
    fontWeight: '700',
  },
  displayName: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  email: {
    color: theme.colors.secondary,
    fontSize: 13,
    marginTop: 2,
  },
  planBadgeRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  planBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.cardSoft,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  planBadgePro: {
    backgroundColor: theme.colors.text,
    borderColor: theme.colors.text,
  },
  planBadgeText: {
    color: theme.colors.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  planBadgeTextPro: {
    color: theme.colors.card,
  },
  planDescription: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 14,
  },

  // Card
  card: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },

  // Usage
  usageCard: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.cardSoft,
    padding: 14,
    marginBottom: 10,
  },
  usageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  usageLabel: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.border,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: theme.colors.accent,
  },
  usageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  usageStat: {
    color: theme.colors.secondary,
    fontSize: 12,
  },
  remainingText: {
    color: theme.colors.muted,
    fontSize: 11,
    marginTop: 4,
  },

  // Upsell
  upsellCard: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    padding: 16,
  },
  upsellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  upsellTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  featureList: {
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    color: theme.colors.text,
    fontSize: 14,
  },
  upgradeButton: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.text,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  upgradeButtonText: {
    color: theme.colors.card,
    fontSize: 16,
    fontWeight: '700',
  },
  billingNote: {
    color: theme.colors.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
  },

  // Settings
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingLabel: {
    color: theme.colors.text,
    fontSize: 15,
  },

  // Sign Out
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
  signOutText: {
    color: theme.colors.danger,
    fontSize: 15,
    fontWeight: '600',
  },
});
