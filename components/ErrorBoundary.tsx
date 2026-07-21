import { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { Colors } from '../constants/Colors';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Catches render errors anywhere in the wrapped subtree so a bug doesn't
// take the whole app down to a blank white screen. Reports to Sentry (a
// no-op until EXPO_PUBLIC_SENTRY_DSN is set — see app/_layout.tsx) and
// shows a real fallback with a way to recover without force-quitting.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            An unexpected error occurred. You can try again, or restart the app if the
            problem continues.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={this.handleReset}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Manrope_800ExtraBold',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.textSecondary,
    marginTop: 10,
    lineHeight: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 54,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    paddingHorizontal: 24,
  },
  buttonText: {
    fontSize: 15.5,
    fontFamily: 'Manrope_700Bold',
    color: Colors.textOnPrimary,
  },
});
