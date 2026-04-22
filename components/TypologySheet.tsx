// TypologySheet.tsx
// Bottom sheet per selezionare tipologia casa + camere + bagni + mq.
// Stile allineato a lib/theme.ts (Fresh Luxe).
//
// Uso:
//   <TypologySheet
//     visible={sheetOpen}
//     onClose={() => setSheetOpen(false)}
//     value={{ typology: 'trilocale', bedrooms: 2, bathrooms: 1, sqm: '85' }}
//     onChange={setValue}
//   />

import React from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, ScrollView,
  TextInput, Platform, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../lib/theme';

const TYPOLOGIES = [
  { id: 'monolocale',   label: 'Monolocale',   sub: '1 ambiente',   icon: 'home-outline' },
  { id: 'bilocale',     label: 'Bilocale',     sub: '1 camera',     icon: 'home-outline' },
  { id: 'trilocale',    label: 'Trilocale',    sub: '2 camere',     icon: 'home-outline' },
  { id: 'quadrilocale', label: 'Quadrilocale', sub: '3 camere',     icon: 'home-outline' },
  { id: '5locali',      label: '5 locali',     sub: 'Grande',       icon: 'home-outline' },
  { id: '6locali',      label: '6 locali',     sub: 'Molto grande', icon: 'home-outline' },
  { id: '7locali',      label: '7+ locali',    sub: 'Villa/attico', icon: 'home-outline' },
] as const;

export type TypologyValue = {
  typology: string;
  bedrooms: number;
  bathrooms: number;
  sqm: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  value: TypologyValue;
  onChange: (v: TypologyValue) => void;
};

// ── StyleSheet declared before component to avoid Hermes TDZ issues ──
const { height: WIN_H } = Dimensions.get('window');

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,36,32,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: WIN_H * 0.9,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 24, shadowOffset: { width: 0, height: -6 } },
      android: { elevation: 12 },
    }),
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.borderLight,
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  optional: {
    textTransform: 'none',
    color: Colors.textTertiary,
    fontWeight: '600',
  },

  // tipologia grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeCard: {
    width: '48%',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  typeCardOn: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 8,
  },
  typeLabelOn: { color: '#fff' },
  typeSub: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  typeSubOn: { color: 'rgba(255,255,255,0.85)' },

  // stepper
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  stepBtnDisabled: {
    opacity: 0.4,
  },
  stepValue: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: -0.6,
    minWidth: 60,
    textAlign: 'center',
  },

  // sqm
  sqmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    paddingHorizontal: 14,
    height: 48,
  },
  sqmInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 0,
  },
  sqmUnit: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textTertiary,
  },
  sqmQuickRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  sqmChip: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sqmChipOn: {
    borderColor: Colors.primary,
    backgroundColor: Colors.accentLight,
  },
  sqmChipTxt: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  sqmChipTxtOn: {
    color: Colors.primary,
  },

  // footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  saveBtn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveTxt: {
    fontSize: 15,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
  },
});

// ── Sub-component: Stepper ──
function Stepper({
  value, onChange, min, max,
}: { value: number; onChange: (n: number) => void; min: number; max: number }) {
  return (
    <View style={styles.stepper}>
      <Pressable
        style={[styles.stepBtn, value <= min && styles.stepBtnDisabled]}
        onPress={() => onChange(value - 1)}
        disabled={value <= min}
        hitSlop={8}
      >
        <Ionicons name="remove" size={22} color={value <= min ? Colors.textTertiary : Colors.text} />
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable
        style={[styles.stepBtn, value >= max && styles.stepBtnDisabled]}
        onPress={() => onChange(value + 1)}
        disabled={value >= max}
        hitSlop={8}
      >
        <Ionicons name="add" size={22} color={value >= max ? Colors.textTertiary : Colors.text} />
      </Pressable>
    </View>
  );
}

// ── Main component ──
export default function TypologySheet({ visible, onClose, value, onChange }: Props) {
  const setTypology = (id: string) => onChange({ ...value, typology: id });
  const setBedrooms = (n: number) => onChange({ ...value, bedrooms: Math.max(0, Math.min(10, n)) });
  const setBathrooms = (n: number) => onChange({ ...value, bathrooms: Math.max(1, Math.min(6, n)) });
  const setSqm = (s: string) => onChange({ ...value, sqm: s.replace(/\D/g, '') });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        {/* Grabber */}
        <View style={styles.grabber} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Dettagli casa</Text>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={18} color={Colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Tipologia grid */}
          <Text style={styles.sectionLabel}>Tipologia</Text>
          <View style={styles.grid}>
            {TYPOLOGIES.map(t => {
              const on = value.typology === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTypology(t.id)}
                  style={[styles.typeCard, on && styles.typeCardOn]}
                >
                  <Ionicons
                    name={t.icon as keyof typeof Ionicons.glyphMap}
                    size={18}
                    color={on ? '#fff' : Colors.text}
                  />
                  <Text style={[styles.typeLabel, on && styles.typeLabelOn]}>{t.label}</Text>
                  <Text style={[styles.typeSub, on && styles.typeSubOn]}>{t.sub}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Stepper camere */}
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Camere da letto</Text>
          <Stepper value={value.bedrooms} onChange={setBedrooms} min={0} max={10} />

          {/* Stepper bagni */}
          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Bagni</Text>
          <Stepper value={value.bathrooms} onChange={setBathrooms} min={1} max={6} />

          {/* Input mq */}
          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>
            Superficie <Text style={styles.optional}>(opzionale)</Text>
          </Text>
          <View style={styles.sqmRow}>
            <TextInput
              value={value.sqm}
              onChangeText={setSqm}
              placeholder="Es. 85"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="number-pad"
              style={styles.sqmInput}
            />
            <Text style={styles.sqmUnit}>m²</Text>
          </View>

          {/* Quick-select mq */}
          <View style={styles.sqmQuickRow}>
            {['50', '75', '100', '150'].map(v => (
              <Pressable
                key={v}
                onPress={() => setSqm(v)}
                style={[styles.sqmChip, value.sqm === v && styles.sqmChipOn]}
              >
                <Text style={[styles.sqmChipTxt, value.sqm === v && styles.sqmChipTxtOn]}>{v} m²</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* CTA salva */}
        <View style={styles.footer}>
          <Pressable style={styles.saveBtn} onPress={onClose}>
            <Text style={styles.saveTxt}>Conferma</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
