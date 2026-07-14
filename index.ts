import { registerRootComponent } from 'expo';

import App from './App';
import { registerBackgroundConnection } from './src/features/background/foregroundService';

// Register the Android foreground-service runner at load time, before any screen
// mounts and outside React (notifee requires this). No-op in Expo Go and on iOS.
// The service is only STARTED after login (see AppNavigator).
registerBackgroundConnection();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
