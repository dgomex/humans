import * as Haptics from 'expo-haptics';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, BottomSheet, Button, Icon, Text, UserRow, useToast } from '@/components';
import { avatarUrl } from '@/features/profile/avatar';
import { useTheme } from '@/theme';

import { AuthFlowError } from '../api';
import { useAuth } from '../AuthProvider';
import { MAX_LOGGED_IN_ACCOUNTS, type SavedAccount } from '../savedAccounts';

type Ctx = { open: () => void };
const SwitcherContext = createContext<Ctx | null>(null);

/**
 * Page 015 — account switcher sheet. Opened from the profile header (username ▾) or by
 * long-pressing the Profile tab.
 */
export function AccountSwitcherProvider({ children }: { children: ReactNode }) {
  const { spacing, colors } = useTheme();
  const auth = useAuth();
  const toast = useToast();
  const [visible, setVisible] = useState(false);
  const [addSheet, setAddSheet] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<SavedAccount | null>(null);

  const open = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setVisible(true);
  }, []);

  const currentId = auth.session?.user.id;
  const loggedIn = auth.accounts
    .filter((a) => a.loggedIn)
    .sort((a, b) => (a.userId === currentId ? -1 : b.userId === currentId ? 1 : 0));

  async function select(account: SavedAccount) {
    setVisible(false);
    if (account.userId === currentId) return;
    setSwitchingTo(account);
    try {
      await auth.switchAccount(account.userId);
    } catch (e) {
      toast.show(
        e instanceof AuthFlowError && e.code === 'session_expired'
          ? `Log in to ${account.username} again to switch to it.`
          : "Couldn't switch accounts. Try again.",
      );
    } finally {
      setSwitchingTo(null);
    }
  }

  async function add(intent: 'login' | 'signup') {
    setAddSheet(false);
    try {
      await auth.startAddAccount(intent);
    } catch (e) {
      toast.show(e instanceof AuthFlowError ? e.message : "Couldn't add an account.");
    }
  }

  const value = useMemo(() => ({ open }), [open]);

  return (
    <SwitcherContext.Provider value={value}>
      {children}

      <BottomSheet visible={visible} onClose={() => setVisible(false)}>
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
          {loggedIn.map((a) => (
            <UserRow
              key={a.userId}
              username={a.username}
              avatarUri={avatarUrl(a.avatarPath)}
              avatarSize={52}
              onPress={() => void select(a)}
              trailing={
                <Icon
                  name={a.userId === currentId ? 'radioOn' : 'radioOff'}
                  color={a.userId === currentId ? colors.primary : colors.textTertiary}
                />
              }
            />
          ))}
          <Pressable
            onPress={() => {
              setVisible(false);
              if (loggedIn.length >= MAX_LOGGED_IN_ACCOUNTS) {
                toast.show(`You can add up to ${MAX_LOGGED_IN_ACCOUNTS} accounts.`);
                return;
              }
              setAddSheet(true);
            }}
            accessibilityRole="button"
            style={[styles.addRow, { gap: spacing.md, paddingVertical: spacing.sm }]}
          >
            <View style={[styles.addIcon, { borderColor: colors.separator }]}>
              <Icon name="add" size={28} />
            </View>
            <Text variant="bodyBold">Add Humans account</Text>
          </Pressable>
        </View>
      </BottomSheet>

      <BottomSheet visible={addSheet} onClose={() => setAddSheet(false)} title="Add account">
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm }}>
          <Button
            title="Log into existing account"
            shape="pill"
            size="lg"
            fullWidth
            onPress={() => void add('login')}
          />
          <Button
            title="Create new account"
            variant="outline"
            shape="pill"
            size="lg"
            fullWidth
            onPress={() => void add('signup')}
          />
        </View>
      </BottomSheet>

      <Modal visible={!!switchingTo} transparent animationType="fade" statusBarTranslucent>
        <View style={[styles.switching, { backgroundColor: colors.background, gap: spacing.lg }]}>
          <Avatar uri={avatarUrl(switchingTo?.avatarPath)} size={96} />
          <Text variant="subhead">{switchingTo?.username}</Text>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      </Modal>
    </SwitcherContext.Provider>
  );
}

export function useAccountSwitcher(): Ctx {
  const ctx = useContext(SwitcherContext);
  if (!ctx) throw new Error('useAccountSwitcher must be used inside <AccountSwitcherProvider>');
  return ctx;
}

const styles = StyleSheet.create({
  addRow: { flexDirection: 'row', alignItems: 'center' },
  addIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switching: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
