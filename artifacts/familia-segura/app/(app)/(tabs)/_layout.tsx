import React from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Icon } from '@/components/Icon';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';

// IMPORTANT: iOS 26 uses NativeTabs for native tabs with liquid glass support.
// NativeTabs intentionally does NOT use custom design tokens — liquid glass
// is a system-level appearance provided by iOS and cannot be overridden.
// Custom brand colors are applied only on the ClassicTabLayout path (older iOS / Android / web).
function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'house', selected: 'house.fill' }}
        />
        <NativeTabs.Trigger.Label>Início</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="apps">
        <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} />
        <NativeTabs.Trigger.Label>Apps</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="routine">
        <NativeTabs.Trigger.Icon sf={{ default: 'moon', selected: 'moon.fill' }} />
        <NativeTabs.Trigger.Label>Rotina</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="reports">
        <NativeTabs.Trigger.Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} />
        <NativeTabs.Trigger.Label>Relatórios</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} />
        <NativeTabs.Trigger.Label>Família</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontFamily: 'NunitoSans_700Bold', fontSize: 11 },
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.card,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.card },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name="house" tintColor={color} size={24} />
            ) : (
              <Icon name="home" size={22} color={color} weight={focused ? 'fill' : 'regular'} />
            ),
        }}
      />
      <Tabs.Screen name="apps" options={{ title: 'Apps', tabBarIcon: ({ color, focused }) => isIOS ? <SymbolView name="square.grid.2x2" tintColor={color} size={23} /> : <Icon name="grid" size={22} color={color} weight={focused ? 'fill' : 'regular'} /> }} />
      <Tabs.Screen name="routine" options={{ title: 'Rotina', tabBarIcon: ({ color, focused }) => isIOS ? <SymbolView name="moon" tintColor={color} size={23} /> : <Icon name="moon" size={22} color={color} weight={focused ? 'fill' : 'regular'} /> }} />
      <Tabs.Screen name="reports" options={{ title: 'Relatórios', tabBarIcon: ({ color, focused }) => isIOS ? <SymbolView name="chart.bar" tintColor={color} size={23} /> : <Icon name="bar-chart-2" size={22} color={color} weight={focused ? 'fill' : 'regular'} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Família', tabBarIcon: ({ color, focused }) => isIOS ? <SymbolView name="person.2" tintColor={color} size={23} /> : <Icon name="users" size={22} color={color} weight={focused ? 'fill' : 'regular'} /> }} />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
