import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { View, ActivityIndicator } from 'react-native';

import { AppProvider } from './src/context/AppContext';
import { SocialProvider } from './src/context/SocialContext';
import AppNavigator from './src/navigation/AppNavigator';
import { COLORS } from './src/theme';

// El fondo por defecto de NavigationContainer es blanco puro. Se ve un
// instante detrás de las tarjetas durante las transiciones entre pantallas
// (en los bordes, o si el `cardStyle` de alguna tarjeta no llegó a pintar
// aún), así que se reemplaza por el fondo de la app para que no haya
// destello. `cardStyle` en AppNavigator hace lo mismo por tarjeta; esto
// cubre el contenedor de más atrás.
const NAV_THEME = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: COLORS.bg, card: COLORS.bg, primary: COLORS.primary },
};

export default function App() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0E9FF' }}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppProvider>
        <SocialProvider>
          <NavigationContainer theme={NAV_THEME}>
            <AppNavigator />
            <StatusBar style="dark" />
          </NavigationContainer>
        </SocialProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
