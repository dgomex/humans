import { Image } from 'expo-image';
import { View } from 'react-native';

import type { Crop } from '../types';

/** Shows the `crop` window of an image filling a `width × height` frame (what will be posted). */
export function CroppedImage({
  uri,
  crop,
  width,
  height,
}: {
  uri: string;
  crop: Crop;
  width: number;
  height: number;
}) {
  const imgW = width / crop.width;
  const imgH = height / crop.height;
  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <Image
        source={{ uri }}
        style={{
          position: 'absolute',
          width: imgW,
          height: imgH,
          left: -crop.x * imgW,
          top: -crop.y * imgH,
        }}
        contentFit="fill"
        transition={0}
      />
    </View>
  );
}
