import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Colors } from '../constants/colors';
import { BorderRadius, Spacing } from '../constants/spacing';
import { Typography } from '../constants/typography';
import { Eye, EyeOff } from 'lucide-react-native';

interface AppInputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  isPassword?: boolean;
  containerStyle?: ViewStyle;
}

export const AppInput: React.FC<AppInputProps> = ({
  label,
  error,
  helperText,
  isPassword = false,
  containerStyle,
  style,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [hidePassword, setHidePassword] = useState(isPassword);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.focusedWrapper,
          Boolean(error) && styles.errorWrapper,
        ]}
      >
        <TextInput
          placeholderTextColor={Colors.secondaryText}
          style={[styles.input, style]}
          secureTextEntry={hidePassword}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setHidePassword(!hidePassword)}
            accessibilityLabel={hidePassword ? 'Show password' : 'Hide password'}
          >
            {hidePassword ? (
              <EyeOff size={18} color={Colors.secondaryText} />
            ) : (
              <Eye size={18} color={Colors.primaryBlue} />
            )}
          </TouchableOpacity>
        )}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.base,
  },
  label: {
    ...Typography.caption,
    color: Colors.secondaryText,
    fontWeight: '600',
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderWidth: 1.5,
    borderColor: Colors.borders,
    borderRadius: BorderRadius.base,
    minHeight: 48,
    paddingHorizontal: Spacing.md,
  },
  focusedWrapper: {
    borderColor: Colors.primaryBlue,
    backgroundColor: '#FFFFFF',
  },
  errorWrapper: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorLight,
  },
  input: {
    flex: 1,
    ...Typography.body,
    color: Colors.primaryText,
    paddingVertical: Spacing.sm,
  },
  eyeButton: {
    padding: Spacing.xs,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  helperText: {
    ...Typography.caption,
    color: Colors.secondaryText,
    marginTop: Spacing.xs,
  },
});
