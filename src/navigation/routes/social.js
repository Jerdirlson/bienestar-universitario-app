/**
 * Pantallas del módulo "social" que viven en el stack raíz (encima de las
 * pestañas). AppNavigator las registra todas; así cada módulo agrega sus
 * pantallas sin editar AppNavigator.
 *
 *   export const SOCIAL_ROUTES = [{ name: 'Algo', component: AlgoScreen, options: {} }];
 *
 * PostDetail y Profile ya están registradas en AppNavigator.
 */
import ComposeScreen from '../../screens/social/ComposeScreen';
import UserProfileScreen from '../../screens/social/UserProfileScreen';
import NotificationsScreen from '../../screens/social/NotificationsScreen';
import { MyPostsScreen, SavedPostsScreen } from '../../screens/social/PostListScreens';
import BlockedUsersScreen from '../../screens/social/BlockedUsersScreen';
import EditProfileScreen from '../../screens/social/EditProfileScreen';
import CommunityGuidelinesScreen from '../../screens/social/CommunityGuidelinesScreen';
import MessagesScreen from '../../screens/social/MessagesScreen';
import ChatScreen from '../../screens/social/ChatScreen';
import MessageRequestScreen from '../../screens/social/MessageRequestScreen';
import { COLORS } from '../../theme';

export const SOCIAL_ROUTES = [
  {
    name: 'Compose',
    component: ComposeScreen,
    options: {
      // Igual que Sos (ver AppNavigator): `presentation: 'modal'` nativo,
      // entra deslizando desde abajo, con fondo opaco del color de la app
      // para que no se vea un destello blanco/negro detrás durante la
      // animación. `gestureEnabled: false`: hay borrador sin enviar y hay que
      // confirmar (beforeRemove más abajo en ComposeScreen), así que no se
      // puede cerrar con el gesto de swipe-to-dismiss que trae el modal
      // nativo.
      headerShown: false,
      presentation: 'modal',
      animation: 'default',
      contentStyle: { backgroundColor: COLORS.bg },
      gestureEnabled: false,
    },
  },
  { name: 'UserProfile', component: UserProfileScreen, options: {} },
  { name: 'Notifications', component: NotificationsScreen, options: {} },
  { name: 'MyPosts', component: MyPostsScreen, options: {} },
  { name: 'SavedPosts', component: SavedPostsScreen, options: {} },
  { name: 'BlockedUsers', component: BlockedUsersScreen, options: {} },
  { name: 'EditProfile', component: EditProfileScreen, options: {} },
  { name: 'CommunityGuidelines', component: CommunityGuidelinesScreen, options: {} },
  { name: 'Messages', component: MessagesScreen, options: {} },
  { name: 'Chat', component: ChatScreen, options: {} },
  {
    name: 'MessageRequest',
    component: MessageRequestScreen,
    options: {
      // Mismo patrón que Compose: modal nativo con Cancelar/Enviar y
      // confirmación al salir con texto sin mandar (ver el propio archivo).
      headerShown: false,
      presentation: 'modal',
      animation: 'default',
      contentStyle: { backgroundColor: COLORS.bg },
      gestureEnabled: false,
    },
  },
];
