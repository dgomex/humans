import { Image } from 'expo-image';

const logo = require('@/assets/images/logo.png');

/** The Humans app mark (pages 001–003). */
export function AppLogo({ size = 64 }: { size?: number }) {
  return (
    <Image
      source={logo}
      style={{ width: size, height: size, alignSelf: 'center' }}
      accessibilityLabel="Humans"
      accessible
    />
  );
}
