import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

export type TextFieldStatus = 'idle' | 'checking' | 'valid' | 'invalid';

export type TextFieldProps = Omit<TextInputProps, 'style' | 'placeholder'> & {
  label: string;
  /** Password field with a show/hide eye. */
  secure?: boolean;
  /** Red border + message below the field. */
  error?: string | null;
  /** Gray helper text below the field (hidden while an error shows). */
  hint?: string;
  /** Trailing status indicator (e.g. username availability). */
  status?: TextFieldStatus;
  /** Show a clear (×) button while focused and non-empty. Default true for non-secure fields. */
  clearable?: boolean;
  /** Makes the field a button (e.g. birthday → date picker); the text input is not editable. */
  onPressField?: () => void;
  trailing?: ReactNode;
};

const HEIGHT = 56;

/** Instagram-style outlined field with a floating label. */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  {
    label,
    secure = false,
    error,
    hint,
    status = 'idle',
    clearable,
    onPressField,
    trailing,
    value,
    onChangeText,
    onFocus,
    onBlur,
    ...inputProps
  },
  ref,
) {
  const { colors, radius, spacing, typography, hairline } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const inputRef = useRef<TextInput>(null);
  useImperativeHandle(ref, () => inputRef.current as TextInput);
  const raised = focused || !!value;
  const progress = useSharedValue(raised ? 1 : 0);

  useEffect(() => {
    progress.set(withTiming(raised ? 1 : 0, { duration: 150 }));
  }, [raised, progress]);

  const labelStyle = useAnimatedStyle(() => ({
    top: interpolate(progress.get(), [0, 1], [18, 8]),
    fontSize: interpolate(progress.get(), [0, 1], [16, 12]),
  }));

  const showClear = (clearable ?? !secure) && focused && !!value && !onPressField;
  const borderColor = error ? colors.danger : focused ? colors.textSecondary : colors.separator;

  // Tapping anywhere on the box focuses the input (the floating label must not swallow taps).
  const field = (
    <Pressable
      onPress={onPressField ?? (() => inputRef.current?.focus())}
      accessible={!!onPressField}
      accessibilityRole={onPressField ? 'button' : undefined}
      accessibilityLabel={onPressField ? label : undefined}
      style={[
        styles.box,
        {
          height: HEIGHT,
          borderRadius: radius.lg,
          borderWidth: hairline * 2,
          borderColor,
          backgroundColor: colors.backgroundElevated,
          paddingHorizontal: spacing.lg,
        },
      ]}
    >
      <View style={styles.inputArea} pointerEvents={onPressField ? 'none' : 'auto'}>
        <Animated.Text
          numberOfLines={1}
          pointerEvents="none"
          style={[styles.label, { color: colors.textSecondary }, labelStyle]}
        >
          {label}
        </Animated.Text>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          editable={!onPressField && inputProps.editable !== false}
          secureTextEntry={secure && hidden}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.primary}
          accessibilityLabel={label}
          style={[
            typography.body,
            styles.input,
            { color: colors.text, fontSize: 16, lineHeight: undefined },
            Platform.OS === 'web' && styles.webInput,
          ]}
          {...inputProps}
        />
      </View>
      <View style={[styles.trailing, { gap: spacing.sm }]}>
        {status === 'checking' ? (
          <ActivityIndicator size="small" color={colors.textSecondary} />
        ) : null}
        {status === 'valid' ? <Icon name="checkCircle" size={22} color={colors.success} /> : null}
        {status === 'invalid' ? <Icon name="alert" size={22} color={colors.danger} /> : null}
        {showClear ? (
          <Pressable
            hitSlop={8}
            onPress={() => onChangeText?.('')}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label}`}
          >
            <Icon name="close" size={20} color={colors.textSecondary} />
          </Pressable>
        ) : null}
        {secure && !!value ? (
          <Pressable
            hitSlop={8}
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          >
            <Icon name={hidden ? 'eye' : 'eyeOff'} size={22} color={colors.textSecondary} />
          </Pressable>
        ) : null}
        {trailing}
      </View>
    </Pressable>
  );

  return (
    <View style={{ gap: spacing.xs }}>
      {field}
      {error ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="textSecondary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center' },
  inputArea: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  label: { position: 'absolute', left: 0, right: 0 },
  input: { paddingTop: 22, paddingBottom: 8, paddingHorizontal: 0 },
  trailing: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  // Browsers draw a focus outline inside our own focused border.
  webInput: { outlineStyle: 'none' } as object,
});
