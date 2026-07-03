import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { patchFlatListProps } from 'react-native-web-refresh-control';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { AppProvider } from './src/context/AppContext';
import { AuthLanguageProvider } from './src/context/AuthLanguageContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/theme';

if (Platform.OS === 'web') {
  patchFlatListProps({ tintColor: colors.primary });
}

const ioniconsFont =
  Platform.OS === 'web' ? { ionicons: '/fonts/Ionicons.ttf' } : Ionicons.font;

export default function App() {
  const [fontsLoaded] = useFonts(ioniconsFont);

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthLanguageProvider>
        <AppProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AppProvider>
      </AuthLanguageProvider>
    </SafeAreaProvider>
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
