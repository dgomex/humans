# Page 007 — Sign up: birthday

- **Phase:** 1 — Onboarding & Authentication
- **Status:** Verifying (built; on-device check pending)
- **Route:** `app/(auth)/signup/birthday.tsx`
- **Depends on:** page 6

## 1. Research (current Instagram behavior)
### Layout
- Title "What's your birthday?". Text: "Use your own birthday, even if this account is for a business, a pet or something else. No one will see this unless you choose to share it." A link "Why do I need to provide my birthday?" opens an explanation sheet.
- A read-only field "Birthday ({n} years old)" opens a date picker: an inline wheel at the bottom on iOS, a calendar dialog on Android.
- "Next".

### Entry & exit points
- Password → birthday → name.

### Features & interactions
- [ ] Date picker with a sensible default (no preselected real date; the field starts empty).
- [ ] Live age shown in the label.
- [ ] Age confirmation dialog: "You're {n}?" ("Confirm" or "Edit").
- [ ] Under 13: "You can't sign up for Instagram" and the sign-up is blocked.
- [ ] 13–17: account created as a **teen account** (private by default, restricted DMs). Settings for this belong to Phase 11.

### States
- Error: an empty date or a future date keeps Next disabled.
- Edge cases: unrealistic ages (over 120) are rejected.

### Sources
- [Create a new Instagram profile – Instagram Help](https://help.instagram.com/155940534568753) ("Use your own birthday…").

## 2. User decision
- **Choice:** Changes
- **Changes requested:** Block under-13s only. **No teen accounts**: every account gets the same features (no is_teen flag, no teen defaults).
- **Date:** 2026-10-07

## 3. Data & storage
- `account_private.birthday date` is **owner-only** (never on `profiles`, which is publicly readable). A check constraint enforces age ≥ 13 at completion.

## 4. Implementation notes
- `@react-native-community/datetimepicker` (`npx expo install`).

## 5. Acceptance checklist
- [ ] Matches agreed feature list on Android
- [ ] Matches agreed feature list on iOS
- [ ] Light + dark mode
- [ ] RLS tested with two users (birthday unreadable by user B)
- [ ] Supabase advisors clean
