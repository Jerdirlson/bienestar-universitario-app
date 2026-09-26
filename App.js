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
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import { View, ActivityIndicator } from 'react-native';

import { AppProvider } from './src/context/AppContext';
import { SocialProvider } from './src/context/SocialContext';
import AppNavigator from './src/navigation/AppNavigator';
import { COLORS } from './src/theme';

// El fondo por defecto de NavigationContainer es blanco puro. Se ve un
// instante detrás de las tarjetas durante las transiciones entre pantallas
// (en los bordes, o si el `contentStyle` de alguna pantalla no llegó a
// pintar aún), así que se reemplaza por el fondo de la app para que no haya
// destello. `contentStyle` en AppNavigator hace lo mismo por pantalla; esto
// cubre el contenedor de más atrás. Los demás colores del tema (texto,
// borde, tarjeta) usan los tokens nuevos de src/theme.js para que cualquier
// pieza de React Navigation que los lea por su cuenta (headers nativos que
// se vayan activando pantalla por pantalla, por ejemplo) ya salga acorde.
const NAV_THEME = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: COLORS.bg,
    card: COLORS.bgElevated,
    primary: COLORS.accent,
    text: COLORS.label,
    border: COLORS.separator,
    notification: COLORS.destructive,
  },
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
    // Extra pesos que necesita el alias de compatibilidad FONTS.black/
    // extraBold en src/theme.js (Nunito ya no los provee: se retiró de ahí).
    Inter_800ExtraBold,
    Inter_900Black,
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
