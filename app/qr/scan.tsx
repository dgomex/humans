import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useIsFocused } from 'expo-router';
import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, Text, ToastProvider, useToast } from '@/components';
import { usernameFromUrl } from '@/features/profile/format';
import { useTheme } from '@/theme';
import { goBack } from '@/lib/navigation';

/** Page 024 — scan a profile QR code; a recognized link opens that profile. */
/**
 * Full-screen modals render above the root ToastProvider on native, so this screen hosts its
 * own toast layer (otherwise its messages would be hidden behind the modal).
 */
export default function QrScanScreenRoute() {
  return (
    <ToastProvider>
      <QrScanScreen />
    </ToastProvider>
  );
}

function QrScanScreen() {
  const { spacing, radius } = useTheme();
  const toast = useToast();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);

  function onScanned(data: string) {
    if (handled.current) return;
    const username = usernameFromUrl(data);
    if (!username) {
      handled.current = true;
      toast.show("This QR code isn't a Humans profile");
      setTimeout(() => (handled.current = false), 2000);
      return;
    }
    handled.current = true;
    // Close the QR modals, then open the profile in the current tab.
    router.dismissAll();
    router.push({ pathname: '/[username]', params: { username } });
  }

  return (
    <View style={[styles.flex, { backgroundColor: '#000000' }]}>
      {permission?.granted && focused ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => onScanned(data)}
        />
      ) : null}
      <SafeAreaView edges={['top', 'bottom']} style={styles.flex}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            height: 48,
            paddingHorizontal: spacing.lg,
          }}
        >
          <Pressable
            onPress={() => goBack()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Icon name="close" size={28} color="#FFFFFF" />
          </Pressable>
          <Text
            variant="subhead"
            style={{ color: '#FFFFFF', flex: 1, textAlign: 'center', marginRight: 28 }}
          >
            Scan QR code
          </Text>
        </View>
        <View style={[styles.flex, styles.center, { gap: spacing.lg, padding: spacing.xl }]}>
          {permission && !permission.granted ? (
            <>
              <Text style={{ color: '#FFFFFF', textAlign: 'center' }}>
                Allow camera access to scan QR codes.
              </Text>
              <Button
                title={permission.canAskAgain ? 'Allow camera access' : 'Camera access is off'}
                disabled={!permission.canAskAgain}
                onPress={() => void requestPermission()}
              />
            </>
          ) : (
            <View
              style={{
                width: 240,
                height: 240,
                borderRadius: radius.xl,
                borderWidth: 3,
                borderColor: '#FFFFFF',
              }}
            />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
});
