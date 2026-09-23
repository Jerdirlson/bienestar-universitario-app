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

export const SOCIAL_ROUTES = [
  { name: 'Compose', component: ComposeScreen, options: { presentation: 'modal', gestureEnabled: false } },
  { name: 'UserProfile', component: UserProfileScreen, options: {} },
  { name: 'Notifications', component: NotificationsScreen, options: {} },
  { name: 'MyPosts', component: MyPostsScreen, options: {} },
  { name: 'SavedPosts', component: SavedPostsScreen, options: {} },
  { name: 'BlockedUsers', component: BlockedUsersScreen, options: {} },
  { name: 'EditProfile', component: EditProfileScreen, options: {} },
  { name: 'CommunityGuidelines', component: CommunityGuidelinesScreen, options: {} },
];
