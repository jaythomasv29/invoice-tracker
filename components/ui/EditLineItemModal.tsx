import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Colors } from '../../constants/Colors';
import { LineItem } from '../../store/useStore';
import Spinner from './Spinner';

interface EditLineItemModalProps {
  item: LineItem | null;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (updates: { desc: string; qty: number; unitPrice: number }) => void;
}

export default function EditLineItemModal({ item, isSaving, onCancel, onSave }: EditLineItemModalProps) {
  const [desc, setDesc] = useState('');
  const [qtyStr, setQtyStr] = useState('');
  const [priceStr, setPriceStr] = useState('');

  useEffect(() => {
    if (item) {
      setDesc(item.desc);
      setQtyStr(String(item.qty));
      setPriceStr(item.unitPrice.toFixed(2));
    }
  }, [item]);

  if (!item) return null;

  const qty = parseFloat(qtyStr) || 0;
  const unitPrice = parseFloat(priceStr) || 0;
  const ext = Math.round(qty * unitPrice * 100) / 100;
  const canSave = desc.trim().length > 0 && qty > 0 && unitPrice >= 0 && !isSaving;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={isSaving ? undefined : onCancel} />
        <View style={styles.card}>
          <Text style={styles.title}>Edit item</Text>

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.input}
            value={desc}
            onChangeText={setDesc}
            placeholder="Item description"
            placeholderTextColor={Colors.textTertiary}
            editable={!isSaving}
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Quantity</Text>
              <TextInput
                style={styles.input}
                value={qtyStr}
                onChangeText={setQtyStr}
                keyboardType="decimal-pad"
                editable={!isSaving}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Unit price</Text>
              <TextInput
                style={styles.input}
                value={priceStr}
                onChangeText={setPriceStr}
                keyboardType="decimal-pad"
                editable={!isSaving}
              />
            </View>
          </View>

          <View style={styles.extRow}>
            <Text style={styles.extLabel}>New total</Text>
            <Text style={styles.extValue}>${ext.toFixed(2)}</Text>
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={isSaving} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
              onPress={() => canSave && onSave({ desc: desc.trim(), qty, unitPrice })}
              disabled={!canSave}
              activeOpacity={0.85}
            >
              {isSaving ? <Spinner size={16} color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(10,10,16,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    width: '100%', maxWidth: 360, backgroundColor: Colors.surface,
    borderRadius: 18, padding: 18, gap: 4,
  },
  title: { fontSize: 16, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, marginBottom: 8 },
  label: {
    fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 0.4,
    textTransform: 'uppercase', color: Colors.textTertiary, marginTop: 10, marginBottom: 5,
  },
  input: {
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 11,
    paddingHorizontal: 13, height: 44,
    fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: Colors.textPrimary,
  },
  row: { flexDirection: 'row', gap: 10 },

  extRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.primaryLight, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 11,
    marginTop: 16,
  },
  extLabel: { fontSize: 12.5, fontFamily: 'Manrope_700Bold', color: Colors.primaryDark },
  extValue: { fontSize: 16, fontFamily: 'Manrope_800ExtraBold', color: Colors.primaryDark },

  btnRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: 13, backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 14.5, fontFamily: 'Manrope_700Bold', color: Colors.textSecondary },
  saveBtn: {
    flex: 1, height: 48, borderRadius: 13, backgroundColor: Colors.textPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 14.5, fontFamily: 'Manrope_700Bold', color: '#fff' },
});
