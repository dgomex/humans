import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

import { useTheme } from '@/theme';

type IonName = ComponentProps<typeof Ionicons>['name'];
type McName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type Glyph = { set: 'ion'; name: IonName } | { set: 'mc'; name: McName };

/**
 * Semantic icon registry. Screens use these names, never glyph names directly, so a glyph can be
 * swapped (e.g. for a custom SVG) in one place. Pairs ending in `Filled` are the active state.
 */
const glyphs = {
  home: { set: 'ion', name: 'home-outline' },
  homeFilled: { set: 'ion', name: 'home' },
  search: { set: 'ion', name: 'search-outline' },
  searchFilled: { set: 'ion', name: 'search' },
  create: { set: 'mc', name: 'plus-box-outline' },
  createFilled: { set: 'mc', name: 'plus-box' },
  reels: { set: 'ion', name: 'film-outline' },
  reelsFilled: { set: 'ion', name: 'film' },
  profile: { set: 'ion', name: 'person-circle-outline' },
  profileFilled: { set: 'ion', name: 'person-circle' },
  heart: { set: 'ion', name: 'heart-outline' },
  heartFilled: { set: 'ion', name: 'heart' },
  comment: { set: 'ion', name: 'chatbubble-outline' },
  share: { set: 'ion', name: 'paper-plane-outline' },
  messenger: { set: 'mc', name: 'facebook-messenger' },
  bookmark: { set: 'ion', name: 'bookmark-outline' },
  bookmarkFilled: { set: 'ion', name: 'bookmark' },
  more: { set: 'ion', name: 'ellipsis-horizontal' },
  moreVertical: { set: 'ion', name: 'ellipsis-vertical' },
  close: { set: 'ion', name: 'close' },
  back: { set: 'ion', name: 'chevron-back' },
  forward: { set: 'ion', name: 'chevron-forward' },
  down: { set: 'ion', name: 'chevron-down' },
  camera: { set: 'ion', name: 'camera-outline' },
  settings: { set: 'ion', name: 'settings-outline' },
  menu: { set: 'ion', name: 'menu' },
  add: { set: 'ion', name: 'add' },
  check: { set: 'ion', name: 'checkmark' },
  checkCircle: { set: 'ion', name: 'checkmark-circle' },
  alert: { set: 'ion', name: 'alert-circle-outline' },
  lock: { set: 'ion', name: 'lock-closed-outline' },
  person: { set: 'ion', name: 'person' },
  eye: { set: 'ion', name: 'eye-outline' },
  eyeOff: { set: 'ion', name: 'eye-off-outline' },
  globe: { set: 'ion', name: 'globe-outline' },
  contacts: { set: 'ion', name: 'people-circle-outline' },
  image: { set: 'ion', name: 'image-outline' },
  cameraFilled: { set: 'ion', name: 'camera' },
  trash: { set: 'ion', name: 'trash-outline' },
  radioOn: { set: 'ion', name: 'radio-button-on' },
  radioOff: { set: 'ion', name: 'radio-button-off' },
  checkbox: { set: 'ion', name: 'checkbox' },
  checkboxOff: { set: 'ion', name: 'square-outline' },
  logout: { set: 'ion', name: 'log-out-outline' },
  // Phase 2 — Profile
  bell: { set: 'ion', name: 'notifications-outline' },
  bellFilled: { set: 'ion', name: 'notifications' },
  personAdd: { set: 'ion', name: 'person-add-outline' },
  personAddFilled: { set: 'ion', name: 'person-add' },
  grid: { set: 'mc', name: 'grid' },
  reposts: { set: 'ion', name: 'repeat' },
  tagged: { set: 'mc', name: 'account-box-outline' },
  link: { set: 'ion', name: 'link-outline' },
  star: { set: 'ion', name: 'star' },
  starOutline: { set: 'ion', name: 'star-outline' },
  qr: { set: 'ion', name: 'qr-code-outline' },
  scan: { set: 'ion', name: 'scan-outline' },
  copy: { set: 'ion', name: 'copy-outline' },
  download: { set: 'ion', name: 'download-outline' },
  info: { set: 'ion', name: 'information-circle-outline' },
  report: { set: 'ion', name: 'flag-outline' },
  block: { set: 'ion', name: 'ban-outline' },
  restrict: { set: 'ion', name: 'remove-circle-outline' },
  mute: { set: 'ion', name: 'volume-mute-outline' },
  hide: { set: 'ion', name: 'eye-off-outline' },
  calendar: { set: 'ion', name: 'calendar-outline' },
  history: { set: 'ion', name: 'time-outline' },
  closeFriends: { set: 'mc', name: 'star-circle' },
  addCircle: { set: 'ion', name: 'add-circle-outline' },
  carousel: { set: 'ion', name: 'copy' },
  pin: { set: 'mc', name: 'pin' },
  palette: { set: 'ion', name: 'color-palette-outline' },
  emoji: { set: 'ion', name: 'happy-outline' },
  highlight: { set: 'ion', name: 'add' },
  live: { set: 'ion', name: 'radio-outline' },
  story: { set: 'mc', name: 'plus-circle-outline' },
  post: { set: 'ion', name: 'grid-outline' },
  sendPlane: { set: 'ion', name: 'paper-plane-outline' },
  folderAdd: { set: 'ion', name: 'add' },
  chevronRight: { set: 'ion', name: 'chevron-forward' },
  // Phase 3 — Creation
  video: { set: 'ion', name: 'videocam' },
  play: { set: 'ion', name: 'play' },
  pause: { set: 'ion', name: 'pause' },
  music: { set: 'ion', name: 'musical-notes-outline' },
  musicFilled: { set: 'ion', name: 'musical-notes' },
  expand: { set: 'mc', name: 'arrow-expand' },
  collapse: { set: 'mc', name: 'arrow-collapse' },
  flashOff: { set: 'ion', name: 'flash-off' },
  flashOn: { set: 'ion', name: 'flash' },
  flashAuto: { set: 'mc', name: 'flash-auto' },
  flipCamera: { set: 'ion', name: 'camera-reverse-outline' },
  tagPerson: { set: 'ion', name: 'person-circle-outline' },
  tagPersonFilled: { set: 'ion', name: 'person-circle' },
  people: { set: 'ion', name: 'people-outline' },
  audience: { set: 'ion', name: 'eye-outline' },
  volumeOn: { set: 'ion', name: 'volume-high' },
  volumeOff: { set: 'ion', name: 'volume-mute' },
  drafts: { set: 'ion', name: 'document-text-outline' },
  archive: { set: 'mc', name: 'archive-arrow-down-outline' },
  unarchive: { set: 'mc', name: 'archive-arrow-up-outline' },
  edit: { set: 'ion', name: 'pencil-outline' },
  pinOff: { set: 'mc', name: 'pin-off-outline' },
  heartOff: { set: 'mc', name: 'heart-off-outline' },
  commentOff: { set: 'mc', name: 'comment-off-outline' },
  accessibility: { set: 'ion', name: 'accessibility-outline' },
  sliders: { set: 'ion', name: 'options-outline' },
  collab: { set: 'mc', name: 'account-multiple-plus-outline' },
  // Phase 5 — Stories
  remove: { set: 'ion', name: 'remove-circle-outline' },
  text: { set: 'mc', name: 'format-text' },
  sticker: { set: 'mc', name: 'sticker-emoji' },
  draw: { set: 'mc', name: 'draw' },
  undo: { set: 'ion', name: 'arrow-undo' },
  boomerang: { set: 'mc', name: 'infinity' },
  layout: { set: 'mc', name: 'view-grid-outline' },
  handsFree: { set: 'mc', name: 'record-circle-outline' },
  createMode: { set: 'mc', name: 'format-text-variant' },
  alignLeft: { set: 'mc', name: 'format-align-left' },
  alignCenter: { set: 'mc', name: 'format-align-center' },
  alignRight: { set: 'mc', name: 'format-align-right' },
  textBackground: { set: 'mc', name: 'format-color-fill' },
  brushPen: { set: 'mc', name: 'pen' },
  brushMarker: { set: 'mc', name: 'marker' },
  brushNeon: { set: 'mc', name: 'lightbulb-on-outline' },
  eraser: { set: 'mc', name: 'eraser' },
  poll: { set: 'mc', name: 'poll' },
  quiz: { set: 'mc', name: 'help-circle-outline' },
  question: { set: 'mc', name: 'comment-question-outline' },
  slider: { set: 'mc', name: 'tune-variant' },
  countdown: { set: 'mc', name: 'timer-outline' },
  hashtag: { set: 'mc', name: 'pound' },
  mention: { set: 'mc', name: 'at' },
  time: { set: 'mc', name: 'clock-outline' },
  addYours: { set: 'mc', name: 'plus-box-multiple-outline' },
  arrowForward: { set: 'ion', name: 'arrow-forward' },
  // Phase 6 — Reels
  speed: { set: 'mc', name: 'speedometer' },
  timer: { set: 'ion', name: 'timer-outline' },
  align: { set: 'mc', name: 'image-filter-center-focus-weak' },
  length: { set: 'mc', name: 'clock-time-four-outline' },
  mic: { set: 'ion', name: 'mic-outline' },
  micFilled: { set: 'ion', name: 'mic' },
  trim: { set: 'mc', name: 'content-cut' },
  split: { set: 'mc', name: 'call-split' },
  remix: { set: 'mc', name: 'vector-combine' },
  sideBySide: { set: 'mc', name: 'view-split-vertical' },
  pip: { set: 'mc', name: 'picture-in-picture-bottom-right' },
  sequence: { set: 'mc', name: 'arrow-right-bold-box-outline' },
  timeline: { set: 'mc', name: 'filmstrip' },
  mixer: { set: 'mc', name: 'tune-vertical' },
  undoSegment: { set: 'mc', name: 'backspace-outline' },
  cover: { set: 'mc', name: 'image-frame' },
  linkReel: { set: 'mc', name: 'link-variant-plus' },
  playCount: { set: 'ion', name: 'play-outline' },
  disc: { set: 'mc', name: 'album' },
} as const satisfies Record<string, Glyph>;

export type IconName = keyof typeof glyphs;

export type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  accessibilityLabel?: string;
};

export function Icon({ name, size = 24, color, accessibilityLabel }: IconProps) {
  const { colors } = useTheme();
  const glyph: Glyph = glyphs[name];
  const shared = {
    size,
    color: color ?? colors.icon,
    accessibilityLabel,
    accessible: !!accessibilityLabel,
  };
  return glyph.set === 'ion' ? (
    <Ionicons name={glyph.name} {...shared} />
  ) : (
    <MaterialCommunityIcons name={glyph.name} {...shared} />
  );
}
