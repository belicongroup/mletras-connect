import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import {
  NavigationContainer,
  DarkTheme,
  LinkingOptions,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext';
import { AuthScreen } from '../screens/AuthScreen';
import { CreatePasswordScreen } from '../screens/CreatePasswordScreen';
import { CommentThreadScreen } from '../screens/CommentThreadScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { FeedScreen } from '../screens/FeedScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { OtpVerificationScreen } from '../screens/OtpVerificationScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ProfileSetupScreen } from '../screens/ProfileSetupScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SignUpEmailScreen } from '../screens/SignUpEmailScreen';
import { colors } from '../theme';
import { RootStackParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

// Maps screens to URL paths so the browser address bar and the back/forward
// buttons stay in sync with in-app navigation on web.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    'https://connect.mletras.com',
    'https://mletras-connect.pages.dev',
    'http://localhost:8081',
    'http://localhost:19006',
  ],
  config: {
    screens: {
      SignUpEmail: 'signup',
      Auth: 'login',
      ForgotPassword: 'forgot-password',
      OtpVerification: 'verify',
      CreatePassword: 'create-password',
      ProfileSetup: 'profile-setup',
      Feed: '',
      Profile: 'profile',
      EditProfile: 'edit-profile',
      Settings: 'settings',
      Notifications: 'notifications',
      CommentThread: 'post/:postId',
    },
  },
};

export function RootNavigator() {
  const { isLoading, currentUser } = useApp();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme} linking={linking}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {currentUser ? (
          <>
            <Stack.Screen name="Feed" component={FeedScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="CommentThread" component={CommentThreadScreen} />
            {/* Auth screens stay reachable so guests can optionally create an account. */}
            <Stack.Screen name="SignUpEmail" component={SignUpEmailScreen} />
            <Stack.Screen name="Auth" component={AuthScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
            <Stack.Screen name="CreatePassword" component={CreatePasswordScreen} />
            <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="SignUpEmail" component={SignUpEmailScreen} />
            <Stack.Screen name="Auth" component={AuthScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
            <Stack.Screen name="CreatePassword" component={CreatePasswordScreen} />
            <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
