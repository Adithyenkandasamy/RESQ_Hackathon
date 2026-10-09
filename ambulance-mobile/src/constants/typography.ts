import { TextStyle } from 'react-native';
import { Colors } from './colors';

export const Typography: Record<string, TextStyle> = {
  h1: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 32,
    color: Colors.primaryText,
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
    color: Colors.primaryText,
    letterSpacing: -0.2,
  },
  h3: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
    color: Colors.primaryText,
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21,
    color: Colors.primaryText,
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    color: Colors.secondaryText,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    color: Colors.secondaryText,
  },
  button: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  mono: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'monospace',
    color: Colors.primaryText,
  },
};
