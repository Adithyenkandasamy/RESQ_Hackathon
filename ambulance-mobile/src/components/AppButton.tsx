import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors } from '../constants/colors';
import { BorderRadius, Spacing } from '../constants/spacing';
import { Typography } from '../constants/typography';

export type ButtonVariant = 'primary' | 'secondary' | 'emergency' | 'outline' | 'success';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const AppButton: React.FC<AppButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}) => {
  const isDisabled = disabled || loading;

  const getContainerStyle = (): ViewStyle => {
    switch (variant) {
      case 'emergency':
        return styles.emergencyContainer;
      case 'secondary':
        return styles.secondaryContainer;
      case 'outline':
        return styles.outlineContainer;
      case 'success':
        return styles.successContainer;
      case 'primary':
      default:
        return styles.primaryContainer;
    }
  };

  const getTextStyle = (): TextStyle => {
    switch (variant) {
      case 'secondary':
        return styles.secondaryText;
      case 'outline':
        return styles.outlineText;
      case 'emergency':
      case 'success':
      case 'primary':
      default:
        return styles.primaryText;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.baseContainer,
        getContainerStyle(),
        isDisabled && styles.disabledContainer,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'secondary' || variant === 'outline' ? Colors.primaryBlue : '#FFFFFF'}
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              Typography.button,
              getTextStyle(),
              icon ? { marginLeft: Spacing.sm } : undefined,
              isDisabled && styles.disabledText,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  baseContainer: {
    height: 48,
    borderRadius: BorderRadius.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.base,
  },
  primaryContainer: {
    backgroundColor: Colors.primaryBlue,
  },
  secondaryContainer: {
    backgroundColor: Colors.lightBlue,
  },
  outlineContainer: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.borders,
  },
  emergencyContainer: {
    backgroundColor: Colors.error,
  },
  successContainer: {
    backgroundColor: Colors.medicalGreen,
  },
  disabledContainer: {
    backgroundColor: Colors.disabledBackground,
    borderColor: Colors.disabledBackground,
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: Colors.primaryBlue,
  },
  outlineText: {
    color: Colors.primaryText,
  },
  disabledText: {
    color: Colors.disabledText,
  },
});
