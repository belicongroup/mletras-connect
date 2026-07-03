import { Alert, Platform } from 'react-native';

/** Shows an alert that works on web (window.alert) and native (Alert.alert). */
export function showAlert(title: string, message: string): void {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}
