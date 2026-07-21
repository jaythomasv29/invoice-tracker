import { View, Text, TouchableOpacity, StyleSheet, Image, Modal, FlatList, useWindowDimensions } from 'react-native';

interface ImageViewerModalProps {
  visible: boolean;
  uris: string[];
  onClose: () => void;
}

// Shared full-screen pager for an invoice's original photo(s) — used both
// pre-save (local file:// URIs on the review screen) and post-save (signed
// storage URLs fetched on demand from the invoice detail screen).
export default function ImageViewerModal({ visible, uris, onClose }: ImageViewerModalProps) {
  const { width } = useWindowDimensions();
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <FlatList
          data={uris}
          horizontal
          pagingEnabled
          keyExtractor={(uri, i) => `${i}-${uri}`}
          renderItem={({ item }) => (
            <View style={{ width, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={{ uri: item }} style={{ width: width - 32, height: '80%' }} resizeMode="contain" />
            </View>
          )}
        />
        {uris.length > 1 && (
          <Text style={styles.pageCount}>{uris.length} pages · swipe to view all</Text>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,10,16,0.96)', alignItems: 'center', justifyContent: 'center' },
  closeBtn: {
    position: 'absolute', top: 56, right: 20, zIndex: 1,
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeText: { fontSize: 16, color: '#fff', fontFamily: 'Manrope_700Bold' },
  pageCount: {
    position: 'absolute', bottom: 48, alignSelf: 'center',
    fontSize: 12.5, fontFamily: 'Manrope_600SemiBold', color: 'rgba(255,255,255,0.6)',
  },
});
