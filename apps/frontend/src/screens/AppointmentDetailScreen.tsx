/**
 * Appointment Detail Screen
 *
 * Shows detailed information about a scheduled appointment
 * SPEC-004: Telemedicine Integration Module
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, AppointmentDetail, AppointmentStatus } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'TelemedicineAppointmentDetail'>;

export const AppointmentDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { appointmentId } = route.params;
  const [appointment, setAppointment] = useState<AppointmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadAppointment();
  }, [appointmentId]);

  const loadAppointment = async () => {
    try {
      setLoading(true);
      // In real implementation, use API service
      // const data = await appointmentService.getAppointment(appointmentId);
      // setAppointment(data);

      // Mock data
      setAppointment({
        id: appointmentId,
        userId: 'user-1',
        providerId: 'provider-1',
        providerName: 'Dr. Maria Garcia',
        providerSpecialty: 'Cardiologist',
        providerClinicName: 'Heart Care Center',
        providerPhone: '+1-555-0123',
        providerEmail: 'dr.garcia@heartcare.com',
        type: 'video',
        status: 'scheduled',
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        duration: 20,
        reason: 'Follow-up for blood pressure',
        notes: 'Bring recent blood pressure readings',
        videoCallLink: 'session_1_1234567890',
        reminderSent: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userName: 'John Doe',
        userEmail: 'john@example.com',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to load appointment details');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Appointment',
      'Are you sure you want to cancel this appointment?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: () => cancelAppointment(),
        },
      ]
    );
  };

  const cancelAppointment = async () => {
    try {
      setCancelling(true);
      // In real implementation:
      // await appointmentService.cancelAppointment(appointmentId, 'Cancelled by patient');
      Alert.alert('Cancelled', 'Your appointment has been cancelled');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to cancel appointment');
    } finally {
      setCancelling(false);
    }
  };

  const handleReschedule = () => {
    if (!appointment) return;
    // Navigate to booking screen with provider
    navigation.navigate('TelemedicineBookAppointment' as never, { providerId: appointment.providerId } as never);
  };

  const handleJoinCall = () => {
    if (!appointment) return;
    navigation.navigate('TelemedicineVideoCall' as never, { appointmentId: appointment.id } as never);
  };

  const handleViewHealthSummary = () => {
    Alert.alert(
      'Health Summary',
      'Your health summary includes:\n\n• Blood pressure trends (30 days)\n• Medication adherence\n• Recent vital signs\n• Current medications\n\nThis will be shared with your provider before the consultation.'
    );
  };

  const getStatusColor = (status: AppointmentStatus) => {
    switch (status) {
      case 'scheduled':
        return '#3B82F6';
      case 'confirmed':
        return '#10B981';
      case 'completed':
        return '#6B7280';
      case 'cancelled':
        return '#EF4444';
      case 'in_progress':
        return '#F59E0B';
      default:
        return '#9CA3AF';
    }
  };

  const getStatusLabel = (status: AppointmentStatus) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    };
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!appointment) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Appointment not found</Text>
      </View>
    );
  }

  const dateTime = formatDateTime(appointment.scheduledAt);
  const isUpcoming = new Date(appointment.scheduledAt) > new Date();
  const canJoinCall = appointment.type === 'video' &&
    (appointment.status === 'scheduled' || appointment.status === 'confirmed') &&
    isUpcoming;

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appointment.status) }]}>
          <Text style={styles.statusText}>{getStatusLabel(appointment.status)}</Text>
        </View>
        <Text style={styles.appointmentType}>
          {appointment.type === 'video' ? 'Video Call' :
           appointment.type === 'in_person' ? 'In-Person Visit' : 'Async Message'}
        </Text>
      </View>

      {/* Provider Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Healthcare Provider</Text>
        <View style={styles.providerCard}>
          <Text style={styles.providerName}>{appointment.providerName}</Text>
          {appointment.providerSpecialty && (
            <Text style={styles.providerSpecialty}>{appointment.providerSpecialty}</Text>
          )}
          {appointment.providerClinicName && (
            <Text style={styles.providerClinic}>{appointment.providerClinicName}</Text>
          )}
          <View style={styles.providerContact}>
            {appointment.providerPhone && (
              <Text style={styles.contactText}>📞 {appointment.providerPhone}</Text>
            )}
            {appointment.providerEmail && (
              <Text style={styles.contactText}>✉️ {appointment.providerEmail}</Text>
            )}
          </View>
        </View>
      </View>

      {/* Appointment Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appointment Details</Text>
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{dateTime.date}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Time</Text>
            <Text style={styles.detailValue}>{dateTime.time}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Duration</Text>
            <Text style={styles.detailValue}>{appointment.duration} minutes</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Reason</Text>
            <Text style={styles.detailValue}>{appointment.reason}</Text>
          </View>
          {appointment.notes && (
            <View style={styles.notesRow}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{appointment.notes}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Health Summary */}
      {appointment.healthDataSnapshot && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Health Summary</Text>
          <TouchableOpacity style={styles.summaryCard} onPress={handleViewHealthSummary}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>30-Day Health Summary</Text>
              <Text style={styles.summaryArrow}>→</Text>
            </View>
            <Text style={styles.summaryText}>
              Includes blood pressure trends, medication adherence, and recent vital signs
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Actions */}
      {isUpcoming && appointment.status !== 'cancelled' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>

          {canJoinCall && (
            <TouchableOpacity style={styles.joinButton} onPress={handleJoinCall}>
              <Text style={styles.joinButtonText}>Join Video Call</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.rescheduleButton} onPress={handleReschedule}>
            <Text style={styles.rescheduleButtonText}>Reschedule Appointment</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cancelButton, cancelling && styles.cancelButtonDisabled]}
            onPress={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? (
              <ActivityIndicator color="#EF4444" />
            ) : (
              <Text style={styles.cancelButtonText}>Cancel Appointment</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Calendar Event Info */}
      {appointment.reminderSent && (
        <View style={styles.reminderCard}>
          <Text style={styles.reminderTitle}>📅 Calendar Reminder</Text>
          <Text style={styles.reminderText}>
            A calendar invitation has been sent to your email. You should receive a reminder 24 hours before the appointment.
          </Text>
        </View>
      )}

      {/* Consultation Notes (after appointment) */}
      {appointment.status === 'completed' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Consultation Notes</Text>
          <TouchableOpacity style={styles.notesCard}>
            <Text style={styles.notesCardTitle}>View Consultation Summary</Text>
            <Text style={styles.notesCardText}>
              See notes from your provider and any treatment plan updates
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  appointmentType: {
    fontSize: 14,
    color: '#6B7280',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  providerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  providerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  providerSpecialty: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  providerClinic: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  providerContact: {
    marginTop: 12,
    gap: 4,
  },
  contactText: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  notesRow: {
    marginTop: 8,
  },
  notesLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
  },
  summaryArrow: {
    fontSize: 18,
    color: '#3B82F6',
    fontWeight: '600',
  },
  summaryText: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  joinButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rescheduleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  rescheduleButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  cancelButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonDisabled: {
    opacity: 0.5,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#EF4444',
  },
  reminderCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  reminderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  reminderText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
  notesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  notesCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  notesCardText: {
    fontSize: 14,
    color: '#6B7280',
  },
});
