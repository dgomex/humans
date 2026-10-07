import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { BottomSheet, Button, Text, TextField } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { AuthStep } from '@/features/auth/components/AuthStep';
import { ageFrom, toIsoDate, useSignupDraft } from '@/features/onboarding/SignupDraft';
import { showDialog } from '@/lib/dialog';
import { useTheme } from '@/theme';

const MIN_AGE = 13;

/** Page 007 — What's your birthday? (under-13s are blocked; no teen accounts). */
export default function BirthdayScreen() {
  const { spacing } = useTheme();
  const auth = useAuth();
  const draft = useSignupDraft();
  const [date, setDate] = useState<Date | null>(
    draft.birthday ? new Date(`${draft.birthday}T12:00:00`) : null,
  );
  const [iosPicker, setIosPicker] = useState(false);
  const [whySheet, setWhySheet] = useState(false);
  const [webText, setWebText] = useState(draft.birthday ?? '');

  const today = new Date();
  const iso =
    Platform.OS === 'web'
      ? /^\d{4}-\d{2}-\d{2}$/.test(webText)
        ? webText
        : null
      : date
        ? toIsoDate(date)
        : null;
  const age = iso ? ageFrom(iso) : null;
  const valid = age !== null && age >= 0 && age <= 120 && iso! <= toIsoDate(today);

  function openPicker() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date ?? today,
        mode: 'date',
        maximumDate: today,
        onChange: (_e, d) => d && setDate(d),
      });
    } else {
      setIosPicker(true);
    }
  }

  function next() {
    if (!valid || !iso || age === null) return;
    if (age < MIN_AGE) {
      showDialog(
        "You can't sign up for Humans",
        'You need to be at least 13 years old to create an account.',
        [{ text: 'OK', onPress: () => void auth.logout() }],
      );
      return;
    }
    draft.update({ birthday: iso });
    router.push('/name');
  }

  return (
    <AuthStep
      title="What's your birthday?"
      subtitle={
        <Text>
          {
            'Use your own birthday, even if this account is for a business, a pet or something else. No one will see this unless you choose to share it. '
          }
          <Text color="primary" onPress={() => setWhySheet(true)} accessibilityRole="link">
            Why do I need to provide my birthday?
          </Text>
        </Text>
      }
    >
      {Platform.OS === 'web' ? (
        <TextField
          label={age !== null && valid ? `Birthday (${age} years old)` : 'Birthday (YYYY-MM-DD)'}
          value={webText}
          onChangeText={setWebText}
          autoFocus
        />
      ) : (
        <TextField
          label={age !== null ? `Birthday (${age} years old)` : 'Birthday'}
          value={
            date
              ? date.toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              : ''
          }
          onPressField={openPicker}
        />
      )}
      <Button title="Next" shape="pill" size="lg" fullWidth disabled={!valid} onPress={next} />

      {Platform.OS === 'ios' && iosPicker ? (
        <View style={{ alignItems: 'center' }}>
          <DateTimePicker
            value={date ?? today}
            mode="date"
            display="spinner"
            maximumDate={today}
            onChange={(_e, d) => d && setDate(d)}
          />
        </View>
      ) : null}

      <BottomSheet visible={whySheet} onClose={() => setWhySheet(false)} title="Birthdays">
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Text>
            {
              'Providing your birthday helps make sure you get the right Humans experience for your age. You need to be at least 13 to use Humans.'
            }
          </Text>
          <Text color="textSecondary">{"Your birthday won't be part of your public profile."}</Text>
        </View>
      </BottomSheet>
    </AuthStep>
  );
}
