import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppShell } from './src/AppShell';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { theme } from './src/theme';

function AppContent() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.black} />
      </View>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <>
      <View style={styles.backgroundGlow} />
      <AppShell />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <AuthProvider>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar style="dark" />
          <AppContent />
        </SafeAreaView>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundGlow: {
    position: 'absolute',
    top: -80,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#e7ddcd',
  },
});
