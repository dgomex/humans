import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionRow, Button, Icon, Text, ToastProvider, useToast } from '@/components';
import {
  invalidateFeeds,
  removeFromFeeds,
  useHidePost,
  usePostCard,
  useReport,
  type ReportReason,
  type ReportTarget,
} from '@/features/feed/api';
import { removeFromExplore } from '@/features/explore/api';
import { useFollowAction } from '@/features/profile/api';
import { TopBar } from '@/features/profile/components/TopBar';
import { goBack } from '@/lib/navigation';
import { useTheme } from '@/theme';

type Reason = { key: ReportReason; label: string; sub?: string[] };

/** Instagram's 2025–2026 report reasons (page 50). */
const REASONS: Reason[] = [
  { key: 'dont_like', label: "I just don't like it" },
  {
    key: 'bullying',
    label: 'Bullying or unwanted contact',
    sub: ['Me', 'Someone I know', 'Someone else'],
  },
  {
    key: 'self_injury',
    label: 'Suicide, self-injury or eating disorders',
    sub: ['Suicide or self-injury', 'Eating disorder'],
  },
  {
    key: 'violence_hate',
    label: 'Violence, hate or exploitation',
    sub: [
      'Credible threat to safety',
      'Hate speech or symbols',
      'Terrorism or organized crime',
      'Calling for violence',
      'Showing violence, death or severe injury',
      'Animal abuse',
      'Sexual exploitation',
      'Human trafficking',
    ],
  },
  {
    key: 'restricted_items',
    label: 'Selling or promoting restricted items',
    sub: ['Drugs', 'Weapons', 'Animals', 'Alcohol or tobacco', 'Other'],
  },
  {
    key: 'nudity',
    label: 'Nudity or sexual activity',
    sub: [
      'Threatening to share or sharing nude images',
      'Seems like prostitution',
      'Seems like sexual exploitation',
      'Nudity or sexual activity',
    ],
  },
  {
    key: 'scam_spam',
    label: 'Scam, fraud or spam',
    sub: ['Fraud or scam', 'Spam', 'Sharing private information'],
  },
  {
    key: 'false_information',
    label: 'False information',
    sub: ['Health', 'Politics', 'Social issue', 'Digitally created or altered'],
  },
  {
    key: 'intellectual_property',
    label: 'Intellectual property',
    sub: ['Copyright', 'Trademark', 'Counterfeit'],
  },
];

type Step =
  | { kind: 'reasons' }
  | { kind: 'sub'; reason: Reason }
  | { kind: 'dont-like' }
  | { kind: 'done'; reason: Reason };

/**
 * Page 50 — Report a post, comment or account: reason → sub-reason → submit → thanks, with
 * follow-up actions. "I just don't like it" offers Hide / Unfollow instead of filing a report.
 */
export default function ReportScreen() {
  // Presented as a native modal above the root, so it needs its own toast layer.
  return (
    <ToastProvider>
      <Report />
    </ToastProvider>
  );
}

