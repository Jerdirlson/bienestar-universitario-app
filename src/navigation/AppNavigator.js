import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
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

const Root = createStackNavigator();
const Tab = createBottomTabNavigator();
const HomeStack = createStackNavigator();
const ExploreStack = createStackNavigator();

const NO_HEADER = { headerShown: false };

function HomeNavigator() {
  return (
    <HomeStack.Navigator screenOptions={NO_HEADER}>
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
    <ExploreStack.Navigator screenOptions={NO_HEADER}>
      <ExploreStack.Screen name="ExploreMain" component={ExploreScreen} />
      <ExploreStack.Screen name="Challenges" component={ChallengesScreen} />
    </ExploreStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => {
        // Hide the tab bar whenever a nested stack has navigated past its root screen
        const homeState = props.state.routes.find(r => r.name === 'home')?.state;
        const exploreState = props.state.routes.find(r => r.name === 'explore')?.state;
        const inSubScreen = (homeState?.index ?? 0) > 0 || (exploreState?.index ?? 0) > 0;
        if (inSubScreen) return null;
        return <TabBar {...props} />;
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
    <Root.Navigator screenOptions={NO_HEADER}>
      <Root.Screen name="Splash" component={SplashScreen} />
      <Root.Screen name="Onboarding" component={OnboardingScreen} initialParams={{ step: 0 }} />
      <Root.Screen name="Login" component={LoginScreen} />
      <Root.Screen name="Main" component={MainTabs} />
      <Root.Screen name="Profile" component={ProfileScreen} />
      <Root.Screen name="PostDetail" component={PostDetailScreen} />
      <Root.Screen name="Sos" component={SosScreen} options={{ presentation: 'modal' }} />
      {[...DIARY_ROUTES, ...SOCIAL_ROUTES, ...WELLNESS_ROUTES].map(r => (
        <Root.Screen key={r.name} name={r.name} component={r.component} options={r.options} />
      ))}
    </Root.Navigator>
  );
}
