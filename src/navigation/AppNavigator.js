import React, { useEffect } from 'react';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TabActions } from '@react-navigation/native';

import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PostDetailScreen from '../screens/PostDetailScreen';
import HomeScreen from '../screens/HomeScreen';
import ExploreScreen from '../screens/ExploreScreen';
import CommunityScreen from '../screens/CommunityScreen';
import InsightsScreen from '../screens/InsightsScreen';
import ChallengesScreen from '../screens/ChallengesScreen';
import SosScreen from '../screens/SosScreen';
import {
  Checkin1Screen, Checkin2Screen, Checkin3Screen,
  Checkin4Screen, Checkin5Screen,
} from '../screens/CheckinScreens';
import TabBar from '../components/TabBar';
import { DIARY_ROUTES } from './routes/diary';
import { SOCIAL_ROUTES } from './routes/social';
import { WELLNESS_ROUTES } from './routes/wellness';
import { useApp } from '../context/AppContext';
import { COLORS } from '../theme';

const Root = createStackNavigator();
const Tab = createBottomTabNavigator();
const HomeStack = createStackNavigator();
const ExploreStack = createStackNavigator();

// Las transiciones de fábrica de @react-navigation/stack difieren entre
// plataformas (en Android es un deslizamiento vertical con desvanecido, muy
// distinto del de iOS), y se mezclaban con las de los modales (Sos, Compose)
// y con la barra de pestañas apareciendo/desapareciendo de golpe. Se unifica
// todo a un único slide horizontal estilo iOS (con gesto de volver) en las
// tres pilas de pantallas normales:
//  - `cardStyle` fija el fondo de la tarjeta al color de la app: sin esto, en
//    la fracción de segundo antes de que la pantalla entrante pinte su
//    propio contenido se ve un destello blanco o negro detrás.
// (Se probó también `detachPreviousScreen: false`, pensado para evitar que la
// pantalla anterior se desmonte durante la transición, pero en la pila raíz
// —donde Onboarding se navega con `push` repetido, una instancia por paso—
// dejaba varias pantallas "montadas mas interacción desactivada" a la vez, y
// en la versión web esa desactivación no bloqueaba los clics: los botones de
// una pantalla vieja tapaban a los de la nueva. Se revirtió: el valor por
// defecto de React Navigation, que sí detacha, ya evita el parpadeo real
// —el que dejaba ver un fondo equivocado— sin este efecto secundario.)
const SLIDE_OPTIONS = {
  headerShown: false,
  ...TransitionPresets.SlideFromRightIOS,
  cardStyle: { backgroundColor: COLORS.bg },
};

// Los modales (Sos, Compose) usan la presentación estándar de iOS: entran
// deslizando desde abajo en vez del slide horizontal de las pantallas
// normales, para que se noten como una capa aparte y no como "un paso más"
// de navegación.
const MODAL_OPTIONS = {
  ...TransitionPresets.ModalSlideFromBottomIOS,
  cardStyle: { backgroundColor: COLORS.bg },
};

// Login y Main son reemplazos de la raíz de la app (`navigation.replace`),
// no "un paso más" dentro de un flujo: con el slide de arriba se veía como
// si se estuviera navegando hacia adelante en vez de arrancar una sección
// nueva. Se desactiva la animación en el destino de esos saltos (además,
// `MainTabs` puede llegar aquí por un `navigation.reset` cuando el servidor
// rechaza la sesión, y ahí tampoco se quiere una animación).
//
// Onboarding queda fuera a propósito: a diferencia de Login y Main, a los
// que solo se llega con `replace`, sus tres pasos se navegan entre sí con
// `navigation.push('Onboarding', { step })` (ver OnboardingScreen) — sin
// animación esos pasos perderían el deslizamiento del carrusel, que sí es
// intencional. Splash → Onboarding hereda entonces el slide normal, que no
// se ve raro (es la única de las tres que empieza una sección con
// contenido, no con una pantalla vacía).
const NO_ANIM = { animationEnabled: false };

function HomeNavigator() {
  return (
    <HomeStack.Navigator screenOptions={SLIDE_OPTIONS}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen name="Checkin1" component={Checkin1Screen} />
      <HomeStack.Screen name="Checkin2" component={Checkin2Screen} />
      <HomeStack.Screen name="Checkin3" component={Checkin3Screen} />
      <HomeStack.Screen name="Checkin4" component={Checkin4Screen} />
      <HomeStack.Screen name="Checkin5" component={Checkin5Screen} />
    </HomeStack.Navigator>
  );
}

function ExploreNavigator() {
  return (
    <ExploreStack.Navigator screenOptions={SLIDE_OPTIONS}>
      <ExploreStack.Screen name="ExploreMain" component={ExploreScreen} />
      <ExploreStack.Screen name="Challenges" component={ChallengesScreen} />
    </ExploreStack.Navigator>
  );
}

function MainTabs({ navigation }) {
  const { sessionReady, sessionToken, sessionExpired } = useApp();

  // Si el servidor rechaza la sesión estando dentro de la app (venció, o la
  // cuenta se borró desde otro teléfono), se vuelve al login en vez de dejar
  // a la persona en pantallas que ya no pueden hablar con el servidor.
  useEffect(() => {
    if (sessionReady && !sessionToken) {
      navigation.reset({ index: 0, routes: [{ name: 'Login', params: sessionExpired ? { expired: true } : undefined }] });
    }
  }, [sessionReady, sessionToken, sessionExpired, navigation]);

  return (
    <Tab.Navigator
      tabBar={(props) => {
        // Se oculta (con fundido, dentro de TabBar) mientras un stack
        // anidado navegó más allá de su pantalla raíz — antes se montaba y
        // desmontaba de golpe (`return null`), lo que se veía como un salto
        // justo cuando la pantalla nueva estaba entrando con su propia
        // animación.
        const homeState = props.state.routes.find(r => r.name === 'home')?.state;
        const exploreState = props.state.routes.find(r => r.name === 'explore')?.state;
        const inSubScreen = (homeState?.index ?? 0) > 0 || (exploreState?.index ?? 0) > 0;
        return <TabBar {...props} hidden={inSubScreen} />;
      }}
      screenOptions={{ headerShown: false, animationEnabled: false }}
    >
      <Tab.Screen name="home" component={HomeNavigator} />
      <Tab.Screen name="explore" component={ExploreNavigator} />
      <Tab.Screen name="community" component={CommunityScreen} />
      <Tab.Screen name="insights" component={InsightsScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Root.Navigator screenOptions={SLIDE_OPTIONS}>
      <Root.Screen name="Splash" component={SplashScreen} />
      <Root.Screen name="Onboarding" component={OnboardingScreen} initialParams={{ step: 0 }} />
      <Root.Screen name="Login" component={LoginScreen} options={NO_ANIM} />
      <Root.Screen name="Main" component={MainTabs} options={NO_ANIM} />
      <Root.Screen name="Profile" component={ProfileScreen} />
      <Root.Screen name="PostDetail" component={PostDetailScreen} />
      <Root.Screen name="Sos" component={SosScreen} options={{ presentation: 'modal', ...MODAL_OPTIONS }} />
      {[...DIARY_ROUTES, ...SOCIAL_ROUTES, ...WELLNESS_ROUTES].map(r => (
        <Root.Screen key={r.name} name={r.name} component={r.component} options={r.options} />
      ))}
    </Root.Navigator>
  );
}