function Report() {
  const { type, id } = useLocalSearchParams<{ type: ReportTarget; id: string }>();
  const target: ReportTarget =
    type === 'comment' ||
    type === 'profile' ||
    type === 'story' ||
    type === 'audio' ||
    type === 'hashtag'
      ? type
      : 'post';
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const report = useReport();
  const [step, setStep] = useState<Step>({ kind: 'reasons' });
  const noun = target === 'profile' ? 'account' : target;

  function submit(reason: Reason, sub?: string) {
    report.mutate(
      { targetType: target, targetId: id, reason: reason.key, subReason: sub ?? null },
      {
        onSuccess: () => setStep({ kind: 'done', reason }),
        onError: () => toast.show("Couldn't send report. Try again."),
      },
    );
  }

  const back = () => {
    if (step.kind === 'reasons' || step.kind === 'done') goBack('/');
    else setStep({ kind: 'reasons' });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar title="Report" center onBack={back} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        {step.kind === 'reasons' ? (
          <>
            <Heading
              title={`Why are you reporting this ${noun}?`}
              body="Your report is anonymous. If someone is in immediate danger, call local emergency services — don't wait."
            />
            {REASONS.map((r) => (
              <ActionRow
                key={r.key}
                label={r.label}
                trailing={<Icon name="chevronRight" size={18} color={colors.textSecondary} />}
                disabled={report.isPending}
                onPress={() =>
                  r.key === 'dont_like'
                    ? setStep({ kind: 'dont-like' })
                    : r.sub
                      ? setStep({ kind: 'sub', reason: r })
                      : submit(r)
                }
              />
            ))}
          </>
        ) : step.kind === 'sub' ? (
          <>
            <Heading title={step.reason.label} body="Choose the option that fits best." />
            {step.reason.sub?.map((s) => (
              <ActionRow
                key={s}
                label={s}
                disabled={report.isPending}
                trailing={<Icon name="chevronRight" size={18} color={colors.textSecondary} />}
                onPress={() => submit(step.reason, s)}
              />
            ))}
            {step.reason.key === 'self_injury' ? (
              <Text color="textSecondary" style={{ padding: spacing.lg }}>
                If you or someone you know is struggling, you can reach out to a local helpline or
                emergency services. You&apos;re not alone.
              </Text>
            ) : null}
          </>
        ) : step.kind === 'dont-like' ? (
          <DontLike target={target} id={id} />
        ) : (
          <Done target={target} id={id} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Heading({ title, body }: { title: string; body: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ padding: spacing.lg, gap: spacing.sm }}>
      <Text variant="headline">{title}</Text>
      <Text color="textSecondary">{body}</Text>
    </View>
  );
}

/** Follow-ups after a report: Unfollow now; Block / Restrict / Mute arrive with Settings (Phase 11). */
function FollowUps({ target, id }: { target: ReportTarget; id: string }) {
  const toast = useToast();
  const qc = useQueryClient();
  const card = usePostCard(target === 'post' ? id : undefined);
  const follow = useFollowAction();
  const author = card.data?.author;
  // Remember the follow state from when the screen opened, so the row stays after unfollowing.
  const [canUnfollow] = useState(() => !!card.data?.i_follow_author);
  const [unfollowed, setUnfollowed] = useState(false);
  const soon = (what: string) =>
    toast.show(`${what} arrives with privacy settings (Phase 11).`, { bottomOffset: 24 });
  const SOON = 'Coming soon';
  return (
    <View>
      {author && (canUnfollow || card.data?.i_follow_author) ? (
        <ActionRow
          icon="personAdd"
          label={unfollowed ? `Unfollowed ${author.username}` : `Unfollow ${author.username}`}
          detail={unfollowed ? "You won't see their posts in your feed." : undefined}
          disabled={unfollowed || follow.isPending}
          trailing={unfollowed ? <Icon name="check" size={20} /> : undefined}
          onPress={() =>
            follow.mutate(
              { userId: author.id, follow: false },
              {
                onSuccess: () => {
                  setUnfollowed(true);
                  invalidateFeeds(qc);
                },
                onError: () => toast.show("Couldn't unfollow. Try again.", { bottomOffset: 24 }),
              },
            )
          }
        />
      ) : null}
      {/* Stubs until Settings & privacy (Phase 11): muted / restricted / blocked accounts. */}
      <ActionRow
        icon="mute"
        label={author ? `Mute ${author.username}` : 'Mute'}
        detail={SOON}
        onPress={() => soon('Muting')}
      />
      <ActionRow
        icon="restrict"
        label={author ? `Restrict ${author.username}` : 'Restrict'}
        detail={SOON}
        onPress={() => soon('Restricting')}
      />
      <ActionRow
        icon="block"
        label={author ? `Block ${author.username}` : 'Block'}
        detail={SOON}
        destructive
        onPress={() => soon('Blocking')}
      />
    </View>
  );
}

function Done({ target, id }: { target: ReportTarget; id: string }) {
  const { colors, spacing } = useTheme();
  return (
    <View>
      <View style={[styles.center, { padding: spacing.xl, gap: spacing.md }]}>
        <View style={[styles.check, { borderColor: colors.success }]}>
          <Icon name="check" size={36} color={colors.success} />
        </View>
        <Text variant="headline" style={styles.text}>
          Thanks for your feedback
        </Text>
        <Text color="textSecondary" style={styles.text}>
          We&apos;ll use it to help keep the community safe.
          {target === 'story' || target === 'hashtag'
            ? ''
            : ` You won't see this ${target === 'profile' ? 'account' : target} in your feed anymore.`}
        </Text>
      </View>
      <FollowUps target={target} id={id} />
      <View style={{ padding: spacing.lg }}>
        <Button title="Done" onPress={() => goBack('/')} />
      </View>
    </View>
  );
}

function DontLike({ target, id }: { target: ReportTarget; id: string }) {
  const { spacing } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const hide = useHidePost();
  return (
    <View>
      <Heading
        title="We're sorry you saw this"
        body="Reports are for content that goes against our guidelines. Here's what you can do so you see less of it."
      />
      {target === 'post' ? (
        <ActionRow
          icon="hide"
          label="Hide this post"
          onPress={() =>
            hide.mutate(
              { postId: id, reason: 'hidden' },
              {
                onSuccess: () => {
                  removeFromFeeds(qc, id);
                  removeFromExplore(qc, id);
                  toast.show("You won't see this post in your feed anymore");
                },
              },
            )
          }
        />
      ) : null}
      <FollowUps target={target} id={id} />
      <View style={{ padding: spacing.lg }}>
        <Button title="Done" variant="secondary" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  text: { textAlign: 'center' },
  check: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
