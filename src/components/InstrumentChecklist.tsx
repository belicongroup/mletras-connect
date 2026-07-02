import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { INSTRUMENTS } from '../constants/instruments';
import { colors, spacing, typography } from '../theme';
import { Instrument } from '../types';

interface InstrumentChecklistProps {
  title?: string;
  selected: Instrument[];
  onChange: (instruments: Instrument[]) => void;
}

function InstrumentChecklistComponent({ title = 'Instruments played', selected, onChange }: InstrumentChecklistProps) {
  const toggle = (instrument: Instrument) => {
    if (selected.includes(instrument)) {
      onChange(selected.filter((i) => i !== instrument));
    } else {
      onChange([...selected, instrument]);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {INSTRUMENTS.map((instrument) => {
        const isSelected = selected.includes(instrument);
        return (
          <Pressable
            key={instrument}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected }}
            onPress={() => toggle(instrument)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Ionicons
              name={isSelected ? 'checkbox' : 'square-outline'}
              size={22}
              color={isSelected ? colors.primary : colors.textSecondary}
            />
            <Text style={styles.label}>{instrument}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const InstrumentChecklist = memo(InstrumentChecklistComponent);

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
  },
  title: {
    ...typography.bodyBold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  pressed: {
    opacity: 0.8,
  },
  label: {
    ...typography.body,
    color: colors.text,
  },
});
