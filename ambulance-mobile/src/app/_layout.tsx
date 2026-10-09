import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../context/AuthContext';
import { EmergencyProvider } from '../context/EmergencyContext';
import { Colors } from '../constants/colors';

export default function RootLayout() {
  return (
    <AuthProvider>
      <EmergencyProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.mainBackground },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="emergency/create"
            options={{
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="emergency/active"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="emergency/ai-assessment"
            options={{
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="emergency/handover"
            options={{
              presentation: 'modal',
              headerShown: false,
            }}
          />
        </Stack>
      </EmergencyProvider>
    </AuthProvider>
  );
}
