/**
 * Telemedicine Screen
 *
 * Main entry point for telemedicine features
 * SPEC-004: Telemedicine Integration Module
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  navigation: NavigationProp;
}

type Tab = 'suggestions' | 'providers' | 'appointments';

interface ConsultationSuggestion {
  type: string;
  priority: string;
  reason: string;
  suggestedSpecialty?: string;
  recommendedWithin?: string;
}

interface HealthcareProvider {
  id: string;
  name: string;
  specialty?: string;
  clinicName?: string;
  consultationTypes: string[];
  rating?: number;
  consultationFee?: {
    video?: number;
    inPerson?: number;
  };
}

interface Appointment {
  id: string;
  providerId: string;
  providerName: string;
  providerSpecialty?: string;
  type: string;
  status: string;
  scheduledAt: string;
  duration: number;
  reason: string;
  videoCallLink?: string;
}

export const TelemedicineScreen: React.FC<Props> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<Tab>('suggestions');
  const [suggestions, setSuggestions] = useState<ConsultationSuggestion[]>([]);
  const [providers, setProviders] = useState<HealthcareProvider[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      // In a real implementation, import and use the API service
      // For now, set mock data
      if (activeTab === 'suggestions') {
        setSuggestions([
          {
            type: 'consultation_recommended',
            priority: 'medium',
            reason: 'Blood pressure has been slightly elevated. Consider a consultation.',
            suggestedSpecialty: 'Cardiologist',
            recommendedWithin: '1 week',
          },
        ]);
      } else if (activeTab === 'providers') {
        setProviders([
          {
            id: '1',
            name: 'Dr. Maria Garcia',
            specialty: 'Cardiologist',
            clinicName: 'Heart Care Center',
            consultationTypes: ['video', 'in_person'],
            rating: 4.8,
            consultationFee: { video: 75, inPerson: 100 },
          },
          {
            id: '2',
            name: 'Dr. James Chen',
            specialty: 'Endocrinologist',
            clinicName: 'Diabetes Wellness Clinic',
            consultationTypes: ['video', 'in_person'],
            rating: 4.9,
            consultationFee: { video: 80, inPerson: 120 },
          },
        ]);
      } else if (activeTab === 'appointments') {
        setAppointments([
          {
            id: '1',
            providerId: '1',
            providerName: 'Dr. Maria Garcia',
            providerSpecialty: 'Cardiologist',
            type: 'video',
            status: 'scheduled',
            scheduledAt: new Date(Date.now() + 86400000).toISOString(),
            duration: 20,
            reason: 'Follow-up for blood pressure',
            videoCallLink: 'session_1_1234567890',
          },
        ]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return '#3B82F6';
      case 'confirmed':
        return '#10B981';
      case 'completed':
        return '#6B7280';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#F59E0B';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return '#EF4444';
      case 'medium':
        return '#F59E0B';
      default:
        return '#10B981';
    }
  };

  const renderSuggestions = () => {
    if (suggestions.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No suggestions at this time</Text>
          <Text style={styles.emptySubtext}>Your health is looking good!</Text>
        </View>
      );
    }

    return suggestions.map((suggestion, index) => (
      <TouchableOpacity
        key={index}
        style={styles.suggestionCard}
        onPress={() => navigation.navigate('TelemedicineProviders' as never)}
      >
        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(suggestion.priority) }]}>
          <Text style={styles.priorityText}>{suggestion.priority.toUpperCase()}</Text>
        </View>
        <Text style={styles.suggestionReason}>{suggestion.reason}</Text>
        {suggestion.suggestedSpecialty && (
          <View style={styles.suggestionFooter}>
            <Text style={styles.suggestionSpecialty}>Suggested: {suggestion.suggestedSpecialty}</Text>
            <Text style={styles.suggestionTime}>
              {suggestion.recommendedWithin && `Within ${suggestion.recommendedWithin}`}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    ));
  };

  const renderProviders = () => {
    if (providers.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No providers available</Text>
        </View>
      );
    }

    return providers.map((provider) => (
      <TouchableOpacity
        key={provider.id}
        style={styles.providerCard}
        onPress={() => navigation.navigate('TelemedicineBookAppointment' as never, { providerId: provider.id } as never)}
      >
        <View style={styles.providerHeader}>
          <View style={styles.providerInfo}>
            <Text style={styles.providerName}>{provider.name}</Text>
            {provider.specialty && (
              <Text style={styles.providerSpecialty}>{provider.specialty}</Text>
            )}
          </View>
          {provider.rating && (
            <View style={styles.ratingContainer}>
              <Text style={styles.star}>★</Text>
              <Text style={styles.rating}>{provider.rating}</Text>
            </View>
          )}
        </View>
        {provider.clinicName && (
          <Text style={styles.clinicName}>{provider.clinicName}</Text>
        )}
        <View style={styles.consultationTypes}>
          {provider.consultationTypes.map((type) => (
            <View key={type} style={styles.typeBadge}>
              <Text style={styles.typeText}>{type === 'video' ? 'Video Call' : 'In-Person'}</Text>
            </View>
          ))}
        </View>
        {provider.consultationFee && (
          <View style={styles.feeContainer}>
            {provider.consultationFee.video && (
              <Text style={styles.feeText}>Video: ${provider.consultationFee.video}</Text>
            )}
            {provider.consultationFee.inPerson && (
              <Text style={styles.feeText}>In-Person: ${provider.consultationFee.inPerson}</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    ));
  };

  const renderAppointments = () => {
    if (appointments.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No scheduled appointments</Text>
          <TouchableOpacity
            style={styles.bookButton}
            onPress={() => navigation.navigate('TelemedicineProviders' as never)}
          >
            <Text style={styles.bookButtonText}>Book an Appointment</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return appointments.map((appointment) => {
      const date = new Date(appointment.scheduledAt);
      const isUpcoming = date > new Date();

      return (
        <TouchableOpacity
          key={appointment.id}
          style={styles.appointmentCard}
          onPress={() => navigation.navigate('TelemedicineAppointmentDetail' as never, { appointmentId: appointment.id } as never)}
        >
          <View style={styles.appointmentHeader}>
            <Text style={styles.appointmentProvider}>{appointment.providerName}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appointment.status) }]}>
              <Text style={styles.statusText}>{appointment.status}</Text>
            </View>
          </View>
          <Text style={styles.appointmentReason}>{appointment.reason}</Text>
          <View style={styles.appointmentDetails}>
            <Text style={styles.appointmentDate}>
              {date.toLocaleDateString()} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Text style={styles.appointmentDuration}>{appointment.duration} min</Text>
          </View>
          {appointment.type === 'video' && isUpcoming && (
            <TouchableOpacity
              style={styles.joinCallButton}
              onPress={() => navigation.navigate('TelemedicineVideoCall' as never, { appointmentId: appointment.id } as never)}
            >
              <Text style={styles.joinCallText}>Join Video Call</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      );
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'suggestions' && styles.activeTab]}
          onPress={() => setActiveTab('suggestions')}
        >
          <Text style={[styles.tabText, activeTab === 'suggestions' && styles.activeTabText]}>
            Suggestions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'providers' && styles.activeTab]}
          onPress={() => setActiveTab('providers')}
        >
          <Text style={[styles.tabText, activeTab === 'providers' && styles.activeTabText]}>
            Providers
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'appointments' && styles.activeTab]}
          onPress={() => setActiveTab('appointments')}
        >
          <Text style={[styles.tabText, activeTab === 'appointments' && styles.activeTabText]}>
            Appointments
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {activeTab === 'suggestions' && renderSuggestions()}
          {activeTab === 'providers' && renderProviders()}
          {activeTab === 'appointments' && renderAppointments()}
        </ScrollView>
      )}

      {activeTab === 'providers' && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('TelemedicineProviders' as never)}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#3B82F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  suggestionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  suggestionReason: {
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 8,
  },
  suggestionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  suggestionSpecialty: {
    fontSize: 12,
    color: '#6B7280',
  },
  suggestionTime: {
    fontSize: 12,
    color: '#3B82F6',
  },
  providerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  providerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  providerSpecialty: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  star: {
    fontSize: 14,
    color: '#F59E0B',
    marginRight: 4,
  },
  rating: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  clinicName: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  consultationTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  typeBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  typeText: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '500',
  },
  feeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  feeText: {
    fontSize: 12,
    color: '#6B7280',
  },
  appointmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  appointmentProvider: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  appointmentReason: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  appointmentDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  appointmentDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  appointmentDuration: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  joinCallButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  joinCallText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bookButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  bookButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  fabText: {
    fontSize: 28,
    color: '#FFFFFF',
    lineHeight: 28,
  },
});
