import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { Text } from './Text';

export type ToastOptions = {
  /** Optional trailing action, e.g. "View" / "Undo". */
  actionLabel?: string;
  onAction?: () => void;
  /** Milliseconds before auto-dismiss. Default 3000. */
  duration?: number;
  /** Extra distance from the bottom safe area (e.g. to clear the tab bar). Default 56. */
  bottomOffset?: number;
};

type ToastState = ToastOptions & { id: number; message: string };

type ToastContextValue = {
  show: (message: string, options?: ToastOptions) => void;
  hide: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** Single-slot snackbar: a new toast replaces the current one. Mount once near the root. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback(
    (message: string, options: ToastOptions = {}) => {
      if (timer.current) clearTimeout(timer.current);
      nextId.current += 1;
      setToast({ ...options, message, id: nextId.current });
      timer.current = setTimeout(hide, options.duration ?? 3000);
    },
    [hide],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const value = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} onDismiss={hide} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[
        StyleSheet.absoluteFill,
        styles.container,
        {
          paddingBottom: insets.bottom + (toast.bottomOffset ?? 56),
          paddingHorizontal: spacing.md,
        },
      ]}
    >
      <Animated.View
        entering={FadeInDown.duration(200)}
        exiting={FadeOutDown.duration(150)}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[
          styles.toast,
          {
            backgroundColor: colors.toastBackground,
            borderRadius: radius.lg,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
          },
        ]}
      >
        <Pressable onPress={onDismiss} style={styles.message}>
          <Text style={{ color: colors.toastText }} numberOfLines={2}>
            {toast.message}
          </Text>
        </Pressable>
        {toast.actionLabel ? (
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            onPress={() => {
              toast.onAction?.();
              onDismiss();
            }}
          >
            <Text variant="bodyBold" color="primary">
              {toast.actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

const styles = StyleSheet.create({
  container: { justifyContent: 'flex-end' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  message: { flex: 1 },
});
