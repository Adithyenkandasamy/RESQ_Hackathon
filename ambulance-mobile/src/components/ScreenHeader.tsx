import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { Spacing, BorderRadius } from '../constants/spacing';
import { Typography } from '../constants/typography';
import { ArrowLeft } from 'lucide-react-native';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  canGoBack?: boolean;
  rightAction?: React.ReactNode;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  canGoBack = false,
  rightAction,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const safeTopPadding = Math.max(insets.top, Platform.OS === 'android' ? 24 : 0);

  return (
    <View style={[styles.container, { paddingTop: safeTopPadding + 10 }]}>
      <View style={styles.contentRow}>
        <View style={styles.leftContainer}>
          {canGoBack && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              accessibilityLabel="Back"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft size={20} color={Colors.primaryText} />
            </TouchableOpacity>
          )}
          <View style={styles.titleWrapper}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
            {subtitle && (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>
        {rightAction && <View style={styles.rightAction}>{rightAction}</View>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borders,
    paddingBottom: Spacing.sm,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    minHeight: 44,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.mainBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  titleWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    ...Typography.h2,
    fontSize: 18,
    color: Colors.darkNavy,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Colors.secondaryText,
    marginTop: 1,
  },
  rightAction: {
    marginLeft: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
