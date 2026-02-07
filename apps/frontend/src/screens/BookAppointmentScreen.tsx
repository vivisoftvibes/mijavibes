/**
 * Book Appointment Screen
 *
 * Allows users to book appointments with healthcare providers
 * SPEC-004: Telemedicine Integration Module
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, AppointmentType } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'TelemedicineBookAppointment'>;

interface TimeSlot {
  slotTime: string;
  slotEndTime: string;
  isAvailable: boolean;
}

interface HealthcareProvider {
  id: string;
  name: string;
  specialty?: string;
  clinicName?: string;
  consultationTypes: AppointmentType[];
  consultationFee?: {
    video?: number;
    inPerson?: number;
    async?: number;
  };
}

export const BookAppointmentScreen: React.FC<Props> = ({ route, navigation }) => {
  const { providerId } = route.params;
  const [provider, setProvider] = useState<HealthcareProvider | null>(null);
  const [selectedType, setSelectedType] = useState<AppointmentType>('video');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => {
    loadProvider();
  }, [providerId]);

  useEffect(() => {
    if (provider) {
      loadSlots();
    }
  }, [selectedDate, selectedType, provider]);

  const loadProvider = async () => {
    try {
      setLoading(true);
      // In real implementation, use API service
      // For now, use mock data
      setProvider({
        id: providerId,
        name: 'Dr. Maria Garcia',
        specialty: 'Cardiologist',
        clinicName: 'Heart Care Center',
        consultationTypes: ['video', 'in_person', 'async_message'],
        consultationFee: { video: 75, inPerson: 100, async: 50 },
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to load provider information');
    } finally {
      setLoading(false);
    }
  };

  const loadSlots = async () => {
    try {
      // In real implementation, use appointmentService.getAvailableSlots()
      // Generate mock slots for the selected date
      const mockSlots: TimeSlot[] = [
        { slotTime: '09:00', slotEndTime: '09:30', isAvailable: true },
        { slotTime: '09:30', slotEndTime: '10:00', isAvailable: true },
        { slotTime: '10:00', slotEndTime: '10:30', isAvailable: false },
        { slotTime: '10:30', slotEndTime: '11:00', isAvailable: true },
        { slotTime: '11:00', slotEndTime: '11:30', isAvailable: true },
        { slotTime: '14:00', slotEndTime: '14:30', isAvailable: true },
        { slotTime: '14:30', slotEndTime: '15:00', isAvailable: true },
        { slotTime: '15:00', slotEndTime: '15:30', isAvailable: false },
        { slotTime: '15:30', slotEndTime: '16:00', isAvailable: true },
        { slotTime: '16:00', slotEndTime: '16:30', isAvailable: true },
      ];
      setSlots(mockSlots);
    } catch (error) {
      console.error('Failed to load slots', error);
    }
  };

  const handleDateSelect = (daysOffset: number) => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + daysOffset);
    setSelectedDate(newDate);
    setSelectedSlot(null);
  };

  const handleBookAppointment = async () => {
    if (!selectedSlot) {
      Alert.alert('Error', 'Please select a time slot');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Error', 'Please provide a reason for the consultation');
      return;
    }

    try {
      setBooking(true);

      // Combine selected date and time
      const [hours, minutes] = selectedSlot.split(':');
      const scheduledAt = new Date(selectedDate);
      scheduledAt.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      // In real implementation:
      // const appointment = await appointmentService.createAppointment({
      //   providerId,
      //   type: selectedType,
      //   scheduledAt: scheduledAt.toISOString(),
      //   reason,
      //   notes,
      //   includeHealthSummary: true,
      // });

      Alert.alert(
        'Success',
        'Your appointment has been booked successfully. You will receive a confirmation shortly.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to book appointment. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  const getDatesForWeek = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  };

  const getFee = () => {
    if (!provider?.consultationFee) return null;
    switch (selectedType) {
      case 'video':
        return provider.consultationFee.video;
      case 'in_person':
        return provider.consultationFee.inPerson;
      case 'async_message':
        return provider.consultationFee.async;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!provider) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load provider information</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Appointment</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content}>
        {/* Provider Info */}
        <View style={styles.providerCard}>
          <Text style={styles.providerName}>{provider.name}</Text>
          {provider.specialty && (
            <Text style={styles.providerSpecialty}>{provider.specialty}</Text>
          )}
          {provider.clinicName && (
            <Text style={styles.clinicName}>{provider.clinicName}</Text>
          )}
        </View>

        {/* Consultation Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Consultation Type</Text>
          <View style={styles.typeContainer}>
            {provider.consultationTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeButton,
                  selectedType === type && styles.selectedTypeButton,
                ]}
                onPress={() => setSelectedType(type)}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    selectedType === type && styles.selectedTypeButtonText,
                  ]}
                >
                  {type === 'video'
                    ? 'Video Call'
                    : type === 'in_person'
                    ? 'In-Person'
                    : 'Async Message'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {getFee() !== null && (
            <Text style={styles.feeText}>Fee: ${getFee()}</Text>
          )}
        </View>

        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {getDatesForWeek().map((date, index) => {
              const isSelected = date.toDateString() === selectedDate.toDateString();
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.dateButton, isSelected && styles.selectedDateButton]}
                  onPress={() => setSelectedDate(date)}
                >
                  <Text
                    style={[styles.dateDay, isSelected && styles.selectedDateText]}
                  >
                    {formatDate(date)}
                  </Text>
                  <Text
                    style={[styles.dateNumber, isSelected && styles.selectedDateText]}
                  >
                    {date.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Time Slots */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Time</Text>
          <View style={styles.slotsContainer}>
            {slots.map((slot, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.slotButton,
                  !slot.isAvailable && styles.slotDisabled,
                  selectedSlot === slot.slotTime && styles.selectedSlot,
                ]}
                onPress={() => slot.isAvailable && setSelectedSlot(slot.slotTime)}
                disabled={!slot.isAvailable}
              >
                <Text
                  style={[
                    styles.slotText,
                    !slot.isAvailable && styles.slotDisabledText,
                    selectedSlot === slot.slotTime && styles.selectedSlotText,
                  ]}
                >
                  {formatTime(slot.slotTime)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Reason for Visit */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reason for Visit</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Describe why you need this consultation..."
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={3}
            maxLength={500}
          />
          <Text style={styles.charCount}>{reason.length}/500</Text>
        </View>

        {/* Additional Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Any additional information..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
            maxLength={1000}
          />
          <Text style={styles.charCount}>{notes.length}/1000</Text>
        </View>

        {/* Health Summary Notice */}
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Health Summary Included</Text>
          <Text style={styles.noticeText}>
            A summary of your vital signs, medications, and recent health trends will be
            shared with the provider before your consultation.
          </Text>
        </View>

        {/* Book Button */}
        <TouchableOpacity
          style={[styles.bookButton, (!selectedSlot || !reason.trim()) && styles.bookButtonDisabled]}
          onPress={handleBookAppointment}
          disabled={booking || !selectedSlot || !reason.trim()}
        >
          {booking ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.bookButtonText}>Book Appointment</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const formatTime = (time: string) => {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    fontSize: 16,
    color: '#3B82F6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  headerSpacer: {
    width: 50,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  providerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
  clinicName: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  typeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  selectedTypeButton: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  typeButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  selectedTypeButtonText: {
    color: '#FFFFFF',
  },
  feeText: {
    fontSize: 14,
    color: '#3B82F6',
    marginTop: 8,
    fontWeight: '500',
  },
  dateButton: {
    width: 70,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    marginRight: 8,
  },
  selectedDateButton: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  dateDay: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 4,
  },
  dateNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  selectedDateText: {
    color: '#FFFFFF',
  },
  slotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotButton: {
    width: '31%',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  slotDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  selectedSlot: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  slotText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1F2937',
  },
  slotDisabledText: {
    color: '#9CA3AF',
  },
  selectedSlotText: {
    color: '#FFFFFF',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  noticeCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 18,
  },
  bookButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  bookButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  bookButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
