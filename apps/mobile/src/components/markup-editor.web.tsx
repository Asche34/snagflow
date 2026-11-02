import type { AnnotationDocument } from '@snagflow/shared';
import { Text, View } from 'react-native';
import { Button, styles } from './ui';
/** Browser preview deliberately avoids loading native Skia without its native runtime. */
export function MarkupEditor({
  onCancel,
}: {
  uri: string;
  document: AnnotationDocument;
  onSave: (document: AnnotationDocument, flattenedUri: string) => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.text}>
        Open the Android or iOS app to draw photo markup. You can continue with the original photo
        in this browser preview.
      </Text>
      <Button label="Continue with photo" secondary onPress={onCancel} />
    </View>
  );
}
