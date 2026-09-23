/**
 * Pantallas del módulo "wellness" que viven en el stack raíz (encima de las
 * pestañas). AppNavigator las registra todas; así cada módulo agrega sus
 * pantallas sin editar AppNavigator.
 *
 *   export const WELLNESS_ROUTES = [{ name: 'Algo', component: AlgoScreen, options: {} }];
 *
 * `Challenges` no está aquí: vive dentro del stack de Explorar (AppNavigator).
 * Para abrirlo desde fuera de Explorar:
 *   navigation.navigate('Main', { screen: 'explore', params: { screen: 'Challenges' } })
 */
import BreathingScreen from '../../screens/BreathingScreen';
import GroundingScreen from '../../screens/GroundingScreen';
import ArticleScreen from '../../screens/ArticleScreen';

export const WELLNESS_ROUTES = [
  // Salir a mitad de una sesión (gesto o botón de volver) no registra nada.
  { name: 'Breathing', component: BreathingScreen, options: {} },
  { name: 'Grounding', component: GroundingScreen, options: {} },
  // params: { id } — ver src/data/wellnessContent.js
  { name: 'Article', component: ArticleScreen, options: {} },
];
