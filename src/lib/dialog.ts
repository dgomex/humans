import { Alert, Platform, type AlertButton } from 'react-native';

/**
 * Native alert dialog (Instagram uses system dialogs for login errors etc.). React Native Web's
 * Alert is a no-op, so on web fall back to the browser's confirm/alert: the last non-cancel
 * button is the "OK" action.
 */
export function showDialog(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }
  const text = message ? `${title}\n\n${message}` : title;
  const actions = (buttons ?? []).filter((b) => b.style !== 'cancel');
  if (actions.length === 0) {
    globalThis.alert?.(text);
    return;
  }
  const primary = actions[0];
  if (globalThis.confirm?.(`${text}\n\nOK = ${primary.text}`)) primary.onPress?.();
  else (buttons ?? []).find((b) => b.style === 'cancel')?.onPress?.();
}
