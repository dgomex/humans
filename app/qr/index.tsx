import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet, Icon, Text, ToastProvider, useToast, type IconName } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileUrl } from '@/features/profile/format';
import { saveQrImage } from '@/features/profile/saveQrImage';
import { useTheme } from '@/theme';
import { goBack } from '@/lib/navigation';

/** Gradient backgrounds cycled by tapping the background (Instagram's COLOR mode). */
const GRADIENTS = [
  ['#FEDA75', '#FA7E1E', '#D62976'],
  ['#4F5BD5', '#962FBF', '#D62976'],
  ['#1CD14F', '#0BA360', '#3CBA92'],
  ['#0095F6', '#4F5BD5', '#962FBF'],
  ['#FF3040', '#FA7E1E', '#FEDA75'],
  ['#262626', '#4A4A4A', '#737373'],
] as const;

const EMOJIS = [
  '😀',
  '😍',
  '🥳',
  '😎',
  '🤩',
  '🔥',
  '✨',
  '🌈',
  '🌸',
  '🌻',
  '🍕',
  '🍩',
  '☕️',
  '🎧',
  '🎨',
  '📸',
  '⚽️',
  '🏀',
  '🎮',
  '🚀',
  '🌊',
  '🏔️',
  '🐶',
  '🐱',
  '🦋',
  '💖',
  '💯',
  '🎉',
  '🌙',
  '⭐️',
  '🍀',
  '🍓',
];

type Mode = 'color' | 'emoji';

/** Page 024 — QR code for a profile (own by default). COLOR + EMOJI backgrounds (no selfie). */
/**
 * Full-screen modals render above the root ToastProvider on native, so this screen hosts its
 * own toast layer (otherwise "Link copied" etc. would be hidden behind the modal).
 */
export default function QrScreenRoute() {
  return (
    <ToastProvider>
      <QrScreen />
    </ToastProvider>
  );
}

function QrScreen() {
  const auth = useAuth();
  const toast = useToast();
  const { spacing, radius } = useTheme();
  const params = useLocalSearchParams<{ username?: string }>();
  const username = params.username ?? auth.profile?.username ?? '';
  const url = profileUrl(username);
  const [mode, setMode] = useState<Mode>('color');
  const [gradient, setGradient] = useState(0);
  const [emoji, setEmoji] = useState('😍');
  const [picker, setPicker] = useState(false);
  const shot = useRef<View>(null);

  const colors = GRADIENTS[gradient];
  const accent = mode === 'color' ? colors[1] : '#262626';

  async function download() {
    try {
      const result = await saveQrImage(shot);
      toast.show(
        result === 'saved'
          ? 'Saved to your photos'
          : result === 'denied'
            ? 'Allow photo access in Settings to save your QR code'
            : 'Download is available in the app',
      );
    } catch {
      toast.show("Couldn't save QR code");
    }
  }

  return (
    <View style={styles.flex}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() =>
          mode === 'color' ? setGradient((g) => (g + 1) % GRADIENTS.length) : setPicker(true)
        }
        accessibilityRole="button"
        accessibilityLabel={mode === 'color' ? 'Change background color' : 'Change emoji'}
      >
        <View ref={shot} collapsable={false} style={styles.flex}>
          {mode === 'color' ? (
            <LinearGradient
              colors={colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.flex}
            />
          ) : (
            <EmojiWallpaper emoji={emoji} />
          )}
          <View style={styles.cardWrap} pointerEvents="none">
            <View style={[styles.card, { borderRadius: radius.xl, gap: spacing.md }]}>
              <QRCode value={url} size={200} color={accent} backgroundColor="#FFFFFF" ecl="M" />
              <Text variant="headline" style={{ color: accent }} numberOfLines={1}>
                {`@${username.toUpperCase()}`}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>

      <SafeAreaView edges={['top', 'bottom']} style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.top, { paddingHorizontal: spacing.lg }]}>
          <Pressable
            onPress={() => goBack()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Icon name="close" size={28} color="#FFFFFF" />
          </Pressable>
          <Pressable
            onPress={() => setMode((m) => (m === 'color' ? 'emoji' : 'color'))}
            accessibilityRole="button"
            accessibilityLabel="Switch background style"
            style={[styles.modePill, { borderRadius: radius.pill, paddingHorizontal: spacing.md }]}
          >
            <Text variant="captionBold" style={styles.white}>
              {mode === 'color' ? 'COLOR' : 'EMOJI'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/qr/scan')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Scan QR code"
          >
            <Icon name="scan" size={26} color="#FFFFFF" />
          </Pressable>
        </View>
        <View style={[styles.actions, { gap: spacing.sm, paddingHorizontal: spacing.lg }]}>
          <QrAction
            icon="sendPlane"
            label="Share profile"
            onPress={() => void Share.share({ message: url, url }).catch(() => {})}
          />
          <QrAction
            icon="link"
            label="Copy link"
            onPress={() =>
              void Clipboard.setStringAsync(url).then(() =>
                toast.show('Link copied', { duration: 2000, bottomOffset: 112 }),
              )
            }
          />
          <QrAction icon="download" label="Download" onPress={() => void download()} />
        </View>
      </SafeAreaView>

      <BottomSheet visible={picker} onClose={() => setPicker(false)} title="Choose an emoji">
        <View style={[styles.emojiGrid, { padding: spacing.lg, gap: spacing.md }]}>
          {EMOJIS.map((e) => (
            <Pressable
              key={e}
              onPress={() => {
                setEmoji(e);
                setPicker(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={e}
            >
              <Text style={styles.emojiChoice}>{e}</Text>
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

function QrAction({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const { radius, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.action, { borderRadius: radius.lg, gap: spacing.xs }]}
    >
      <Icon name={icon} size={24} color="#262626" />
      <Text variant="captionBold" style={{ color: '#262626' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function EmojiWallpaper({ emoji }: { emoji: string }) {
  return (
    <View style={[styles.flex, styles.emojiWall]}>
      {Array.from({ length: 120 }, (_, i) => (
        <Text
          key={i}
          style={[styles.emojiTile, { transform: [{ rotate: i % 2 ? '-12deg' : '12deg' }] }]}
        >
          {emoji}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48 },
  modePill: { borderWidth: 1.5, borderColor: '#FFFFFF', paddingVertical: 4 },
  white: { color: '#FFFFFF' },
  cardWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#FFFFFF', padding: 24, alignItems: 'center', maxWidth: 300 },
  actions: { flexDirection: 'row', paddingBottom: 16 },
  action: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  emojiChoice: { fontSize: 32, lineHeight: 40 },
  emojiWall: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#F2E8FF',
    overflow: 'hidden',
    justifyContent: 'center',
    alignContent: 'center',
  },
  emojiTile: { fontSize: 34, lineHeight: 52, width: 52, textAlign: 'center' },
});
