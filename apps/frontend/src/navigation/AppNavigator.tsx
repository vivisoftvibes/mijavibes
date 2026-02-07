/**
 * Main Navigation
 *
 * React Navigation setup for SaludAlDía
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { RootStackParamList, MainTabParamList } from '../types';
import { useAuthStore } from '../store/useAuthStore';

// Import screens
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { MedicationsScreen } from '../screens/MedicationsScreen';
import { VitalsScreen } from '../screens/VitalsScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { MedicationDetailScreen } from '../screens/MedicationDetailScreen';
import { AddMedicationScreen } from '../screens/AddMedicationScreen';
import { RecordBloodPressureScreen } from '../screens/RecordBloodPressureScreen';
import { RecordGlucoseScreen } from '../screens/RecordGlucoseScreen';
import { EmergencyScreen } from '../screens/EmergencyScreen';
import { PharmacyListScreen } from '../screens/PharmacyListScreen';
import { TelemedicineScreen } from '../screens/TelemedicineScreen';
import { BookAppointmentScreen } from '../screens/BookAppointmentScreen';
import { VideoCallScreen } from '../screens/VideoCallScreen';
import { AppointmentDetailScreen } from '../screens/AppointmentDetailScreen';
import { CaregiverHomeScreen } from '../screens/CaregiverHomeScreen';
import { PatientDetailScreen } from '../screens/PatientDetailScreen';
import { PharmacyRefillSelectScreen } from '../screens/PharmacyRefillSelectScreen';
import { PharmacyRefillReviewScreen } from '../screens/PharmacyRefillReviewScreen';
import { PharmacyOrderTrackingScreen } from '../screens/PharmacyOrderTrackingScreen';
import { PharmacyAutoRefillSettingsScreen } from '../screens/PharmacyAutoRefillSettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Main tab navigator for authenticated users
 */
function MainTabs() {
  const user = useAuthStore((state) => state.user);
  const isCaregiver = user?.role === 'caregiver';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0066CC',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
        }}
      />
      <Tab.Screen
        name="Medications"
        component={MedicationsScreen}
        options={{
          tabBarLabel: 'Meds',
          tabBarIcon: ({ color }) => <TabIcon name="medication" color={color} />,
        }}
      />
      <Tab.Screen
        name="Vitals"
        component={VitalsScreen}
        options={{
          tabBarLabel: 'Vitals',
          tabBarIcon: ({ color }) => <TabIcon name="vitals" color={color} />,
        }}
      />
      <Tab.Screen
        name="Stats"
        component={StatsScreen}
        options={{
          tabBarLabel: 'Stats',
          tabBarIcon: ({ color }) => <TabIcon name="stats" color={color} />,
        }}
      />
      <Tab.Screen
        name={isCaregiver ? 'Caregiver' : 'Profile'}
        component={isCaregiver ? CaregiverHomeScreen : ProfileScreen}
        options={{
          tabBarLabel: isCaregiver ? 'Caregiver' : 'Profile',
          tabBarIcon: ({ color }) => (
            <TabIcon name={isCaregiver ? 'caregiver' : 'profile'} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

/**
 * Simple icon component for tab bar
 */
function TabIcon({ name, color }: { name: string; color: string }) {
  const icons: Record<string, string> = {
    home: '🏠',
    medication: '💊',
    vitals: '❤️',
    stats: '📊',
    profile: '👤',
    caregiver: '👥',
  };
  return <span style={{ fontSize: 24 }}>{icons[name] || '•'}</span>;
}

/**
 * Root navigator handling auth flow
 */
export function AppNavigator() {
  const { user, isInitialized, initialize } = useAuthStore();

  React.useEffect(() => {
    initialize();
  }, []);

  if (!isInitialized) {
    return null; // Or show loading screen
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {!user ? (
          // Auth stack
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : (
          // Main app stack
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="MedicationDetail"
              component={MedicationDetailScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="AddMedication"
              component={AddMedicationScreen}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen
              name="RecordBloodPressure"
              component={RecordBloodPressureScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="RecordGlucose"
              component={RecordGlucoseScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="Emergency"
              component={EmergencyScreen}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen
              name="PharmacyList"
              component={PharmacyListScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="Telemedicine"
              component={TelemedicineScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="TelemedicineProviders"
              component={TelemedicineScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="TelemedicineBookAppointment"
              component={BookAppointmentScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="TelemedicineAppointmentDetail"
              component={AppointmentDetailScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="TelemedicineVideoCall"
              component={VideoCallScreen}
              options={{ presentation: 'fullScreenModal', headerShown: false }}
            />
            <Stack.Screen
              name="PatientDetail"
              component={PatientDetailScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="PharmacyRefillSelect"
              component={PharmacyRefillSelectScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="PharmacyRefillReview"
              component={PharmacyRefillReviewScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="PharmacyOrderTracking"
              component={PharmacyOrderTrackingScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="PharmacyAutoRefillSettings"
              component={PharmacyAutoRefillSettingsScreen}
              options={{ presentation: 'card' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
