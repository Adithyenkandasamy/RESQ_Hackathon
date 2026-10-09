import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';
import { BorderRadius, Spacing } from '../constants/spacing';
import { Typography } from '../constants/typography';

export type StatusType = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusBadgeProps {
  label: string;
  type?: StatusType;
  style?: ViewStyle;
  icon?: React.ReactNode;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  type = 'neutral',
  style,
  icon,
}) => {
  const getBadgeColors = () => {
    switch (type) {
      case 'success':
        return {
          bg: Colors.lightGreen,
          border: 'rgba(22, 163, 74, 0.3)',
          text: Colors.medicalGreen,
        };
      case 'warning':
        return {
          bg: Colors.warningLight,
          border: 'rgba(217, 119, 6, 0.3)',
          text: Colors.warning,
        };
      case 'error':
        return {
          bg: Colors.errorLight,
          border: 'rgba(220, 38, 38, 0.3)',
          text: Colors.error,
        };
      case 'info':
        return {
          bg: Colors.lightBlue,
          border: 'rgba(37, 99, 235, 0.3)',
          text: Colors.primaryBlue,
        };
      case 'neutral':
      default:
        return {
          bg: '#F1F5F9',
          border: Colors.borders,
          text: Colors.secondaryText,
        };
    }
  };

  const colors = getBadgeColors();

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: colors.bg, borderColor: colors.border },
        style,
      ]}
    >
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text style={[styles.badgeText, { color: colors.text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  iconContainer: {
    marginRight: 4,
  },
  badgeText: {
    ...Typography.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
