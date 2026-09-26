import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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

const Root = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const ExploreStack = createNativeStackNavigator();

// Migración de @react-navigation/stack (transiciones dibujadas en JS, que en
// Android eran un deslizamiento vertical con desvanecido muy distinto del de
// iOS, y podían saltar/parpadear) a @react-navigation/native-stack: cada
// plataforma usa su transición nativa de verdad (push lateral con gesto de
// volver en iOS, la de Android en Android) — ver docs/design-system.md §6.
//
// `headerShown: false` por defecto: las pantallas actuales dibujan su propio
// `TopBar`; un encabezado nativo encima duplicaría la barra. Se migran a
// encabezados nativos (`headerLargeTitle`, etc.) pantalla por pantalla más
// adelante, no en esta base.
// `contentStyle` reemplaza a `cardStyle`: mismo motivo que antes (sin esto se
// ve un destello del fondo por defecto justo antes de que la pantalla
// entrante pinte su propio contenido).
const SLIDE_OPTIONS = {
  headerShown: false,
  animation: 'default',
  contentStyle: { backgroundColor: COLORS.bg },
};

// Los modales (Sos, Compose) usan `presentation: 'modal'` nativo: entran
// deslizando desde abajo (con la barra de estado y, en iOS, la tarjeta
// anterior asomando detrás) en vez del slide horizontal de las pantallas
// normales, para que se noten como una capa aparte y no como "un paso más"
// de navegación.
const MODAL_OPTIONS = {
  headerShown: false,
  presentation: 'modal',
  animation: 'default',
  contentStyle: { backgroundColor: COLORS.bg },
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
const NO_ANIM = { animation: 'none' };

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
        // Check-in y Retos NO viven en el stack raíz por encima de las
        // pestañas: siguen anidados dentro de HomeStack/ExploreStack (así
        // estaban antes de esta migración) y la pestaña se oculta calculando
        // si ese stack anidado está en una subpantalla (`index > 0`). Se
        // evaluaron las dos formas estándar de ocultar la barra en
        // native-stack:
        //   (a) subir esas pantallas al stack raíz (fuera de las pestañas), o
        //   (b) `tabBarStyle: { display: 'none' }` por ruta, vía
        //       `getFocusedRouteNameFromRoute` en las screenOptions del tab.
        // Se descartaron ambas para esta base: (a) cambiaría a qué stack
        // pertenecen 'Checkin1'..'Checkin5' y 'Challenges' — las pantallas ya
        // las navegan con `navigation.navigate('Checkin1', ...)` /
        // `navigation.navigate('Challenges')` esperando resolverlas dentro de
        // su propio stack anidado (HomeScreen.js, ExploreScreen.js); moverlas
        // habría exigido tocarlas, fuera del alcance de esta tarea. (b)
        // reintroduce exactamente el salto que el propio código ya resolvió
        // antes (ver commit previo): `display: 'none'` monta/desmonta la
        // barra de golpe, no la funde. Se mantiene entonces el fundido corto
        // ya existente (`Animated` dentro de TabBar), que no cambia con
        // native-stack porque el estado de un stack anidado (índice, rutas)
        // tiene la misma forma sin importar qué stack lo renderiza.
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
      <Root.Screen name="Sos" component={SosScreen} options={MODAL_OPTIONS} />
      {[...DIARY_ROUTES, ...SOCIAL_ROUTES, ...WELLNESS_ROUTES].map(r => (
        <Root.Screen key={r.name} name={r.name} component={r.component} options={r.options} />
      ))}
    </Root.Navigator>
  );
}
