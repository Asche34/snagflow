import type { AnnotationDocument } from '@snagflow/shared';
import { Image, Modal, Text, View } from 'react-native';
import { Button, styles } from './ui';
/** Browser preview deliberately avoids loading native Skia without its native runtime. */
export function MarkupEditor({
  uri,
  onCancel,
  onUseOriginal,
  fullScreen,
}: {
  uri: string;
  document: AnnotationDocument;
  onSave: (document: AnnotationDocument, flattenedUri: string) => Promise<void>;
  onCancel: () => void;
  onUseOriginal?: () => void;
  fullScreen?: boolean;
}) {
  const editor = (
    <View style={[styles.card, { flex: 1, borderRadius: 0 }]}>
      <Text accessibilityRole="header" style={styles.title}>
        Review photo
      </Text>
      <Image
        accessibilityLabel="Photo to attach"
        source={{ uri }}
        resizeMode="contain"
        style={{ flex: 1 }}
      />
      <Text style={styles.text}>
        Open the Android or iOS app to draw photo markup. You can continue with the original photo
        in this browser preview.
      </Text>
      <Button label="Continue with photo" onPress={onUseOriginal ?? onCancel} />
      {onUseOriginal && <Button label="Discard photo" secondary onPress={onCancel} />}
    </View>
  );
  return fullScreen ? (
    <Modal visible onRequestClose={onCancel}>
      {editor}
    </Modal>
  ) : (
    editor
  );
}
